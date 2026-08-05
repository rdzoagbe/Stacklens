import { describe, it, expect, beforeEach, vi } from 'vitest';
import { subDays, format } from 'date-fns';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(undefined),
  loadUserData: vi.fn().mockResolvedValue(null),
  logConsent: vi.fn().mockResolvedValue(undefined),
}));
import {
  computeToolDerivedStatus,
  computeToolDerivedRisk,
  getRiskEvidence,
  computeAccessDerivedRiskFlag,
  buildRiskAlerts,
  riskSeverityCounts,
  countOrphanedTools,
  computeMfaCoverage,
  countFormerEmployeeAccess,
  computeSecurityScore,
  validateEmail,
  validateRequired,
} from './dataUtils';

// Helpers
const daysAgo = (n) => format(subDays(new Date(), n), 'yyyy-MM-dd');

const makeTool = (overrides = {}) => ({
  id: 't1', name: 'Slack', owner_email: 'owner@co.com',
  criticality: 'medium', last_used_date: daysAgo(1),
  status: 'active', cost_per_month: 50, risk_score: 'low',
  ...overrides,
});

const makeEmp = (overrides = {}) => ({
  id: 'e1', full_name: 'Alice', email: 'alice@co.com',
  status: 'active', department: 'engineering', role: 'Engineer',
  ...overrides,
});

const makeAccess = (overrides = {}) => ({
  id: 'a1', tool_id: 't1', employee_id: 'e1',
  access_level: 'viewer', status: 'active',
  last_reviewed_date: daysAgo(30),
  ...overrides,
});

// ── computeToolDerivedStatus ─────────────────────────────────────────────────

describe('computeToolDerivedStatus', () => {
  it('returns decommissioned when status=decommissioned', () => {
    expect(computeToolDerivedStatus(makeTool({ status: 'decommissioned' }))).toBe('decommissioned');
  });

  it('returns orphaned when no owner_email', () => {
    expect(computeToolDerivedStatus(makeTool({ owner_email: '' }))).toBe('orphaned');
  });

  it('returns unused when last_used_date >= 90 days ago', () => {
    expect(computeToolDerivedStatus(makeTool({ last_used_date: daysAgo(95) }))).toBe('unused');
  });

  it('returns active when last used 89 days ago with owner', () => {
    expect(computeToolDerivedStatus(makeTool({ last_used_date: daysAgo(89) }))).toBe('active');
  });

  it('returns active for recently used tool', () => {
    expect(computeToolDerivedStatus(makeTool())).toBe('active');
  });

  it('orphaned takes precedence over decommissioned check', () => {
    // decommissioned is checked first
    const t = makeTool({ status: 'decommissioned', owner_email: '' });
    expect(computeToolDerivedStatus(t)).toBe('decommissioned');
  });
});

// ── computeToolDerivedRisk ───────────────────────────────────────────────────

describe('computeToolDerivedRisk', () => {
  it('high risk for orphaned tool', () => {
    expect(computeToolDerivedRisk(makeTool({ owner_email: '' }))).toBe('high');
  });

  it('high risk for unused tool', () => {
    expect(computeToolDerivedRisk(makeTool({ last_used_date: daysAgo(100) }))).toBe('high');
  });

  it('medium risk for active high-criticality tool', () => {
    expect(computeToolDerivedRisk(makeTool({ criticality: 'high' }))).toBe('medium');
  });

  it('returns stored risk_score for low-criticality active tool', () => {
    expect(computeToolDerivedRisk(makeTool({ risk_score: 'low' }))).toBe('low');
  });
});

// ── getRiskEvidence ──────────────────────────────────────────────────────────

describe('getRiskEvidence', () => {
  it('returns orphaned evidence when no owner', () => {
    const reasons = getRiskEvidence(makeTool({ owner_email: '' }));
    expect(reasons.some(r => r.key === 'evidence_orphaned')).toBe(true);
  });

  it('includes no-MFA evidence when mfa flags absent', () => {
    const reasons = getRiskEvidence(makeTool({ mfa_required: false, mfa_enabled: false }));
    expect(reasons.some(r => r.key === 'evidence_no_mfa')).toBe(true);
  });

  it('includes high-cost evidence for expensive tools', () => {
    const reasons = getRiskEvidence(makeTool({ cost_per_month: 500 }));
    expect(reasons.some(r => r.key === 'evidence_high_cost')).toBe(true);
  });

  it('returns no high-cost evidence for cheap tools', () => {
    const reasons = getRiskEvidence(makeTool({ cost_per_month: 50 }));
    expect(reasons.some(r => r.key === 'evidence_high_cost')).toBe(false);
  });

  it('returns no_usage_data when last_used_date missing', () => {
    const reasons = getRiskEvidence(makeTool({ last_used_date: null }));
    expect(reasons.some(r => r.key === 'evidence_no_usage_data')).toBe(true);
  });
});

