// ── Reminders sent at 30 days, then at 7 ───────────────────────────────────
//
// Renewals (renewal-alerts.js) and warranty or lease ends (device-alerts.js)
// are mailed by dailyAlerts once per threshold. Both use this one rule: the
// tightest threshold that applies today is the one sent, and sending it also
// settles the looser ones. A date first seen 3 days out gets one email, not a
// 30-day one today and a 7-day one tomorrow; renewals used to do exactly that.

/** Days ahead a date is mentioned: 30, then 7. */
const THRESHOLDS = [30, 7];

const DAY_MS = 86400000;

/** Whole calendar days from today (YYYY-MM-DD) to a date (YYYY-MM-DD). */
function daysUntil(todayStr, endStr) {
  return Math.round((Date.parse(`${endStr}T00:00:00Z`) - Date.parse(`${todayStr}T00:00:00Z`)) / DAY_MS);
}

/**
 * Whether `idBase` is due a reminder `days` ahead. `sentKeys` is what earlier
 * emails already said (alert_state); when due, the keys for this threshold and
 * every looser one are added to `newKeys`, and true is returned.
 */
function dueReminder(idBase, days, sentKeys, newKeys, todayStr, thresholds = THRESHOLDS) {
  const applies = [...thresholds].sort((x, y) => x - y).find((t) => days <= t);
  if (applies === undefined) return false;
  const key = `${idBase}_${applies}`;
  if (sentKeys[key] || newKeys[key]) return false;
  for (const t of thresholds) if (t >= applies) newKeys[`${idBase}_${t}`] = todayStr;
  return true;
}

module.exports = { THRESHOLDS, daysUntil, dueReminder };
