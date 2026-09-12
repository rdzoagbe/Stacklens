import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Every third party this product talks to, in one place ───────────────────
//
// Two gaps reached production before anyone noticed, and both were found by a
// person reading code by hand rather than by anything that would catch the
// next one:
//
//   Sentry     receives stack traces and the URL being viewed, and was absent
//              from the published sub-processor list — a page that states it
//              is complete.
//   ipwho.is   received every user's IP address, which is personal data under
//              GDPR, and was likewise absent. Removed rather than declared —
//              it powered a flag on an internal admin screen and nothing else.
//
// Adding a `fetch` to a new host is a one-line change that silently creates a
// legal obligation: the sub-processor page must name it, the CSP must allow
// it, and if it handles personal data the DPA promises 30 days' notice before
// it starts. None of that is enforced by anything except attention.
//
// So this file is the registry, and the tests below make drift fail the build:
// a new host that nobody registered, a browser-side host the CSP would block,
// a personal-data processor missing from the published list, or an env var the
// code reads and the deploy never supplies.
//
// LIMITS, stated so this is not mistaken for completeness. The scan finds
// hosts written as literals inside fetch(). It cannot see a host assembled
// from variables (Bridge, Salesforce, a customer's own Okta domain) or one a
// vendor SDK requests internally (Sentry). Those are covered by being
// registered here deliberately. The registry is the source of truth; the scan
// only stops a careless addition from going unnoticed.

const root = resolve(__dirname, '../..');
// Paths come only from the hardcoded lists below — no input reaches this — and
// the rule cannot see that through the helper.
// eslint-disable-next-line security/detect-non-literal-fs-filename
const read = (p) => readFileSync(resolve(root, p), 'utf8');

/**
 * where: 'browser'  fetched from the page, so connect-src must allow it.
 *        'server'   called from Cloud Functions; the CSP does not apply.
 *        'redirect' reached by navigating the tab (window.location), which
 *                   connect-src does not govern — Stripe checkout works this
 *                   way, so its absence from connect-src is correct.
 * personalData: true means a customer's or visitor's personal data reaches
 *        this party, so the published sub-processor list must name it.
 * published: the exact `name` on the sub-processor page, or null with a `gap`.
 */
