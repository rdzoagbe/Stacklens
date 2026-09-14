import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── The probe must never be able to break what it is testing ───────────────
//
// APP_CHECK_ENABLED has been flipped to true twice and taken sign-in down
// twice. The failure mode is that once App Check is initialised on the app
// Auth uses, the Auth SDK attaches an App Check token to every ID-token
// refresh; if minting it fails, the refresh is corrupted and checkout, the AI
// proxy and Firestore all start returning 401. There is no fail-open.
//
// So a probe that answers "would this work?" is only useful if it cannot
// itself cause that. Two properties carry the whole safety argument, and
// neither is visible from reading the happy path:
//
//   isolation   App Check is initialised on a SECOND, named Firebase app that
//               nothing else holds, never on the default one
//   no refresh  isTokenAutoRefreshEnabled is off, so no background loop
//               outlives the probe inside the page
//
// The tests below are mostly about those, not about the exchange succeeding —
// whether the exchange succeeds is a fact about Google Cloud configuration
// and cannot be tested here at all.

const appCheckCalls = [];
const initCalls = [];
const deleted = [];
let tokenBehaviour = () => ({ token: 'x'.repeat(120) });

vi.mock('firebase/app', () => ({
  initializeApp: (config, name) => { initCalls.push({ config, name }); return { name }; },
  deleteApp: async (app) => { deleted.push(app?.name); },
  getApps: () => [],
}));

vi.mock('firebase/app-check', () => ({
  initializeAppCheck: (app, options) => {
    appCheckCalls.push({ appName: app?.name, options });
    return { _app: app };
  },
  ReCaptchaV3Provider: class { constructor(key) { this.key = key; } },
  getToken: async () => tokenBehaviour(),
}));

const { probeAppCheck, explain } = await import('./appCheckProbe');

const config = { apiKey: 'k', projectId: 'p' };
// The site key is a build-time env var and is not set in a test run, so it is
// injected here. That the PRODUCTION path uses the same key as the real
// initialisation is asserted separately, against the source.
const opts = { siteKey: '6Ltest000000000000000000000000000000000' };

beforeEach(() => {
  appCheckCalls.length = 0;
  initCalls.length = 0;
  deleted.length = 0;
  tokenBehaviour = () => ({ token: 'x'.repeat(120) });
});

describe('the probe is isolated from the app Auth uses', () => {
  it('creates its own named Firebase app', async () => {
    await probeAppCheck(config, opts);
    expect(initCalls.length).toBe(1);
    expect(initCalls[0].name, 'the probe must pass a name, or it initialises the DEFAULT app '
      + '— which is the one Auth and Firestore are attached to, and the one whose '
      + 'token refresh a failing App Check corrupts').toBeTruthy();
  });

  it('initialises App Check on that app and no other', async () => {
    await probeAppCheck(config, opts);
    expect(appCheckCalls.length).toBe(1);
    expect(appCheckCalls[0].appName).toBe(initCalls[0].name);
  });

  it('never leaves a token-refresh loop running', async () => {
    // A background refresh would keep attempting the failing exchange after
    // the probe had reported, in the page the founder is still using.
    expect(appCheckCalls[0]?.options?.isTokenAutoRefreshEnabled).toBeUndefined();
    await probeAppCheck(config, opts);
    expect(appCheckCalls[0].options.isTokenAutoRefreshEnabled).toBe(false);
  });

  it('deletes its app afterwards', async () => {
    await probeAppCheck(config, opts);
    expect(deleted).toContain(initCalls[0].name);
  });

  it('deletes its app even when the exchange fails', async () => {
    // Repeated runs would otherwise stack up Firebase instances in the page.
    tokenBehaviour = () => { throw new Error('exchange failed with 400'); };
    await probeAppCheck(config, opts);
    expect(deleted).toContain(initCalls[0].name);
  });

  it('forces a refresh, so a cached token cannot answer for the exchange', async () => {
    // Without forceRefresh a token minted before the registration changed
    // keeps reporting success, which is worse than no probe.
    const src = readFileSync(resolve(process.cwd(), 'src/lib/appCheckProbe.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(src).toMatch(/getToken\([^)]*true/);
  });
});

describe('the probe always reports rather than throwing', () => {
  it('shows the raw error in the panel so it can be pasted', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/FounderAdminPage.jsx'), 'utf8');
    expect(page, 'the panel must render result.raw — the canned explanation '
      + 'alone left the first real failure undiagnosable')
      .toMatch(/result\.raw/);
  });

  it('reports success with the token length, never the token', async () => {
    const r = await probeAppCheck(config, opts);
    expect(r.ok).toBe(true);
    // A token is a credential. On screen it gets pasted into a chat or a
    // screenshot, so the length is the most that should ever be shown.
    expect(JSON.stringify(r)).not.toContain('x'.repeat(120));
    expect(r.detail).toMatch(/120 characters/);
  });

  it('reports a thrown failure instead of propagating it', async () => {
    tokenBehaviour = () => { throw new Error('boom'); };
    const r = await probeAppCheck(config, opts);
    expect(r.ok).toBe(false);
  });

  it('reports an exchange that returns no token', async () => {
    tokenBehaviour = () => ({});
    const r = await probeAppCheck(config, opts);
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/no token/);
  });

  it('refuses to run without a Firebase config', async () => {
    const r = await probeAppCheck({}, opts);
    expect(r.ok).toBe(false);
    expect(r.verdict).toBe('unavailable');
    expect(initCalls.length, 'nothing should be initialised').toBe(0);
  });
});

