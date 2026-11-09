// ── Access removal, said as it is ──────────────────────────────────────────
//
// Clicking "Revoke" in Stacklens used to set the access row to 'revoked' at
// once, although nothing had been removed in the tool: the record said the
// person was out while they could still sign in. A removal now goes through
// four recorded steps, each with who and when:
//
//   approved   someone decided the access goes (a click, a signed review,
//              an offboarding). Still held: status 'pending_revocation'.
//   requested  the tool's admin or IT was asked (to whom, ticket reference).
//              Still held.
//   completed  the access was removed in the tool. Either by hand in the
//              vendor's console (method 'manual', evidence required: what was
//              done, a ticket or screenshot reference), or by Stacklens
//              through the vendor's API (method 'vendor': today only blocking
//              a Microsoft 365 sign-in). Status 'revoked'.
//   verified   a later check confirmed it: a connector read showing the
//              person no longer there (method 'connector'), or a person who
//              looked (method 'manual', evidence required).
//
// A row revoked before this existed has no record of how; it reads as
// completed with method 'unrecorded' and stays in the unverified list rather
// than being presented as proven. Nothing here contacts a vendor.

import { csvText } from './csvSafe';

export const REMOVAL_STAGES = ['approved', 'requested', 'completed', 'verified'];
export const APPROVAL_SOURCES = ['manual', 'review', 'offboarding', 'eligibility', 'dashboard'];
export const COMPLETION_METHODS = ['manual', 'vendor', 'connector'];
export const VERIFICATION_METHODS = ['manual', 'connector'];
export const MIN_EVIDENCE = 3;
const OPEN = new Set(['approved', 'requested']);

const iso = (at) => (at instanceof Date ? at : new Date(at || Date.now())).toISOString();
const clean = (s, n = 300) => String(s ?? '').trim().slice(0, n);

function needEvidence(evidence) {
  const e = clean(evidence, 500);
  if (e.length < MIN_EVIDENCE) throw new Error('evidence_required');
  return e;
}

/** The removal record of an access row, with older rows read as they were left. */
export function removalOf(a) {
  if (!a) return null;
  const r = a.removal;
  if (r && REMOVAL_STAGES.includes(r.stage)) return r;
  if (a.status === 'revoked') return { stage: 'completed', legacy: true, completed: { by: '', at: a.revoked_at || null, method: 'unrecorded', evidence: '' } };
  if (a.status === 'pending_revocation') return { stage: 'approved', legacy: true, approved: { by: '', at: null, source: 'manual' } };
  return null;
}

export const removalStage = (a) => removalOf(a)?.stage || null;
export const isRemovalOpen = (a) => OPEN.has(removalStage(a));

/** Decide the access goes. Still held until someone removes it in the tool. */
export function approveRemoval(a, { by = '', at, source = 'manual' } = {}) {
  const stage = removalStage(a);
  if (stage === 'completed' || stage === 'verified' || OPEN.has(stage) && a.removal) return a;
  return {
    ...a,
    status: 'pending_revocation',
    removal: { stage: 'approved', approved: { by, at: iso(at), source: APPROVAL_SOURCES.includes(source) ? source : 'manual' } },
  };
}

/** The tool's admin or IT was asked. */
export function requestRemoval(a, { by = '', at, to = '', reference = '' } = {}) {
  const r = removalOf(a);
  if (!r || !OPEN.has(r.stage)) throw new Error('not_open');
  return {
    ...a,
    status: 'pending_revocation',
    removal: { ...r, legacy: undefined, stage: 'requested', requested: { by, at: iso(at), to: clean(to, 120), reference: clean(reference, 120) } },
  };
}

/** The access was removed in the tool. Evidence is what was done, or the vendor's answer. */
export function completeRemoval(a, { by = '', at, method = 'manual', evidence = '' } = {}) {
  if (!COMPLETION_METHODS.includes(method)) throw new Error('unknown_method');
  const r = removalOf(a) || { approved: { by, at: iso(at), source: 'manual' } };
  if (r.stage === 'completed' && !r.legacy || r.stage === 'verified') return a;
  return {
    ...a,
    status: 'revoked',
    revoked_at: iso(at),
    removal: { ...r, legacy: undefined, stage: 'completed', completed: { by, at: iso(at), method, evidence: needEvidence(evidence) } },
  };
}

