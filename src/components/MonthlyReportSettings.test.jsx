import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(1), loadUserData: vi.fn().mockResolvedValue(null), logConsent: vi.fn(),
  sendMonthlyReportNow: vi.fn().mockResolvedValue({ sent: true, to: 'daf@acme.fr' }),
}));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import toast from 'react-hot-toast';
import { sendMonthlyReportNow, saveUserData } from '../firebase-config';
import { track } from '../lib/analytics';
import { loadDb } from '../lib/db';
import { translations } from '../translations';
import { MonthlyReportSettings } from './MonthlyReportSettings';

// ── Settings → Notifications: turning the monthly report on ────────────────

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const t = (k) => translations.en[k] || k;
let root;
const qc = { invalidateQueries: vi.fn() };
const panel = () => document.querySelector('[data-testid="monthly-report-settings"]');
const click = (el) => act(async () => { el.click(); });
const type = (el, v) => act(async () => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
});
const button = (text) => [...panel().querySelectorAll('button')].find((b) => b.textContent.trim() === text);

async function mount(email = 'daf@acme.fr', monthly_report) {
  localStorage.clear();
  localStorage.setItem('accessguard_v1', JSON.stringify({
    user: { is_authenticated: true, email, ...(monthly_report ? { monthly_report } : {}) },
    tools: [], employees: [], access: [],
  }));
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<MonthlyReportSettings firebaseUser={{ uid: 'u1', email }} qc={qc} t={t} language="fr" />);
  });
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; });

describe('the monthly report setting', () => {
  it('is off by default, and turning it on saves it with the app language', async () => {
    await mount();
    const toggle = panel().querySelector('[role="switch"]');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await click(toggle);
    expect(loadDb().user.monthly_report).toEqual({ enabled: true, recipients: [], lang: 'fr' });
    expect(saveUserData).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('monthly_report_toggled', { enabled: true });
    expect(panel().textContent).toContain('Sent to daf@acme.fr.');
  });

  it('accepts colleagues on the company domain and says which it will not send to', async () => {
    await mount('daf@acme.fr', { enabled: true, recipients: [], lang: 'fr' });
    await type(panel().querySelector('input'), 'dg@acme.fr, someone@gmail.com; compta@acme.fr');
    expect(panel().textContent).toContain('Will not be sent to: someone@gmail.com.');
    await click(button('Save'));
    expect(loadDb().user.monthly_report.recipients).toEqual(['dg@acme.fr', 'compta@acme.fr']);
    expect(toast.success).toHaveBeenCalledWith('Recipients saved.');
  });

  it('from a public mail domain, colleagues cannot be added at all', async () => {
    await mount('roland@gmail.com', { enabled: true, recipients: [], lang: 'fr' });
    expect(panel().querySelector('input')).toBeNull();
    expect(panel().textContent).toContain('only from a company address');
  });

  it('sends an example to the account, in the app language, and says where', async () => {
    await mount('daf@acme.fr', { enabled: true, recipients: [], lang: 'fr' });
    await click(button('Send me an example now'));
    expect(sendMonthlyReportNow).toHaveBeenCalledWith('fr');
    expect(toast.success).toHaveBeenCalledWith('Example sent to daf@acme.fr.');
  });

  it('says why when the server refuses: an unverified address, or email switched off', async () => {
    sendMonthlyReportNow.mockRejectedValueOnce(new Error('no_email'));
    await mount('daf@acme.fr', { enabled: true, recipients: [], lang: 'fr' });
    await click(button('Send me an example now'));
    expect(toast.error).toHaveBeenLastCalledWith('Confirm your email address first: the report is only sent to a verified address.');
    sendMonthlyReportNow.mockRejectedValueOnce(new Error('mail_not_configured'));
    await click(button('Send me an example now'));
    expect(toast.error).toHaveBeenLastCalledWith(expect.stringContaining('Email sending is not switched on'));
  });

  it("inside someone else's workspace, it says these are your own account's settings and changes nothing", async () => {
    localStorage.clear();
    localStorage.setItem('accessguard_v1', JSON.stringify({ _shared_view: { owner_uid: 'o', role: 'editor' }, user: { email: 'owner@client.fr' }, tools: [] }));
    const host = document.createElement('div'); document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(<MonthlyReportSettings firebaseUser={{ uid: 'u1', email: 'daf@acme.fr' }} qc={qc} t={t} language="fr" />); });
    expect(panel().textContent).toContain("These are your own account's settings");
    expect(panel().querySelector('[role="switch"]')).toBeNull();
    expect(saveUserData).not.toHaveBeenCalled();
  });

  it('a failed send says so', async () => {
    sendMonthlyReportNow.mockRejectedValueOnce(new Error('send_failed'));
    await mount('daf@acme.fr', { enabled: true, recipients: [], lang: 'fr' });
    await click(button('Send me an example now'));
    expect(toast.error).toHaveBeenCalledWith('The example could not be sent. Try again in a few minutes.');
  });
});