const SERVICES = [
  // ── Infrastructure ──
  { id: 'firebase',    hosts: ['googleapis.com', 'firebaseapp.com', 'accessguard-v2.web.app'], where: 'browser', personalData: true,  published: 'Google Firebase' },
  { id: 'functions',   hosts: ['us-central1-accessguard-v2.cloudfunctions.net'],                where: 'browser', personalData: true,  published: 'Google Cloud Platform' },
  { id: 'ganalytics',  hosts: ['google-analytics.com', 'googletagmanager.com'],                 where: 'browser', personalData: true,  published: 'Google Analytics' },
  { id: 'recaptcha',   hosts: ['recaptcha.net', 'gstatic.com'],                                 where: 'browser', personalData: false, published: null, noProcessing: 'Bot scoring only; no customer record is sent.' },
  { id: 'cdnjs',       hosts: ['cdnjs.cloudflare.com'],                                         where: 'browser', personalData: false, published: null, noProcessing: 'Static asset delivery; receives only the request itself.' },

  // ── Payments, mail, AI ──
  { id: 'stripe',      hosts: ['stripe.com'],            where: 'redirect', personalData: true, published: 'Stripe' },
  { id: 'sendgrid',    hosts: ['sendgrid.net'],          where: 'server',  personalData: true,  published: 'Twilio SendGrid' },
  { id: 'anthropic',   hosts: ['api.anthropic.com'],     where: 'server',  personalData: true,  published: 'Anthropic (Claude AI)' },
  { id: 'web3forms',   hosts: ['api.web3forms.com'],     where: 'browser', personalData: true,  published: 'Web3Forms' },
  { id: 'bridge',      hosts: ['api.bridgeapi.io'],      where: 'server',  personalData: true,  published: 'Bridge (Bridgeapi SAS)' },

  // ── Directory integrations: the customer's own tenants, on their instruction ──
  { id: 'msgraph',     hosts: ['graph.microsoft.com', 'login.microsoftonline.com'], where: 'browser', personalData: true, published: null, noProcessing: "The customer's own Microsoft tenant, read on their instruction. Not a Stacklens sub-processor." },
  { id: 'gworkspace',  hosts: ['admin.googleapis.com', 'gmail.googleapis.com'],     where: 'browser', personalData: true, published: null, noProcessing: "The customer's own Google tenant, read on their instruction." },
  { id: 'slack',       hosts: ['slack.com', 'hooks.slack.com'],                     where: 'server',  personalData: true, published: null, noProcessing: "The customer's own Slack workspace, read on their instruction." },
  { id: 'github',      hosts: ['api.github.com'],                                   where: 'server',  personalData: true, published: null, noProcessing: "The customer's own GitHub org." },
  { id: 'okta',        hosts: ['okta.com', 'okta-emea.com', 'oktapreview.com'],     where: 'server',  personalData: true, published: null, noProcessing: "The customer's own Okta org." },
  { id: 'zoom',        hosts: ['zoom.us', 'api.zoom.us'],                           where: 'server',  personalData: true, published: null, noProcessing: "The customer's own Zoom account." },
  { id: 'asana',       hosts: ['app.asana.com'],                                    where: 'server',  personalData: true, published: null, noProcessing: "The customer's own Asana workspace." },
  { id: 'salesforce',  hosts: ['salesforce.com'],                                   where: 'server',  personalData: true, published: null, noProcessing: "The customer's own Salesforce org." },

  // ── Open gap: a real processor, not yet on the published list ──
  {
    id: 'sentry', hosts: ['ingest.sentry.io', 'ingest.de.sentry.io', 'ingest.us.sentry.io'],
    where: 'browser', personalData: true, published: null,
    gap: {
      found: '2026-09-11',
      what: 'Receives stack traces and the URL being viewed, which can carry identifiers.',
      blockedOn: 'Which Sentry region the production DSN points at (de = EU, no transfer; us = USA, needs SCCs). Read it from sentry.io > Settings > Client Keys.',
    },
  },
];

// Hosts that appear in fetch() but belong to no third party.
const FIRST_PARTY = ['stacklens.fr', 'localhost', '127.0.0.1'];

