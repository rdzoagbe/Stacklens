import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null), logConsent: vi.fn(),
}));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { loadDb } from '../lib/db';
import { useDbQuery } from '../hooks/useDbQuery';
import { translations } from '../translations';
import { GoogleLicencesCard } from './GoogleLicencesCard';

// ── The Google licences card, against a stand-in for Google ────────────────

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const t = (k) => translations.en[k] || k;
let root;

const assignments = [
  { email: 'ana@acme.fr', productId: '101047', productName: 'Gemini', skuId: '1010470003', skuName: 'Gemini Business' },
  { email: 'ben@acme.fr', productId: '101047', productName: 'Gemini', skuId: '1010470003', skuName: 'Gemini Business' },
  { email: 'shared@acme.fr', productId: '101047', productName: 'Gemini', skuId: '1010470003', skuName: 'Gemini Business' },
];
const google = { token: vi.fn(async () => 'tok'), read: vi.fn(async () => ({ assignments, skipped: [] })) };

function Host({ canEdit, deps }) {
  const { data } = useDbQuery();
  return data ? <GoogleLicencesCard db={data} canEdit={canEdit} t={t} deps={deps} /> : null;
}

async function mount({ canEdit = true, demo = false, tools, access = [], deps = google } = {}) {
  localStorage.clear();
  localStorage.setItem('accessguard_v1', JSON.stringify({
    user: { is_authenticated: true, is_demo: demo, plan: 'pro', role: canEdit ? 'owner' : 'viewer' },
    employees: [
      { id: 'ana', full_name: 'Ana', email: 'ana@acme.fr', status: 'active' },
      { id: 'ben', full_name: 'Ben', email: 'ben@acme.fr', status: 'active' },
      { id: 'dan', full_name: 'Dan', email: 'dan@acme.fr', status: 'active' },
    ],
    tools: tools || [{ id: 'gem', name: 'Gemini', status: 'active' }],
    access, contracts: [], invoices: [], licenses: [], audit_log: [],
  }));
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<QueryClientProvider client={new QueryClient()}><Host canEdit={canEdit} deps={deps} /></QueryClientProvider>); });
  await settle();
}
const settle = async () => { for (let i = 0; i < 15; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const button = (re) => [...document.querySelectorAll('button')].find((b) => re.test(b.textContent.trim()));
const click = async (el) => { await act(async () => { el.click(); }); await settle(); };
const choose = async (select, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(select, value);
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  await settle();
};
const box = (id) => document.querySelector(`[data-testid="${id}"]`);

beforeEach(() => { vi.clearAllMocks(); });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; document.body.innerHTML = ''; });

describe('reading Google licences', () => {
  it('nothing is read until someone clicks, and the card says it only reads', async () => {
    await mount();
    expect(google.read).not.toHaveBeenCalled();
    expect(box('gl-readonly').textContent).toMatch(/never assigns or removes a licence in Google/);
    await click(button(/^Read the licences from Google$/));
    expect(google.token).toHaveBeenCalled();
    expect(box('gl-sku').textContent).toContain('Gemini Business');
    expect(box('gl-sku').textContent).toContain('3 holder(s)');
  });

  it('a SKU is compared once it is linked to a tool; the link is saved on the tool', async () => {
    await mount({ access: [{ id: 'a2', tool_id: 'gem', employee_id: 'dan', employee_email: 'dan@acme.fr', employee_name: 'Dan', status: 'active' }] });
    await click(button(/^Read the licences from Google$/));
    expect(box('gl-to-record')).toBeNull();
    await choose(box('gl-sku').querySelector('select'), 'gem');
    expect(loadDb().tools[0].google_sku).toEqual({ productId: '101047', skuId: '1010470003', skuName: 'Gemini Business' });
    expect(box('gl-to-record').textContent).toMatch(/In Google, not recorded \(2\)/);
    expect(box('gl-not-in-google').textContent).toMatch(/Recorded, not in Google \(1\).*Dan/);
    expect(box('gl-unknown').textContent).toContain('shared@acme.fr');
  });

  it('"Record them all" adds access rows; "Mark them as removed" revokes', async () => {
    await mount({ tools: [{ id: 'gem', name: 'Gemini Business', status: 'active' }],
      access: [{ id: 'a2', tool_id: 'gem', employee_id: 'dan', employee_email: 'dan@acme.fr', status: 'active' }] });
    await click(button(/^Read the licences from Google$/));
    await click(button(/^Record them all$/));
    const rows = loadDb().access.filter((a) => a.origin === 'google-licensing');
    expect(rows.map((a) => a.employee_id).sort()).toEqual(['ana', 'ben']);
    expect(box('gl-to-record').textContent).toMatch(/\(0\)/);
    await click(button(/^Mark them as removed$/));
    expect(loadDb().access.find((a) => a.id === 'a2').status).toBe('revoked');
  });

  it('"Create" makes the tool already linked to the SKU', async () => {
    await mount({ tools: [] });
    await click(button(/^Read the licences from Google$/));
    await choose(box('gl-sku').querySelector('select'), '__new');
    const tool = loadDb().tools.find((x) => x.name === 'Gemini Business');
    expect(tool.google_sku.skuId).toBe('1010470003');
  });

  it('a Google refusal is shown as it came', async () => {
    await mount({ deps: { token: async () => 'tok', read: async () => { throw new Error('Google refused: the account must be a Google Workspace administrator.'); } } });
    await click(button(/^Read the licences from Google$/));
    expect(document.querySelector('[role="alert"]').textContent).toContain('must be a Google Workspace administrator');
  });

  it('not in the demo, and a viewer has no button', async () => {
    await mount({ demo: true });
    expect(button(/^Read the licences from Google$/)).toBeUndefined();
    expect(box('google-licences').textContent).toContain('Not available in the demo');
    await act(async () => root.unmount()); root = null; document.body.innerHTML = '';
    await mount({ canEdit: false });
    expect(button(/^Read the licences from Google$/)).toBeUndefined();
  });
});
