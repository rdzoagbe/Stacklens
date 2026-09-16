import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { authErrorKey } from '../firebase-config';

// ── "Continue with Google" did nothing, and said nothing ───────────────────
//
// I told the founder this was a missing-redirect problem: signInWithPopup is
// blocked in iOS in-app browsers, so a visitor arriving from a LinkedIn or
// Instagram link taps the button and nothing happens. The symptom was right.
// The cause was not, and it was two lines away from the thing I was reading.
//
//   case 'auth/popup-closed-by-user':
//   case 'auth/cancelled-popup-request':
//   case 'auth/popup-blocked':          ← this one
//   case 'auth/user-cancelled':           return '';  // user dismissed
//
// auth/popup-blocked is not a dismissal. The person tapped the button; the
// BROWSER refused to open the window. Filing it under "user dismissed" and
// returning '' means the app deliberately stays quiet about the one failure
// the user cannot diagnose and can actually work around — there is a magic
// link on the same screen.
//
// And the Google branch compounded it: handleSSOClick awaited login(), login()
// caught its own error and returned, so nothing threw, the catch never ran,
// and setLoading(false) was never reached. Raw Firebase string in a toast,
// then a button spinning until the page is reloaded.
//
// Unlike most of this repo's auth guards, authErrorKey is a pure function, so
// these call it instead of reading the file.

describe('a blocked popup is not a cancelled one', () => {
  it('tells the user when the browser blocked the window', () => {
    expect(authErrorKey('Firebase: Error (auth/popup-blocked).'),
      'silence here is indistinguishable from the app being broken, and it is ' +
      'the case a social-link visitor hits')
      .toBe('err_auth_popup_blocked');
  });

  it('treats the same condition reported differently the same way', () => {
    // What Firebase returns instead in some embedded webviews.
    expect(authErrorKey('auth/operation-not-supported-in-this-environment'))
      .toBe('err_auth_popup_blocked');
  });

  it('still stays silent when the person closed the popup themselves', () => {
    // The genuinely silent cases. Telling someone their own click failed is
    // noise, and this is the half of the old grouping that was correct.
    expect(authErrorKey('auth/popup-closed-by-user')).toBe('');
    expect(authErrorKey('auth/cancelled-popup-request')).toBe('');
    expect(authErrorKey('auth/user-cancelled')).toBe('');
  });

  it('reads the code out of a whole Error, not just a string', () => {
    expect(authErrorKey(new Error('Firebase: Error (auth/popup-blocked).')))
      .toBe('err_auth_popup_blocked');
    expect(authErrorKey({ code: 'auth/popup-blocked' }))
      .toBe('err_auth_popup_blocked');
  });

  it('has not lost the mappings that already worked', () => {
    expect(authErrorKey('auth/wrong-password')).toBe('err_auth_bad_creds');
    expect(authErrorKey('auth/invalid-credential')).toBe('err_auth_bad_creds');
    expect(authErrorKey('auth/user-not-found')).toBe('err_auth_no_account');
    expect(authErrorKey('auth/too-many-requests')).toBe('err_auth_too_many');
    expect(authErrorKey('auth/network-request-failed')).toBe('err_auth_network');
    expect(authErrorKey('auth/email-already-in-use')).toBe('err_auth_email_used');
  });

  it('falls back to the generic message for anything unrecognised', () => {
    expect(authErrorKey('auth/some-code-that-does-not-exist')).toBe('err_auth_generic');
    expect(authErrorKey('not a firebase error at all')).toBe('err_auth_generic');
    expect(authErrorKey(undefined)).toBe('err_auth_generic');
    expect(authErrorKey(null)).toBe('err_auth_generic');
  });

  it('every key it can return exists in English and French', () => {
    // A key with no string renders as the raw key — "err_auth_popup_blocked"
    // in a toast — which is worse than the silence it replaced.
    const cfg = readFileSync(resolve(process.cwd(), 'src/firebase-config.js'), 'utf8');
    const fn = cfg.slice(cfg.indexOf('export function authErrorKey'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    const keys = [...new Set([...body.matchAll(/return '(err_auth_[a-z_]+)'/g)].map(m => m[1]))];
    expect(keys.length, 'no keys found — has the function been rewritten?')
      .toBeGreaterThan(5);

    // Counted by splitting rather than with new RegExp(key): a computed
    // pattern trips security/detect-non-literal-regexp, and this file is
    // linted. Splitting on the literal is the same count and needs no escape
    // rules.
    const tr = readFileSync(resolve(process.cwd(), 'src/translations.js'), 'utf8');
    for (const key of keys) {
      const count = tr.split(key + ':').length - 1;
      expect(count, `${key} is returned by authErrorKey but has ${count} ` +
        `translation(s); a missing one renders the raw key in a toast`)
        .toBeGreaterThanOrEqual(2);
    }
  });
});

// ── The button has to come back ───────────────────────────────────────────
//
// Source checks, because this half lives in a component and there is no
// @testing-library/react in this project. Comments stripped: a guard in this
// repo was once satisfied by the comment describing the code.
describe('a failed Google sign-in releases the button', () => {
  const strip = (raw) => raw
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const page = () => strip(readFileSync(resolve(process.cwd(), 'src/pages/TrialPage.jsx'), 'utf8'));
  const hook = () => strip(readFileSync(resolve(process.cwd(), 'src/hooks/useAuth.js'), 'utf8'));

  it('the Google branch clears loading when sign-in fails', () => {
    const at = page().indexOf("if (provider.id === 'google')");
    expect(at, 'the Google branch was not found').toBeGreaterThan(-1);
    const branch = page().slice(at, page().indexOf("provider.id === 'microsoft'"));
    expect(branch, 'without this the button spins for ever: login() catches ' +
      'its own error, so nothing throws and the catch never runs')
      .toMatch(/setLoading\(false\)/);
  });

  it('and maps the failure through the shared mapper', () => {
    const at = page().indexOf("if (provider.id === 'google')");
    const branch = page().slice(at, page().indexOf("provider.id === 'microsoft'"));
    expect(branch, 'Google must use the same mapper as Microsoft — one screen, ' +
      'one behaviour').toMatch(/authErrorKey\(error\)/);
  });

  it('login no longer builds a message it cannot translate', () => {
    // useAuth has no t(). Anything it writes is either English-only or a raw
    // Firebase string, which is what this was.
    expect(hook(), 'a raw Firebase error string was reaching the user')
      .not.toMatch(/Sign in failed/);
    expect(hook(), 'the error must go back to the caller, which has t()')
      .toMatch(/return \{ user: null, error \}/);
  });

  it('both providers end up in the same three lines', () => {
    // The actual defect was divergence: two buttons on one screen, one
    // mapping its errors and clearing its flag, the other doing neither.
    const src = page();
    const googleAt = src.indexOf("if (provider.id === 'google')");
    const msAt = src.indexOf("provider.id === 'microsoft'");
    const google = src.slice(googleAt, msAt);
    const ms = src.slice(msAt, src.indexOf("provider.id === 'magic'"));
    for (const [name, branch] of [['google', google], ['microsoft', ms]]) {
      expect(branch, `the ${name} branch must map its error`).toMatch(/authErrorKey/);
      expect(branch, `the ${name} branch must clear loading`).toMatch(/setLoading\(false\)/);
    }
  });
});