/** Hosts written as literals inside a fetch() call, across src/ and functions/. */
function scanFetchHosts() {
  const files = [
    'src/firebase-config.js', 'src/google-workspace.js', 'src/lib/contact.js',
    'src/lib/db.js', 'src/hooks/useAuth.js', 'src/auth-redirect.js',
    'functions/index.js', 'functions/integrations.js', 'functions/workspace-write.js',
  ];
  const found = new Set();
  for (const f of files) {
    let src;
    try { src = read(f); } catch { continue; }
    for (const m of src.matchAll(/fetch\(\s*[`'"]https:\/\/([A-Za-z0-9._-]+)/g)) {
      found.add(m[1]);
    }
  }
  return [...found];
}

const cspConnectSrc = () => {
  const fb = JSON.parse(read('firebase.json'));
  const csp = fb.hosting.headers
    .flatMap(h => h.headers)
    .find(h => h.key === 'Content-Security-Policy').value;
  return csp.match(/connect-src ([^;]+);/)[1];
};

const publishedNames = () => {
  const src = read('src/pages/LegalPages.jsx');
  return [...src.matchAll(/\{\s*name:\s*'([^']+)',\s*purpose:\s*t\('subproc_/g)].map(m => m[1]);
};

const matches = (host, pattern) => host === pattern || host.endsWith('.' + pattern);

describe('every external host the code calls is registered', () => {
  it('no fetch reaches a host nobody declared', () => {
    const unknown = scanFetchHosts().filter(h =>
      !FIRST_PARTY.some(f => matches(h, f)) &&
      !SERVICES.some(s => s.hosts.some(p => matches(h, p)))
    );
    expect(unknown, `Unregistered fetch host(s). Add them to SERVICES in this file, ` +
      `decide whether they receive personal data, and if so put them on the ` +
      `sub-processor page before shipping.`).toEqual([]);
  });
});

describe('browser-side hosts are reachable through the CSP', () => {
  const csp = cspConnectSrc();
  for (const s of SERVICES.filter(x => x.where === 'browser')) {
    it(`${s.id} is allowed by connect-src`, () => {
      // connect-src entries may be wildcards (https://*.googleapis.com), which
      // cover a subdomain the registry names explicitly.
      const allowed = s.hosts.some(h =>
        csp.includes(h) ||
        csp.split(/\s+/).some(entry => {
          const m = entry.match(/^https:\/\/\*\.(.+)$/);
          return m && (h === m[1] || h.endsWith('.' + m[1]));
        })
      );
      expect(allowed, `${s.id} (${s.hosts.join(', ')}) is called from the browser but ` +
        `connect-src does not allow it — the request will be blocked in production ` +
        `with no error visible locally.`).toBe(true);
    });
  }
});

describe('every processor of personal data is on the published sub-processor list', () => {
  const names = publishedNames();

  it('the published list is readable and non-empty', () => {
    expect(names.length).toBeGreaterThan(5);
  });

  for (const s of SERVICES.filter(x => x.personalData && x.published)) {
    it(`${s.id} is named on the page`, () => {
      expect(names, `"${s.published}" is registered as a personal-data processor ` +
        `but no longer appears on the sub-processor page.`).toContain(s.published);
    });
  }

  it('anything not on the page is either out of scope or a tracked gap', () => {
    const undeclared = SERVICES.filter(s => s.personalData && !s.published);
    const untracked = undeclared.filter(s => !s.gap && !s.noProcessing);
    expect(untracked.map(s => s.id),
      'A service receives personal data, is not on the published sub-processor ' +
      'page, and has neither a `gap` (a tracked omission) nor a `noProcessing` ' +
      'note explaining why it is out of scope. One of those must be true before ' +
      'it ships.').toEqual([]);
  });

  // Not an assertion — a standing reminder. The published page claims the list
  // is complete, so an open gap is a live inaccuracy, not a backlog item.
  it('reports any open gaps so they are not forgotten', () => {
    const gaps = SERVICES.filter(s => s.gap);
    if (gaps.length) {
      const lines = gaps.map(g =>
        `\n  - ${g.id} (found ${g.gap.found})\n      ${g.gap.what}\n      blocked on: ${g.gap.blockedOn}`);
      console.warn(`\n[sub-processor gaps still open]${lines.join('')}\n`);
    }
    expect(gaps.every(g => g.gap.found && g.gap.what && g.gap.blockedOn)).toBe(true);
  });
});

describe('the deploy supplies every environment variable the code reads', () => {
  it('no VITE_ variable is read in src but absent from the build workflow', () => {
    const srcFiles = ['src/firebase-config.js', 'src/main.jsx', 'src/lib/contact.js',
      'src/google-workspace.js', 'src/auth-redirect.js', 'src/pages/settings/IntegrationsTab.jsx'];
    const readVars = new Set();
    for (const f of srcFiles) {
      let s; try { s = read(f); } catch { continue; }
      for (const m of s.matchAll(/import\.meta\.env\.(VITE_[A-Z0-9_]+)/g)) readVars.add(m[1]);
    }
    const workflow = read('.github/workflows/build.yml');
    const missing = [...readVars].filter(v => !workflow.includes(v));
    expect(missing, `Read by the app but never passed to the production build, so it ` +
      `is undefined in production while working locally from .env.`).toEqual([]);
  });
});
