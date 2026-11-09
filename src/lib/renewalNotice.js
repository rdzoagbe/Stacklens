// ── The last day to cancel, not just the renewal date ──────────────────────
//
// The browser's copy of functions/renewal-notice.js (the daily email), held
// equal by renewal-notice-parity.test.js: the Renewals tab, the tool form and
// the dashboard must name the same dates the email does.
//
//   notice_deadline = renewal_date - notice_days         (last day to cancel)
//   decide_by       = notice_deadline - procurement lead (15 days by default
//                     when purchasing must approve)
//
// state: decided | no_auto_renew | unknown_notice | locked | act_now | soon | later

export const DEFAULT_PROCUREMENT_LEAD_DAYS = 15;
export const ACT_NOW_DAYS = 7;
export const SOON_DAYS = 30;
export const RENEWAL_DECISIONS = ['renew', 'cancel', 'renegotiate'];
/** The label of each decision, spelled out so the translation checks see every key. */
export const DECISION_LABEL_KEY = { renew: 'rn_renew', cancel: 'rn_cancel', renegotiate: 'rn_renegotiate' };

const DAY_MS = 86400000;
const daysUntil = (todayStr, endStr) => Math.round((Date.parse(`${endStr}T00:00:00Z`) - Date.parse(`${todayStr}T00:00:00Z`)) / DAY_MS);

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function wholeDays(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export const noticeDays = (tool) => wholeDays(tool?.notice_days);

export function procurementLead(tool) {
  if (tool?.procurement_required !== true) return 0;
  const n = wholeDays(tool.procurement_lead_days);
  return n === null ? DEFAULT_PROCUREMENT_LEAD_DAYS : n;
}

export function decisionFor(tool) {
  const d = tool?.renewal_decision;
  if (!d || !RENEWAL_DECISIONS.includes(d.choice)) return null;
  return String(d.renewal_date || '').slice(0, 10) === String(tool.renewal_date || '').slice(0, 10) ? d : null;
}

export const todayISOUtc = (now = new Date()) => now.toISOString().slice(0, 10);

export function noticeTimeline(tool, todayStr = todayISOUtc()) {
  if (!tool || !tool.renewal_date || tool.status === 'decommissioned') return null;
  const renewal = String(tool.renewal_date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(renewal) || renewal < todayStr) return null;
  // A contract that does not renew by itself has nothing to cancel: it keeps
  // the plain renewal reminder (state no_auto_renew).
  const manual = tool.auto_renew === false;
  const notice = manual ? null : noticeDays(tool);
  const lead = procurementLead(tool);
  const decision = decisionFor(tool);
  const deadline = notice === null ? null : addDays(renewal, -notice);
  const decideBy = deadline === null ? null : addDays(deadline, -lead);
  const daysToDeadline = deadline === null ? null : daysUntil(todayStr, deadline);
  const daysToDecide = decideBy === null ? null : daysUntil(todayStr, decideBy);
  let state;
  if (decision) state = 'decided';
  else if (manual) state = 'no_auto_renew';
  else if (notice === null) state = 'unknown_notice';
  else if (daysToDeadline < 0) state = 'locked';
  else if (daysToDecide <= ACT_NOW_DAYS) state = 'act_now';
  else if (daysToDecide <= SOON_DAYS) state = 'soon';
  else state = 'later';
  return {
    id: tool.id, name: tool.name, renewal_date: renewal, days_to_renewal: daysUntil(todayStr, renewal),
    notice_days: notice, notice_deadline: deadline, procurement_lead_days: lead, decide_by: decideBy,
    days_to_deadline: daysToDeadline, days_to_decide: daysToDecide, decision, state,
    auto_renew: tool.auto_renew !== false,
    owner: tool.contract_owner_email || tool.owner_email || '',
    annual: (Number(tool.cost_per_month) || 0) * 12,
  };
}

/** Every timeline in the workspace that needs a decision now: act_now and locked, soonest first. */
export function decisionsDue(db, todayStr = todayISOUtc()) {
  return (db?.tools || [])
    .map((t) => noticeTimeline(t, todayStr))
    .filter((tl) => tl && (tl.state === 'act_now' || tl.state === 'locked'))
    .sort((a, b) => (a.state === b.state ? (a.days_to_decide ?? 0) - (b.days_to_decide ?? 0) : a.state === 'locked' ? -1 : 1));
}

/** The tool with this cycle's decision recorded. Pure. */
export function withDecision(tool, { choice, by = '', note = '', at = new Date() }) {
  if (!RENEWAL_DECISIONS.includes(choice)) throw new Error(`unknown decision ${choice}`);
  return { ...tool, renewal_decision: { renewal_date: String(tool.renewal_date || '').slice(0, 10), choice, by, note: String(note || '').slice(0, 300), at: at.toISOString() } };
}

const UNKNOWN_WINDOW_DAYS = 90;
const DECIDED_WINDOW_DAYS = 90;

/** The Renewals panel's three lists: due (locked, act_now, soon), decided
 * within 90 days of renewal, and notice unknown within 90 days. */
export function noticeRows(tools, today = todayISOUtc()) {
  const all = (tools || []).map((tool) => noticeTimeline(tool, today)).filter(Boolean);
  const order = { locked: 0, act_now: 1, soon: 2 };
  return {
    due: all.filter((r) => r.state in order)
      .sort((a, b) => order[a.state] - order[b.state] || (a.days_to_decide ?? 0) - (b.days_to_decide ?? 0)),
    decided: all.filter((r) => r.state === 'decided' && r.days_to_renewal <= DECIDED_WINDOW_DAYS)
      .sort((a, b) => a.days_to_renewal - b.days_to_renewal),
    unknown: all.filter((r) => r.state === 'unknown_notice' && r.days_to_renewal <= UNKNOWN_WINDOW_DAYS),
  };
}
