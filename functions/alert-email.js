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
