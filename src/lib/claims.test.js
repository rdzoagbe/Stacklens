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

// ── Shared helpers for the claims below ────────────────────────────────────

/** The value of `key` in one locale block of translations.js, or undefined. */
function copy(lang, key) {
  // Literal patterns only, filtered by name: a pattern built from its input
  // is the shape that turns into an injection once someone parameterises it.
  const heads = [...translations.matchAll(/^ {2}([a-z]{2}): \{$/gm)];
  const i = heads.findIndex((h) => h[1] === lang);
  if (i < 0) return undefined;
  const block = translations.slice(heads[i].index, heads[i + 1]?.index);
  const hit = [...block.matchAll(/\b([a-zA-Z0-9_]+):\s*"((?:[^"\\]|\\.)*)"/g)].find((m) => m[1] === key);
  return hit ? hit[2] : undefined;
}
const functionsSrc = read('functions/index.js');

// ── 3. What cancelling and deleting actually do ────────────────────────────
//
// The site gave four different answers — deleted on cancel, deleted 30 days
// after cancel, kept while the account is active — and the code did a fifth:
// cancelling deletes nothing, and the "Delete account" button emailed the
// founder through a US form service and deleted nothing either.

describe('cancelling and deleting are described as the code does them', () => {
  it('the Stripe cancellation handler deletes nothing', () => {
    const at = functionsSrc.indexOf("case 'customer.subscription.deleted'");
    const handler = functionsSrc.slice(at, functionsSrc.indexOf('break;', at));
    expect(handler).toMatch(/plan: 'free'/);
    expect(handler, 'cancellation now deletes data: rewrite the cancel copy to say so')
      .not.toMatch(/purgeAccount|\.delete\(|recursiveDelete/);
  });

  it('so no page says cancelling deletes your data', () => {
    const cancelDeletes = /(when you cancel|on cancel|lors de la résiliation|quand vous résiliez).{0,40}(delet|supprim|effac)|30 days, then is deleted|30 jours, puis/i;
    for (const key of ['sec_card_delete_body', 'lp_faq_a6', 'lp_faq7_a', 'privacy_s5_body', 'terms_s7_body', 'terms_s10_body']) {
      for (const lang of ['en', 'fr']) {
        const text = copy(lang, key);
        expect(text, `${lang}.${key} missing`).toBeTruthy();
        expect(text, `${lang}.${key}`).not.toMatch(cancelDeletes);
      }
    }
    expect(copy('en', 'sec_card_delete_body')).toMatch(/free plan and keeps your data/);
    // The terms said "Upon termination, your data will be deleted within 30
    // days" beside a privacy policy saying cancelling keeps it. Both now say
    // the same thing, and this pins the terms to it.
    expect(copy('en', 'terms_s7_body')).toMatch(/Cancelling a paid subscription does not delete it/);
    expect(copy('fr', 'terms_s7_body')).toMatch(/Résilier un abonnement payant ne les supprime pas/);
    expect(copy('en', 'terms_s7_body')).not.toMatch(/Upon termination, your data will be deleted/);
  });

  it('the Delete account button calls the real erasure, not a contact form', () => {
    const tab = read('src/pages/settings/DataTab.jsx');
    expect(tab).toMatch(/await deleteAccount\(/);
    expect(tab, 'deletion is back to emailing a request').not.toMatch(/submitContactForm/);
  });
});

// ── 4. What stays in the browser ───────────────────────────────────────────
//
// "Never stored in plaintext" sat above an architecture whose primary read
// path is a plain-JSON copy of the workspace in localStorage — which signing
// out did not even remove. The page now says the local copy exists and that
// signing out removes it; both halves are pinned here.

describe('the browser copy is described truthfully', () => {
  it('no page says data is never stored in plaintext', () => {
    expect(translations).not.toMatch(/never stored in plaintext|jamais stockées en clair/i);
  });

  it('says a local copy exists and that signing out removes it', () => {
    expect(copy('en', 'sec_card_enc_body')).toMatch(/local storage[^.]*not encrypted/);
    expect(copy('en', 'sec_card_enc_body')).toMatch(/Signing out removes it/);
  });

  it('and signing out does remove it', () => {
    const auth = read('src/hooks/useAuth.js');
    const logout = auth.slice(auth.indexOf('const logout = async'));
    expect(logout.slice(0, 600)).toMatch(/clearLocalWorkspace\(\)/);
    expect(logout.slice(0, 600), 'sign-out must flush unsynced work before clearing')
      .toMatch(/flushBeforeSignOut\(\)/);
  });
});

// ── 5. Export means everything ─────────────────────────────────────────────

describe('"export everything" covers everything', () => {
  it('the Data tab offers the whole-workspace JSON export', () => {
    expect(read('src/pages/settings/DataTab.jsx')).toMatch(/downloadWorkspaceExport\(/);
  });

  it('the export takes every customer array, including ones added later', async () => {
    const { buildWorkspaceExport } = await import('./workspace-export');
    const out = buildWorkspaceExport({
      name: 'x', data: {
        tools: [{ id: 1 }], budgets: [{ year: 2026 }], uploaded_invoices: [{ id: 'i' }],
        some_future_list: [{ a: 1 }], _chunks: [1, 2], user: { email: 'x@y.fr' },
      },
    });
    expect(out.budgets).toEqual([{ year: 2026 }]);
    expect(out.uploaded_invoices).toEqual([{ id: 'i' }]);
    expect(out.some_future_list, 'a new workspace array fell out of the export').toEqual([{ a: 1 }]);
    expect(out._chunks, 'internal bookkeeping must not be exported').toBeUndefined();
  });

  it('no invoice is kept outside the workspace any more', () => {
    const tab = read('src/pages/finance/RenewalsTab.jsx');
    expect(tab, 'uploaded invoices are being written outside the workspace again')
      .not.toMatch(/setItem\(['"]ag_uploaded_invoices['"]/);
  });
});

// ── 6. Which endpoints take no sign-in ─────────────────────────────────────
//
// The security page said "every server API requires an authenticated token".
// Four HTTP endpoints do not, by design, each checking something else. The
// page now names all four; this fails the day a fifth appears unannounced.

describe('the security page names every endpoint that takes no sign-in', () => {
  const exportsList = [...functionsSrc.matchAll(/^exports\.(\w+)\s*=\s*onRequest/gm)].map((m, i, all) => {
    const end = all[i + 1] ? all[i + 1].index : functionsSrc.length;
    return { name: m[1], body: functionsSrc.slice(m.index, end) };
  });
  const noSignIn = exportsList.filter((e) => !/verifyAuth\(/.test(e.body)).map((e) => e.name).sort();

  it('finds the endpoints it means to check', () => {
    expect(exportsList.length).toBeGreaterThan(10);
  });

  it('is exactly the four the page describes', () => {
    expect(noSignIn, 'an endpoint without sign-in was added or removed: update sec_card_abuse_body')
      .toEqual(['api', 'clientErrors', 'invoiceInbound', 'stripeWebhook']);
  });

  it('and the page names each one with what it checks instead', () => {
    const text = copy('en', 'sec_card_abuse_body');
    for (const phrase of ['public API (your API key)', "Stripe's signature", 'invoice inbox', 'crash reports']) {
      expect(text).toContain(phrase);
    }
    expect(text).not.toMatch(/every server API/i);
  });
});

// ── 7. Everything that goes to Anthropic is disclosed ──────────────────────
//
// The DPA and privacy policy disclosed contract comparison only. Invoices,
// including ones arriving by email with no one clicking anything, the support
// chat and the weekly email summary went to Anthropic too. Each sender is now
// named; a new one fails here until it is.

describe('every feature that sends data to Anthropic is disclosed', () => {
  const src = 'src';
  const callers = ['src/components/FloatingChatbot.jsx', 'src/pages/ContractComparisonPage.jsx',
    'src/pages/finance/BudgetTab.jsx', 'src/translations.js'];

  it('the client callers are exactly the known ones', async () => {
    const { readdirSync, statSync } = await import('node:fs');
    const { join, relative } = await import('node:path');
    const walk = (d) => readdirSync(d).flatMap((f) => {
      const p = join(d, f);
      if (statSync(p).isDirectory()) return walk(p);
      return /\.jsx?$/.test(f) && !/\.test\./.test(f) ? [p] : [];
    });
    const found = walk(resolve(root, src))
      .filter((p) => /\bcallAI\(/.test(readFileSync(p, 'utf8')))
      .map((p) => relative(root, p))
      .filter((p) => p !== 'src/firebase-config.js')
      .sort();
    expect(found, 'a new AI caller: disclose it in privacy_s4_body, subproc_anthropic_purpose and dpa_s8_body')
      .toEqual([...callers].sort());
  });

  it('the browser sends AI requests to the ai function only', async () => {
    // A second route (a Cloudflare Worker, tried first when VITE_WORKER_URL
    // was set) bundled a secret into the public site, had no per-user rate
    // limit, and was not on the sub-processors page. Removed 2026-10-07.
    const cfg = read('src/firebase-config.js');
    const fn = cfg.slice(cfg.indexOf('export async function callAI'), cfg.indexOf('// FIRESTORE DATA LAYER'));
    expect(fn.match(/fetch\(/g)).toHaveLength(1);
    expect(fn).toContain('`${FUNCTIONS_BASE}/ai`');
    expect(cfg).not.toMatch(/VITE_WORKER|workerUrl/);
    expect(read('.github/workflows/build.yml')).not.toMatch(/VITE_WORKER/);
    const { existsSync } = await import('node:fs');
    expect(existsSync(resolve(root, 'workers'))).toBe(false);
  });

  it('the server senders are exactly the known ones', () => {
    const hits = [...functionsSrc.matchAll(/api\.anthropic\.com/g)].length;
    expect(hits, 'a new server-side Anthropic call: disclose it').toBe(3);
    expect(functionsSrc).toMatch(/async function extractInvoicesWithAI/);
    expect(functionsSrc).toMatch(/async function weeklyAiInsight/);
  });

  it('the privacy policy names each one', () => {
    const text = copy('en', 'privacy_s4_body');
    for (const feature of ['comparing contracts', 'invoice inbox', 'support assistant', 'weekly email', 'Interface text']) {
      expect(text).toContain(feature);
    }
    expect(copy('en', 'subproc_anthropic_purpose')).not.toMatch(/only when feature is explicitly used/);
  });
});

// ── 8. Small claims that were simply stale ─────────────────────────────────

describe('small claims', () => {
  it('no page carries a hardcoded "last updated" month', () => {
    expect(read('src/pages/LegalPages.jsx')).not.toMatch(/: July 2026|Last updated: \w+ 20\d\d/);
  });

  it('the footer GDPR link goes to the privacy policy, not About', () => {
    expect(read('src/pages/TrialPage.jsx')).not.toMatch(/to="\/about"[^>]*>GDPR</);
  });

  it('nothing offers to "download" a whitepaper that does not exist', () => {
    expect(copy('en', 'hc_download_security_whitepaper')).not.toMatch(/download/i);
  });

  it('no locale makes the blanket "GDPR compliant" claim', () => {
    expect(translations).not.toMatch(/"Conforme RGPD"|"GDPR-compliant"|"GDPR compliant"/);
  });

  it('Web3Forms is described as receiving name and email, which it does', () => {
    expect(read('src/lib/contact.js')).toMatch(/from_name:\s*name/);
    expect(copy('en', 'subproc_web3forms_transfer')).toMatch(/name, email address and message/);
  });

  it('Sentry is described as performance monitoring too, since tracing is on', () => {
    expect(read('src/main.jsx')).toMatch(/tracesSampleRate/);
    expect(copy('en', 'subproc_sentry_purpose')).toMatch(/performance/);
  });
});

// ── 9. The early-access offer ──────────────────────────────────────────────
//
// The page promises a plan, a length, a number of places, and that the account
// returns to free with nothing charged. Each is tied to the code that does it:
// the numbers are placeholders filled from EARLY_ACCESS, the founder's button
// grants exactly EARLY_ACCESS, and the return to free is grantExpired() in
// both plan resolvers (plan-parity.test.js) and a rules-protected end date
// (firestore-rules.test.js).
describe('the early-access offer is what the grant gives', () => {
  it('no number is typed into the offer copy', () => {
    for (const lang of ['en', 'fr']) {
      const block = translations.slice(translations.indexOf(`  ${lang}: {`));
      const keys = [...block.matchAll(/\b(ea_[a-z0-9_]+):\s*"([^"]*)"/g)].slice(0, 60);
      expect(keys.length, lang).toBeGreaterThan(20);
      // The form's own size buckets ("Fewer than 20") are not offer terms.
      for (const [, key, text] of keys.filter(([, k]) => !k.startsWith('ea_form_'))) {
        expect(text.replace(/\{[a-z]+\}/g, ''), `${lang}.${key} types a number`).not.toMatch(/\d/);
      }
    }
  });

  it('the founder grants the plan and length the page states', () => {
    const admin = read('src/pages/FounderAdminPage.jsx');
    expect(admin).toMatch(/founderGrantPlan\(u\.uid, \{ plan: EARLY_ACCESS\.PLAN, until, reason: 'early_access' \}\)/);
    expect(admin).toMatch(/const until = earlyAccessUntil\(\)/);
  });

  it('a plan set by hand clears any grant, so it cannot expire by surprise', () => {
    const cfg = read('src/firebase-config.js');
    const setPlan = cfg.slice(cfg.indexOf('export async function founderSetPlan'), cfg.indexOf('export async function founderGrantPlan'));
    expect(setPlan).toMatch(/plan_grant_until: deleteField\(\)/);
  });

  it('the page says the account returns to free with nothing charged', () => {
    expect(copy('en', 'ea_terms_1')).toMatch(/No card\. Nothing is charged/);
    expect(copy('en', 'ea_terms_2')).toMatch(/moves to the free plan/);
    expect(copy('fr', 'ea_terms_2')).toMatch(/passe au plan gratuit/);
  });
});

// ── 10. What the review of 2026-10-02 found the site saying ────────────────

describe('App Check is described as it is: sent, not enforced', () => {
  it('the server lets every request through, so no page calls it a protection', () => {
    const verify = functionsSrc.slice(functionsSrc.indexOf('async function verifyAppCheck'), functionsSrc.indexOf('async function checkRateLimit'));
    expect(verify, 'App Check is now enforced: move sec_real_appcheck back into the enforced list, '
      + 'reword it and dpa_s9_body, then rewrite this test').toMatch(/allowing \(monitoring mode\)/);
    // Settings → Security lists only enforced controls; App Check is not one.
    const tab = read('src/pages/settings/SecurityTab.jsx');
    const list = tab.slice(tab.indexOf('const enforced = ['), tab.indexOf('];', tab.indexOf('const enforced = [')));
    expect(list).not.toMatch(/appcheck/);
    for (const lang of ['en', 'fr']) {
      expect(copy(lang, 'sec_real_appcheck'), lang).toMatch(/not reject|ne rejette pas/);
      expect(copy(lang, 'dpa_s9_body'), lang).toMatch(/not yet enforced|pas encore exigés/);
    }
  });
});

describe('the AI disclosures name every feature', () => {
  it('the legal notice, terms, privacy table and DPA list them all', () => {
    for (const key of ['legal_ai_body', 'terms_s8_body', 'dpa_s3_item3', 'privacy_s3_anthropic_purpose']) {
      const text = copy('en', key);
      for (const feature of [/contract/i, /invoice/i, /support assistant/i, /weekly/i]) {
        expect(text, `${key} misses ${feature}`).toMatch(feature);
      }
    }
  });
});

describe('the email provider and the invoice inbox', () => {
  it('SendGrid is listed for the mail it receives, not only what it sends', () => {
    expect(functionsSrc).toMatch(/SendGrid\s*\n?\s*\/\/\s*Inbound Parse posts incoming mail to invoiceInbound/);
    expect(copy('en', 'subproc_sendgrid_purpose')).toMatch(/receiving the invoices you forward/);
    expect(copy('fr', 'subproc_sendgrid_purpose')).toMatch(/réception des factures/);
  });

  it('the DPA says an emailed invoice is kept with its sender and subject', () => {
    const inbound = functionsSrc.slice(functionsSrc.indexOf('exports.invoiceInbound'));
    expect(inbound).toMatch(/from: String\(fields\.from/);
    expect(inbound).toMatch(/subject: String\(fields\.subject/);
    expect(copy('en', 'dpa_s11_item5')).toMatch(/sender and subject until you review it, then deleted from the inbox/);
    // …and reviewing it deletes it, whether applied or unticked.
    const budget = read('src/pages/finance/BudgetTab.jsx');
    const apply = budget.slice(budget.indexOf('const applyInvoices'), budget.indexOf('const rows = departments.map'));
    expect(apply).toMatch(/if \(inboxIds\?\.length\) \{\s*invoiceInboxAck\(inboxIds\)/);
    expect(functionsSrc).toMatch(/if \(action === 'ack'\) \{[\s\S]{0,300}batch\.delete\(/);
    expect(copy('fr', 'dpa_s11_item5')).toMatch(/expéditeur et son objet/);
  });
});

describe('"hosted in the EU" says where the rest runs', () => {
  it('the trust lines that say EU also say some providers are outside it', () => {
    for (const lang of ['en', 'fr']) {
      for (const key of ['fin_trust_1', 'acct_trust_1']) {
        expect(copy(lang, key), `${lang}.${key}`).toMatch(/outside|hors UE/);
      }
    }
  });
});

describe('a legal acceptance names nobody once the account is gone', () => {
  it('the record holds no email, and the rules refuse one', () => {
    const cfg = read('src/firebase-config.js');
    const fn = cfg.slice(cfg.indexOf('export async function logLegalAcceptance'), cfg.indexOf('// FOUNDER ADMIN'));
    expect(fn).not.toMatch(/email/);
    expect(read('firestore.rules')).toMatch(/match \/legal_acceptances\/\{logId\}[\s\S]*?hasOnly\(\['uid', 'accepted_at', 'documents', 'plan_id'\]\)/);
  });
});
