import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(undefined),
  deleteAccount: vi.fn(),
  signOutUser: vi.fn().mockResolvedValue(undefined),
  createBillingPortal: vi.fn().mockResolvedValue({ url: 'https://billing.example/portal' }),
}));
vi.mock('../../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { deleteAccount, signOutUser } from '../../firebase-config';
import { DataTab } from './DataTab';

// ── The Delete account button deletes the account ──────────────────────────
//
// It used to email a request through a contact form and delete nothing, while
// the DPA, privacy policy and security page promised self-service erasure.
// These tests click through it as a user would. The key facts: the account is
// only deleted after the email is typed back; a subscription that can still
// bill stops it and offers the way out; and nothing signs the user out unless
// the deletion actually happened.

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host, root, assign;
const t = (k) => k;
const setInput = (el, value) => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(el, value);
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
};
const button = (label) => [...host.ownerDocument.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(async () => {
  deleteAccount.mockReset();
  signOutUser.mockClear();
  assign = vi.fn();
  Object.defineProperty(window, 'location', { configurable: true, value: { assign, href: '' } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<DataTab db={{ tools: [] }} firebaseUser={{ email: 'owner@cabinet.fr' }} isDemo={false} qc={{ invalidateQueries() {} }} t={t} />);
  });
  await act(async () => { button('set_del_account_btn').click(); });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.body.innerHTML = '';
});

describe('deleting an account from Settings → Data', () => {
  it('opens a confirmation instead of doing anything', () => {
    expect(document.body.textContent).toContain('del_acct_title');
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('stays disabled until the email is typed back, ignoring case and spaces', async () => {
    const input = document.body.querySelector('input');
    expect(button('del_acct_confirm_btn').disabled).toBe(true);
    await act(async () => setInput(input, 'someone@else.fr'));
    expect(button('del_acct_confirm_btn').disabled).toBe(true);
    await act(async () => setInput(input, '  Owner@Cabinet.FR '));
    expect(button('del_acct_confirm_btn').disabled).toBe(false);
  });

  it('calls the real erasure, then signs out and leaves', async () => {
    deleteAccount.mockResolvedValue(undefined);
    await act(async () => setInput(document.body.querySelector('input'), 'owner@cabinet.fr'));
    await act(async () => { button('del_acct_confirm_btn').click(); });
    await flush();
    expect(deleteAccount).toHaveBeenCalledWith('owner@cabinet.fr');
    expect(signOutUser).toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith('/');
  });

  it('a subscription that can still bill stops it, and offers to manage the subscription', async () => {
    deleteAccount.mockRejectedValue(Object.assign(new Error('Cancel your subscription first.'), { code: 'subscription_active', status: 409 }));
    await act(async () => setInput(document.body.querySelector('input'), 'owner@cabinet.fr'));
    await act(async () => { button('del_acct_confirm_btn').click(); });
    await flush();
    expect(document.body.textContent).toContain('Cancel your subscription first.');
    expect(button('del_acct_manage_sub')).toBeTruthy();
    expect(signOutUser, 'must not sign out when nothing was deleted').not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it('any other failure is reported and nothing else happens', async () => {
    deleteAccount.mockRejectedValue(new Error('Verify your email address before deleting your account'));
    await act(async () => setInput(document.body.querySelector('input'), 'owner@cabinet.fr'));
    await act(async () => { button('del_acct_confirm_btn').click(); });
    await flush();
    expect(document.body.textContent).toContain('Verify your email address');
    expect(button('del_acct_manage_sub')).toBeFalsy();
    expect(signOutUser).not.toHaveBeenCalled();
  });
});
