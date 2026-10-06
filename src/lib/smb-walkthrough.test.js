import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { employeeCostShares, billedTools, monthlySpend } from './waste';
import { allocateSpendByDepartment } from './budget';
import { computeMfaCoverage, getRiskEvidence } from './dataUtils';
import { translations } from '../translations';

// ── What a company owner met on day one (walkthrough of 2026-10-06) ─────────
//
// Signed in as the owner of a 17-person agency on the top plan, imported the
// company file, and read every screen. These hold the fixes.

// eslint-disable-next-line security/detect-non-literal-fs-filename -- repo paths from literals below
const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

const db = {
  tools: [
    { id: 'hub', name: 'HubSpot', cost_per_month: 600, status: 'active' },
    { id: 'slack', name: 'Slack', cost_per_month: 120, status: 'active' },
    { id: 'loom', name: 'Loom', cost_per_month: 12, status: 'decommissioned' },
  ],
  employees: [
    { id: 'a', department: 'Sales', status: 'active' }, { id: 'b', department: 'Sales', status: 'active' },
    { id: 'c', department: 'Design', status: 'active' },
  ],
  access: [
    { employee_id: 'a', tool_id: 'hub', status: 'active' }, { employee_id: 'b', tool_id: 'hub', status: 'active' },
    { employee_id: 'a', tool_id: 'slack', status: 'active' }, { employee_id: 'b', tool_id: 'slack', status: 'active' }, { employee_id: 'c', tool_id: 'slack', status: 'active' },
    { employee_id: 'c', tool_id: 'loom', status: 'active' },
  ],
};

describe('one spend figure on every page', () => {
  it('a decommissioned tool is not spend, on the Finance overview or in the budget', () => {
    expect(billedTools(db).map((t) => t.id)).toEqual(['hub', 'slack']);
    expect(monthlySpend(db)).toBe(720);
    const byDept = allocateSpendByDepartment(db);
    expect(Math.round(Object.values(byDept).reduce((s, n) => s + n, 0))).toBe(720);
    // The Finance page counts the same set as the Dashboard and Tools.
    expect(read('src/pages/FinancePage.jsx')).toMatch(/const _tools = billedTools\(db\);/);
    // …and the server's monthly report agrees.
    expect(read('functions/monthly-report.js')).toMatch(/t\.status !== 'archived' && t\.status !== 'decommissioned'/);
  });
});

describe('what a person costs', () => {
  it('is their share of each tool, not the whole bill of each tool', () => {
    const shares = employeeCostShares(db);
    // HubSpot 600 shared by 2, Slack 120 shared by 3.
    expect(shares.get('a')).toBe(300 + 40);
    expect(shares.get('b')).toBe(300 + 40);
    expect(shares.get('c')).toBe(40);   // Loom is decommissioned: nothing
    const total = [...shares.values()].reduce((s, n) => s + n, 0);
    expect(total).toBe(monthlySpend(db));
    expect(read('src/pages/EmployeesPage.jsx')).toMatch(/useMemo\(\(\) => employeeCostShares\(db\), \[db\]\)/);
  });
});

describe('the security score does not shout at a fresh import', () => {
  it('MFA coverage is unknown until someone says something about MFA', () => {
    expect(computeMfaCoverage([{ id: 1 }, { id: 2 }])).toBeNull();
    expect(computeMfaCoverage([{ id: 1, mfa_enabled: true }, { id: 2 }])).toEqual({ percent: 50, secured: 1, total: 2 });
    expect(computeMfaCoverage([{ id: 1, mfa_enabled: false }])).toEqual({ percent: 0, secured: 0, total: 1 });
    // "MFA not enabled" is evidence only when someone said it is not.
    expect(getRiskEvidence({ name: 'x', owner_email: 'o@x', last_used_date: '2026-10-01' }).some((r) => r.key === 'evidence_no_mfa')).toBe(false);
    expect(getRiskEvidence({ name: 'x', owner_email: 'o@x', last_used_date: '2026-10-01', mfa_enabled: false }).some((r) => r.key === 'evidence_no_mfa')).toBe(true);
  });

  it('the tool form records MFA, the renewal, the billing cycle and the seats', () => {
    const form = read('src/pages/ToolsPage.jsx');
    for (const f of ['mfa_enabled', 'renewal_date', 'billing_cycle', 'seats', 'auto_renew']) expect(form, f).toContain(`form.${f}`);
    expect(form).not.toMatch(/value=\{form\.risk_score\}/);
    expect(form).not.toMatch(/"Edit tool"/);
    // …and the CSV can carry them.
    expect(read('src/hooks/useDbQuery.js')).toMatch(/function csvToolExtras\(r, prefix\)/);
  });

  it('"reviews overdue" counts what the access rule says needs a review', () => {
    expect(read('src/pages/DashboardPage.jsx')).toMatch(/derived\.access\.filter\(a => a\.derived_risk_flag === 'needs_review'\)\.length/);
  });

  it('the compliance block about Stacklens itself is off the customer’s security page', () => {
    const page = read('src/pages/SecurityCompliancePage.jsx');
    expect(page).not.toMatch(/name: 'HIPAA'|status: 'non-compliant'/);
  });
});

describe('revoking in bulk', () => {
  it('"high risk" is access held by someone who left, and the confirm names each one', () => {
    const page = read('src/pages/AccessPage.jsx');
    expect(page).toMatch(/const highRisk = access\.filter\(a => a\.risk === 'former_employee'\);/);
    expect(page).not.toMatch(/excessive_admin/);
    expect(page).toMatch(/derived\.highRisk\.slice\(0, 12\)\.map\(a => `• \$\{a\.employee\?\.full_name/);
  });
});

describe('Slack says what it does', () => {
  it('promises no alert nothing sends', () => {
    const comp = read('src/components/SlackNotifications.jsx');
    expect(comp).not.toMatch(/slack_you_will_receive|slack_alert_high_risk|You will receive alerts/);
    for (const lang of ['en', 'fr']) {
      expect(translations[lang].slack_what_it_does).toMatch(/Finance → Renouvellements|Finance → Renewals/);
      expect(translations[lang].slack_sub).not.toMatch(/alert|alerte/i);
    }
    // Nothing on the server posts to a Slack webhook.
    expect(read('functions/index.js')).not.toMatch(/hooks\.slack\.com|slack_webhook/);
  });
});
