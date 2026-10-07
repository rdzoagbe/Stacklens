import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null), logConsent: vi.fn(),
}));

import { saveUserData } from '../../firebase-config';
import { loadDb } from '../../lib/db';
import { translations } from '../../translations';
import { SecurityTab } from './SecurityTab';

// ── Settings → Security: the screen-protection switch ──────────────────────

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const t = (k) => translations.en[k] || k;
let root;
const settle = async () => { for (let i = 0; i < 10; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const sw = () => document.querySelector('[data-testid="screen-protection-card"] [role="switch"]');

async function mount(user = {}, extra = {}) {
  localStorage.clear();
  localStorage.setItem('accessguard_v1', JSON.stringify({
    user: { is_authenticated: true, plan: 'pro', role: 'owner', ...user }, tools: [], employees: [], access: [], ...extra,
  }));
  const qc = new QueryClient();
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<QueryClientProvider client={qc}><MemoryRouter><SecurityTab t={t} firebaseUser={{ uid: 'u1' }} qc={qc} /></MemoryRouter></QueryClientProvider>);
  });
  for (let i = 0; i < 10; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; document.body.innerHTML = ''; });

describe('the screen-protection switch', () => {
  it('is off by default, says what it is not, and an owner can turn it on and off', async () => {
    await mount();
    expect(sw().getAttribute('aria-checked')).toBe('false');
    expect(document.querySelector('[data-testid="screen-protection-limits"]').textContent).toMatch(/cannot stop the system's screenshot/);
    await act(async () => { sw().click(); });
    expect(loadDb().user.screen_protection).toBe(true);
    expect(saveUserData).toHaveBeenCalled();
    await settle();
    expect(sw().getAttribute('aria-checked')).toBe('true');
    await act(async () => { sw().click(); });
    expect(loadDb().user.screen_protection).toBe(false);
  });

  it('an editor can read it and cannot change it', async () => {
    await mount({ role: 'editor' });
    expect(sw().disabled).toBe(true);
    await act(async () => { sw().click(); });
    expect(loadDb().user.screen_protection).toBeUndefined();
    expect(document.body.textContent).toContain('Only an owner or admin can change this.');
  });

  it('in someone else\'s workspace it is theirs to set', async () => {
    await mount({ role: 'owner' }, { _shared_view: { owner_uid: 'o', role: 'editor' } });
    expect(sw().disabled).toBe(true);
    expect(document.body.textContent).toContain('belongs to the workspace owner');
    expect(saveUserData).not.toHaveBeenCalled();
  });
});