// ── computeAccessDerivedRiskFlag ─────────────────────────────────────────────

describe('computeAccessDerivedRiskFlag', () => {
  const byEmp  = { e1: makeEmp() };
  const byTool = { t1: makeTool() };

  it('returns none for inactive access records', () => {
    const a = makeAccess({ status: 'revoked' });
    expect(computeAccessDerivedRiskFlag(a, byEmp, byTool)).toBe('none');
  });

  it('returns former_employee for offboarded employee', () => {
    const emp = { e1: makeEmp({ status: 'offboarded' }) };
    expect(computeAccessDerivedRiskFlag(makeAccess(), emp, byTool)).toBe('former_employee');
  });

  it('returns needs_review for offboarding employee', () => {
    const emp = { e1: makeEmp({ status: 'offboarding' }) };
    expect(computeAccessDerivedRiskFlag(makeAccess(), emp, byTool)).toBe('needs_review');
  });

  it('returns orphaned when tool has no owner', () => {
    const tools = { t1: makeTool({ owner_email: '' }) };
    expect(computeAccessDerivedRiskFlag(makeAccess(), byEmp, tools)).toBe('orphaned');
  });

  it('returns needs_review for admin access never reviewed', () => {
    const a = makeAccess({ access_level: 'admin', last_reviewed_date: null });
    expect(computeAccessDerivedRiskFlag(a, byEmp, byTool)).toBe('needs_review');
  });

  it('returns excessive_admin for admin reviewed within 180 days', () => {
    const a = makeAccess({ access_level: 'admin', last_reviewed_date: daysAgo(90) });
    expect(computeAccessDerivedRiskFlag(a, byEmp, byTool)).toBe('excessive_admin');
  });

  it('returns needs_review for admin not reviewed in 180+ days', () => {
    const a = makeAccess({ access_level: 'admin', last_reviewed_date: daysAgo(200) });
    expect(computeAccessDerivedRiskFlag(a, byEmp, byTool)).toBe('needs_review');
  });

  it('returns needs_review for viewer not reviewed in 365+ days', () => {
    const a = makeAccess({ access_level: 'viewer', last_reviewed_date: daysAgo(400) });
    expect(computeAccessDerivedRiskFlag(a, byEmp, byTool)).toBe('needs_review');
  });

  it('returns none for recently reviewed viewer', () => {
    expect(computeAccessDerivedRiskFlag(makeAccess(), byEmp, byTool)).toBe('none');
  });
});

// ── buildRiskAlerts ──────────────────────────────────────────────────────────

describe('buildRiskAlerts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const emptyDb = { tools: [], employees: [], access: [] };

  it('returns empty array for empty db', () => {
    expect(buildRiskAlerts(emptyDb)).toEqual([]);
  });

  it('generates orphaned_tools alert', () => {
    const db = { ...emptyDb, tools: [makeTool({ owner_email: '' })] };
    const alerts = buildRiskAlerts(db);
    expect(alerts.some(a => a.id === 'orphaned_tools')).toBe(true);
    expect(alerts.find(a => a.id === 'orphaned_tools').severity).toBe('critical');
  });

  it('generates former_employee_access alert', () => {
    const emp = makeEmp({ status: 'offboarded' });
    const db = {
      tools: [makeTool()],
      employees: [emp],
      access: [makeAccess({ employee_id: emp.id })],
    };
    const alerts = buildRiskAlerts(db);
    expect(alerts.some(a => a.id === 'former_employee_access')).toBe(true);
    expect(alerts.find(a => a.id === 'former_employee_access').severity).toBe('critical');
  });

  it('generates admin_overdue_review alert', () => {
    const db = {
      tools: [makeTool()],
      employees: [makeEmp()],
      access: [makeAccess({ access_level: 'admin', last_reviewed_date: daysAgo(200) })],
    };
    const alerts = buildRiskAlerts(db);
    expect(alerts.some(a => a.id === 'admin_overdue_review')).toBe(true);
  });

  it('generates tools_unused_90 alert', () => {
    const db = { ...emptyDb, tools: [makeTool({ last_used_date: daysAgo(95) })] };
    const alerts = buildRiskAlerts(db);
    expect(alerts.some(a => a.id === 'tools_unused_90')).toBe(true);
  });

  it('generates spend_watch alert when total spend > 1000', () => {
    const tools = [
      makeTool({ id: 't1', cost_per_month: 600 }),
      makeTool({ id: 't2', cost_per_month: 500, owner_email: 'b@co.com' }),
    ];
    const db = { ...emptyDb, tools };
    const alerts = buildRiskAlerts(db);
    expect(alerts.some(a => a.id === 'spend_watch')).toBe(true);
  });

  it('caps alerts at 7', () => {
    // Create conditions for all alert types simultaneously
    const emp = makeEmp({ status: 'offboarded' });
    const tools = Array.from({ length: 3 }, (_, i) => makeTool({
      id: `t${i}`, owner_email: '', last_used_date: daysAgo(95), cost_per_month: 400,
    }));
    const db = {
      tools,
      employees: [emp],
      access: [makeAccess({ employee_id: emp.id, access_level: 'admin', last_reviewed_date: daysAgo(400) })],
    };
    expect(buildRiskAlerts(db).length).toBeLessThanOrEqual(7);
  });
});

