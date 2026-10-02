import { describe, it, expect, vi, beforeEach } from 'vitest';
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

import { toolOrigin, needsReview, isRejectedVendor, originOfRow, vendorKey } from './toolReview';
import { loadDb } from './db';
import { useDbMutations } from '../hooks/useDbQuery';

// ── Tools the app added by itself wait for a person's word ─────────────────

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('which tools are waiting to be checked', () => {
  it('those an import or a sync created, until someone reviews them', () => {
    expect(needsReview({ origin: 'invoice' })).toBe(true);
    expect(needsReview({ origin: 'bank' })).toBe(true);
    expect(needsReview({ origin: 'google-workspace' })).toBe(true);
    expect(needsReview({ origin: 'invoice', reviewed: 'confirmed' })).toBe(false);
  });

  it('never one a person typed, whatever a CSV put in the origin column', () => {
    expect(needsReview({ name: 'Slack' })).toBe(false);
    expect(needsReview({ origin: 'csv' })).toBe(false);
  });

  it('tools created before origin existed, by the note each path wrote', () => {
    expect(toolOrigin({ notes: 'Created from invoice import' })).toBe('invoice');
    expect(toolOrigin({ notes: 'Discovered via Google Workspace — 3 user(s) signed in' })).toBe('google-workspace');
    expect(toolOrigin({ notes: 'Mentioned in Created from invoice import' })).toBe(null);
  });

  it('a bank row makes a bank tool, anything else an invoice tool', () => {
    expect(originOfRow({ source: 'bank' })).toBe('bank');
    expect(originOfRow({ source: 'email' })).toBe('invoice');
    expect(originOfRow({ source: 'invoice' })).toBe('invoice');
  });

  it('a rejected vendor is matched whatever its case and spacing', () => {
    expect(vendorKey('  Qonto   Abonnement ')).toBe('qonto abonnement');
    expect(isRejectedVendor({ rejected_vendors: ['qonto abonnement'] }, 'QONTO  Abonnement')).toBe(true);
    expect(isRejectedVendor({ rejected_vendors: ['qonto abonnement'] }, 'Qonto')).toBe(false);
    expect(isRejectedVendor({}, '')).toBe(false);
  });
});

