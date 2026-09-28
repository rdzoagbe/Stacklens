import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null),
  logConsent: vi.fn(), callAI: vi.fn(),
  workspaceWrite: vi.fn().mockResolvedValue({ ok: true }), workspaceRead: vi.fn().mockResolvedValue({ data: {} }),
}));
vi.mock('./analytics', () => ({ track: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { buildKit } from '../../tools/make-demo-kit.mjs';
import { decodeBankFile, parseBankExport, auditSaas } from './saasAudit';
import { parseFec } from './fec';
import { parseCsv, buildRiskAlerts } from './dataUtils';
import { computeWaste, monthlySpend } from './waste';
import { loadDb } from './db';
import { useDbMutations } from '../hooks/useDbQuery';

// ── The demo kit does what its guide says ──────────────────────────────────
//
// public/demo/ holds one fictional company, Atelier Lumen, told through every
// file the site reads; public/demo/LISEZ-MOI.md tells a founder or a prospect
// what each file will show. Both are only worth anything if they are true, so
// this runs the files through the real audit engine and the real in-app
// import, and checks the guide quotes the figures they produce.

/* eslint-disable security/detect-non-literal-fs-filename --
   paths are the repo's own demo folder and a fixed file list. */

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const DEMO = resolve(process.cwd(), 'public/demo');
const file = (name) => readFileSync(resolve(DEMO, name));
const guide = readFileSync(resolve(DEMO, 'LISEZ-MOI.md'), 'utf8');
const euros = (n) => Math.round(n).toLocaleString('fr-FR').replace(/\s/g, ' ');

describe('the published files are what the generator writes', () => {
  it.each(Object.entries(buildKit()))('%s', (name, body) => {
    expect(file(name).toString('utf8'), `re-run node tools/make-demo-kit.mjs`).toBe(body);
  });
});

describe('the bank statement, in the free audit', () => {
  const r = auditSaas(parseBankExport(decodeBankFile(file('releve-bancaire-atelier-lumen.csv'))).transactions);
  const vendors = r.subscriptions.map((s) => s.vendor);

  it('finds the subscriptions and the total the guide quotes', () => {
    expect(r.totals.subscriptionCount).toBe(17);
    expect(guide).toContain(`${r.totals.subscriptionCount} abonnements`);
    expect(guide).toContain(`${euros(r.totals.monthlySaas)} € par mois`);
  });

  it('shows each finding the guide walks through', () => {
    const f = r.findings;
    expect(f.upcomingAnnual).toEqual([expect.objectContaining({ vendor: 'Adobe', inDays: 16 })]);
    expect(f.duplicates.map((d) => d.vendor).sort()).toEqual(['Google Workspace', 'Notion']);
    expect(f.multiPerMonth.map((d) => d.vendor)).toContain('Figma');
    expect(f.priceIncreases.map((p) => p.vendor)).toEqual(expect.arrayContaining(['HubSpot', 'Notion']));
    expect(f.forgotten.map((g) => g.vendor)).toEqual(expect.arrayContaining(['Zoom', 'Dropbox', 'Canva', 'Calendly']));
  });

  it('falls for the three traps, which the review then corrects', () => {
    expect(r.subscriptions.some((s) => s.key.startsWith('GOOGLE ADS'))).toBe(true);
    expect(vendors).toContain('monday.com');
    expect(vendors).toContain('Qonto Abonnement');
    // and misses Wimi, whose name no list knows
    expect(r.otherRecurring.map((o) => o.key)).toContain('WIMI');
  });
});

describe('the ledger, in the free audit', () => {
  const r = auditSaas(parseFec(decodeBankFile(file('fec-atelier-lumen-2026-09-30.txt'))).transactions);
  const keys = r.subscriptions.map((s) => s.key);

  it('finds the subscriptions and the total the guide quotes', () => {
    expect(r.totals.subscriptionCount).toBe(13);
    expect(guide).toContain(`${r.totals.subscriptionCount} abonnements`);
    expect(guide).toContain(`${euros(r.totals.monthlySaas)} € HT par mois`);
  });

  it('the account removes the traps and finds Wimi and Miro under their legal names', () => {
    for (const trap of ['GOOGLE IRELAND', 'QONTO', 'MONDAY CAFE']) expect(keys).not.toContain(trap);
    expect(keys).toEqual(expect.arrayContaining(['WIMI', 'REALTIMEBOARD']));
  });

  it('keeps the annual Adobe licence and flags its renewal', () => {
    expect(r.findings.upcomingAnnual.map((u) => u.vendor)).toEqual(['Adobe']);
  });

  it('misses Pennylane, booked with the accountant\'s fees, as the guide warns', () => {
    expect(keys).not.toContain('PENNYLANE');
    expect(guide).toMatch(/Pennylane[\s\S]{0,120}6226/);
  });
});

describe('the one application file, imported as company data', () => {
  let db;
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T09:00:00Z'));
    localStorage.clear();
    localStorage.setItem('accessguard_v1', JSON.stringify({
      user: { is_authenticated: true, is_demo: false, plan: 'trial', trial_started_at: Date.now() },
      tools: [], employees: [], access: [], contracts: [], invoices: [], licenses: [], audit_log: [],
    }));
    let muts;
    function Harness() { muts = useDbMutations(); return null; }
    const root = createRoot(document.createElement('div'));
    await act(async () => root.render(<QueryClientProvider client={new QueryClient()}><Harness /></QueryClientProvider>));
    await act(async () => {
      await muts.bulkImport.mutateAsync({ kind: 'company', records: parseCsv(file('atelier-lumen-application.csv').toString('utf8')) });
    });
    db = loadDb();
    await act(async () => root.unmount());
  });
  afterAll(() => vi.useRealTimers());

  it('imports every row', () => {
    expect(db.tools).toHaveLength(14);
    expect(db.employees).toHaveLength(17);
    expect(db.access).toHaveLength(76);
  });

  it('raises the alerts the guide promises', () => {
    const alerts = Object.fromEntries(buildRiskAlerts(db).map((a) => [a.id, a]));
    expect(alerts.former_employee_access.body).toMatch(/^8 /);
    expect(alerts.orphaned_tools.body).toMatch(/^1 /);
    expect(alerts.admin_overdue_review.body).toMatch(/^6 /);
    // Zoom, Dropbox, Miro and the cancelled Loom, measured on 1 Oct 2026.
    expect(alerts.tools_unused_90.body).toMatch(/^4 /);
    expect(guide).toContain('8 accès');
  });

  it('counts Loom as cancelled and Miro as paid for by nobody', () => {
    const spend = monthlySpend(db);
    expect(spend).toBeCloseTo(db.tools.filter((t) => t.status !== 'decommissioned').reduce((s, t) => s + t.cost_per_month, 0), 2);
    const waste = computeWaste(db);
    expect(waste.unusedTools.map((t) => t.name)).toEqual(['Miro']);
    expect(guide).toContain(`${euros(spend)} € HT par mois`);
  });
});

describe('the demo page', () => {
  it('links only to files that exist, and features the single application file', () => {
    const html = readFileSync(resolve(DEMO, 'index.html'), 'utf8');
    const links = [...html.matchAll(/href="\/demo\/([^"]+)"/g)].map((m) => m[1]);
    expect(links).toContain('atelier-lumen-application.csv');
    for (const name of links) expect(() => file(name), name).not.toThrow();
    for (const name of Object.keys(buildKit())) expect(links, name).toContain(name);
  });
});

describe('a company file without the optional columns imports as before', () => {
  it('a leaver\'s access is assumed revoked, and the first person listed owns the tool', async () => {
    localStorage.setItem('accessguard_v1', JSON.stringify({
      user: { is_authenticated: true, is_demo: false, plan: 'trial', trial_started_at: Date.now() },
      tools: [], employees: [], access: [], contracts: [], invoices: [], licenses: [], audit_log: [],
    }));
    let muts;
    function Harness() { muts = useDbMutations(); return null; }
    const root = createRoot(document.createElement('div'));
    await act(async () => root.render(<QueryClientProvider client={new QueryClient()}><Harness /></QueryClientProvider>));
    const csv = 'employee_name,employee_email,employee_status,tool_name,access_level\n'
      + 'Ana Lopez,ana@x.example,active,Slack,admin\nBen Roy,ben@x.example,offboarded,Slack,member\n';
    await act(async () => { await muts.bulkImport.mutateAsync({ kind: 'company', records: parseCsv(csv) }); });
    const db = loadDb();
    await act(async () => root.unmount());
    expect(db.tools[0].owner_email).toBe('ana@x.example');
    expect(db.access.find((a) => a.employee_email === 'ben@x.example').status).toBe('revoked');
  });
});
