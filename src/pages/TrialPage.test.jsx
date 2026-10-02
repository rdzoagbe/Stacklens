import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../firebase-config', () => ({
  sendMagicLink: vi.fn(), signInWithMicrosoft: vi.fn(), signInWithEmail: vi.fn(),
  resetPassword: vi.fn(), registerWithEmail: vi.fn(), authErrorKey: vi.fn(),
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null), logConsent: vi.fn(), callAI: vi.fn(),
}));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ login: vi.fn(), startDemo: vi.fn(), isAuthed: false, firebaseUser: null }) }));
vi.mock('../components/AppShell', () => ({ LangSelectorCompact: () => null, _openCookieBanner: vi.fn() }));

import { TrialPage } from './TrialPage';
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
