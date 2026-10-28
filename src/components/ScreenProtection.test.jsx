import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null), logConsent: vi.fn(),
}));
const auth = { user: {}, firebaseUser: { email: 'claire@acme.fr' }, isDemo: false };
vi.mock('../hooks/useAuth', () => ({ useAuth: () => auth }));

import { ScreenProtection } from './ScreenProtection';
import { FOUNDER_EMAILS } from '../lib/constants';

// ── The deterrent, as a viewer meets it ────────────────────────────────────

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
let focused;
const body = () => document.body;

// By default the viewer is someone the owner invited (a shared workspace,
// role viewer): the person the protection is for. The owner, and an admin,
// can switch it off, so it never applies to them (see 'does not apply').
const MEMBER = { owner_uid: 'o', owner_email: 'boss@acme.fr', role: 'viewer' };
async function mount({ on = true, shared = MEMBER, role } = {}) {
  localStorage.clear();
  localStorage.setItem('accessguard_v1', JSON.stringify({
    user: { is_authenticated: true, is_demo: false, plan: 'pro', role: role || (shared ? shared.role : 'owner'), ...(on ? { screen_protection: true } : {}) },
    tools: [], employees: [], access: [], ...(shared ? { _shared_view: shared } : {}),
  }));
  const host = document.createElement('div');
  host.id = 'root';
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<QueryClientProvider client={new QueryClient()}><ScreenProtection /></QueryClientProvider>);
  });
  for (let i = 0; i < 10; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
const fire = (target, type, init = {}) => act(async () => {
  const e = new window.Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, init);
  target.dispatchEvent(e);
  return e;
});
const key = (type, init) => act(async () => {
  const e = new window.KeyboardEvent(type, { bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(e);
});

beforeEach(() => {
  focused = true;
  vi.spyOn(document, 'hasFocus').mockImplementation(() => focused);
  Object.assign(auth, { user: {}, firebaseUser: { email: 'claire@acme.fr' }, isDemo: false });
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue() }, configurable: true });
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null; vi.restoreAllMocks(); document.body.innerHTML = ''; document.body.className = '';
});

describe('when it is on', () => {
  it('draws the viewer\'s own email over the screen and marks the page protected', async () => {
    await mount();
    const mark = document.querySelector('[data-testid="screen-watermark"]');
    expect(mark).not.toBeNull();
    expect(mark.textContent).toContain('claire@acme.fr');
    expect(mark.className).toMatch(/pointer-events-none/);
    expect(body().classList.contains('screen-protected')).toBe(true);
    expect(body().getAttribute('data-print-notice')).toMatch(/Printing is turned off|L'impression/);
  });

  it('blurs when the window loses focus and clears when it returns', async () => {
    await mount();
    expect(body().classList.contains('screen-blurred')).toBe(false);
    await fire(window, 'blur');
    expect(body().classList.contains('screen-blurred')).toBe(true);
    await fire(window, 'focus');
    expect(body().classList.contains('screen-blurred')).toBe(false);
  });

  it('starts blurred if the page opens behind another window', async () => {
    focused = false;
    await mount();
    expect(body().classList.contains('screen-blurred')).toBe(true);
  });

  it('does not blur while the client report is being printed', async () => {
    await mount();
    body().classList.add('printing-report');
    await fire(window, 'blur');
    expect(body().classList.contains('screen-blurred')).toBe(false);
  });

  it('Print Screen blurs for a moment and empties the clipboard', async () => {
    await mount();
    await key('keyup', { key: 'PrintScreen' });
    expect(body().classList.contains('screen-blurred')).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('');
  });

  it('refuses copy and right-click on the page, never in a text field', async () => {
    await mount();
    const div = document.createElement('div'); const input = document.createElement('input');
    document.body.append(div, input);
    for (const type of ['copy', 'cut', 'contextmenu', 'dragstart']) {
      expect((await fire(div, type)).defaultPrevented, `${type} on the page`).toBe(true);
      expect((await fire(input, type)).defaultPrevented, `${type} in a field`).toBe(false);
    }
  });

  it('leaves nothing behind when switched off', async () => {
    await mount();
    await act(async () => root.unmount());
    root = null;
    expect(body().classList.contains('screen-protected')).toBe(false);
    expect(body().classList.contains('screen-blurred')).toBe(false);
    expect(body().hasAttribute('data-print-notice')).toBe(false);
    expect(document.querySelector('[data-testid="screen-watermark"]')).toBeNull();
  });

  it('in a workspace shared with you, watermarks YOUR email, not the owner\'s', async () => {
    auth.firebaseUser = { email: 'collegue@cabinet.fr' };
    await mount({ shared: { owner_uid: 'o', role: 'editor' } });
    const text = document.querySelector('[data-testid="screen-watermark"]').textContent;
    expect(text).toContain('collegue@cabinet.fr');
  });
});

describe('when it does not apply', () => {
  it('off by default', async () => {
    await mount({ on: false });
    expect(document.querySelector('[data-testid="screen-watermark"]')).toBeNull();
    expect(body().classList.contains('screen-protected')).toBe(false);
    await fire(window, 'blur');
    expect(body().classList.contains('screen-blurred')).toBe(false);
  });

  it('the founder is never watermarked, blurred or refused', async () => {
    auth.firebaseUser = { email: FOUNDER_EMAILS[0] };
    await mount();
    expect(document.querySelector('[data-testid="screen-watermark"]')).toBeNull();
    const div = document.createElement('div'); document.body.appendChild(div);
    expect((await fire(div, 'copy')).defaultPrevented).toBe(false);
  });

  it('an account with the founder flag is exempt too', async () => {
    auth.user = { is_founder: true };
    // The flag only counts in the founder's own workspace; editor, so the
    // owner/admin rule is not what lets it through.
    await mount({ shared: null, role: 'editor' });
    expect(document.querySelector('[data-testid="screen-watermark"]')).toBeNull();
  });

  it('never for the owner or an admin in their own workspace: they can switch it off', async () => {
    await mount({ shared: null });
    expect(document.querySelector('[data-testid="screen-watermark"]')).toBeNull();
    const div = document.createElement('div'); document.body.appendChild(div);
    expect((await fire(div, 'copy')).defaultPrevented).toBe(false);
    await act(async () => root.unmount());
    root = null;
    await mount({ shared: null, role: 'admin' });
    expect(document.querySelector('[data-testid="screen-watermark"]')).toBeNull();
  });

  it('never in the demo', async () => {
    auth.isDemo = true;
    await mount();
    expect(document.querySelector('[data-testid="screen-watermark"]')).toBeNull();
  });
});
