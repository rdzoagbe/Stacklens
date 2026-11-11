import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../firebase-config', () => ({
  sendMagicLink: vi.fn(), signInWithMicrosoft: vi.fn(), signInWithEmail: vi.fn(),
  resetPassword: vi.fn(), registerWithEmail: vi.fn(), authErrorKey: vi.fn(), authErrorMessage: vi.fn(() => ''),
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null), logConsent: vi.fn(), callAI: vi.fn(),
}));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('../lib/goToDashboard', () => ({ goToDashboard: vi.fn() }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ login: vi.fn(), startDemo: vi.fn(), isAuthed: false, firebaseUser: null }) }));
vi.mock('../components/AppShell', () => ({ LangSelectorCompact: () => null, _openCookieBanner: vi.fn() }));

import { TrialPage } from './TrialPage';
import { signInWithMicrosoft } from '../firebase-config';
import { goToDashboard } from '../lib/goToDashboard';
import { LanguageProvider } from '../contexts/LangContext';
import { translations } from '../translations';

// ── "?signup=true" opens the account form ──────────────────────────────────
//
// The free audit, the accountants page and the demo banner all link to
// /?signup=true. For a long time nothing read it: the reader landed on the
// home page and had to find the button again, which is exactly where a list
// handed over from the audit would be lost.

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;

async function open(search, lang = 'en') {
  localStorage.setItem('language', lang);
  window.history.pushState({}, '', `/${search}`);
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<LanguageProvider><MemoryRouter><TrialPage /></MemoryRouter></LanguageProvider>); });
}
const tab = (label) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label);

afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; window.history.pushState({}, '', '/'); });

describe('the sign-up link', () => {
  it('opens the form on the create-account tab', async () => {
    await open('?signup=true');
    const create = tab('Create Account');
    expect(create, 'the create tab is showing').toBeTruthy();
    expect(create.className).toContain('bg-blue-600');
  });

  it('the plain home page opens nothing', async () => {
    await open('');
    expect(tab('Create Account')).toBeFalsy();
  });
});

describe('the account forms, in French', () => {
  const fr = translations.fr;
  const labelsPointAtFields = () => {
    const labels = [...document.querySelectorAll('label')].filter((l) => !l.querySelector('input'));
    expect(labels.length).toBeGreaterThan(1);
    for (const l of labels) {
      const id = l.getAttribute('for');
      expect(id, `label "${l.textContent}" names no field`).toBeTruthy();
      expect(document.getElementById(id), `label "${l.textContent}" points at nothing`).toBeTruthy();
    }
  };

  it('sign-up: every label names its field, and nothing is left in English', async () => {
    await open('?signup=true', 'fr');
    labelsPointAtFields();
    const placeholders = [...document.querySelectorAll('input')].map((i) => i.placeholder);
    expect(placeholders).not.toContain('Jane Smith');
    expect(placeholders).not.toContain('you@company.com');
    const links = [...document.querySelectorAll('a')].map((a) => a.textContent.trim());
    expect(links).toContain(fr.footer_terms);
    expect(links).not.toContain('Terms');
  });

  it('sign-in: the same', async () => {
    await open('?signup=true', 'fr');
    // The nav has its own "Se connecter" buttons; the tab is the last one.
    const signinTab = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === fr.lp_auth_signin_tab).at(-1);
    await act(async () => { signinTab.click(); });
    expect(document.getElementById('signin-email')).toBeTruthy();
    labelsPointAtFields();
    const spans = [...document.querySelectorAll('span')].map((x) => x.textContent.trim());
    expect(spans).toContain(fr.lp_or);
    expect(spans).not.toContain('or');
  });
});

// ── Microsoft sign-in lands on the dashboard ───────────────────────────────
//
// It used to leave the person on the landing page with the sign-in window
// open until they reloaded: the success branch only had a comment saying
// something else would move on, and nothing did.
describe('Microsoft sign-in', () => {
  const click = async (label) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(label));
    expect(b, label).toBeTruthy();
    await act(async () => { b.click(); });
  };

  it('goes to the dashboard on success, without a reload by hand', async () => {
    signInWithMicrosoft.mockResolvedValueOnce({ user: { uid: 'u1' }, error: null });
    goToDashboard.mockClear();
    await open('?signin=true');
    await click('SSO');
    await click('Microsoft 365');
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(signInWithMicrosoft).toHaveBeenCalled();
    expect(goToDashboard).toHaveBeenCalledTimes(1);
  });

  it('stays put when the person closed the window', async () => {
    signInWithMicrosoft.mockResolvedValueOnce({ user: null, error: 'Firebase: Error (auth/popup-closed-by-user).' });
    goToDashboard.mockClear();
    await open('?signin=true');
    await click('SSO');
    await click('Microsoft 365');
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(goToDashboard).not.toHaveBeenCalled();
  });
});

// ── The pricing grid sells yearly too ──────────────────────────────────────
//
// Settings → Billing always had Monthly / Yearly; the public grid showed only
// the monthly price. Yearly shows what the yearly price comes to per month,
// to the cent, with the yearly total and the saving under it, from the same
// plan cards checkout uses.
describe('the pricing grid', () => {
  const card = (id) => document.querySelector(`[data-testid="lp-yearly-${id}"]`);
  const toggle = (label) => [...document.querySelectorAll('[data-testid="lp-billing-toggle"] button')]
    .find((b) => b.textContent.startsWith(label));

  it('opens on monthly, with Starter at €39', async () => {
    await open('');
    expect(toggle('Monthly').getAttribute('aria-pressed')).toBe('true');
    expect(card('starter')).toBeNull();
    expect(document.getElementById('pricing').textContent).toContain('€39');
  });

  it('yearly shows the per-month figure and the yearly total, and leaves Enterprise and Free alone', async () => {
    await open('');
    await act(async () => { toggle('Annual').click(); });
    const grid = document.getElementById('pricing').textContent;
    expect(grid).toContain('€31');
    expect(grid).not.toMatch(/€\d+\.\d/);
    expect(card('starter').textContent).toBe('€372 once a year, €96 less than monthly');
    expect(card('pro').textContent).toContain('€756');
    expect(card('business').textContent).toContain('€1,428');
    expect(card('enterprise')).toBeNull();
    expect(card('free')).toBeNull();
    expect(grid).toContain('€299');
  });
});