describe('reviewing, through the workspace', () => {
  let muts;
  const tools = () => loadDb().tools;
  const run = (fn) => act(async () => { await fn(); });

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('accessguard_v1', JSON.stringify({
      user: { is_authenticated: true, is_demo: false, plan: 'trial', trial_started_at: Date.now() },
      tools: [
        { id: 't1', name: 'Qonto Abonnement', origin: 'bank', cost_per_month: 29 },
        { id: 't2', name: 'Notion Labs Inc', origin: 'invoice', cost_per_month: 96 },
        { id: 't3', name: 'Slack', cost_per_month: 80 },
      ],
      employees: [{ id: 'e1', email: 'a@x.example', status: 'active' }],
      access: [{ id: 'a1', tool_id: 't1', tool_name: 'Qonto Abonnement', employee_id: 'e1', status: 'active' },
        { id: 'a2', tool_id: 't2', tool_name: 'Notion Labs Inc', employee_id: 'e1', status: 'active' }],
      contracts: [], invoices: [], licenses: [], audit_log: [],
    }));
    function Harness() { muts = useDbMutations(); return null; }
    const root = createRoot(document.createElement('div'));
    await act(async () => root.render(<QueryClientProvider client={new QueryClient()}><Harness /></QueryClientProvider>));
  });

  it('Correct keeps the tool and clears the mark', async () => {
    await run(() => muts.reviewTool.mutateAsync({ id: 't2', kind: 'confirm' }));
    const t2 = tools().find((x) => x.id === 't2');
    expect(t2.reviewed).toBe('confirmed');
    expect(needsReview(t2)).toBe(false);
    expect(loadDb().audit_log.some((e) => e.action === 'tool.reviewed' && e.details === 'Notion Labs Inc — confirmed')).toBe(true);
  });

  it('Rename changes the name everywhere, access records included', async () => {
    await run(() => muts.reviewTool.mutateAsync({ id: 't2', kind: 'rename', name: '  Notion ' }));
    expect(tools().find((x) => x.id === 't2')).toMatchObject({ name: 'Notion', reviewed: 'renamed' });
    expect(loadDb().access.find((a) => a.id === 'a2').tool_name).toBe('Notion');
  });

  it('Rename with an empty name changes nothing', async () => {
    await run(() => muts.reviewTool.mutateAsync({ id: 't2', kind: 'rename', name: '   ' }));
    expect(tools().find((x) => x.id === 't2')).toMatchObject({ name: 'Notion Labs Inc' });
    expect(tools().find((x) => x.id === 't2').reviewed).toBeUndefined();
  });

  it('Not software removes the tool and its access, remembers the vendor, and leaves the audit trail', async () => {
    await run(() => muts.reviewTool.mutateAsync({ id: 't1', kind: 'reject' }));
    const db = loadDb();
    expect(db.tools.map((x) => x.id)).toEqual(['t2', 't3']);
    expect(db.access.map((a) => a.id)).toEqual(['a2']);
    expect(db.rejected_vendors).toEqual(['qonto abonnement']);
    expect(db.audit_log.some((e) => e.action === 'tool.reviewed' && /Qonto Abonnement — not software/.test(e.details))).toBe(true);
  });

  it('the next invoice from a rejected vendor is recorded but brings no tool back', async () => {
    await run(() => muts.reviewTool.mutateAsync({ id: 't1', kind: 'reject' }));
    await run(() => muts.importInvoices.mutateAsync([
      { vendor: 'QONTO ABONNEMENT', amount: 29, monthly: 29, source: 'bank' },
      { vendor: 'Figma', amount: 45, monthly: 45, source: 'bank' },
      { vendor: 'Pennylane', amount: 49, monthly: 49, source: 'email' },
    ]));
    const db = loadDb();
    expect(db.tools.some((x) => /qonto/i.test(x.name))).toBe(false);
    expect(db.invoice_records.some((r) => r.vendor === 'QONTO ABONNEMENT')).toBe(true);
    expect(db.tools.find((x) => x.name === 'Figma')).toMatchObject({ origin: 'bank' });
    expect(db.tools.find((x) => x.name === 'Pennylane')).toMatchObject({ origin: 'invoice' });
    expect(needsReview(db.tools.find((x) => x.name === 'Figma'))).toBe(true);
  });

  it('an invoice already recorded is not recorded again, and the import is in the audit log', async () => {
    const rows = [{ vendor: 'Figma', amount: 45, monthly: 45, source: 'bank', invoice_date: '2026-09-21' }];
    await run(() => muts.importInvoices.mutateAsync(rows));
    await run(() => muts.importInvoices.mutateAsync(rows));   // a second bank sync, no new charge
    const db = loadDb();
    expect(db.invoice_records.filter((r) => r.vendor === 'Figma')).toHaveLength(1);
    expect(db.audit_log.filter((e) => e.action === 'invoice.imported').map((e) => e.details)).toEqual(['1 invoice(s) recorded, 1 tool(s) created']);
    // The same PDF twice is one document; two different PDFs are two.
    await run(() => muts.importInvoices.mutateAsync([{ vendor: 'Notion', amount: 96, monthly: 96, source: 'invoice', invoice_date: '2026-09-05', file: 'a.pdf' }]));
    await run(() => muts.importInvoices.mutateAsync([{ vendor: 'Notion', amount: 96, monthly: 96, source: 'invoice', invoice_date: '2026-09-05', file: 'a.pdf' }]));
    await run(() => muts.importInvoices.mutateAsync([{ vendor: 'Notion', amount: 96, monthly: 96, source: 'invoice', invoice_date: '2026-09-05', file: 'b.pdf' }]));
    expect(loadDb().invoice_records.filter((r) => r.vendor === 'Notion')).toHaveLength(2);
  });

  it('a tools import keeps an origin the app sets, and drops one it does not know', async () => {
    await run(() => muts.bulkImport.mutateAsync({ kind: 'tools', records: [
      { name: 'Miro', origin: 'google-workspace' },
      { name: 'Canva', origin: 'anything' },
    ] }));
    expect(tools().find((x) => x.name === 'Miro').origin).toBe('google-workspace');
    expect(tools().find((x) => x.name === 'Canva')).not.toHaveProperty('origin');
  });
});
