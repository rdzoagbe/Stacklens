import { describe, it, expect } from 'vitest';
import {
  detectPeopleChanges, annotatePeopleChanges, openPeopleChanges, directoryPatch, BULK_LIMIT, OPEN_DAYS,
} from './peopleChanges';

// ── Joiners and movers ─────────────────────────────────────────────────────

const NOW = new Date('2026-10-15T10:00:00Z');
const p = (id, department, role, extra = {}) => ({ id, full_name: id, email: `${id}@acme.fr`, department, role, status: 'active', ...extra });
const team = [p('ana', 'marketing', 'Growth Manager'), p('ben', 'engineering', 'Developer')];
const kinds = (found) => found.map((f) => `${f.id}:${f.change.kind}`);

describe('who counts as a joiner', () => {
  it('someone added to a workspace that already has people', () => {
    expect(kinds(detectPeopleChanges(team, [...team, p('cle', 'sales', 'AE')], NOW))).toEqual(['cle:joiner']);
  });

  it('not the people of a first import, unless their start date is recent', () => {
    const first = [p('a', 'x', 'y'), p('b', 'x', 'y', { start_date: '2026-10-01' }), p('c', 'x', 'y', { start_date: '2024-01-01' })];
    expect(kinds(detectPeopleChanges([], first, NOW))).toEqual(['b:joiner']);
  });

  it(`not a load of more than ${BULK_LIMIT} people at once`, () => {
    const many = Array.from({ length: BULK_LIMIT + 1 }, (_, i) => p(`n${i}`, 'ops', 'x'));
    expect(detectPeopleChanges(team, [...team, ...many], NOW)).toEqual([]);
  });

  it('someone back after leaving', () => {
    const before = [p('ana', 'marketing', 'x', { status: 'offboarded' })];
    expect(kinds(detectPeopleChanges(before, [p('ana', 'marketing', 'x')], NOW))).toEqual(['ana:joiner']);
  });

  it('not someone added already gone, and not the same person re-imported under a new id', () => {
    expect(detectPeopleChanges(team, [...team, p('old', 'x', 'y', { status: 'offboarded' })], NOW)).toEqual([]);
    expect(detectPeopleChanges(team, [team[0], { ...team[1], id: 'new-id' }], NOW)).toEqual([]);
  });
});

describe('who counts as a mover', () => {
  it('a department or a job title that changed, with what it was', () => {
    const found = detectPeopleChanges(team, [{ ...team[0], department: 'sales' }, { ...team[1], role: 'Engineering Manager' }], NOW);
    expect(kinds(found)).toEqual(['ana:mover', 'ben:mover']);
    expect(found[0].change).toMatchObject({ from: { department: 'marketing' }, to: { department: 'sales' }, at: NOW.toISOString() });
  });

  it('not a value filled in where there was none, nor a change of case or accents', () => {
    const blank = [p('a', '', '')];
    expect(detectPeopleChanges(blank, [p('a', 'sales', 'AE')], NOW)).toEqual([]);
    expect(detectPeopleChanges([p('a', 'Développement', 'x')], [p('a', 'developpement', 'X')], NOW)).toEqual([]);
  });

  it('not the account type a directory writes into role', () => {
    expect(detectPeopleChanges([p('a', 'ops', 'admin')], [p('a', 'ops', 'user')], NOW)).toEqual([]);
  });

  it('not someone leaving: the Offboarding page owns that', () => {
    expect(detectPeopleChanges(team, [{ ...team[0], status: 'offboarded', department: 'x' }, team[1]], NOW)).toEqual([]);
  });
});

describe('the change is written on the person', () => {
  it('annotate writes people_change on the new list only, and leaves an untouched list alone', () => {
    const cur = { employees: team };
    const next = { employees: [{ ...team[0], department: 'sales' }, team[1]] };
    expect(annotatePeopleChanges(cur, next, NOW)).toBe(1);
    expect(next.employees[0].people_change.kind).toBe('mover');
    expect(next.employees[1].people_change).toBeUndefined();
    expect(annotatePeopleChanges(cur, { employees: cur.employees }, NOW)).toBe(0);
  });
});

