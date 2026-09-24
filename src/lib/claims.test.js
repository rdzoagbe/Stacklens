import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

/* eslint-disable security/detect-non-literal-fs-filename --
   every path read here is a literal file in this repository, not user input. */

// ── What the site tells people has to be what the code does ────────────────
//
// A claims audit in September 2026 found a dozen public statements that the
// code contradicted, and not one of them was covered by a test. This repo is
// held accurate almost everywhere by guards like plan-parity and
// subprocessors; the claims were the part nothing watched. This file is where
// they are watched. Each block states a claim, then checks the code that would
// have to be true for it, so the day the code changes the copy fails with it.

const root = process.cwd();
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const norm = (x) => JSON.parse(JSON.stringify(x)); // strip the vm realm's prototypes

// ── 1. "Accept" means analytics, and never advertising ─────────────────────
//
// The banner offers "analytics cookies (Google Analytics)"; its Customize panel
// has two categories, essential and analytics. The privacy policy says
// analytics only. The DPA promises no cross-context behavioural advertising.
// Yet accepting used to grant ad_storage, ad_user_data and ad_personalization
// too, from four hand-typed copies of the same object — consent taken for one
// purpose, used for another, which is the CNIL's core complaint pattern and a
// signed contract clause made untrue.
//
// These tests EXECUTE the consent script from index.html rather than grep it,
// because the failure was never a missing string; it was what the code did.

const html = read('index.html');
const CONSENT_SCRIPT = (html.match(/<script>([\s\S]*?)<\/script>/g) || [])
  .map((block) => block.replace(/^<script>|<\/script>$/g, ''))
  .find((code) => code.includes('window.enableAnalytics'));
const VERSION = (CONSENT_SCRIPT || '').match(/CONSENT_VERSION\s*=\s*'([^']+)'/)?.[1];
const DAY = 24 * 60 * 60 * 1000;

const ANALYTICS_ONLY = {
  analytics_storage: 'granted',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};
const ALL_DENIED = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};

/** Runs the real consent script in a fresh page. `stored` is what localStorage holds. */
function loadPage({ stored } = {}) {
  const store = new Map();
  if (stored !== undefined) {
    store.set('cookie_consent_v2', typeof stored === 'string' ? stored : JSON.stringify(stored));
  }
  const loadedScripts = [];
  const firebase = [];
  const page = {
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem() {} },
    document: { createElement: () => ({}), head: { appendChild: (el) => loadedScripts.push(el) } },
    Date, JSON, Math,
  };
  page.window = page;
  page.__firebaseAnalyticsSetConsent = (state) => firebase.push(norm(state));
  vm.createContext(page);
  vm.runInContext(CONSENT_SCRIPT, page);
  const calls = () => page.dataLayer.map((args) => norm(Array.from(args)));
  const updates = () => calls().filter((c) => c[0] === 'consent' && c[1] === 'update').map((c) => c[2]);
  return { page, calls, updates, firebase, loadedScripts };
}

