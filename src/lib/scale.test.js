import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null), logConsent: vi.fn(),
}));

import { primeWorkspaceStore, _resetWorkspaceStoreForTests } from './workspaceStore';
import { loadDb, saveDb } from './db';
import { LS_KEY } from './constants';
import { annotatePeopleChanges } from './peopleChanges';
import { computeAccessDerivedRiskFlag, buildRiskAlerts, computeSecurityScore, countOrphanedTools, countFormerEmployeeAccess } from './dataUtils';
import { computeWaste, monthlySpend, employeeCostShares } from './waste';
import { rowsInScope } from './accessReviews';

// ── A workspace the size of a broadcaster's ────────────────────────────────
//
// 3,000 people, 60 tools, 20,000 access rows: the shape the enterprise review
// asked about. The point is not speed for its own sake but that nothing is
// cut: the old localStorage ceiling trimmed the access list to 150 rows at
// 4.5 MB, so every figure below was computed on a fraction of the data.

const PEOPLE = 3000, TOOLS = 60, ACCESS = 20000;
const big = () => {
  const employees = Array.from({ length: PEOPLE }, (_, i) => ({
    id: `e${i}`, full_name: `Person ${i}`, email: `p${i}@acme.example`, department: ['news', 'sport', 'tech', 'hr', 'finance'][i % 5],
    role: ['Journalist', 'Editor', 'Engineer', 'Producer'][i % 4], status: i % 50 === 0 ? 'offboarded' : 'active',
    start_date: '2023-01-10', end_date: i % 50 === 0 ? '2026-01-31' : '',
  }));
  const tools = Array.from({ length: TOOLS }, (_, i) => ({
    id: `t${i}`, name: `Tool ${i}`, category: 'other', status: i % 15 === 14 ? 'unused' : 'active', cost_per_month: 50 + i * 10,
    owner_email: i % 7 === 0 ? '' : 'it@acme.example', mfa_required: i % 2 === 0, last_used_date: '2026-10-01',
  }));
  const access = Array.from({ length: ACCESS }, (_, i) => ({
    id: `a${i}`, employee_id: `e${i % PEOPLE}`, tool_id: `t${i % TOOLS}`, access_level: i % 9 === 0 ? 'admin' : 'viewer',
    status: 'active', granted_date: '2024-03-01', last_reviewed_date: i % 3 === 0 ? '2026-09-01' : '', notes: 'granted by the directory import of 2024-03-01, reviewed with the team lead',
  }));
  return { user: { is_authenticated: true, plan: 'enterprise', email: 'it@acme.example' }, employees, tools, access, contracts: [], invoices: [], licenses: [], audit_log: [] };
};

beforeEach(async () => { _resetWorkspaceStoreForTests(); localStorage.clear(); globalThis.indexedDB = new IDBFactory(); await primeWorkspaceStore(); });
afterEach(() => { _resetWorkspaceStoreForTests(); });

describe('a 3,000-person workspace', () => {
  it('is stored whole, is larger than the old ceiling, and comes back complete after a reload', async () => {
    const db = big();
    saveDb(db);
    const raw = JSON.stringify(db);
    expect(raw.length).toBeGreaterThan(4.5 * 1024 * 1024);
    const loaded = loadDb();
    expect(loaded.employees).toHaveLength(PEOPLE);
    expect(loaded.access).toHaveLength(ACCESS);
    expect(loaded._trimmed).toBeUndefined();
    // localStorage holds no cut-down copy of it.
    expect(localStorage.getItem(LS_KEY)).toBeNull();
    // Another tab, later: still complete.
    _resetWorkspaceStoreForTests();
    await primeWorkspaceStore();
    expect(loadDb().access).toHaveLength(ACCESS);
  });

  it('every figure the pages show is computed over all of it, within a budget', () => {
    const db = big();
    const t0 = performance.now();
    annotatePeopleChanges(null, db);
    const annotated = db;
    const byId = Object.fromEntries(annotated.employees.map((e) => [e.id, e]));
    const byTool = Object.fromEntries(annotated.tools.map((t) => [t.id, t]));
    const flags = annotated.access.map((a) => computeAccessDerivedRiskFlag(a, byId, byTool));
    const alerts = buildRiskAlerts(annotated, (k) => k);
    const score = computeSecurityScore({ orphanedTools: countOrphanedTools(annotated.tools), formerAccess: countFormerEmployeeAccess(annotated.access, annotated.employees) });
    const waste = computeWaste(annotated);
    const spend = monthlySpend(annotated);
    const shares = employeeCostShares(annotated);
    const review = rowsInScope(annotated, 'all');
    const ms = performance.now() - t0;
    expect(flags).toHaveLength(ACCESS);
    // 60 people left: their rows are the high risk, counted from the whole list.
    expect(flags.filter((f) => f === 'former_employee').length).toBe(annotated.access.filter((a) => byId[a.employee_id]?.status === 'offboarded').length);
    expect(review).toHaveLength(ACCESS);
    expect(spend).toBe(annotated.tools.reduce((s, t) => s + t.cost_per_month, 0));
    expect(waste.tools.length).toBe(TOOLS);
    expect(shares.size).toBe(PEOPLE);
    expect(typeof score).toBe('number');
    expect(alerts.length).toBeGreaterThan(0);
    expect(ms, `derived figures took ${Math.round(ms)} ms`).toBeLessThan(5000);
  });
});
