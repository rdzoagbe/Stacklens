import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null), logConsent: vi.fn(),
  workspaceMine: vi.fn().mockResolvedValue({ workspaces: [] }),
  workspaceListOrgs: vi.fn(),
  workspaceCreateOrg: vi.fn().mockResolvedValue({ org: { org_id: 'o3', name: 'Cabinet Dupont', created_at: Date.now() } }),
  workspaceDeleteOrg: vi.fn().mockResolvedValue({ ok: true, days_left: 90 }),
  workspaceRestoreOrg: vi.fn(),
  workspaceRead: vi.fn().mockResolvedValue({ data: { tools: [], employees: [], access: [], user: {} }, role: 'editor' }),
}));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
const authState = { firebaseUser: { uid: 'u1' }, isDemo: false, user: { plan: 'pro' } };   // stable: the hook refetches when it changes
vi.mock('../hooks/useAuth', () => ({ useAuth: () => authState }));
vi.mock('../components/AppShell', () => ({ AppShell: ({ children }) => <div>{children}</div> }));

import toast from 'react-hot-toast';
import { workspaceListOrgs, workspaceCreateOrg, workspaceDeleteOrg, workspaceRead } from '../firebase-config';
import { invalidateWorkspaceCaches } from '../hooks/useClientWorkspaces';
import { LanguageContext } from '../contexts/LangContext';
import { ClientsPage } from './ClientsPage';

// ── Managing client workspaces, as an accounting firm does it ──────────────
//
// Adding a client used window.prompt and deleting used window.confirm; opening
// one left you on the list. These hold the dialogs, the money format and the
// hand-off to the client's dashboard.

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
function Where() { const l = useLocation(); return <div data-testid="where" hidden>{l.pathname}</div>; }
const here = () => document.querySelector('[data-testid="where"]').textContent;
const button = (re) => [...document.querySelectorAll('button')].find((b) => re.test(b.textContent));
const click = (el) => act(async () => { el.click(); });
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const until = async (fn) => { for (let i = 0; i < 40 && !fn(); i++) await act(async () => { await new Promise((r) => setTimeout(r, 25)); }); };

async function mount(language = 'fr') {
  document.body.innerHTML = '';
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <LanguageContext.Provider value={{ language, setLanguage: () => {} }}>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter initialEntries={['/clients']}>
            <Routes><Route path="/clients" element={<ClientsPage />} /><Route path="/dashboard" element={<div>dashboard</div>} /></Routes>
            <Where />
          </MemoryRouter>
        </QueryClientProvider>
      </LanguageContext.Provider>,
    );
  });
  await settle();
}

beforeEach(() => {
  vi.clearAllMocks();
  invalidateWorkspaceCaches();
  localStorage.clear();
  workspaceListOrgs.mockResolvedValue({
    orgs: [{ org_id: 'o1', name: 'Boulangerie Martin', created_at: Date.now(), summary: { currency: '€', monthly_spend: 1840, tools: 14, updated_at: Date.now() } }],
    deleted: [], retention_days: 90,
  });
  vi.spyOn(window, 'prompt').mockImplementation(() => 'should not be used');
  vi.spyOn(window, 'confirm').mockImplementation(() => true);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('Clients page', () => {
  it('writes a client\'s spend the way the reader\'s language writes money', async () => {
    await mount('fr');
    expect(document.body.textContent).toMatch(/1\s840\s€\/mois/);
    expect(document.body.textContent).not.toContain('€1,840');
  });

  it('adds a client from a dialog, not the browser\'s prompt', async () => {
    await mount('fr');
    await click(button(/Ajouter un client/));
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const input = dialog.querySelector('input');
    // The Create button is off until there is a name.
    expect(button(/^Créer$/).disabled).toBe(true);
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'Cabinet Dupont');
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    await click(button(/^Créer$/));
    expect(workspaceCreateOrg).toHaveBeenCalledWith('Cabinet Dupont');
    expect(window.prompt).not.toHaveBeenCalled();
    await until(() => document.body.textContent.includes('Cabinet Dupont'));
    expect(document.body.textContent).toContain('Cabinet Dupont');
  });

  it('confirms a delete in a dialog that names the client and the window', async () => {
    await mount('fr');
    await click(button(/Supprimer/));
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain('Boulangerie Martin');
    expect(dialog.textContent).toContain('90 jours');
    expect(workspaceDeleteOrg).not.toHaveBeenCalled();       // nothing until confirmed
    await click([...dialog.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Supprimer'));
    expect(workspaceDeleteOrg).toHaveBeenCalledWith('o1');
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('cancelling the delete dialog deletes nothing', async () => {
    await mount('fr');
    await click(button(/Supprimer/));
    await click(button(/Annuler/));
    await until(() => !document.querySelector('[role="dialog"]'));
    expect(workspaceDeleteOrg).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('opening a client takes you to their dashboard, and says you can edit', async () => {
    await mount('fr');
    await click(button(/Ouvrir/));
    expect(workspaceRead).toHaveBeenCalledWith('o1');
    expect(here()).toBe('/dashboard');
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('modifications'));
    expect(toast.success).not.toHaveBeenCalledWith(expect.stringContaining('lecture seule'));
  });
});
