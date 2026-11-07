import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(3), loadUserData: vi.fn().mockResolvedValue(null), logConsent: vi.fn(), workspaceRead: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { saveUserData } from '../firebase-config';
import { translations } from '../translations';
import { ReconcilePanel } from './ReconcilePanel';

// ── Settings → Data → Compare with the stored copy ─────────────────────────

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const t = (k) => translations.en[k] || k;
let root;
const settle = async () => { for (let i = 0; i < 10; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const button = (re) => [...document.querySelectorAll('button')].find((b) => re.test(b.textContent.trim()));
const box = (id) => document.querySelector(`[data-testid="${id}"]`);
const rows = (prefix, n) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }));

async function mount({ db, stored, isDemo = false, shared = null } = {}) {
  localStorage.clear();
  const local = { user: { is_authenticated: true, plan: 'pro', role: 'owner' }, tools: rows('t', 3), employees: rows('e', 2), access: rows('a', 4), _rev: 2, ...(shared ? { _shared_view: shared } : {}), ...db };
  localStorage.setItem('accessguard_v1', JSON.stringify(local));
  const deps = { loadUserData: vi.fn(async () => stored), workspaceRead: vi.fn(async () => ({ data: stored, role: 'editor' })) };
  const host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  await act(async () => { root.render(<ReconcilePanel db={local} firebaseUser={{ uid: 'u1' }} isDemo={isDemo} t={t} deps={deps} />); });
  await settle();
  return deps;
}
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; document.body.innerHTML = ''; });
beforeEach(() => vi.clearAllMocks());

describe('ReconcilePanel', () => {
  it('says the copies are the same when every record is on both sides', async () => {
    await mount({ stored: { tools: rows('t', 3), employees: rows('e', 2), access: rows('a', 4), _rev: 2, _updatedAt: 1762500000000 } });
    await act(async () => { button(/^Compare now$/).click(); }); await settle();
    expect(box('reconcile-verdict').textContent).toBe('This browser holds exactly what is stored.');
    expect(box('reconcile-table').textContent).toContain('Access');
    expect(box('reconcile-table').querySelectorAll('tbody tr')).toHaveLength(10);
    expect(document.body.textContent).toContain('Revision here 2, stored 2');
    expect(button(/^Save now$/)).toBeUndefined();
  });

  it('names what is missing on each side, offers to save, and saves through the revision-checked path', async () => {
    const deps = await mount({ stored: { tools: rows('t', 2).concat([{ id: 'tOld' }]), employees: rows('e', 2), access: rows('a', 2), _rev: 3 } });
    await act(async () => { button(/^Compare now$/).click(); }); await settle();
    expect(box('reconcile-verdict').textContent).toBe('The two copies differ: 1 record(s) stored but not here, 3 here but not yet stored.');
    const text = box('reconcile-table').textContent;
    expect(text).toContain('1 missing here');
    expect(text).toContain('1 not yet stored');
    expect(text).toContain('2 not yet stored');
    expect(button(/^Use the stored copy$/)).toBeTruthy();
    await act(async () => { button(/^Save now$/).click(); }); await settle();
    expect(saveUserData).toHaveBeenCalledWith('u1', expect.objectContaining({ tools: rows('t', 3) }));
    expect(deps.loadUserData).toHaveBeenCalledTimes(2);
  });

  it('with nothing stored, says so and counts everything as unsaved', async () => {
    await mount({ stored: null });
    await act(async () => { button(/^Compare now$/).click(); }); await settle();
    expect(box('reconcile-verdict').textContent).toBe('Nothing is stored yet for this workspace: everything here is unsaved.');
    expect(button(/^Save now$/)).toBeTruthy();
    expect(button(/^Use the stored copy$/)).toBeUndefined();
  });

  it('a shared workspace is read through the endpoint; a viewer gets no Save button', async () => {
    const deps = await mount({ shared: { owner_uid: 'o9', role: 'viewer' }, stored: { tools: [{ id: 'tX' }], _rev: 9 } });
    await act(async () => { button(/^Compare now$/).click(); }); await settle();
    expect(deps.workspaceRead).toHaveBeenCalledWith('o9');
    expect(deps.loadUserData).not.toHaveBeenCalled();
    expect(button(/^Save now$/)).toBeUndefined();
    expect(button(/^Use the stored copy$/)).toBeUndefined();
    expect(document.body.textContent).toContain('open this workspace again from Client workspaces');
  });

  it('the demo has nothing to compare, and a failed read is reported', async () => {
    await mount({ isDemo: true });
    expect(button(/^Compare now$/)).toBeUndefined();
    expect(box('reconcile').textContent).toContain('The demo is not stored anywhere');
    await act(async () => root.unmount()); root = null; document.body.innerHTML = '';
    const deps = await mount({ stored: null });
    deps.loadUserData.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { button(/^Compare now$/).click(); }); await settle();
    expect(document.querySelector('[role=alert]').textContent).toContain('offline');
  });
});
