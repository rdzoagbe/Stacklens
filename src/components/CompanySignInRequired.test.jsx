import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../firebase-config', () => ({
  signInWithGoogle: vi.fn(async () => ({ user: { uid: 'g1' }, error: null })),
  signInWithMicrosoft: vi.fn(async () => ({ user: null, error: 'auth/popup-closed-by-user' })),
  signOutUser: vi.fn(async () => ({ error: null })),
  authErrorMessage: vi.fn(() => ''),
  saveUserData: vi.fn(), loadUserData: vi.fn(), logConsent: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { signInWithGoogle, signInWithMicrosoft, signOutUser } from '../firebase-config';
import { LanguageContext } from '../contexts/LangContext';
import { raiseSsoBlock, clearSsoBlock, currentSsoBlock } from '../lib/sso';
import { CompanySignInRequired } from './CompanySignInRequired';

// ── The screen shown when a session is not the company sign-in ─────────────

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const screen = () => document.querySelector('[data-testid="sso-block"]');
const button = (re) => [...document.querySelectorAll('button')].find((b) => re.test(b.textContent.trim()));

async function mount(language = 'en') {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<LanguageContext.Provider value={{ language, setLanguage: () => {} }}><CompanySignInRequired /></LanguageContext.Provider>);
  });
  await settle();
}

beforeEach(() => { vi.clearAllMocks(); clearSsoBlock(); localStorage.clear(); });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; document.body.innerHTML = ''; clearSsoBlock(); });

describe('CompanySignInRequired', () => {
  it('shows nothing until a refusal is raised, then names the account and the method', async () => {
    await mount();
    expect(screen()).toBeNull();
    await act(async () => { raiseSsoBlock({ scope: 'own', owner: 'ana@acme.fr', signedInWith: 'password' }); });
    await settle();
    expect(screen().getAttribute('role')).toBe('dialog');
    expect(screen().textContent).toContain('Company sign-in required');
    expect(screen().textContent).toContain('ana@acme.fr must be opened with a Google or Microsoft work account. This session signed in with a password or a magic link.');
    expect(screen().textContent).toContain('Use the same email address');
    expect(button(/^Continue with Google$/)).toBeTruthy();
    expect(button(/^Continue with Microsoft$/)).toBeTruthy();
    expect(button(/^Logout$/)).toBeTruthy();
    expect(button(/^Back to my workspace$/)).toBeUndefined();
  });

  it('for a shared workspace it names the owner and offers a way back that keeps the session', async () => {
    await mount();
    await act(async () => { raiseSsoBlock({ scope: 'shared', owner: 'claire@acme.fr', signedInWith: 'phone' }); });
    await settle();
    expect(screen().textContent).toContain('claire@acme.fr requires everyone who opens this workspace');
    expect(screen().textContent).toContain('signed in with another method');
    expect(button(/^Logout$/)).toBeUndefined();
    await act(async () => { button(/^Back to my workspace$/).click(); });
    await settle();
    expect(screen()).toBeNull();
    expect(currentSsoBlock()).toBeNull();
    expect(signOutUser).not.toHaveBeenCalled();
  });

  it('the Google button starts a new session and reloads; a closed Microsoft popup leaves the screen as it was', async () => {
    const replace = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { value: { ...original, replace }, writable: true, configurable: true });
    try {
      await mount();
      await act(async () => { raiseSsoBlock({ scope: 'own', owner: 'ana@acme.fr', signedInWith: 'password' }); });
      await settle();
      await act(async () => { button(/^Continue with Microsoft$/).click(); });
      await settle();
      expect(signInWithMicrosoft).toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
      expect(screen()).not.toBeNull();
      await act(async () => { button(/^Continue with Google$/).click(); });
      await settle();
      expect(signInWithGoogle).toHaveBeenCalled();
      expect(replace).toHaveBeenCalledWith('/dashboard');
      expect(currentSsoBlock()).toBeNull();
    } finally {
      Object.defineProperty(window, 'location', { value: original, writable: true, configurable: true });
    }
  });

  it('signing out ends the session and clears the browser, and the screen goes', async () => {
    localStorage.setItem('accessguard_v1', JSON.stringify({ user: { is_authenticated: true, email: 'ana@acme.fr' }, tools: [] }));
    localStorage.setItem('sg_auth_uid', 'u1');
    await mount();
    await act(async () => { raiseSsoBlock({ scope: 'own', owner: 'ana@acme.fr', signedInWith: 'password' }); });
    await settle();
    await act(async () => { button(/^Logout$/).click(); });
    await settle();
    expect(signOutUser).toHaveBeenCalled();
    expect(localStorage.getItem('accessguard_v1')).toBeNull();
    expect(localStorage.getItem('sg_auth_uid')).toBeNull();
    expect(screen()).toBeNull();
  });

  it('reads in French', async () => {
    await mount('fr');
    await act(async () => { raiseSsoBlock({ scope: 'own', owner: '', signedInWith: 'password' }); });
    await settle();
    expect(screen().textContent).toContain("Connexion d'entreprise exigée");
    expect(screen().textContent).toContain("Cet espace doit être ouvert avec un compte professionnel Google ou Microsoft. Cette session s'est connectée avec un mot de passe ou un lien magique.");
  });
});
