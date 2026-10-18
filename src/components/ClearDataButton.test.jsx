import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null), logConsent: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import toast from 'react-hot-toast';
import { saveUserData } from '../firebase-config';
import { loadDb } from '../lib/db';
import { translations } from '../translations';
import { ClearDataButton } from './ClearDataButton';

// ── Dashboard → Clear data ─────────────────────────────────────────────────

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const t = (k) => translations.en[k] || k;
let root;

const full = { tools: [{ id: 't1', name: 'Slack' }, { id: 't2', name: 'Notion' }], employees: [{ id: 'e1', full_name: 'Ana' }], access: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }] };

async function mount({ role = 'owner', demo = false, data = full, shared = null, scope } = {}) {
  const db = { user: { is_authenticated: true, is_demo: demo, plan: 'pro', role, budget_cap: 900 }, audit_log: [], ...data, ...(shared ? { _shared_view: shared } : {}) };
  localStorage.clear();
  localStorage.setItem('accessguard_v1', JSON.stringify(db));
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><ClearDataButton db={db} uid="u1" t={t} scope={scope} /></MemoryRouter></QueryClientProvider>);
  });
}
const settle = async () => { for (let i = 0; i < 20; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const button = (re) => [...document.querySelectorAll('button')].find((b) => re.test(b.textContent.trim()));
const click = async (el) => { await act(async () => { el.click(); }); await settle(); };

beforeEach(() => { vi.clearAllMocks(); });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; document.body.innerHTML = ''; });

describe('Clear data on the dashboard', () => {
  it('asks first, saying exactly what goes and offering the export; nothing is deleted on the click alone', async () => {
    await mount();
    await click(button(/^Clear data$/));
    const dialog = document.querySelector('[data-testid="clear-data-dialog"]');
    expect(dialog.textContent).toContain('2 tool(s), 1 person(s) and 3 access record(s)');
    expect(dialog.querySelector('a').getAttribute('href')).toBe('/settings?tab=data');
    expect(loadDb().tools).toHaveLength(2);
  });

  it('"Delete everything" empties tools, people and access, keeps the plan and settings, logs it and saves to the cloud', async () => {
    await mount();
    await click(button(/^Clear data$/));
    await click(button(/^Delete everything$/));
    const db = loadDb();
    expect(db.tools).toEqual([]);
    expect(db.employees).toEqual([]);
    expect(db.access).toEqual([]);
    expect(db.user).toMatchObject({ plan: 'pro', budget_cap: 900 });
    expect(db.audit_log.at(-1)).toMatchObject({ action: 'data.deleted' });
    expect(saveUserData).toHaveBeenCalledWith('u1', expect.objectContaining({ tools: [] }));
    expect(toast.success).toHaveBeenCalledWith('All tools, people and access deleted');
  });

  it('a failed cloud save is said, not reported as done', async () => {
    saveUserData.mockRejectedValueOnce(new Error('offline'));
    await mount();
    await click(button(/^Clear data$/));
    await click(button(/^Delete everything$/));
    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('Cancel deletes nothing', async () => {
    await mount();
    await click(button(/^Clear data$/));
    await click(button(/^Cancel$/));
    expect(loadDb().tools).toHaveLength(2);
  });

  it('not offered to an editor, in the demo, in a shared workspace, or with nothing to delete', async () => {
    for (const opts of [{ role: 'editor' }, { demo: true }, { shared: { owner_uid: 'o', role: 'editor' } }, { data: { tools: [], employees: [], access: [] } }]) {
      await mount(opts);
      expect(button(/^Clear data$/), JSON.stringify(opts)).toBeUndefined();
      await act(async () => root.unmount()); root = null; document.body.innerHTML = '';
    }
  });

  it('an admin may', async () => {
    await mount({ role: 'admin' });
    expect(button(/^Clear data$/)).toBeTruthy();
  });

  it('reads in French', async () => {
    expect(translations.fr.dash_clear_data).toBe('Effacer les données');
  });
});

// ── Employees → Clear people ───────────────────────────────────────────────

describe('Clear people on the Employees page', () => {
  it('asks first, counting people and access only', async () => {
    await mount({ scope: 'people' });
    await click(button(/^Clear people$/));
    const dialog = document.querySelector('[data-testid="clear-data-dialog"]');
    expect(dialog.textContent).toContain('1 person(s) and 3 access record(s)');
    expect(dialog.textContent).toMatch(/Tools, devices/);
    expect(loadDb().employees).toHaveLength(1);
  });

  it('deletes people and access, keeps tools and devices, logs it and saves to the cloud', async () => {
    await mount({ scope: 'people', data: { ...full, assets: [{ id: 'd1', name: 'Mac', assigned_name: 'Ana' }] } });
    await click(button(/^Clear people$/));
    await click(button(/^Delete all people$/));
    const db = loadDb();
    expect(db.employees).toEqual([]);
    expect(db.access).toEqual([]);
    expect(db.tools).toHaveLength(2);
    expect(db.assets).toHaveLength(1);
    expect(db.audit_log.at(-1)).toMatchObject({ action: 'data.deleted' });
    expect(saveUserData).toHaveBeenCalledWith('u1', expect.objectContaining({ employees: [], tools: full.tools }));
    expect(toast.success).toHaveBeenCalledWith('All people and their access deleted');
  });

  it('not offered with no people and no access, even when there are tools, nor to an editor', async () => {
    for (const opts of [{ data: { tools: full.tools, employees: [], access: [] } }, { role: 'editor' }]) {
      await mount({ scope: 'people', ...opts });
      expect(button(/^Clear people$/), JSON.stringify(opts)).toBeUndefined();
      await act(async () => root.unmount()); root = null; document.body.innerHTML = '';
    }
  });

  it('is on the Employees page, and every language has its words', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/pages/EmployeesPage.jsx', 'utf8')).toMatch(/<ClearDataButton db=\{db\} uid=\{firebaseUser\?\.uid\} t=\{t\} scope="people" \/>/);
    for (const lang of ['en', 'fr', 'de', 'es', 'pt']) {
      for (const k of ['emp_clear_people', 'emp_clear_title', 'emp_clear_body', 'emp_clear_confirm', 'emp_clear_done']) expect(translations[lang][k], `${lang}.${k}`).toBeTruthy();
    }
  });
});
