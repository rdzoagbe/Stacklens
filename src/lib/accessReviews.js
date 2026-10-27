// ── Access reviews: a campaign, decisions, and a sign-off ──────────────────
//
// "Who still needs this?" is the control an auditor asks for, and until now
// Stacklens could only mark one access row reviewed at a time, with no record
// of who looked and what they decided. A review takes a snapshot of the live
// access rows in scope (everyone, one tool, or one department), the reviewer
// answers keep or revoke for each, and signs off with their name. Signing off
// is the moment anything changes: kept rows get today's last_reviewed_date,
// revoked rows are revoked, and the review becomes evidence (a printed report
// or a CSV) with the reviewer's name, the dates and every decision.
//
// Reviews live in db.access_reviews. A teammate in a shared workspace may
// write that key (MEMBER_WRITABLE_KEYS in functions/workspace-write.js), as
// they may write access, so reviews are not an owner-only job.

import { uid } from './db';
import { computeAccessDerivedRiskFlag } from './dataUtils';
import { norm } from './eligibility';
import { csvText } from './csvSafe';

export const REVIEW_SCOPES = ['all', 'tool', 'department'];
export const DECISIONS = ['keep', 'revoke'];
const HELD = new Set(['active', 'pending_revocation']);

/** The live access rows a scope covers, with their person and tool. */
export function rowsInScope(db, scope, target) {
  const employees = db?.employees || [];
  const tools = db?.tools || [];
  const byId = Object.fromEntries(employees.map((e) => [e.id, e]));
  const toolsById = Object.fromEntries(tools.map((t) => [t.id, t]));
  return (db?.access || [])
    .filter((a) => HELD.has(a.status || 'active'))
    .map((a) => ({ a, emp: byId[a.employee_id], tool: toolsById[a.tool_id] }))
    .filter(({ a, emp, tool }) => {
      if (scope === 'tool') return a.tool_id === target;
      if (scope === 'department') return norm(emp?.department) === norm(target);
      return true;
    })
    .map(({ a, emp, tool }) => ({
      access_id: a.id,
      employee_id: a.employee_id || '',
      employee_name: emp?.full_name || a.employee_name || '',
      employee_email: emp?.email || a.employee_email || '',
      department: emp?.department || '',
      employee_status: emp?.status || '',
      tool_id: a.tool_id || '',
      tool_name: tool?.name || a.tool_name || '',
      access_level: a.access_level || '',
      granted_date: a.granted_date || '',
      last_reviewed_date: a.last_reviewed_date || '',
      risk: computeAccessDerivedRiskFlag(a, byId, toolsById),
      decision: null,
      decided_at: '',
    }));
}

/** A label for the scope, shown on the review and in the report. */
export function scopeLabel(db, scope, target) {
  if (scope === 'tool') return (db?.tools || []).find((t) => t.id === target)?.name || target || '';
  if (scope === 'department') return target || '';
  return '';
}

/** A new review: the snapshot, nothing decided yet. */
export function startReview(db, { scope = 'all', target = '', by = '', now = new Date() } = {}) {
  if (!REVIEW_SCOPES.includes(scope)) throw new Error(`unknown scope ${scope}`);
  return {
    id: uid('rev'),
    scope, target: scope === 'all' ? '' : target,
    label: scopeLabel(db, scope, target),
    started_at: now.toISOString(),
    started_by: by,
    rows: rowsInScope(db, scope, target),
    signed_off: null,
  };
}

/** The review with one row decided (or undecided again with null). */
export function decide(review, accessId, decision, now = new Date()) {
  if (decision != null && !DECISIONS.includes(decision)) throw new Error(`unknown decision ${decision}`);
  return {
    ...review,
    rows: review.rows.map((r) => (r.access_id === accessId
      ? { ...r, decision, decided_at: decision ? now.toISOString() : '' }
      : r)),
  };
}

/** Every undecided row decided the same way, in one go. */
export function decideRemaining(review, decision, now = new Date()) {
  return { ...review, rows: review.rows.map((r) => (r.decision ? r : { ...r, decision, decided_at: now.toISOString() })) };
}

export function summary(review) {
  const rows = review?.rows || [];
  const keep = rows.filter((r) => r.decision === 'keep').length;
  const revoke = rows.filter((r) => r.decision === 'revoke').length;
  return { total: rows.length, keep, revoke, undecided: rows.length - keep - revoke };
}

export const canSignOff = (review) => !review?.signed_off && (review?.rows || []).length > 0 && summary(review).undecided === 0;

/**
 * Signs the review and applies it to the access rows: kept ones carry today's
 * review date, revoked ones are revoked. Returns { db, review }. A review
 * already signed, or with a row undecided, is left alone.
 */
export function signOff(db, review, { name = '', by = '', now = new Date() } = {}) {
  if (!canSignOff(review)) return { db, review, applied: false };
  const signed = { ...review, signed_off: { name: String(name || '').trim() || String(by || ''), by, at: now.toISOString() } };
  const byAccess = new Map(signed.rows.map((r) => [r.access_id, r.decision]));
  const today = now.toISOString().slice(0, 10);
  const access = (db.access || []).map((a) => {
    const d = byAccess.get(a.id);
    if (d === 'keep') return { ...a, last_reviewed_date: today, risk_flag: a.risk_flag === 'needs_review' ? 'none' : a.risk_flag };
    if (d === 'revoke') return { ...a, status: 'revoked', last_reviewed_date: today };
    return a;
  });
  const reviews = (db.access_reviews || []).map((r) => (r.id === review.id ? signed : r));
  return { db: { ...db, access, access_reviews: reviews }, review: signed, applied: true };
}

/** The review as a CSV: one line per access row, with the decision and who signed. */
export function reviewCsv(review, { sep = ',', headers } = {}) {
  const cols = headers || ['person', 'email', 'department', 'tool', 'level', 'granted', 'previously_reviewed', 'risk', 'decision', 'decided_at', 'signed_by', 'signed_at'];
  const esc = (v) => {
    const s = csvText(v);
    return s.includes('"') || s.includes('\n') || s.includes(sep) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const signed = review.signed_off || {};
  const lines = (review.rows || []).map((r) => [
    r.employee_name, r.employee_email, r.department, r.tool_name, r.access_level, r.granted_date, r.last_reviewed_date,
    r.risk, r.decision || '', r.decided_at ? r.decided_at.slice(0, 10) : '', signed.name || '', signed.at ? signed.at.slice(0, 10) : '',
  ].map(esc).join(sep));
  return [cols.join(sep), ...lines].join('\n') + '\n';
}

/** Open reviews first, newest first within each. */
export function sortReviews(reviews) {
  return [...(reviews || [])].sort((a, b) => {
    if (!!a.signed_off !== !!b.signed_off) return a.signed_off ? 1 : -1;
    return String(b.started_at).localeCompare(String(a.started_at));
  });
}
