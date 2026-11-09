'use strict';

// ── Assignment reminders and escalation, for the daily email ───────────────
//
// The server twin of src/lib/lifecycle.js, held to it by
// src/lib/lifecycle-parity.test.js. What the email says:
//   ending    14 and 3 days before a person's end date, once each, naming the
//             manager who answers for it and what is still open
//   overdue   once, when an ended assignment has had something open for
//             ESCALATE_AFTER_DAYS (at once when nobody manages it): the
//             escalation to the account owner
//   expired   once, when temporary access passes its expiry date still held
// An item kept under a written exception (reason and end date) is not open
// until the exception ends. Nothing here changes anything.

const { dueReminder } = require('./threshold-alerts.js');

const REMIND_DAYS = [14, 3];
const ESCALATE_AFTER_DAYS = 7;
const SHOW_BEFORE_DAYS = 30;
const HELD = new Set(['active', 'pending_revocation']);
const DAY_MS = 86400000;

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').slice(0, 10));
const day = (s) => String(s || '').slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
const exceptionActive = (x, today) => !!(x && x.exception && isDate(x.exception.until) && day(x.exception.until) >= today);

/** What is still open for one person: held access and devices not under an exception. */
function openItems(data, emp, today) {
  const access = (Array.isArray(data.access) ? data.access : [])
    .filter((a) => a && a.employee_id === emp.id && HELD.has(a.status || 'active') && !exceptionActive(a, today));
  const devices = (Array.isArray(data.assets) ? data.assets : [])
    .filter((x) => x && x.assigned_to === emp.id && x.status === 'in_use' && !exceptionActive(x, today));
  return { access: access.length, devices: devices.length, open: access.length + devices.length };
}

function lifecycleAlerts(data, todayStr, sentKeys = {}, newKeys = {}) {
  const out = [];
  for (const emp of Array.isArray(data && data.employees) ? data.employees : []) {
    if (!emp || !isDate(emp.end_date) || emp.assignment_closed) continue;
    const end = day(emp.end_date);
    const days = daysBetween(todayStr, end);
    if (days > SHOW_BEFORE_DAYS) continue;
    const items = openItems(data, emp, todayStr);
    const base = `assign_${emp.id}_${end}`;
    const who = { name: emp.full_name || emp.email || '', manager: emp.manager_email || '', end_date: end, ...items };
    if (days >= 0) {
      if (items.open && dueReminder(base, days, sentKeys, newKeys, todayStr, REMIND_DAYS)) out.push({ kind: 'ending', days, ...who });
      continue;
    }
    if (!items.open) continue;
    if (-days >= ESCALATE_AFTER_DAYS || !emp.manager_email) {
      const key = `${base}_overdue`;
      if (sentKeys[key] || newKeys[key]) continue;
      newKeys[key] = todayStr;
      out.push({ kind: 'overdue', days: -days, ...who });
    }
  }
  const people = Object.fromEntries((Array.isArray(data && data.employees) ? data.employees : []).filter(Boolean).map((e) => [e.id, e]));
  for (const a of Array.isArray(data && data.access) ? data.access : []) {
    if (!a || !HELD.has(a.status || 'active') || !isDate(a.expires_on) || exceptionActive(a, todayStr)) continue;
    const exp = day(a.expires_on);
    if (exp >= todayStr) continue;
    const key = `accexp_${a.id}_${exp}`;
    if (sentKeys[key] || newKeys[key]) continue;
    newKeys[key] = todayStr;
    const emp = people[a.employee_id] || {};
    out.push({ kind: 'expired', name: emp.full_name || a.employee_name || a.employee_email || '', tool: a.tool_name || '', manager: emp.manager_email || '', expires_on: exp, days: daysBetween(exp, todayStr) });
  }
  return out;
}

module.exports = { REMIND_DAYS, ESCALATE_AFTER_DAYS, SHOW_BEFORE_DAYS, lifecycleAlerts, openItems };
