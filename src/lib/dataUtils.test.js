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
