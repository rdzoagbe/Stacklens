// ── Sending the audit log to the server's tamper-evident copy ──────────────
//
// db.audit_log lives in the workspace, which its owner can edit. Every row
// added in this browser is also sent to the workspace function, which appends
// it to /audit_chains (functions/audit-chain.js): rows chained by hash, with
// the actor and the time taken from the server, in a collection no browser
// may write. Settings → Data verifies that copy.
//
// Called from saveDb, the one funnel every local save goes through, so no
// path that writes a log row (a form, an import, an access review, Clear
// data) can forget to report it. Only rows created since this page loaded
// are sent: older ones arrived from the cloud and were reported where they
// were made. The action and the detail travel; the browser's own name for the
// actor and its clock do not.
//
// Best effort, said plainly in the copy: a row made offline, or in a tab
// closed before the batch left, stays in the workspace log but may be missing
// from the server copy.

export const AUDIT_SYNC_DELAY_MS = 8000;
const BATCH = 50; // the server's MAX_EVENTS_PER_CALL

const loadedAt = Date.now();
const sent = new Set();
let queue = []; // { target, action, details }
let timer = null;
let sender = null;

/** The function that posts a batch: (ownerUid|null, events, opts) => Promise. Injected for tests. */
export function setAuditSender(fn) { sender = fn; }

/** Where this workspace's rows go: the owner's id when editing someone else's, else null (one's own). */
function targetOf(db) {
  return db?._shared_view?.owner_uid || null;
}

/** Queue the rows this browser added since load. Never throws. */
export function noteAuditLog(db) {
  try {
    if (!db || !db.user?.is_authenticated || db.user?.is_demo) return;
    // A viewer writes nothing, so it has nothing to report.
    if (db._shared_view && db._shared_view.role !== 'editor') return;
    const target = targetOf(db);
    const fresh = [];
    for (const e of Array.isArray(db.audit_log) ? db.audit_log : []) {
      // The log is newest first: once a row predates this page, the rest do.
      if (Date.parse(e?.timestamp) < loadedAt) break;
      if (!e?.id || sent.has(e.id)) continue;
      sent.add(e.id);
      fresh.push({ target, action: e.action, details: e.details });
    }
    // Oldest first, so the server chains them in the order they happened.
    queue.push(...fresh.reverse());
    if (queue.length && !timer) timer = setTimeout(() => { timer = null; flushAudit(); }, AUDIT_SYNC_DELAY_MS);
  } catch { /* the trail is worth having, never worth breaking a save for */ }
}

/** Send what is queued, oldest first, grouped by workspace. */
export async function flushAudit({ keepalive = false } = {}) {
  if (!sender || !queue.length) return 0;
  const pending = queue;
  queue = [];
  const byTarget = new Map();
  for (const e of pending) {
    const k = e.target || '';
    if (!byTarget.has(k)) byTarget.set(k, []);
    byTarget.get(k).push({ action: e.action, details: e.details });
  }
  let n = 0;
  for (const [target, events] of byTarget) {
    for (let i = 0; i < events.length; i += BATCH) {
      try { await sender(target || null, events.slice(i, i + BATCH), { keepalive }); n += Math.min(BATCH, events.length - i); }
      catch { /* best effort: the workspace log still has the row */ }
    }
  }
  return n;
}

// A tab closing sends what it holds rather than dropping it.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { flushAudit({ keepalive: true }); });
}

/** Tests only. */
export function _resetAuditSync() { queue = []; sent.clear(); clearTimeout(timer); timer = null; }