/**
 * A check confirmed the person no longer has it. A connector read that finds
 * them absent also completes a removal nobody had marked done.
 */
export function verifyRemoval(a, { by = '', at, method = 'manual', evidence = '' } = {}) {
  if (!VERIFICATION_METHODS.includes(method)) throw new Error('unknown_method');
  const ev = needEvidence(evidence);
  let row = a;
  if (removalStage(row) !== 'completed') {
    if (method !== 'connector') throw new Error('not_completed');
    row = completeRemoval(row, { by, at, method: 'connector', evidence: ev });
  }
  const r = removalOf(row);
  if (r.stage === 'verified') return row;
  return { ...row, removal: { ...r, stage: 'verified', verified: { by, at: iso(at), method, evidence: ev } } };
}

/** Take back an approval that has not been carried out: the access stays. */
export function cancelRemoval(a) {
  if (!isRemovalOpen(a)) throw new Error('not_open');
  const { removal: _gone, ...rest } = a;
  return { ...rest, status: 'active' };
}

const DAY_MS = 86400000;
const ageDays = (at, now) => (at ? Math.max(0, Math.floor((now - Date.parse(at)) / DAY_MS)) : null);

/**
 * The Removals view: what is still to do in the tool, what was removed but
 * not verified (older rows included), and what is verified, newest first.
 */
export function removalQueue(db, now = Date.now()) {
  const people = Object.fromEntries((db?.employees || []).map((e) => [e.id, e]));
  const tools = Object.fromEntries((db?.tools || []).map((t) => [t.id, t]));
  const out = { open: [], unverified: [], verified: [] };
  for (const a of db?.access || []) {
    const r = removalOf(a);
    if (!r) continue;
    const emp = people[a.employee_id];
    const row = {
      id: a.id, access: a, removal: r, stage: r.stage,
      person: emp?.full_name || a.employee_name || a.employee_email || '',
      email: emp?.email || a.employee_email || '',
      tool: tools[a.tool_id]?.name || a.tool_name || '',
      since: r.stage === 'verified' ? r.verified?.at : r.stage === 'completed' ? r.completed?.at : (r.requested?.at || r.approved?.at) || null,
    };
    row.age_days = ageDays(row.since, now);
    if (OPEN.has(r.stage)) out.open.push(row);
    else if (r.stage === 'completed') out.unverified.push(row);
    else out.verified.push(row);
  }
  const oldestFirst = (x, y) => (x.since || '').localeCompare(y.since || '');
  out.open.sort(oldestFirst);
  out.unverified.sort(oldestFirst);
  out.verified.sort((x, y) => (y.since || '').localeCompare(x.since || ''));
  return out;
}

/** Microsoft's own tools: the rows a Microsoft 365 sign-in block actually closes. */
export const isMicrosoftTool = (name) => /\b(microsoft|office ?365|m365|outlook|teams|sharepoint|onedrive|entra)\b/i.test(String(name || ''));

export const REMOVAL_CSV_COLUMNS = [
  'person', 'email', 'tool', 'stage',
  'approved_by', 'approved_at', 'approved_from',
  'requested_by', 'requested_at', 'requested_to', 'reference',
  'removed_by', 'removed_at', 'removed_how', 'removal_evidence',
  'verified_by', 'verified_at', 'verified_how', 'verification_evidence',
];

/** Every removal with its trail: who, when, how and on what evidence. Spreadsheet-safe. */
export function removalsCsv(db, { sep = ',' } = {}) {
  const q = removalQueue(db);
  const esc = (v) => {
    const s = csvText(v ?? '');
    return s.includes('"') || s.includes('\n') || s.includes(sep) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const rows = [...q.open, ...q.unverified, ...q.verified].map(({ person, email, tool, removal: r }) => [
    person, email, tool, r.stage,
    r.approved?.by, r.approved?.at, r.approved?.source,
    r.requested?.by, r.requested?.at, r.requested?.to, r.requested?.reference,
    r.completed?.by, r.completed?.at, r.completed?.method, r.completed?.evidence,
    r.verified?.by, r.verified?.at, r.verified?.method, r.verified?.evidence,
  ].map(esc).join(sep));
  return [REMOVAL_CSV_COLUMNS.join(sep), ...rows].join('\n') + '\n';
}