describe('the open to-dos', () => {
  const rule = (extra) => ({ mode: 'match', departments: ['engineering'], ...extra });
  const db = (employees, access = [], tools) => ({
    employees,
    tools: tools || [
      { id: 'gh', name: 'GitHub', eligibility: rule() },
      { id: 'hs', name: 'HubSpot', eligibility: { mode: 'match', departments: ['sales'] } },
      { id: 'nt', name: 'Notion' },
    ],
    access,
  });
  const moved = (from, to, extra = {}) => p('ana', to, 'x', { people_change: { kind: 'mover', at: NOW.toISOString(), from: { department: from }, to: { department: to } }, ...extra });
  const row = (id, tool_id, extra = {}) => ({ id, tool_id, employee_id: 'ana', status: 'active', ...extra });

  it('a mover gets what the new team has, loses what the old one had, and is told about tools no rule covers', () => {
    const [c] = openPeopleChanges(db([moved('sales', 'engineering')], [row('1', 'hs'), row('2', 'nt')]), NOW);
    expect(c.grants.map((t) => t.id)).toEqual(['gh']);
    expect(c.removals.map((r) => r.tool.id)).toEqual(['hs']);
    expect(c.unruled.map((t) => t.id)).toEqual(['nt']);
    expect(c.pending).toBe(2);
  });

  it('what is granted, excluded or kept as an exception leaves the to-do', () => {
    const tools = [
      { id: 'gh', name: 'GitHub', eligibility: rule({ excluded_ids: ['ana'] }) },
      { id: 'hs', name: 'HubSpot', eligibility: { mode: 'match', departments: ['sales'] } },
    ];
    const [c] = openPeopleChanges(db([moved('sales', 'engineering')], [row('1', 'hs', { eligibility_exception: { at: 'x' } })], tools), NOW);
    expect(c.pending).toBe(0);
  });

  it('done, too old, or gone: not open', () => {
    const at = NOW.toISOString();
    expect(openPeopleChanges(db([moved('sales', 'engineering', { people_change: { kind: 'mover', at, done_at: at } })]), NOW)).toEqual([]);
    const old = new Date(NOW.getTime() - (OPEN_DAYS + 1) * 86_400_000).toISOString();
    expect(openPeopleChanges(db([moved('sales', 'engineering', { people_change: { kind: 'mover', at: old } })]), NOW)).toEqual([]);
    expect(openPeopleChanges(db([moved('sales', 'engineering', { status: 'offboarded' })]), NOW)).toEqual([]);
  });

  it('a joiner gets the grants; tools without a rule are not listed for them', () => {
    const joiner = p('ana', 'engineering', 'Dev', { people_change: { kind: 'joiner', at: NOW.toISOString() } });
    const [c] = openPeopleChanges(db([joiner], [row('2', 'nt')]), NOW);
    expect(c.grants.map((t) => t.id)).toEqual(['gh']);
    expect(c.unruled).toEqual([]);
  });
});

describe('a directory sync updates what it gave, never a hand edit', () => {
  it('fills an empty department and remembers where it came from', () => {
    expect(directoryPatch({ department: '' }, { department: 'Sales' })).toEqual({ department: 'Sales', dir_department: 'Sales' });
  });
  it('follows the directory while nobody changed the value by hand', () => {
    expect(directoryPatch({ department: 'Sales', dir_department: 'Sales' }, { department: 'Engineering' }))
      .toEqual({ department: 'Engineering', dir_department: 'Engineering' });
  });
  it('keeps a value someone edited, and only records the directory\'s', () => {
    expect(directoryPatch({ department: 'Finance', dir_department: 'Sales' }, { department: 'Engineering' }))
      .toEqual({ dir_department: 'Engineering' });
    expect(directoryPatch({ department: 'Finance' }, { department: 'Sales' })).toEqual({ dir_department: 'Sales' });
  });
  it('status, name and a missing start date still come through; nothing when nothing changed', () => {
    expect(directoryPatch({ status: 'active', full_name: 'A' }, { status: 'offboarded', full_name: 'A B', start_date: '2026-01-01' }))
      .toEqual({ status: 'offboarded', full_name: 'A B', start_date: '2026-01-01' });
    expect(directoryPatch({ department: 'Sales', dir_department: 'Sales', status: 'active' }, { department: 'Sales', status: 'active' })).toEqual({});
  });
});

describe('every directory sync uses that rule', () => {
  it('Google Workspace, Microsoft 365 and the vendor reconcile all call directoryPatch, with no older inline rule left', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(resolve(process.cwd(), 'src/pages/settings/IntegrationsTab.jsx'), 'utf8');
    expect((src.match(/const patch = directoryPatch\(existing, u\);/g) || []).length).toBe(3);
    expect(src).not.toMatch(/u\.department && !existing\.department/);
  });
});
