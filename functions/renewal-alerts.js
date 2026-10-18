// ── Renewals, for the daily alert email ────────────────────────────────────
//
// A tool whose renewal date is within 30 days is mailed once at 30 days and
// once at 7, behind the renewal_alerts switch (dailyAlerts in index.js). The
// keys (`renewal_<id>_<date>_<threshold>`) are the ones earlier emails stored,
// so what was already sent stays sent.

const { daysUntil, dueReminder } = require('./threshold-alerts.js');

/** The renewals to mention today, one line per tool. */
function renewalAlerts(tools, todayStr, sentKeys = {}, newKeys = {}) {
  const out = [];
  for (const t of Array.isArray(tools) ? tools : []) {
    if (!t || !t.renewal_date) continue;
    const date = String(t.renewal_date).slice(0, 10);
    if (date < todayStr) continue;
    const days = daysUntil(todayStr, date);
    if (!dueReminder(`renewal_${t.id || t.name}_${t.renewal_date}`, days, sentKeys, newKeys, todayStr)) continue;
    out.push({ name: t.name, date, days, annual: (Number(t.cost_per_month) || 0) * 12 });
  }
  return out;
}

module.exports = { renewalAlerts };
