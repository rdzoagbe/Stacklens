// ── The words and rows of the alert and digest emails ───────────────────────
//
// What dailyAlerts and weeklySummary (index.js) put into their HTML, kept here
// so a test can feed it hostile names. Each builder returns text that is
// already escaped; the caller only wraps it in markup. Device lines are built
// the same way in device-alerts.js.

const { escapeHtml } = require('./html-escape.js');

/** [title, detail] of a renewal line in the daily email. */
function renewalAlertLine(r, cur, fmt) {
  const annual = r.annual ? ` · ${cur}${fmt(r.annual)}/yr` : '';
  const owner = r.owner ? ` · owner ${escapeHtml(r.owner)}` : '';
  if (r.kind === 'notice') {
    const lead = r.procurement_lead_days ? `, after ${Number(r.procurement_lead_days)} days for purchasing approval` : '';
    // Purchasing's date already behind us, the last day to cancel not yet.
    const when = Number(r.days) < 0
      ? `purchasing's date (${escapeHtml(r.decide_by)}) has passed, ${Number(r.days_to_deadline)} days left`
      : `decide by ${escapeHtml(r.decide_by)} (${Number(r.days)} days)`;
    return [escapeHtml(r.name),
      `${when}: last day to cancel ${escapeHtml(r.notice_deadline)} (${Number(r.notice_days)} days' notice${lead}), renews ${escapeHtml(r.renewal_date)}${annual}${owner}`];
  }
  if (r.kind === 'locked') {
    return [escapeHtml(r.name),
      `the last day to cancel (${escapeHtml(r.notice_deadline)}) has passed with no decision recorded: it renews ${escapeHtml(r.renewal_date)}${annual}${owner}`];
  }
  return [escapeHtml(r.name), `renews ${escapeHtml(r.date)} (${Number(r.days)} days)${annual}`];
}

/** [title, detail] of a department budget line in the daily email. */
function budgetAlertLine(b, cur, fmt) {
  return [escapeHtml(b.department),
    `${Number(b.pct)}% of annual budget consumed (${cur}${fmt(b.spent)} of ${cur}${fmt(b.budget)})`];
}

/** [title, detail] of a former employee who still holds access, in the daily email. */
function securityAlertLine(s) {
  const n = Number(s.count);
  return [escapeHtml(s.name), `no longer active but still holds ${n} access grant${n > 1 ? 's' : ''}`];
}

/** One row of the weekly email's renewals table. `days` and `cost` are ours; the rest is escaped. */
function weeklyRenewalRow(t, days, cost, color) {
  const cell = 'padding:8px;border-bottom:1px solid #1e293b;font-size:13px';
  return `<tr>
        <td style="${cell};color:#e2e8f0">${escapeHtml(t.name)}</td>
        <td style="${cell};color:#94a3b8">${escapeHtml(t.renewal_date)}</td>
        <td style="${cell};color:${color};font-weight:700">${Number(days)}d</td>
        <td style="${cell};color:#e2e8f0">${escapeHtml(cost)}</td>
      </tr>`;
}

/** The AI-written insight paragraph. It is built from the customer's data, so it is text, never markup. */
function insightHtml(insight) {
  return escapeHtml(insight);
}

module.exports = { renewalAlertLine, budgetAlertLine, securityAlertLine, weeklyRenewalRow, insightHtml };
