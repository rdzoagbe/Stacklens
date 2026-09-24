import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(7),
  loadUserData: vi.fn().mockResolvedValue(null),
  logConsent: vi.fn().mockResolvedValue(undefined),
  workspaceWrite: vi.fn().mockResolvedValue({ ok: true }),
  workspaceRead: vi.fn().mockResolvedValue({ data: {}, role: 'editor' }),
}));

import { saveUserData } from '../firebase-config';
import { SIGN_OUT_KEYS, clearLocalWorkspace, flushBeforeSignOut, setFirestoreUid } from './db';

// ── Signing out leaves nothing of the account behind ───────────────────────
//
// localStorage is this app's primary read path, so a signed-in browser holds
// the whole workspace: every employee's name and work email. Signing out used
// to keep all of it, so on a shared machine — an accounting practice's front
// desk — the next person could read the last client's staff list out of the
// browser. The security page now says signing out removes it. These tests hold
// that to the code, and hold the other half too: clearing must never throw
// away work the cloud does not have.

const MARK = 'accessguard_synced_v1';
const workspace = (user) => JSON.stringify({ user, tools: [{ id: 't1' }], employees: [{ email: 'a@b.fr' }] });
const signedIn = { is_authenticated: true, is_demo: false };

beforeEach(() => {
  localStorage.clear();
  saveUserData.mockReset().mockResolvedValue(7);
  setFirestoreUid('u1');
});

describe('clearLocalWorkspace', () => {
  it('removes the workspace, the owner backup, secrets and connection state', () => {
    for (const k of SIGN_OUT_KEYS) localStorage.setItem(k, 'x');
    clearLocalWorkspace();
    for (const k of SIGN_OUT_KEYS) expect(localStorage.getItem(k), k).toBeNull();
  });

  it('covers the keys that actually hold personal data or secrets', () => {
    expect(SIGN_OUT_KEYS).toEqual(expect.arrayContaining([
      'accessguard_v1', 'sg_own_workspace_backup', 'saasguard_db', 'slack_webhook',
    ]));
  });

  it('leaves the visitor’s own preferences alone', () => {
    localStorage.setItem('language', 'fr');
    localStorage.setItem('cookie_consent_v2', '{"choice":"accepted"}');
    clearLocalWorkspace();
    expect(localStorage.getItem('language')).toBe('fr');
    expect(localStorage.getItem('cookie_consent_v2')).toBe('{"choice":"accepted"}');
  });
});

describe('flushBeforeSignOut never lets clearing lose work', () => {
  it('nothing to do when the cloud already has everything', async () => {
    localStorage.setItem('accessguard_v1', workspace(signedIn));
    localStorage.setItem(MARK, 'clean');
    expect(await flushBeforeSignOut()).toBe(true);
    expect(saveUserData).not.toHaveBeenCalled();
  });

  it('writes unsynced work to the cloud first, then says it is safe', async () => {
    localStorage.setItem('accessguard_v1', workspace(signedIn));
    localStorage.setItem(MARK, 'dirty');
    expect(await flushBeforeSignOut()).toBe(true);
    expect(saveUserData).toHaveBeenCalledTimes(1);
    expect(saveUserData.mock.calls[0][0]).toBe('u1');
    expect(saveUserData.mock.calls[0][1].employees).toEqual([{ email: 'a@b.fr' }]);
    expect(localStorage.getItem(MARK)).toBe('clean');
  });

  it('treats an absent marker as unsynced, which is the safe reading', async () => {
    localStorage.setItem('accessguard_v1', workspace(signedIn));
    expect(await flushBeforeSignOut()).toBe(true);
    expect(saveUserData).toHaveBeenCalledTimes(1);
  });

  it('reports unsafe when the write fails, so the caller asks first', async () => {
    localStorage.setItem('accessguard_v1', workspace(signedIn));
    localStorage.setItem(MARK, 'dirty');
    saveUserData.mockRejectedValueOnce(new Error('offline'));
    expect(await flushBeforeSignOut()).toBe(false);
  });

  it('reports unsafe inside someone else’s workspace rather than guess', async () => {
    localStorage.setItem('accessguard_v1', JSON.stringify({ user: signedIn, _shared_view: { owner_uid: 'o', role: 'editor' } }));
    localStorage.setItem(MARK, 'dirty');
    expect(await flushBeforeSignOut()).toBe(false);
    expect(saveUserData).not.toHaveBeenCalled();
  });

  it('reports unsafe when there is no cloud account to write to', async () => {
    setFirestoreUid(null);
    localStorage.setItem('accessguard_v1', workspace(signedIn));
    localStorage.setItem(MARK, 'dirty');
    expect(await flushBeforeSignOut()).toBe(false);
  });

  it('demo data is never the user’s, so there is nothing to protect', async () => {
    localStorage.setItem('accessguard_v1', workspace({ is_authenticated: false, is_demo: true }));
    localStorage.setItem(MARK, 'dirty');
    expect(await flushBeforeSignOut()).toBe(true);
    expect(saveUserData).not.toHaveBeenCalled();
  });
});
