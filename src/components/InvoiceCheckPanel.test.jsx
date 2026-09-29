import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null),
  logConsent: vi.fn(), callAI: vi.fn(),
  workspaceWrite: vi.fn().mockResolvedValue({ ok: true }), workspaceRead: vi.fn().mockResolvedValue({ data: {} }),
}));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { loadDb } from '../lib/db';
import { InvoiceCheckPanel } from './InvoiceCheckPanel';

// ── Finance → Budget: the supplier invoice check, clicked through ──────────

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host, root;
const panel = () => document.querySelector('[data-testid="invoice-check"]');
const findings = () => [...document.querySelectorAll('[data-testid="invoice-finding"]')];
const findingFor = (name) => findings().find((li) => li.textContent.startsWith(name));
const byText = (text, scope = document) => [...scope.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));
const click = (el) => act(async () => { el.click(); });
const type = (el, v) => act(async () => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
});

function seed({ role = 'owner', records } = {}) {
  localStorage.clear();
  localStorage.setItem('language', 'en');
  localStorage.setItem('accessguard_v1', JSON.stringify({
    user: { is_authenticated: true, is_demo: false, plan: 'trial', trial_started_at: Date.now(), role },
    tools: [
      { id: 'n', name: 'Notion', agreed_monthly: 80, agreed_basis: 'ht', cost_per_month: 112 },
      { id: 'h', name: 'HubSpot', cost_per_month: 672 },
      { id: 's', name: 'Slack', cost_per_month: 147 },
    ],
    employees: [], access: [], contracts: [], invoices: [], licenses: [], audit_log: [],
    invoice_records: records ?? [
      { id: 'i1', vendor: 'Notion Labs Inc', amount: 112, amount_excl_tax: 93.33, billing_cycle: 'monthly', invoice_date: '2026-09-05', file: 'notion-sept.pdf' },
      { id: 'i2', vendor: 'HubSpot Inc', amount: 600, billing_cycle: 'monthly', invoice_date: '2026-08-02' },
      { id: 'i3', vendor: 'HubSpot Inc', amount: 672, billing_cycle: 'monthly', invoice_date: '2026-09-02' },
      { id: 'i4', vendor: 'Slack Technologies', amount: 147, billing_cycle: 'monthly', invoice_date: '2026-09-10' },
    ],
  }));
}

async function mount() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<QueryClientProvider client={new QueryClient()}><InvoiceCheckPanel /></QueryClientProvider>); });
  // The workspace is read through a query: let it resolve.
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
}
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

beforeEach(async () => { seed(); await mount(); });
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; });

describe('the supplier invoice check', () => {
  it('lists each discrepancy, costliest first, with what is at stake per year', () => {
    expect(findings().map((li) => li.textContent.split('Price')[0].split('Above')[0])).toEqual(['HubSpot', 'Notion']);
    expect(findingFor('HubSpot').textContent).toContain('$672/month against $600/month on the previous invoice (+12%)');
    expect(findingFor('Notion').textContent).toContain('$93.33/month invoiced for $80/month agreed (excl. tax)');
    expect(findingFor('Notion').textContent).toContain('notion-sept.pdf');
    expect(panel().textContent).toContain('per year across 2 invoice(s) to check');
  });

  it('Justified clears a finding and leaves the invoice in place', async () => {
    await click(byText('Justified', findingFor('Notion')));
    await settle();
    expect(findingFor('Notion')).toBeUndefined();
    const r = loadDb().invoice_records.find((x) => x.id === 'i1');
    expect(r).toMatchObject({ cleared: true, amount: 112 });
    expect(loadDb().audit_log.some((e) => e.action === 'invoice.cleared' && /Notion Labs Inc 112/.test(e.details))).toBe(true);
  });

  it('recording the agreed price turns a price rise into a check against it', async () => {
    await click(byText('Record the agreed price', findingFor('HubSpot')));
    await type(findingFor('HubSpot').querySelector('input[aria-label="Agreed price / month"]'), '672');
    const sel = findingFor('HubSpot').querySelector('select');
    await act(async () => { sel.value = 'ttc'; sel.dispatchEvent(new window.Event('change', { bubbles: true })); });
    await click(byText('Save', findingFor('HubSpot')));
    await settle();
    expect(loadDb().tools.find((x) => x.id === 'h')).toMatchObject({ agreed_monthly: 672, agreed_basis: 'ttc' });
    expect(findingFor('HubSpot')).toBeUndefined();   // 672 was agreed: the rise was the deal
  });

  it('names the invoiced tools that have no agreed price', async () => {
    await click(byText('▸ 2 invoiced tool(s)'));
    const list = document.querySelector('[data-testid="invoice-unpriced"]').textContent;
    expect(list).toContain('HubSpot');
    expect(list).toContain('Slack');
    expect(list).not.toContain('Notion');
  });
});

describe('before and after', () => {
  it('with no invoices, it says what importing them will do', async () => {
    await act(async () => root.unmount());
    seed({ records: [] });
    await mount();
    expect(panel().textContent).toContain('Import your invoices');
    expect(findings()).toHaveLength(0);
  });

  it('with nothing wrong, it says so', async () => {
    await act(async () => root.unmount());
    seed({ records: [{ id: 'ok', vendor: 'Notion', amount: 96, amount_excl_tax: 80, billing_cycle: 'monthly', invoice_date: '2026-09-05' }] });
    await mount();
    expect(panel().textContent).toContain('No discrepancy across 1 imported invoice(s).');
  });

  it('a viewer sees the findings but cannot clear them', async () => {
    await act(async () => root.unmount());
    seed({ role: 'viewer' });
    await mount();
    expect(findings()).toHaveLength(2);
    expect(byText('Justified')).toBeUndefined();
  });
});
