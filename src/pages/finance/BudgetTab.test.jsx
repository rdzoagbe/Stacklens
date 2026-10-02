import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null),
  logConsent: vi.fn(), callAI: vi.fn(),
  workspaceWrite: vi.fn().mockResolvedValue({ ok: true }), workspaceRead: vi.fn().mockResolvedValue({ data: {} }),
  invoiceInboxAddress: vi.fn().mockResolvedValue({ address: 'invoices-abc@in.stacklens.fr' }),
  invoiceInboxList: vi.fn().mockResolvedValue({ items: [] }),
  invoiceInboxAck: vi.fn().mockResolvedValue({ ok: true }),
  bankConnect: vi.fn(), bankSync: vi.fn(),
  bankStatus: vi.fn().mockResolvedValue({ connected: false }),
}));
vi.mock('../../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { bankStatus, invoiceInboxAddress } from '../../firebase-config';
import { BudgetTabContent } from './BudgetTab';

// ── Finance → Budget: who may change what ──────────────────────────────────
//
// A viewer could set budgets and import invoices here, though the finance
// page says viewers only read. And the bank button showed on every plan with
// Finance, while the endpoint answers 403 below Enterprise.

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;

async function mount(user, extra = {}) {
  localStorage.clear();
  localStorage.setItem('language', 'en');
  localStorage.setItem('accessguard_v1', JSON.stringify({
    user: { is_authenticated: true, is_demo: false, ...user },
    tools: [{ id: 't', name: 'Notion', cost_per_month: 100, department: 'sales' }],
    employees: [{ id: 'e', full_name: 'Ana', department: 'Sales', status: 'active' }], access: [],
    budgets: [{ department: 'sales', year: new Date().getFullYear(), annual: 5000 }],
    ...extra,
  }));
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(<QueryClientProvider client={qc}><BudgetTabContent /></QueryClientProvider>);
  });
  // The workspace query resolves on the next tick.
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

const buttons = () => [...document.querySelectorAll('button')].map((b) => b.textContent.trim());
const budgetInputs = () => document.querySelectorAll('tbody input');
const bankLocked = () => document.querySelector('[data-testid="bank-locked"]');

beforeEach(() => { vi.clearAllMocks(); });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; document.body.innerHTML = ''; });

describe('Finance → Budget', () => {
  it('an editor sets budgets and imports invoices', async () => {
    await mount({ plan: 'pro', role: 'editor' });
    expect(budgetInputs().length).toBeGreaterThan(0);
    expect(buttons().some((b) => /Import invoices/i.test(b))).toBe(true);
  });

  it('a viewer reads the budget and changes nothing', async () => {
    await mount({ plan: 'pro', role: 'viewer' });
    expect(budgetInputs()).toHaveLength(0);
    expect(document.body.textContent).toMatch(/5,000|5 000/);
    expect(buttons().some((b) => /Import invoices|Import CSV/i.test(b))).toBe(false);
    expect(bankLocked()).toBeNull();
    expect(invoiceInboxAddress).not.toHaveBeenCalled();
  });

  it('below Enterprise the bank connection is shown locked, and never asked for', async () => {
    await mount({ plan: 'pro', role: 'owner' });
    expect(bankLocked()).not.toBeNull();
    expect(bankLocked().textContent).toContain('Enterprise');
    expect(bankStatus).not.toHaveBeenCalled();
  });

  it('on Enterprise the bank connection is offered', async () => {
    await mount({ plan: 'enterprise', role: 'owner' });
    expect(bankLocked()).toBeNull();
    expect(bankStatus).toHaveBeenCalled();
  });

  it('in a workspace shared with you, your own inbox and bank are not offered', async () => {
    await mount({ plan: 'enterprise', role: 'editor' }, { _shared_view: { owner_uid: 'o', role: 'editor' } });
    expect(invoiceInboxAddress).not.toHaveBeenCalled();
    expect(bankStatus).not.toHaveBeenCalled();
    expect(bankLocked()).toBeNull();
  });
});
