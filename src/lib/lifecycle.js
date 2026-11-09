// ── Assignments, from the first day to the last item handed back ───────────
//
// A contractor on a shoot, an intern, a fixed-term hire: each has an end date,
// a manager who answers for the assignment, access that may itself be
// temporary, and devices to give back. An assignment is finished only when
// every access and every device is accounted for: removed (lib/removals.js),
// returned (lib/assets.js), or kept under a written exception with a reason
// and an end date. Closing it is refused while anything is open.
//
//   person   worker_type (employee | contractor | intern | temporary),
//            manager_email (who answers for it), end_date, assignment_closed
//   access   expires_on (temporary access), exception { reason, until, by, at }
//   device   exception { reason, until, by, at } ("kept by agreement")
//
// Reminders go to the manager on screen and to the account owner by email
// (functions/lifecycle.js, the twin held by lifecycle-parity.test.js): 14 and
// 3 days before the end, then an escalation once an ended assignment has had
// something open for ESCALATE_AFTER_DAYS. An ended assignment with no manager
// escalates at once: nobody else is answering for it.

import { addDays, todayISOUtc } from './renewalNotice';
import { removalStage } from './removals';

export const WORKER_TYPES = ['employee', 'contractor', 'intern', 'temporary'];
export const REMIND_DAYS = [14, 3];
export const ESCALATE_AFTER_DAYS = 7;
export const SHOW_BEFORE_DAYS = 30;
export const EXPIRING_SOON_DAYS = 7;
export const MAX_EXCEPTION_DAYS = 365;
export const MIN_EXCEPTION_REASON = 3;
const HELD = new Set(['active', 'pending_revocation']);
const DAY_MS = 86400000;

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').slice(0, 10));
const day = (s) => String(s || '').slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
const iso = (at) => (at instanceof Date ? at : new Date(at || Date.now())).toISOString();

/** An exception still in force today. */
export const exceptionActive = (x, today = todayISOUtc()) => !!(x?.exception && isDate(x.exception.until) && day(x.exception.until) >= today);

/** A written exception: a reason and an end date, never open-ended. */
export function withException(item, { reason = '', until = '', by = '', at, today = todayISOUtc() } = {}) {
  const r = String(reason || '').trim().slice(0, 300);
  if (r.length < MIN_EXCEPTION_REASON) throw new Error('reason_required');
  if (!isDate(until) || day(until) < today) throw new Error('until_required');
  if (daysBetween(today, day(until)) > MAX_EXCEPTION_DAYS) throw new Error('until_too_far');
  return { ...item, exception: { reason: r, until: day(until), by, at: iso(at) } };
}

export function withoutException(item) {
  const { exception: _gone, ...rest } = item;
  return rest;
}

/** One access row's state within an assignment. */
function accessState(a, today) {
  if (exceptionActive(a, today)) return 'excepted';
  const stage = removalStage(a);
  if (stage === 'approved' || stage === 'requested') return 'removal_open';
  return 'to_remove';
}

const heldBy = (db, emp) => (db?.access || []).filter((a) => a && a.employee_id === emp.id && HELD.has(a.status || 'active'));
const devicesOf = (db, emp) => (db?.assets || []).filter((x) => x && x.assigned_to === emp.id && x.status === 'in_use');

/**
 * Every assignment that needs attention: ending within SHOW_BEFORE_DAYS, or
 * ended and not closed. Soonest first, escalated first among the ended.
 */
export function assignments(db, today = todayISOUtc()) {
  const out = [];
  for (const emp of Array.isArray(db?.employees) ? db.employees : []) {
    if (!emp || !isDate(emp.end_date) || emp.assignment_closed) continue;
    const end = day(emp.end_date);
    const daysToEnd = daysBetween(today, end);
    if (daysToEnd > SHOW_BEFORE_DAYS) continue;
    const access = heldBy(db, emp).map((a) => ({ id: a.id, tool: a.tool_name || '', state: accessState(a, today), exception: a.exception || null, row: a }));
    const devices = devicesOf(db, emp).map((x) => ({ id: x.id, name: x.name || x.serial || '', state: exceptionActive(x, today) ? 'excepted' : 'to_return', exception: x.exception || null, row: x }));
    const open = access.filter((i) => i.state !== 'excepted').length + devices.filter((i) => i.state !== 'excepted').length;
    let stage;
    if (daysToEnd > REMIND_DAYS[0]) stage = 'upcoming';
    else if (daysToEnd > REMIND_DAYS[1]) stage = 'remind';
    else if (daysToEnd >= 0) stage = 'ending';
    else if (open === 0) stage = 'ready_to_close';
    else if (-daysToEnd >= ESCALATE_AFTER_DAYS || !emp.manager_email) stage = 'overdue';
    else stage = 'ended';
    out.push({
      id: emp.id, name: emp.full_name || emp.email || '', email: emp.email || '',
      worker_type: WORKER_TYPES.includes(emp.worker_type) ? emp.worker_type : 'employee',
      manager: emp.manager_email || '', end_date: end, days_to_end: daysToEnd,
      access, devices, open, stage, escalated: stage === 'overdue',
    });
  }
  const rank = { overdue: 0, ended: 1, ready_to_close: 2, ending: 3, remind: 4, upcoming: 5 };
  return out.sort((a, b) => rank[a.stage] - rank[b.stage] || a.days_to_end - b.days_to_end);
}

/** Temporary access ending within EXPIRING_SOON_DAYS, or already past its date and still held. */
export function expiringAccess(db, today = todayISOUtc()) {
  const people = Object.fromEntries((db?.employees || []).map((e) => [e.id, e]));
  return (db?.access || [])
    .filter((a) => a && HELD.has(a.status || 'active') && isDate(a.expires_on) && !exceptionActive(a, today))
    .map((a) => ({
      id: a.id, tool: a.tool_name || '', person: people[a.employee_id]?.full_name || a.employee_name || a.employee_email || '',
      manager: people[a.employee_id]?.manager_email || '', expires_on: day(a.expires_on),
      days: daysBetween(today, day(a.expires_on)), removal_open: ['approved', 'requested'].includes(removalStage(a)), row: a,
    }))
    .filter((x) => x.days <= EXPIRING_SOON_DAYS)
    .sort((a, b) => a.days - b.days);
}

/** Closed only when nothing is open: every access removed or excepted, every device returned or excepted. */
export function closeAssignment(emp, db, { by = '', at, today = todayISOUtc() } = {}) {
  const a = assignments(db, today).find((x) => x.id === emp.id);
  if (!a) throw new Error('not_open');
  if (a.days_to_end >= 0) throw new Error('not_ended');
  if (a.open > 0) throw new Error('items_open');
  const excepted = [...a.access, ...a.devices].filter((i) => i.state === 'excepted').length;
  return { ...emp, assignment_closed: { by, at: iso(at), excepted } };
}

/** Next reminder or escalation date, for the screen: what the email will do. */
export function nextReminder(a) {
  if (a.stage === 'upcoming') return { kind: 'remind', on: addDays(a.end_date, -REMIND_DAYS[0]) };
  if (a.stage === 'remind') return { kind: 'remind', on: addDays(a.end_date, -REMIND_DAYS[1]) };
  if (a.stage === 'ending' || a.stage === 'ended') return { kind: 'escalate', on: addDays(a.end_date, ESCALATE_AFTER_DAYS) };
  return null;
}
