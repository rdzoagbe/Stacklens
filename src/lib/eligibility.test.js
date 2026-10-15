import { describe, it, expect } from 'vitest';
import {
  norm, cleanRule, parseTitleWords, isEligible, perLicence, eligibilityGaps, eligibilityOverview, departmentsInUse,
} from './eligibility';

// ── Who should have each tool ──────────────────────────────────────────────

const emp = (id, department, title, status = 'active', extra = {}) =>
  ({ id, full_name: id, email: `${id}@acme.fr`, department, role: title, status, ...extra });

const people = [
  emp('ana', 'Marketing', 'Growth Manager'),
  emp('ben', 'engineering', 'Développeur Senior'),
  emp('chloe', 'engineering', 'QA Lead'),
  emp('dan', 'sales', 'Account Executive'),
  emp('eve', 'Marketing', 'Designer', 'offboarded'),
  emp('fay', 'finance', 'Controller', 'offboarding'),
  emp('gus', 'ops', 'admin'),        // a Google Workspace account type, not a job
];

describe('the rule', () => {
  it('everyone means every active person, nobody who is leaving or gone', () => {
    const r = { mode: 'all' };
    expect(people.filter((p) => isEligible(p, r)).map((p) => p.id)).toEqual(['ana', 'ben', 'chloe', 'dan', 'gus']);
  });

  it('departments match whatever the case and accents', () => {
    const r = { mode: 'match', departments: ['marketing', 'Engineering'] };
    expect(people.filter((p) => isEligible(p, r)).map((p) => p.id)).toEqual(['ana', 'ben', 'chloe']);
  });

  it('job-title words match inside the title, accents and capitals ignored', () => {
    const r = { mode: 'match', titles: ['developpeur', 'ACCOUNT'] };
    expect(people.filter((p) => isEligible(p, r)).map((p) => p.id)).toEqual(['ben', 'dan']);
  });

  it('the account type a directory writes into `role` never counts as a title', () => {
    expect(isEligible(people.find((p) => p.id === 'gus'), { mode: 'match', titles: ['admin'] })).toBe(false);
  });

  it('a match rule with nothing chosen covers nobody, and no rule covers nobody', () => {
    expect(people.some((p) => isEligible(p, { mode: 'match' }))).toBe(false);
    expect(isEligible(people[0], null)).toBe(false);
    expect(isEligible(people[0], { mode: 'whatever' })).toBe(false);
  });

  it('cleans what is stored', () => {
    expect(cleanRule({ mode: 'match', departments: [' sales ', '', 'sales'], titles: [null, 'dev'] }))
      .toEqual({ mode: 'match', departments: ['sales'], titles: ['dev'], excluded_ids: [] });
    expect(parseTitleWords('dev, ingénieur ; Data\n,dev')).toEqual(['dev', 'ingénieur', 'Data']);
    expect(norm('  Développement   Web ')).toBe('developpement web');
  });
});

describe('the two lists', () => {
  const tool = { id: 'gem', name: 'Gemini', cost_per_month: 300, seats: 10, eligibility: { mode: 'match', departments: ['engineering'] } };
  const access = (id, employee_id, extra = {}) => ({ id, tool_id: 'gem', employee_id, status: 'active', ...extra });
  const db = {
    employees: people,
    tools: [tool],
    access: [
      access('a1', 'ben'),                                   // eligible and has it
      access('a2', 'ana'),                                   // outside the rule
      access('a3', 'dan', { eligibility_exception: { at: '2026-10-01' } }), // outside, kept
      access('a4', 'eve'),                                   // left: Offboarding's job
      access('a5', 'chloe', { status: 'revoked' }),          // revoked: does not hold it
    ],
  };

  it('lists who the rule covers without a licence, and who holds one outside it', () => {
    const g = eligibilityGaps(db, tool);
    expect(g.toGrant.map((e) => e.id)).toEqual(['chloe']);
    expect(g.outsideRule.map((r) => r.employee.id)).toEqual(['ana']);
    expect(g.exceptions.map((r) => r.employee.id)).toEqual(['dan']);
  });

  it('never lists someone who left, however they still hold it', () => {
    const g = eligibilityGaps(db, tool);
    expect([...g.toGrant.map((e) => e.id), ...g.outsideRule.map((r) => r.employee.id)]).not.toContain('eve');
  });

  it('"not needed" takes a person off the list for good', () => {
    const g = eligibilityGaps(db, { ...tool, eligibility: { ...tool.eligibility, excluded_ids: ['chloe'] } });
    expect(g.toGrant).toEqual([]);
    expect(g.notNeeded.map((e) => e.id)).toEqual(['chloe']);
  });

  it('finds the person by email when the access row has no id', () => {
    const g = eligibilityGaps({ ...db, access: [{ id: 'x', tool_id: 'gem', employee_email: 'CHLOE@acme.fr', status: 'active' }] }, tool);
    expect(g.toGrant.map((e) => e.id)).toEqual(['ben']);
  });

  it('prices a licence from the seats, else from the holders, else not at all', () => {
    const g = eligibilityGaps(db, tool);
    expect(g.perLicence).toBe(30);
    expect(g.grantCost).toBe(30);
    expect(g.recoverable).toBe(30);
    expect(perLicence({ cost_per_month: 300 }, 4)).toBe(75);
    expect(perLicence({ cost_per_month: 300 }, 0)).toBeNull();
    expect(perLicence({}, 4)).toBeNull();
  });

  it('a tool without a rule produces no list', () => {
    const g = eligibilityGaps(db, { ...tool, eligibility: null });
    expect(g.rule).toBeNull();
    expect(g.toGrant).toEqual([]);
    expect(g.outsideRule).toEqual([]);
  });

  it('the overview adds up the tools with a rule, never a decommissioned one', () => {
    const off = { ...tool, id: 'old', status: 'decommissioned' };
    const o = eligibilityOverview({ ...db, tools: [tool, off, { id: 'n', name: 'No rule' }] });
    expect(o.items.map((i) => i.tool.id)).toEqual(['gem']);
    expect(o).toMatchObject({ toGrant: 1, outsideRule: 1 });
  });
});

describe('the departments offered', () => {
  it('are the ones active people are in, most people first, spelled as stored', () => {
    expect(departmentsInUse(people)).toEqual([
      { value: 'engineering', count: 2 },
      { value: 'Marketing', count: 1 },
      { value: 'ops', count: 1 },
      { value: 'sales', count: 1 },
    ]);
  });
});