// ── riskSeverityCounts ───────────────────────────────────────────────────────

describe('riskSeverityCounts', () => {
  it('counts correctly', () => {
    const alerts = [
      { severity: 'critical' }, { severity: 'critical' },
      { severity: 'high' },
      { severity: 'medium' }, { severity: 'medium' },
    ];
    expect(riskSeverityCounts(alerts)).toEqual({ critical: 2, high: 1, medium: 2 });
  });

  it('returns zeros for empty array', () => {
    expect(riskSeverityCounts([])).toEqual({ critical: 0, high: 0, medium: 0 });
  });
});

// ── validateEmail ────────────────────────────────────────────────────────────

describe('validateEmail', () => {
  it('accepts valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateEmail('')).toBe(false);
  });

  it('rejects missing @', () => {
    expect(validateEmail('notanemail')).toBe(false);
  });

  it('rejects missing domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });
});

// ── validateRequired ─────────────────────────────────────────────────────────

describe('validateRequired', () => {
  it('returns true for non-empty string', () => {
    expect(validateRequired('hello', 'name')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(validateRequired('', 'Tool name')).toBe(false);
  });

  it('returns false for whitespace-only', () => {
    expect(validateRequired('   ', 'name')).toBe(false);
  });
});

// ── Security posture metrics ────────────────────────────────────────────────
// These four are rendered on BOTH the Dashboard and the Security page. They
// used to be computed separately in each and disagreed on live data, so these
// tests pin the definitions.
describe('security posture metrics', () => {
  const TOOLS = [
    { id: 't1', name: 'Slack',   status: 'active',    owner_email: 'a@x.com', mfa_required: true },
    { id: 't2', name: 'GitHub',  status: 'active',    owner_email: 'b@x.com' },
    { id: 't3', name: 'Figma',   status: 'orphaned',  owner_email: '' },
    { id: 't4', name: 'HubSpot', status: 'unused',    owner_email: 'c@x.com' },
  ];

  describe('countOrphanedTools', () => {
    it('counts every unowned tool regardless of lifecycle status', () => {
      // Figma is status "orphaned" — the old filter required status==='active'
      // and therefore reported 0 orphaned tools on a stack that had one.
      expect(countOrphanedTools(TOOLS)).toBe(1);
    });
    it('handles an empty stack', () => {
      expect(countOrphanedTools([])).toBe(0);
    });
  });

  describe('computeMfaCoverage', () => {
    it('reads the MFA fields, not ownership', () => {
      // Only Slack has an MFA flag: 1 of 4 = 25%. The old formula used
      // ownership as a proxy and reported 100% on this same data.
      expect(computeMfaCoverage(TOOLS)).toEqual({ percent: 25, secured: 1, total: 4 });
    });
    it('counts mfa_enabled as well as mfa_required', () => {
      expect(computeMfaCoverage([{ mfa_enabled: true }, {}]).percent).toBe(50);
    });
    it('returns null with no tools rather than an unearned 100%', () => {
      expect(computeMfaCoverage([])).toBeNull();
    });
  });

  describe('countFormerEmployeeAccess', () => {
    const EMPLOYEES = [
      { id: 'e1', status: 'active' },
      { id: 'e2', status: 'offboarding' },
      { id: 'e3', status: 'offboarded' },
    ];
    const ACCESS = [
      { employee_id: 'e1', status: 'active' },
      { employee_id: 'e2', status: 'active' },
      { employee_id: 'e3', status: 'active' },
      { employee_id: 'e3', status: 'revoked' },
    ];
    it('counts only people who have actually left', () => {
      // The old Security-page filter matched offboarding|inactive, so it
      // counted the employee still in transition and missed the one who left.
      expect(countFormerEmployeeAccess(ACCESS, EMPLOYEES)).toBe(1);
    });
    it('ignores access that is already revoked', () => {
      expect(countFormerEmployeeAccess(
        [{ employee_id: 'e3', status: 'revoked' }], EMPLOYEES)).toBe(0);
    });
    it('handles empty inputs', () => {
      expect(countFormerEmployeeAccess([], [])).toBe(0);
    });
  });

  describe('computeSecurityScore', () => {
    it('applies the documented weights', () => {
      expect(computeSecurityScore({ orphanedTools: 1, highRiskTools: 2, formerAccess: 1 }))
        .toBe(100 - 10 - 10 - 8);
    });
    it('is a perfect score on a clean stack', () => {
      expect(computeSecurityScore({})).toBe(100);
    });
    it('clamps at 0 rather than going negative', () => {
      expect(computeSecurityScore({ orphanedTools: 50 })).toBe(0);
    });
  });

  it('Dashboard and Security page now agree on the same data', () => {
    const employees = [{ id: 'e3', status: 'offboarded' }];
    const access = [{ employee_id: 'e3', status: 'active' }];
    const orphanedTools = countOrphanedTools(TOOLS);
    const formerAccess = countFormerEmployeeAccess(access, employees);
    const score = computeSecurityScore({ orphanedTools, highRiskTools: 0, formerAccess });
    // Both screens call these same helpers, so one input can only ever
    // produce one score.
    expect(score).toBe(100 - 10 - 8);
    expect(computeMfaCoverage(TOOLS).percent).toBe(25);
  });
});

// ── Money helpers: one implementation, two import paths ─────────────────────
// lib/currency.js and lib/dataUtils.js each used to define getCurrency /
// convertCurrency / formatMoney. They drifted, and pages disagreed depending
// on which module they imported: a Spanish user saw "$" on Employees and
// Budget (lib/currency) and "€" on Dashboard, Tools and Audit (lib/dataUtils),
// for the same data. dataUtils now re-exports, and these tests pin that.
describe('money helpers are shared, not duplicated', () => {
  beforeEach(() => localStorage.clear());

  it('dataUtils re-exports the very same function object as currency', async () => {
    const currency = await import('./currency');
    const utils    = await import('./dataUtils');
    expect(utils.getCurrency).toBe(currency.getCurrency);
    expect(utils.convertCurrency).toBe(currency.convertCurrency);
    expect(utils.formatMoney).toBe(currency.formatMoney);
  });

  it('every European language bills in euros', async () => {
    const { getCurrency } = await import('./currency');
    // German and Portuguese used to fall through to "$", which is wrong for
    // those markets and for a product sold to European SMBs.
    for (const lang of ['fr', 'es', 'de', 'pt']) {
      expect(getCurrency(lang)).toBe('€');
    }
    expect(getCurrency('en')).toBe('$');
  });

  it('an explicit Settings choice overrides the language', async () => {
    const { getCurrency } = await import('./currency');
    localStorage.setItem('sg_general', JSON.stringify({ currency: 'GBP (£)' }));
    expect(getCurrency('fr')).toBe('£');
    expect(getCurrency('en')).toBe('£');
  });

  it('converts using the currency the symbol implies', async () => {
    const { convertCurrency } = await import('./currency');
    // Default rates: EUR 0.92. A French user's 100 "USD" reads as 92 EUR.
    expect(convertCurrency(100, 'fr')).toBe(92);
    expect(convertCurrency(100, 'en')).toBe(100);
  });

  it('survives a corrupt sg_general blob rather than throwing', async () => {
    const { getCurrency } = await import('./currency');
    localStorage.setItem('sg_general', 'not-json{');
    expect(getCurrency('fr')).toBe('€');
  });
});
