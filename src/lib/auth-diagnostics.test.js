import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { authErrorDetail, authErrorKey, authErrorMessage, authFail } from '../firebase-config';

// ── A failed sign-in says why ──────────────────────────────────────────────
//
// Every failure authErrorKey does not name became "Sign-in failed. Please try
// again." and nothing was logged. When Microsoft sign-in broke because the
// secret stored in Firebase had expired, the only clue was a 400 in the
// network tab. The code and the server's reason now reach the console and the
// generic sentence, without anything personal.

const t = (k) => ({ err_auth_generic: 'Sign-in failed. Please try again.', err_auth_bad_creds: 'Wrong email or password.', err_auth_popup_blocked: 'Popup blocked.' }[k] || k);

// What Firebase hands back for a rejected identity-provider exchange.
const idpError = (serverMessage) => Object.assign(new Error('Firebase: Error (auth/internal-error).'), {
  code: 'auth/internal-error',
  customData: { _serverResponse: { error: { message: serverMessage } } },
});

afterEach(() => vi.restoreAllMocks());

describe('authErrorDetail', () => {
  it('reads the code and the server’s reason from an Error', () => {
    expect(authErrorDetail(idpError('INVALID_IDP_RESPONSE : Error getting access token from microsoft.com')))
      .toEqual({ code: 'auth/internal-error', reason: 'INVALID_IDP_RESPONSE' });
  });

  it('reads the code from a message string, and the reason from the bracket authFail adds', () => {
    expect(authErrorDetail('Firebase: Error (auth/internal-error). [INVALID_IDP_RESPONSE]'))
      .toEqual({ code: 'auth/internal-error', reason: 'INVALID_IDP_RESPONSE' });
    expect(authErrorDetail('Firebase: Error (auth/popup-blocked).')).toEqual({ code: 'auth/popup-blocked', reason: '' });
  });

  it('keeps no reason when the server’s text is a sentence, and copes with nothing at all', () => {
    expect(authErrorDetail(idpError('Error getting access token')).reason).toBe('');
    expect(authErrorDetail(undefined)).toEqual({ code: '', reason: '' });
    expect(authErrorDetail(null)).toEqual({ code: '', reason: '' });
    expect(authErrorDetail({})).toEqual({ code: '', reason: '' });
  });
});

describe('authFail: what is logged, and what is handed back', () => {
  it('logs the provider, the code and the reason, and returns the message with the reason in brackets', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = authFail('microsoft', idpError('INVALID_IDP_RESPONSE : invalid_client'));
    expect(out).toBe('Firebase: Error (auth/internal-error). [INVALID_IDP_RESPONSE]');
    expect(warn).toHaveBeenCalledTimes(1);
    const line = warn.mock.calls[0].join(' ');
    expect(line).toContain('microsoft');
    expect(line).toContain('auth/internal-error');
    expect(line).toContain('INVALID_IDP_RESPONSE');
    // authErrorKey still finds the auth/ code inside it.
    expect(authErrorKey(out)).toBe('err_auth_generic');
  });

  it('never prints an email address or a long token', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const token = 'ya29.A0ARrdaM-' + 'x'.repeat(60);
    authFail('google', idpError(`INVALID_IDP_RESPONSE : bad token ${token} for jane.doe@company.com`));
    const line = warn.mock.calls[0].join(' ');
    expect(line).not.toContain('@');
    expect(line).not.toContain('jane');
    expect(line).not.toContain('xxxxxxxxxx');
    expect(line).toContain('<email>');
    expect(line).toContain('<token>');
  });

  it('does not log a person closing the popup, and returns a plain message unchanged', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const closed = Object.assign(new Error('Firebase: Error (auth/popup-closed-by-user).'), { code: 'auth/popup-closed-by-user' });
    expect(authFail('google', closed)).toBe('Firebase: Error (auth/popup-closed-by-user).');
    expect(warn).not.toHaveBeenCalled();
    expect(authFail('email', new Error('Firebase: Error (auth/wrong-password).'))).toBe('Firebase: Error (auth/wrong-password).');
  });

  it('does not add the bracket twice', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const once = authFail('microsoft', idpError('INVALID_IDP_RESPONSE : x'));
    expect(authFail('microsoft', once)).toBe(once);
  });
});

