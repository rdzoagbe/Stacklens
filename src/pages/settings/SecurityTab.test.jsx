import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null), logConsent: vi.fn(),
  secondFactors: vi.fn(() => []), startTwoStep: vi.fn(), finishTwoStep: vi.fn(), removeTwoStep: vi.fn(),
  resendEmailVerification: vi.fn(async () => ({ error: null })), refreshEmailVerified: vi.fn(async () => ({ verified: false, error: null })),
}));

import { saveUserData, secondFactors, startTwoStep, finishTwoStep, resendEmailVerification, refreshEmailVerified } from '../../firebase-config';
import { loadDb } from '../../lib/db';
import { translations } from '../../translations';
import { SecurityTab } from './SecurityTab';

// ── Settings → Security: the screen-protection switch ──────────────────────

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const t = (k) => translations.en[k] || k;
let root;
const settle = async () => { for (let i = 0; i < 10; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const sw = () => document.querySelector('[data-testid="screen-protection-card"] [role="switch"]');

async function mount(user = {}, extra = {}, firebaseUser = { uid: 'u1' }) {
  localStorage.clear();
  localStorage.setItem('accessguard_v1', JSON.stringify({
    user: { is_authenticated: true, plan: 'pro', role: 'owner', ...user }, tools: [], employees: [], access: [], ...extra,
  }));
  const qc = new QueryClient();
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<QueryClientProvider client={qc}><MemoryRouter><SecurityTab t={t} firebaseUser={firebaseUser} qc={qc} /></MemoryRouter></QueryClientProvider>);
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

describe('two-step sign-in', () => {
  const card = () => document.querySelector('[data-testid="two-step-card"]');
  const button = (label) => [...card().querySelectorAll('button')].find((b) => b.textContent === label);
  beforeEach(() => { secondFactors.mockReturnValue([]); });

  it('is offered to a signed-in account, and set up with a QR code and the first code', async () => {
    startTwoStep.mockResolvedValue({ secret: { id: 's' }, qrUrl: 'otpauth://totp/Stacklens:a@b.example?secret=ABC&issuer=Stacklens', key: 'ABC' });
    finishTwoStep.mockResolvedValue();
    await mount({}, {}, { uid: 'u1', emailVerified: true });
    expect(card().textContent).toContain(t('mfa_off'));
    await act(async () => { button(t('mfa_enable')).click(); });
    await settle();
    const img = card().querySelector('img');
    expect(img.getAttribute('src')).toMatch(/^data:image\/gif;base64,/);
    expect(card().textContent).toContain('ABC');
    const input = card().querySelector('input');
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, '123456');
    await act(async () => { input.dispatchEvent(new window.Event('input', { bubbles: true })); });
    secondFactors.mockReturnValue([{ uid: 'f1', factorId: 'totp', enrollmentTime: 'Tue, 27 Oct 2026 10:00:00 GMT' }]);
    await act(async () => { button(t('mfa_turn_on')).click(); });
    await settle();
    expect(finishTwoStep).toHaveBeenCalledWith({ id: 's' }, '123456');
    expect(card().textContent).toContain(t('mfa_turn_off'));
  });

  it('asks for a verified email first, and is not shown without an account', async () => {
    await mount({}, {}, { uid: 'u1', emailVerified: false });
    expect(card().textContent).toContain(t('mfa_need_verified'));
    expect(button(t('mfa_enable'))).toBeUndefined();
    await act(async () => root.unmount());
    root = null;
    await mount({}, {}, null);
    expect(document.querySelector('[data-testid="two-step-card"]')).toBeNull();
  });

  it('sends the verification link again and lets the person carry on once verified', async () => {
    await mount({}, {}, { uid: 'u1', emailVerified: false });
    await act(async () => { button(t('resend_verification')).click(); });
    await settle();
    expect(resendEmailVerification).toHaveBeenCalledTimes(1);
    // A second click waits out the cooldown.
    expect(button(t('resend_verification'))).toBeUndefined();
    expect(card().textContent).toContain(t('resend_in'));

    await act(async () => { button(t('ive_verified')).click(); });
    await settle();
    expect(card().textContent).toContain(t('email_not_verified_yet'));
    expect(button(t('mfa_enable'))).toBeUndefined();

    refreshEmailVerified.mockResolvedValueOnce({ verified: true, error: null });
    await act(async () => { button(t('ive_verified')).click(); });
    await settle();
    expect(button(t('mfa_enable'))).toBeDefined();
    expect(card().textContent).not.toContain(t('mfa_need_verified'));
  });

  it('says plainly when the project has not switched it on', async () => {
    startTwoStep.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/operation-not-allowed' }));
    await mount({}, {}, { uid: 'u1', emailVerified: true });
    await act(async () => { button(t('mfa_enable')).click(); });
    await settle();
    expect(card().querySelector('[role="alert"]').textContent).toBe(t('mfa_not_available'));
  });
});