describe('cookie consent grants analytics and nothing for advertising', () => {
  it('finds the consent script it means to run', () => {
    expect(CONSENT_SCRIPT, 'no <script> in index.html defines window.enableAnalytics').toBeTruthy();
    expect(VERSION).toBeTruthy();
  });

  it('a first visit grants nothing and loads nothing', () => {
    const { calls, updates, loadedScripts } = loadPage();
    const defaults = calls().find((c) => c[0] === 'consent' && c[1] === 'default')[2];
    expect(defaults).toMatchObject(ALL_DENIED);
    expect(updates()).toEqual([]);
    expect(loadedScripts).toHaveLength(0);
  });

  it('clicking Accept grants analytics and leaves all three ad signals denied', () => {
    const { page, updates, loadedScripts } = loadPage();
    page.enableAnalytics();
    expect(updates()).toEqual([ANALYTICS_ONLY]);
    expect(loadedScripts).toHaveLength(1);
  });

  it('passes the same analytics-only state to the Firebase SDK', () => {
    const { page, firebase } = loadPage();
    page.enableAnalytics();
    expect(firebase).toEqual([ANALYTICS_ONLY]);
  });

  it('switches off Google signals and ad personalisation on the GA config itself', () => {
    const { page, calls } = loadPage();
    page.enableAnalytics();
    const config = calls().find((c) => c[0] === 'config');
    expect(config[2]).toMatchObject({ allow_google_signals: false, allow_ad_personalization_signals: false });
  });

  it('a returning visitor who accepted gets analytics only, before anything loads', () => {
    const { updates, loadedScripts } = loadPage({
      stored: { choice: 'accepted', version: VERSION, timestamp: Date.now() - 30 * DAY },
    });
    expect(updates()).toEqual([ANALYTICS_ONLY]);
    expect(loadedScripts).toHaveLength(1);
  });

  it('refuses a stored consent from an older banner version', () => {
    const { updates, loadedScripts } = loadPage({
      stored: { choice: 'accepted', version: 'v1-before-the-change', timestamp: Date.now() },
    });
    expect(updates()).toEqual([]);
    expect(loadedScripts).toHaveLength(0);
  });

  it('refuses a stored consent older than 13 months', () => {
    const { updates } = loadPage({
      stored: { choice: 'accepted', version: VERSION, timestamp: Date.now() - 14 * 30 * DAY },
    });
    expect(updates()).toEqual([]);
  });

  it('refuses a stored rejection and survives corrupted storage', () => {
    expect(loadPage({ stored: { choice: 'rejected', version: VERSION, timestamp: Date.now() } }).updates()).toEqual([]);
    expect(() => loadPage({ stored: '{not json' })).not.toThrow();
    expect(loadPage({ stored: '{not json' }).updates()).toEqual([]);
  });

  it('clicking Reject denies all four, in gtag and in Firebase', () => {
    const { page, updates, firebase } = loadPage();
    page.disableAnalytics();
    expect(updates()).toEqual([ALL_DENIED]);
    expect(firebase).toEqual([ALL_DENIED]);
  });

  it('no file anywhere grants an ad signal', () => {
    // The behavioural tests above cover index.html. firebase-config.js runs
    // inside the Firebase SDK and cannot be executed here, so it is checked by
    // source — and it was the one path that ALSO ignored version and expiry.
    const grant = /ad_(?:storage|user_data|personalization)\s*:\s*['"]granted['"]/;
    expect(html).not.toMatch(grant);
    expect(read('src/firebase-config.js')).not.toMatch(grant);
  });

  it('the Firebase load path uses the shared test, not its own weaker one', () => {
    const src = read('src/firebase-config.js');
    expect(src).toMatch(/window\.hasStoredAnalyticsConsent\(\)/);
    expect(src).toMatch(/firebaseSetConsent\(window\.ANALYTICS_CONSENT\)/);
    expect(src, 'reading the consent key directly bypasses the version and expiry checks')
      .not.toMatch(/getItem\(['"]cookie_consent_v2['"]\)/);
  });
});

// ── 2. What happens to an integration token ────────────────────────────────
//
// Under the Asana, Zoom, Okta, GitHub and Slack secret fields the app said
// "Stored locally in your browser. Never sent to Stacklens servers." They were
// sent: integrationCall posts them to the integrations endpoint, which keeps
// them in /integration_credentials/{uid}. That sentence is what persuades
// someone to paste an org-wide Okta admin token or a Zoom secret that never
// expires, and the in-app Security tab contradicted it on the next screen.
//
// Each part of the replacement sentence is a claim with code behind it, and
// each is checked below: sent to the server, readable by nobody, deleted on
// disconnect.

const translations = read('src/translations.js');
const tokenCopy = [...translations.matchAll(/int_stored_server:\s*"([^"]*)"/g)].map((m) => m[1]);

describe('the token hint says what the code does with the token', () => {
  it('exists in all five languages, and the old key is gone', () => {
    expect(tokenCopy).toHaveLength(5);
    expect(translations).not.toMatch(/int_stored_locally/);
  });

  it('is shown under every credential field', () => {
    const tab = read('src/pages/settings/IntegrationsTab.jsx');
    expect((tab.match(/t\('int_stored_server'\)/g) || []).length).toBe(5);
  });

  it('the code sends the credential to the server — so no language may say otherwise', () => {
    const cfg = read('src/firebase-config.js');
    const fn = cfg.slice(cfg.indexOf('export async function integrationCall'));
    expect(fn.slice(0, 600), 'integrationCall no longer posts credentials: '
      + 'if tokens now stay in the browser, rewrite int_stored_server to say so')
      .toMatch(/JSON\.stringify\(\{\s*vendor,\s*action,\s*credentials\s*\}\)/);
    const falseClaim = /locally|localement|lokal|localmente|never sent|jamais envoy|nie an|nunca se env|nunca enviado/i;
    for (const text of tokenCopy) expect(text).not.toMatch(falseClaim);
    expect(tokenCopy[0]).toMatch(/stored on the Stacklens server/);
  });

  // The server block for integrations: from its credential collection to the
  // next exported function, so the bankfeed endpoint's own "disconnect" is
  // never mistaken for this one.
  const fns = read('functions/index.js');
  const start = fns.indexOf("collection('integration_credentials')");
  const block = fns.slice(start, fns.indexOf('exports.', start));

  it('"nobody can read it back": the status reply carries no credential', () => {
    const status = block.slice(block.indexOf("action === 'status'"));
    const reply = status.slice(status.indexOf('res.json('), status.indexOf('});', status.indexOf('res.json(')));
    expect(reply).toMatch(/connected:/);
    expect(reply, 'the status reply now includes the stored value; the copy says nobody can read it back')
      .not.toMatch(/token|secret|credential|\.\.\.v|apiKey|password/i);
  });

  it('"disconnecting deletes it": the disconnect action deletes the stored field', () => {
    const disconnect = block.slice(block.indexOf("action === 'disconnect'"));
    expect(disconnect.slice(0, 200)).toMatch(/FieldValue\.delete\(\)/);
  });
});
