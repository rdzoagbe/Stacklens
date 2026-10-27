import { describe, it, expect, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null),
  logConsent: vi.fn(), callAI: vi.fn(),
}));

import { SecondFactorPrompt } from './SecondFactorPrompt';
import { askForSecondFactor, cancelSecondFactor, currentSecondFactor, mfaErrorText } from '../lib/secondFactor';
import { translations } from '../translations';

// ── Two-step sign-in: the code that finishes every sign-in ─────────────────

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const en = (k) => translations.en[k] || k;

let root, host;
async function type(el, value) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, value);
  await act(async () => { el.dispatchEvent(new window.Event('input', { bubbles: true })); });
}
async function mount() {
  localStorage.setItem('language', 'en');
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<SecondFactorPrompt />); });
}
afterEach(async () => {
  cancelSecondFactor();
  await act(async () => { root?.unmount(); });
  host?.remove();
});
const submitButton = () => [...document.querySelectorAll('button')].find((b) => b.textContent === en('mfa_verify'));

describe('the code prompt', () => {
  it('appears when a sign-in needs the second step, and finishes it with the code', async () => {
    await mount();
    expect(document.querySelector('[data-testid="second-factor-prompt"]')).toBeNull();
    const verify = vi.fn(async (code) => ({ user: { uid: 'u1' }, code }));
    let done;
    await act(async () => { done = askForSecondFactor(verify); });
    expect(document.body.textContent).toContain(en('mfa_prompt_body'));
    await type(document.querySelector('#second-factor-code'), '123 456');
    await act(async () => { submitButton().click(); });
    await expect(done).resolves.toEqual({ user: { uid: 'u1' }, code: '123456' });
    expect(verify).toHaveBeenCalledWith('123456');
    expect(document.querySelector('[data-testid="second-factor-prompt"]')).toBeNull();
  });

  it('a wrong code says so and lets the person try again', async () => {
    await mount();
    const verify = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('bad'), { code: 'auth/invalid-verification-code' }))
      .mockResolvedValueOnce({ user: { uid: 'u1' } });
    let done;
    await act(async () => { done = askForSecondFactor(verify); });
    await type(document.querySelector('#second-factor-code'), '000000');
    await act(async () => { submitButton().click(); });
    expect(document.querySelector('[role="alert"]').textContent).toBe(en('mfa_wrong_code'));
    expect(currentSecondFactor()).not.toBeNull();
    await type(document.querySelector('#second-factor-code'), '654321');
    await act(async () => { submitButton().click(); });
    await expect(done).resolves.toEqual({ user: { uid: 'u1' } });
  });

  it('closing it ends the sign-in silently, as a closed popup does', async () => {
    await mount();
    let done;
    await act(async () => { done = askForSecondFactor(vi.fn()).catch((e) => e); });
    await act(async () => { cancelSecondFactor(); });
    const err = await done;
    expect(err.code).toBe('auth/user-cancelled');
    expect(document.querySelector('[data-testid="second-factor-prompt"]')).toBeNull();
    // authErrorKey stays silent for it, and authFail does not log it.
    const cfg = readFileSync(resolve(process.cwd(), 'src/firebase-config.js'), 'utf8');
    expect(cfg).toMatch(/case 'auth\/user-cancelled':\s*return '';/);
    expect(cfg).toMatch(/const DISMISSED = \/auth\\\/\(popup-closed-by-user\|cancelled-popup-request\|user-cancelled\)\//);
  });
});

describe('what Firebase answers, in words', () => {
  it('names each case a person can act on, and quotes the code otherwise', () => {
    expect(mfaErrorText({ code: 'auth/requires-recent-login' }, en)).toBe(en('mfa_recent_login'));
    expect(mfaErrorText({ code: 'auth/unverified-email' }, en)).toBe(en('mfa_need_verified'));
    expect(mfaErrorText({ code: 'auth/operation-not-allowed' }, en)).toBe(en('mfa_not_available'));
    expect(mfaErrorText({ message: 'Firebase: x (auth/quota-exceeded).' }, en)).toBe(en('mfa_failed').replace('{code}', 'auth/quota-exceeded'));
  });
});

describe('every sign-in path goes through the second step', () => {
  const cfg = readFileSync(resolve(process.cwd(), 'src/firebase-config.js'), 'utf8');
  const body = (fn) => { const i = cfg.indexOf(`export async function ${fn}(`); return cfg.slice(i, cfg.indexOf('\nexport ', i + 10)); };

  it('Google, Microsoft, email, magic link and the Google Workspace popup', () => {
    for (const fn of ['signInWithGoogle', 'signInWithMicrosoft', 'signInWithEmail', 'completeMagicLinkSignIn', 'signInWithGoogleWorkspace']) {
      expect(body(fn), fn).toMatch(/signInResult\('[a-z-]+', \(\) => /);
    }
    expect(cfg).toMatch(/if \(error\?\.code !== SECOND_FACTOR_REQUIRED\)/);
    expect(cfg).toMatch(/const SECOND_FACTOR_REQUIRED = 'auth\/multi-factor-auth-required';/);
    expect(cfg).toMatch(/TotpMultiFactorGenerator\.assertionForSignIn\(hint\.uid, code\)/);
  });

  it('the prompt is mounted once for the whole app, and the set-up is in Settings → Security', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8');
    expect(app.match(/<SecondFactorPrompt \/>/g)).toHaveLength(1);
    const sec = readFileSync(resolve(process.cwd(), 'src/pages/settings/SecurityTab.jsx'), 'utf8');
    expect(sec).toMatch(/<TwoStepCard firebaseUser=\{firebaseUser\}/);
  });

  it('the secret never reaches browser storage', () => {
    const card = readFileSync(resolve(process.cwd(), 'src/components/TwoStepCard.jsx'), 'utf8');
    expect(card).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  });

  it('the project-wide switch is founder-only, behind the founder check', () => {
    const fns = readFileSync(resolve(process.cwd(), 'functions/index.js'), 'utf8');
    const ops = fns.slice(fns.indexOf('exports.founderops'));
    expect(ops.indexOf('isFounderCaller(')).toBeGreaterThan(-1);
    expect(ops.indexOf("action === 'enableTotp'")).toBeGreaterThan(ops.indexOf('isFounderCaller('));
    expect(ops).toMatch(/providerConfigs: \[\{ state: 'ENABLED', totpProviderConfig: \{ adjacentIntervals: 5 \} \}\]/);
  });
});