describe('the failure is explained in terms of what to go and fix', () => {
  it('names throttling, and that fixing the registration comes first', () => {
    const r = explain({ code: 'appCheck/throttled', message: 'throttled' });
    expect(r.verdict).toBe('throttled');
    // The first live run reported throttled, and the canned text alone said
    // what to do without saying what had gone wrong. Throttling is the
    // symptom; the registration is the cause, and that ordering is the advice.
    expect(r.detail).toMatch(/registration is still the cause/);
    expect(r.detail).toMatch(/throttle has expired/);
  });

  it('carries the raw Firebase error through every verdict', () => {
    // Dropped on the first version, which is what made the first real failure
    // undiagnosable: throttling then stops the next attempt from learning
    // anything. An error code and an HTTP status are not credentials.
    expect(explain({ code: 'appCheck/throttled', message: 'AppCheck: 403' }).raw)
      .toBe('appCheck/throttled: AppCheck: 403');
    expect(explain(new Error('exchangeRecaptchaV3Token returned 400')).raw)
      .toMatch(/400/);
    expect(explain(new Error('network down')).raw).toMatch(/network down/);
  });

  it('recognises a 403 as a rejected exchange, not just a 400', () => {
    // A provider that is not registered at all answers 403, and the first
    // version only matched 400 — so the commonest cause fell through to the
    // generic branch with no guidance attached.
    const r = explain(new Error('AppCheck exchange failed: 403 Forbidden'));
    expect(r.verdict).toBe('rejected');
    expect(r.detail).toMatch(/SECRET key/);
  });

  it('points a rejected exchange at the secret key and the domain list', () => {
    // The two things that were actually wrong in July. "It failed" sends you
    // to the wrong console page.
    const r = explain(new Error('exchangeRecaptchaV3Token returned 400'));
    expect(r.verdict).toBe('rejected');
    expect(r.detail).toMatch(/SECRET key/);
    expect(r.detail).toMatch(/allowed-domains/);
  });

  it('falls back to the raw message for anything else', () => {
    expect(explain(new Error('network down')).detail).toMatch(/network down/);
  });
});

describe('the probe tests the key App Check would really use', () => {
  it('uses the same site key as the real initialisation', () => {
    // A probe against a different key proves nothing about the thing being
    // turned on. Both read the production key from the same literal.
    const cfg = readFileSync(resolve(process.cwd(), 'src/firebase-config.js'), 'utf8');
    const m = /'(6L[\w-]{10,})'/.exec(cfg);
    expect(m, 'the production reCAPTCHA site key was not found in firebase-config').toBeTruthy();
    const probeSrc = readFileSync(resolve(process.cwd(), 'src/lib/appCheckProbe.js'), 'utf8');
    expect(probeSrc, 'the probe must use the same site key as firebase-config')
      .toContain(m[1]);
  });

  it('refuses to run with no site key at all', async () => {
    const r = await probeAppCheck(config, { siteKey: '' });
    expect(r.ok).toBe(false);
    expect(r.verdict).toBe('unavailable');
    expect(initCalls.length, 'nothing should be initialised').toBe(0);
  });
});

describe('App Check is still off, and stays off until the probe passes', () => {
  it('APP_CHECK_ENABLED is false', () => {
    // The point of the probe is that flipping this is a verified change, not a
    // third attempt. If a future commit flips it, this test is the place to
    // record that the probe returned a token on the live domain first.
    const cfg = readFileSync(resolve(process.cwd(), 'src/firebase-config.js'), 'utf8');
    expect(cfg, 'APP_CHECK_ENABLED was flipped — has the probe been run on the '
      + 'live domain and returned a token? It broke sign-in the last two times '
      + 'it was turned on without that.')
      .toMatch(/const APP_CHECK_ENABLED = false;/);
  });

  it('the probe is reachable from the founder page', () => {
    // A diagnostic nobody can run is not a diagnostic. This is the mistake
    // that left client workspaces unreachable for months.
    const page = readFileSync(resolve(process.cwd(), 'src/pages/FounderAdminPage.jsx'), 'utf8');
    expect(page).toMatch(/probeAppCheck/);
    expect(page).toMatch(/Test App Check/);
  });
});