// What the real SDK produces for a rejected Microsoft exchange: the code is
// auth/invalid-credential and the provider's explanation sits in the message.
const sdkError = () => Object.assign(
  new Error('Firebase: Error getting access token from microsoft.com, OAuth2 error AADSTS7000222: The provided client secret keys are expired. (auth/invalid-credential).'),
  { code: 'auth/invalid-credential' },
);

describe('the provider’s explanation reaches the screen', () => {
  it('reads an AADSTS number out of the SDK’s own message', () => {
    expect(authErrorDetail(sdkError())).toEqual({ code: 'auth/invalid-credential', reason: 'AADSTS7000222' });
  });

  it('an SSO button shows it on “Wrong email or password.” too, an email form does not', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const raw = authFail('microsoft', sdkError());
    expect(authErrorMessage(raw, t, { sso: true })).toBe('Wrong email or password. (auth/invalid-credential · AADSTS7000222)');
    expect(authErrorMessage(raw, t)).toBe('Wrong email or password.');
  });

  it('logs the explanation without adding a second copy of it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = authFail('microsoft', sdkError());
    expect(out).toBe(sdkError().message);
    expect(warn.mock.calls[0].join(' ')).toContain('AADSTS7000222');
  });
});

describe('authErrorMessage', () => {
  it('the generic sentence carries the code and the reason', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const raw = authFail('microsoft', idpError('INVALID_IDP_RESPONSE : x'));
    expect(authErrorMessage(raw, t)).toBe('Sign-in failed. Please try again. (auth/internal-error · INVALID_IDP_RESPONSE)');
    expect(authErrorMessage('Firebase: Error (auth/internal-error).', t)).toBe('Sign-in failed. Please try again. (auth/internal-error)');
  });

  it('a failure with no code at all is still the plain generic sentence', () => {
    expect(authErrorMessage('something broke', t)).toBe('Sign-in failed. Please try again.');
  });

  it('every failure the table names keeps its own sentence, and a dismissed popup stays silent', () => {
    expect(authErrorMessage('Firebase: Error (auth/wrong-password).', t)).toBe('Wrong email or password.');
    expect(authErrorMessage('Firebase: Error (auth/popup-blocked).', t)).toBe('Popup blocked.');
    expect(authErrorMessage('Firebase: Error (auth/popup-closed-by-user).', t)).toBe('');
  });
});

describe('every sign-in path goes through it', () => {
  /* eslint-disable security/detect-non-literal-fs-filename --
     every path here is a file of this repository named in this test. */
  const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
  const cfg = read('src/firebase-config.js');

  it('the eight sign-in functions return authFail, not the bare message', () => {
    for (const fn of ['signInWithGoogleWorkspace', 'signInWithGoogle', 'signInWithMicrosoft', 'sendMagicLink',
      'completeMagicLinkSignIn', 'registerWithEmail', 'signInWithEmail', 'resetPassword']) {
      const i = cfg.indexOf(`export async function ${fn}(`);
      const body = cfg.slice(i, cfg.indexOf('\nexport ', i + 10));
      // Directly, or through signInResult (the second step of a sign-in),
      // which hands every failure to authFail itself.
      expect(body.includes('authFail(') || body.includes('signInResult('), fn).toBe(true);
      expect(body, fn).not.toContain('error: error.message');
    }
    const helper = cfg.slice(cfg.indexOf('async function signInResult('), cfg.indexOf('export async function signInWithGoogle('));
    expect((helper.match(/authFail\(provider, /g) || []).length).toBe(2);
  });

  it('the sign-in screen builds its sentence with authErrorMessage, never t(authErrorKey(...)) by hand', () => {
    const page = read('src/pages/TrialPage.jsx');
    expect(page).not.toMatch(/t\(authErrorKey\(/);
    expect(page).not.toMatch(/\bauthErrorKey\b/);
    expect((page.match(/authErrorMessage\(/g) || []).length).toBeGreaterThanOrEqual(6);
  });
});
