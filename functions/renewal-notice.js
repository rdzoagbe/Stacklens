'use strict';

// ── The last day to cancel, not just the renewal date ──────────────────────
//
// A contract that renews on 1 March with 60 days' notice has to be cancelled
// by 31 December; an alert "renews in 30 days" on 30 January arrives a month
// too late to do anything but pay. So for each tool with a renewal date:
//
//   notice_deadline = renewal_date - notice_days        (last day to cancel)
//   decide_by       = notice_deadline - procurement lead (when purchasing
//                     must approve the decision first; 15 days by default)
//
// and the daily email is sent at 30 and 7 days before decide_by, with the
// same once-per-threshold rule as renewals (threshold-alerts.js). A decision
// recorded for this renewal cycle (tool.renewal_decision with the same
// renewal_date) stops the reminders. A tool whose notice period is not
// recorded keeps the old renewal-date reminder, and the screens say why.
//
// src/lib/renewalNotice.js is the browser's copy of these rules;
// src/lib/renewal-notice-parity.test.js runs both on the same tools.

const { daysUntil, dueReminder } = require('./threshold-alerts.js');

const DEFAULT_PROCUREMENT_LEAD_DAYS = 15;
const ACT_NOW_DAYS = 7;
const SOON_DAYS = 30;
const RENEWAL_DECISIONS = ['renew', 'cancel', 'renegotiate'];

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days, 0 or more, or null when nothing usable was recorded. */
function wholeDays(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

const noticeDays = (tool) => wholeDays(tool && tool.notice_days);

function procurementLead(tool) {
  if (!tool || tool.procurement_required !== true) return 0;
  const n = wholeDays(tool.procurement_lead_days);
  return n === null ? DEFAULT_PROCUREMENT_LEAD_DAYS : n;
}

/** The decision recorded for this renewal cycle, or null. */
function decisionFor(tool) {
  const d = tool && tool.renewal_decision;
  if (!d || !RENEWAL_DECISIONS.includes(d.choice)) return null;
  return String(d.renewal_date || '').slice(0, 10) === String(tool.renewal_date || '').slice(0, 10) ? d : null;
}

/**
 * The timeline of one tool's next renewal, or null when there is none to act
 * on (no date, a date already past, a decommissioned tool).
 * state: decided | no_auto_renew | unknown_notice | locked | act_now | soon | later
 */
function noticeTimeline(tool, todayStr) {
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

/**
 * The notice reminders to mail today: 30 and 7 days before the decision is
 * due, once each, and once when the last day to cancel has passed with no
 * decision (the contract will renew).
 */
function noticeAlerts(tools, todayStr, sentKeys = {}, newKeys = {}) {
  const out = [];
  for (const t of Array.isArray(tools) ? tools : []) {
    const tl = noticeTimeline(t, todayStr);
    if (!tl || tl.notice_days === null || tl.decision) continue;
    const base = `notice_${t.id || t.name}_${tl.notice_deadline}`;
    if (tl.state === 'locked') {
      const key = `${base}_locked`;
      if (sentKeys[key] || newKeys[key]) continue;
      newKeys[key] = todayStr;
      out.push({ ...tl, kind: 'locked', date: tl.renewal_date, days: tl.days_to_renewal });
      continue;
    }
    if (!dueReminder(base, tl.days_to_decide, sentKeys, newKeys, todayStr)) continue;
    out.push({ ...tl, kind: 'notice', date: tl.decide_by, days: tl.days_to_decide });
  }
  return out;
}

/** Tools the renewal-date reminder still covers: no notice period, no decision. */
const coveredByRenewalReminder = (tool, todayStr) => {
  const tl = noticeTimeline(tool, todayStr);
  return !tl || (tl.notice_days === null && !tl.decision);
};

module.exports = {
  DEFAULT_PROCUREMENT_LEAD_DAYS, ACT_NOW_DAYS, SOON_DAYS, RENEWAL_DECISIONS,
  addDays, noticeDays, procurementLead, decisionFor, noticeTimeline, noticeAlerts, coveredByRenewalReminder,
};
