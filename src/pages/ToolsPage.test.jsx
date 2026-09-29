import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null),
  logConsent: vi.fn(), callAI: vi.fn(),
  workspaceWrite: vi.fn().mockResolvedValue({ ok: true }), workspaceRead: vi.fn().mockResolvedValue({ data: {} }),
}));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
// The shell (navigation, sync status, account menu) is not what is tested here.
vi.mock('../components/AppShell', () => ({ AppShell: ({ children }) => <div>{children}</div> }));

import { loadDb } from '../lib/db';
import { ToolsPage } from './ToolsPage';

// ── The Tools page: checking what the app added by itself ──────────────────

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host, root;
const buttons = (scope = document) => [...scope.querySelectorAll('button')];
const byText = (text, scope) => buttons(scope).find((b) => b.textContent.trim() === text);
const click = (el) => act(async () => { el.click(); });
const rowOf = (name) => [...document.querySelectorAll('tbody tr')].find((tr) => tr.querySelector('.font-semibold')?.textContent === name);
// The review strip is the row under the tool's own.
const stripOf = (name) => {
  const next = rowOf(name)?.nextElementSibling;
  return next?.querySelector('[data-testid="tool-review"]') ? next : null;
};
const names = () => [...document.querySelectorAll('tbody tr .text-sm.font-semibold.text-white.truncate')].map((d) => d.textContent);

function seed(role = 'owner') {
  localStorage.clear();
  localStorage.setItem('language', 'en');
  localStorage.setItem('accessguard_v1', JSON.stringify({
    user: { is_authenticated: true, is_demo: false, plan: 'trial', trial_started_at: Date.now(), role },
    tools: [
      { id: 't1', name: 'Qonto Abonnement', origin: 'bank', category: 'other', status: 'active', cost_per_month: 29 },
      { id: 't2', name: 'Notion Labs Inc', category: 'other', status: 'active', cost_per_month: 96, notes: 'Created from invoice import' },
      { id: 't3', name: 'Slack', category: 'communication', status: 'active', cost_per_month: 80 },
    ],
    employees: [], access: [], contracts: [], invoices: [], licenses: [], audit_log: [],
  }));
}

async function mount() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><ToolsPage /></MemoryRouter></QueryClientProvider>);
  });
  // The workspace is read through a query: let it resolve.
  for (let i = 0; i < 20 && !document.querySelector('tbody tr'); i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
  }
}

beforeEach(async () => { seed(); window.confirm = vi.fn(() => true); await mount(); });
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; });

describe('tools the app added by itself', () => {
  it('are counted in a banner and marked where they came from; a typed tool is not', () => {
    expect(document.querySelector('[data-testid="tool-review-banner"]').textContent).toContain('2 tool(s) added automatically');
    expect(stripOf('Qonto Abonnement').textContent).toContain('To check · from the bank');
    expect(stripOf('Notion Labs Inc').textContent).toContain('To check · from an invoice');
    expect(stripOf('Slack')).toBeNull();
  });

  it('the banner filters the table to them, and lets go once none are left', async () => {
    await click(byText('Show only these'));
    expect(names()).toEqual(['Notion Labs Inc', 'Qonto Abonnement']);
    await click(byText('Correct', stripOf('Notion Labs Inc')));
    await click(byText('Correct', stripOf('Qonto Abonnement')));
    expect(document.querySelector('[data-testid="tool-review-banner"]')).toBeNull();
    expect(names()).toEqual(['Notion Labs Inc', 'Qonto Abonnement', 'Slack']);
  });

  it('Rename fixes the name in place', async () => {
    await click(byText('Rename', stripOf('Notion Labs Inc')));
    const input = document.querySelector('input[aria-label="Rename"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'Notion');
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    await click(byText('Save'));
    expect(loadDb().tools.find((x) => x.id === 't2')).toMatchObject({ name: 'Notion', reviewed: 'renamed' });
    expect(stripOf('Notion')).toBeNull();
  });

  it('Not software asks first, then removes the tool and remembers the vendor', async () => {
    window.confirm = vi.fn(() => false);
    await click(byText('Not software', stripOf('Qonto Abonnement')));
    expect(loadDb().tools).toHaveLength(3);
    window.confirm = vi.fn(() => true);
    await click(byText('Not software', stripOf('Qonto Abonnement')));
    expect(window.confirm.mock.calls[0][0]).toContain('Future invoices from this vendor will not add it back');
    expect(loadDb().tools.map((x) => x.id)).toEqual(['t2', 't3']);
    expect(loadDb().rejected_vendors).toEqual(['qonto abonnement']);
  });

  it('a viewer sees the mark but no buttons', async () => {
    await act(async () => root.unmount());
    seed('viewer');
    await mount();
    expect(stripOf('Qonto Abonnement').textContent).toContain('To check');
    expect(byText('Not software', stripOf('Qonto Abonnement'))).toBeUndefined();
  });
});
