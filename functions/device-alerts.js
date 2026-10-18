// ── Warranty and lease ends, for the daily alert email ──────────────────────
//
// The server twin of coverageEnding / coverageState in src/lib/assets.js: a
// device in the hardware register whose warranty or lease ends within 30 days,
// unless it is retired or lost. dailyAlerts (index.js) mails each one once at
// 30 days and once at 7, like a renewal, behind the device_alerts switch.
// functions/ deploys on its own and cannot import src/, so
// src/lib/device-alerts-parity.test.js runs both copies on the same devices.

const { THRESHOLDS, daysUntil, dueReminder } = require('./threshold-alerts.js');

/** Days ahead a warranty or lease end is mentioned: 30, then 7. */
const COVERAGE_THRESHOLDS = THRESHOLDS;
/** A device written off or missing needs no reminder (GONE in src/lib/assets.js). */
const GONE_STATUSES = ['retired', 'lost'];

/** Escape text written into the email's HTML: names and models are typed by people. */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * The devices to mention today. `sentKeys` is what earlier emails already said
 * (alert_state); keys for these alerts are added to `newKeys`. One line per
 * device per run, for the tightest threshold that applies.
 */
function deviceCoverageAlerts(assets, todayStr, sentKeys = {}, newKeys = {}) {
  const out = [];
  for (const a of Array.isArray(assets) ? assets : []) {
    if (!a || !a.coverage_end || GONE_STATUSES.includes(a.status)) continue;
    const end = String(a.coverage_end).slice(0, 10);
    if (end < todayStr) continue;
    const days = daysUntil(todayStr, end);
    // One line per device per run, for the tightest threshold that applies
    // (threshold-alerts.js).
    if (!dueReminder(`coverage_${a.id || a.serial || a.name}_${end}`, days, sentKeys, newKeys, todayStr)) continue;
    out.push({
      name: a.name || a.serial || 'Device',
      type: a.coverage_type === 'lease' ? 'lease' : a.coverage_type === 'warranty' ? 'warranty' : '',
      date: end,
      days,
      holder: a.assigned_name || a.assigned_email || '',
    });
  }
  return out.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
}

/** The words of one email line for a device: [title, detail], HTML-escaped. */
function deviceAlertLine(d) {
  const what = d.type === 'lease' ? 'Lease' : d.type === 'warranty' ? 'Warranty' : 'Warranty or lease';
  const holder = d.holder ? ` · held by ${escapeHtml(d.holder)}` : '';
  return [escapeHtml(d.name), `${what} ends ${d.date} (${d.days} day${d.days === 1 ? '' : 's'})${holder}`];
}

module.exports = { COVERAGE_THRESHOLDS, GONE_STATUSES, deviceCoverageAlerts, deviceAlertLine, escapeHtml };
