// ── A tamper-evident audit trail ───────────────────────────────────────────
//
// The audit log in the workspace (db.audit_log) is written by the browser and
// stored in /userdata, which its owner may write freely: anyone with the
// account could edit or delete a row, and nothing would show it. An auditor
// cannot rely on that.
//
// This is the server's copy. Each event is stored in
// /audit_chains/{workspaceId}/events/{seq}, which firestore.rules closes to
// every client (read and write), so only this code writes it. Each row
// carries the hash of the row before it:
//
//   hash = SHA-256(prev_hash | seq | at | actor | action | details)
//
// so changing, removing or reordering any row breaks every hash after it, and
// verifyChain says where. The actor and the time come from the server (the
// verified token and the server clock), never from the browser.
//
// What it does not do, said plainly: the browser still decides which of its
// own edits to report, and whoever operates the database could rewrite the
// whole chain from the first row. It proves the trail was not altered after
// it was written, not that every action was written. The actions the server
// performs itself (sharing, roles, client workspaces) are recorded here by the
// server, with certainty.

const { createHash } = require('node:crypto');

/** The head document holds the count and the last hash; rows live under it. */
const CHAIN_COLLECTION = 'audit_chains';
const EVENTS_SUBCOLLECTION = 'events';

/** The hash before the first row. */
const GENESIS = '0'.repeat(64);

/** At most this many events in one request, and this long a detail. */
const MAX_EVENTS_PER_CALL = 50;
const MAX_DETAILS = 500;
const ACTION_RE = /^[a-z][a-z0-9_.-]{0,63}$/;

/** Rows are stored under a zero-padded sequence, so ids sort in order. */
const seqId = (seq) => String(seq).padStart(12, '0');

/** The exact bytes a row's hash covers, in a fixed order. */
function canonical({ prev_hash, seq, at, actor, action, details }) {
  return [prev_hash, seq, at, actor, action, details].map((v) => String(v)).join('|');
}

function hashRow(row) {
  return createHash('sha256').update(canonical(row), 'utf8').digest('hex');
}

/**
 * The events a client may send: an action name and a detail, nothing else.
 * Anything malformed is dropped rather than refused, so one odd row cannot
 * cost the others; the caller learns how many were kept.
 */
function cleanEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.slice(0, MAX_EVENTS_PER_CALL)
    .filter((e) => e && typeof e === 'object' && ACTION_RE.test(String(e.action || '')))
    .map((e) => ({
      action: String(e.action),
      details: String(e.details == null ? '' : e.details).slice(0, MAX_DETAILS),
    }));
}

/**
 * The rows to append after `head`, each chained to the one before.
 * Pure: `head` is { count, head_hash } (or null for a new chain).
 */
function chainRows(head, events, { actor, at }) {
  let prev = (head && head.head_hash) || GENESIS;
  let seq = (head && Number(head.count)) || 0;
  const rows = [];
  for (const e of events) {
    seq += 1;
    const row = {
      seq,
      at,
      actor: String(actor || 'unknown'),
      action: e.action,
      details: e.details,
      prev_hash: prev,
    };
    row.hash = hashRow(row);
    rows.push(row);
    prev = row.hash;
  }
  return { rows, head: { count: seq, head_hash: prev } };
}

/**
 * Check a chain read back in sequence order.
 * Returns { ok, count, broken_at } where broken_at is the first sequence
 * number whose row does not follow from the one before (null when intact).
 */
function verifyChain(rows, head) {
  let prev = GENESIS;
  let expected = 1;
  for (const row of rows) {
    if (Number(row.seq) !== expected || row.prev_hash !== prev || hashRow(row) !== row.hash) {
      return { ok: false, count: rows.length, broken_at: expected };
    }
    prev = row.hash;
    expected += 1;
  }
  // The head is written in the same transaction as the rows: a row removed
  // from the end leaves the head pointing past it.
  if (head && (Number(head.count) !== rows.length || (rows.length && head.head_hash !== prev))) {
    return { ok: false, count: rows.length, broken_at: rows.length + 1 };
  }
  return { ok: true, count: rows.length, broken_at: null };
}

/**
 * Append events to one workspace's chain, in a transaction so two writers
 * cannot both take the same sequence number. `actor` comes from the verified
 * token. Returns the new count and head hash.
 */
async function appendToChain(db, workspaceId, events, actor, now = new Date()) {
  const clean = cleanEvents(events);
  if (!clean.length) return { appended: 0 };
  const headRef = db.collection(CHAIN_COLLECTION).doc(workspaceId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(headRef);
    const { rows, head } = chainRows(snap.exists ? snap.data() : null, clean, { actor, at: now.toISOString() });
    for (const row of rows) tx.set(headRef.collection(EVENTS_SUBCOLLECTION).doc(seqId(row.seq)), row);
    tx.set(headRef, { ...head, updated_at: now.toISOString() });
    return { appended: rows.length, count: head.count, head_hash: head.head_hash };
  });
}

/** Read a chain back in order and check it. */
async function readChain(db, workspaceId, limit = 20000) {
  const headRef = db.collection(CHAIN_COLLECTION).doc(workspaceId);
  const [headSnap, rowsSnap] = await Promise.all([
    headRef.get(),
    headRef.collection(EVENTS_SUBCOLLECTION).orderBy('seq').limit(limit).get(),
  ]);
  const rows = rowsSnap.docs.map((d) => d.data());
  const head = headSnap.exists ? headSnap.data() : null;
  // Past the read limit the head cannot be compared with what was read.
  const truncated = rows.length >= limit;
  return { rows, head, truncated, check: verifyChain(rows, truncated ? null : head) };
}

module.exports = {
  CHAIN_COLLECTION,
  EVENTS_SUBCOLLECTION,
  GENESIS,
  MAX_EVENTS_PER_CALL,
  MAX_DETAILS,
  cleanEvents,
  chainRows,
  hashRow,
  verifyChain,
  appendToChain,
  readChain,
};
