// ── Joiners and movers: the licence to-dos a directory change creates ──────
//
// Every write to the workspace goes through setDb (hooks/useDbQuery.js), and
// it compares the people before and after. A new person is a joiner, someone
// whose department or job title changed is a mover, and the change is kept on
// the person (`employee.people_change`). It lives there, not in a list of its
// own, because a teammate editing a shared or client workspace may only save
// people, tools and access (MEMBER_WRITABLE_KEYS in functions/workspace-write.js).
//
// What each change asks for is not stored: it is read from the eligibility
// rules (lib/eligibility.js) every time, so a rule edited later, or a licence
// marked as granted, updates the to-do at once.
//
// Not every new row is an arrival. A first import, or any single write adding
// more than BULK_LIMIT people, is a directory being loaded, not people joining:
// only those whose start date is recent are counted. Filling in a department
// that was empty is data being completed, not a move. Leavers are not here:
// the Offboarding page already owns them.

import { isEligible, cleanRule, jobTitleOf, norm } from './eligibility';

export const BULK_LIMIT = 25;
export const RECENT_START_DAYS = 30;
/** A to-do nobody closed stops being shown after this long. */
export const OPEN_DAYS = 90;

const DAY = 86_400_000;
const isActive = (e) => e?.status === 'active';
const snapshot = (e) => ({ department: e?.department || '', title: jobTitleOf(e) });

function startIsRecent(emp, now) {
  const t = Date.parse(emp?.start_date || '');
  if (!Number.isFinite(t)) return false;
  return t >= now.getTime() - RECENT_START_DAYS * DAY && t <= now.getTime() + 60 * DAY;
}

/**
 * The joiners and movers between two lists of people, by employee id.
 * Returns [{ id, change }] where change is { kind, at, from?, to }.
 */
export function detectPeopleChanges(before = [], after = [], now = new Date()) {
  const was = new Map((before || []).map((e) => [e.id, e]));
  const wasEmail = new Map((before || []).filter((e) => e.email).map((e) => [norm(e.email), e]));
  const at = now.toISOString();
  const found = [];

  const added = (after || []).filter((e) => !was.has(e.id) && !(e.email && wasEmail.has(norm(e.email))));
  const loading = (before || []).length === 0 || added.length > BULK_LIMIT;
  for (const e of added) {
    if (!isActive(e)) continue;
    if (loading && !startIsRecent(e, now)) continue;
    found.push({ id: e.id, change: { kind: 'joiner', at, to: snapshot(e) } });
  }

  for (const e of after || []) {
    const prev = was.get(e.id) || (e.email ? wasEmail.get(norm(e.email)) : null);
    if (!prev) continue;
    if (!isActive(prev) && isActive(e)) {                 // back after leaving
      found.push({ id: e.id, change: { kind: 'joiner', at, to: snapshot(e) } });
      continue;
    }
    if (!isActive(prev) || !isActive(e)) continue;
    const a = snapshot(prev); const b = snapshot(e);
    // A value filled in where there was none is data being completed.
    const deptMoved = a.department && norm(a.department) !== norm(b.department);
    const titleMoved = a.title && norm(a.title) !== norm(b.title);
    if (deptMoved || titleMoved) found.push({ id: e.id, change: { kind: 'mover', at, from: a, to: b } });
  }
  return found;
}

/** Writes what detectPeopleChanges found onto `next.employees`. Returns how many. */
export function annotatePeopleChanges(cur, next, now = new Date()) {
  if (!next || !Array.isArray(next.employees)) return 0;
  if (cur?.employees === next.employees) return 0;
  const found = detectPeopleChanges(cur?.employees || [], next.employees, now);
  if (!found.length) return 0;
  const byId = new Map(found.map((f) => [f.id, f.change]));
  next.employees = next.employees.map((e) => (byId.has(e.id) ? { ...e, people_change: byId.get(e.id) } : e));
  return found.length;
}

const HELD = new Set(['active', 'pending_revocation']);

/**
 * The open to-dos: each joiner or mover not yet marked done, with the
 * licences the rules say to grant and to take back, and the tools they hold
 * that no rule speaks about (a mover keeps those unless someone checks).
 */
export function openPeopleChanges(db, now = new Date()) {
  const tools = (db?.tools || []).filter((t) => t.status !== 'decommissioned');
  const ruled = tools.map((tool) => ({ tool, rule: cleanRule(tool.eligibility) })).filter((x) => x.rule);
  const access = (db?.access || []).filter((a) => HELD.has(a.status || 'active'));
  const out = [];
  for (const emp of db?.employees || []) {
    const change = emp.people_change;
    if (!change || change.done_at || !isActive(emp)) continue;
    const t = Date.parse(change.at);
    if (Number.isFinite(t) && now.getTime() - t > OPEN_DAYS * DAY) continue;
    const mine = access.filter((a) => a.employee_id === emp.id
      || (!a.employee_id && emp.email && norm(a.employee_email) === norm(emp.email)));
    const holds = (toolId) => mine.find((a) => a.tool_id === toolId);
    const grants = []; const removals = [];
    for (const { tool, rule } of ruled) {
      const row = holds(tool.id);
      const eligible = isEligible(emp, rule);
      if (eligible && !row && !rule.excluded_ids.includes(emp.id)) grants.push(tool);
      if (!eligible && row && !row.eligibility_exception) removals.push({ tool, access: row });
    }
    const ruledIds = new Set(ruled.map((x) => x.tool.id));
    const unruled = change.kind === 'mover'
      ? tools.filter((tool) => !ruledIds.has(tool.id) && holds(tool.id))
      : [];
    out.push({ employee: emp, change, grants, removals, unruled, pending: grants.length + removals.length });
  }
  return out.sort((a, b) => String(b.change.at).localeCompare(String(a.change.at)));
}

/**
 * A directory sync's update for someone already here. The department and job
 * title follow the directory only while nobody changed them by hand: the last
 * value the directory gave is kept (dir_department, dir_role), and a value
 * that still equals it, or is empty, is the directory's to update. That is
 * how a move in the directory reaches Stacklens without overwriting an edit.
 */
export function directoryPatch(existing, incoming) {
  const patch = {};
  if (incoming.full_name && incoming.full_name !== existing.full_name) patch.full_name = incoming.full_name;
  for (const [field, mirror] of [['department', 'dir_department'], ['role', 'dir_role']]) {
    const next = incoming[field];
    if (!next) continue;
    const mine = existing[field];
    const followsDirectory = !mine || (existing[mirror] != null && mine === existing[mirror]);
    if (followsDirectory && mine !== next) patch[field] = next;
    if (existing[mirror] !== next) patch[mirror] = next;
  }
  if (incoming.status && incoming.status !== existing.status) patch.status = incoming.status;
  if (incoming.start_date && !existing.start_date) patch.start_date = incoming.start_date;
  return patch;
}
