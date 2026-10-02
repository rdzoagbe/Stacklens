import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PAGE_SEO } from './seo';
import { parseBankExport, auditSaas, sampleBankExport } from './saasAudit';

// ── The accountant channel: two public pages that have to hang together ────
//
// /experts-comptables sells to the person who holds an SMB's books for fifty
// companies at once; /audit-saas is the free, browser-only audit that page
// sends them to. Neither is reachable unless the route, the SEO entry, the
// sitemap, the footer link and every translation key all exist at once, and
// nothing else checks that a lazily-loaded page is actually wired in.
//
// The other thing this pins is the promise the audit page makes in its own
// copy: nothing leaves the browser. That must be structurally true, so it is
// asserted on the source rather than believed.

// Paths come only from the literal calls below; the rule cannot see that
// through the helper.
// eslint-disable-next-line security/detect-non-literal-fs-filename
const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
const strip = (raw) => raw
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

const app = () => read('src/App.jsx');
const audit = () => read('src/pages/SaasAuditPage.jsx');
const acct = () => read('src/pages/AccountantsPage.jsx');
const tr = () => read('src/translations.js');

describe('both pages are wired in', () => {
  it('have routes', () => {
    expect(app()).toMatch(/path="\/experts-comptables" element=\{<AccountantsPage \/>\}/);
    expect(app()).toMatch(/path="\/audit-saas" element=\{<SaasAuditPage \/>\}/);
  });

  it('are lazily imported from files that exist', () => {
    expect(app()).toMatch(/import\('\.\/pages\/AccountantsPage'\)/);
    expect(app()).toMatch(/import\('\.\/pages\/SaasAuditPage'\)/);
    expect(acct()).toMatch(/export function AccountantsPage/);
    expect(audit()).toMatch(/export function SaasAuditPage/);
  });

  it('are public: outside RequireAuth', () => {
    const src = app();
    for (const path of ['/experts-comptables', '/audit-saas']) {
      const at = src.indexOf(`path="${path}"`);
      const tail = src.slice(at, src.indexOf('/>', at) + 2);
      expect(tail, `${path} must not be gated`).not.toMatch(/RequireAuth/);
    }
  });

  it('have SEO metadata, and so are in the sitemap', () => {
    // seo.test.js enforces PAGE_SEO ↔ sitemap parity; this just names the two.
    expect(PAGE_SEO['/experts-comptables']).toBeTruthy();
    expect(PAGE_SEO['/audit-saas']).toBeTruthy();
    const sitemap = read('public/sitemap.xml');
    expect(sitemap).toContain('<loc>https://stacklens.fr/experts-comptables</loc>');
    expect(sitemap).toContain('<loc>https://stacklens.fr/audit-saas</loc>');
  });

  it('are not disallowed for crawlers', () => {
    // /audit is the authenticated security page and IS disallowed. The public
    // audit had to live somewhere else for exactly this reason.
    const robots = read('public/robots.txt');
    expect(robots).not.toMatch(/^Disallow: \/audit-saas/m);
    expect(robots).not.toMatch(/^Disallow: \/experts-comptables/m);
  });

  it('are reachable from the homepage footer', () => {
    const page = read('src/pages/TrialPage.jsx');
    expect(page).toMatch(/to="\/experts-comptables"/);
    expect(page).toMatch(/to="\/audit-saas"/);
  });

  it('link to each other', () => {
    expect(acct()).toMatch(/to="\/audit-saas"/);
    expect(audit()).toMatch(/to="\/experts-comptables"/);
  });
});

describe('every string they render exists in English and French', () => {
  const keysIn = (src) => [...new Set([...src.matchAll(/\bt\(\s*'([a-z0-9_]+)'/g)].map(m => m[1]))];
  // Cadence labels go through a static map, so they are listed here by hand.
  const CADENCES = ['monthly', 'annual', 'quarterly', 'weekly', 'irregular', 'single']
    .map(c => 'audit_cadence_' + c);
  const FAQ = [1, 2, 3].flatMap(i => [`acct_q${i}`, `acct_a${i}`]);

  it('the audit page', () => {
    const keys = [...keysIn(audit()), ...CADENCES];
    expect(keys.length).toBeGreaterThan(40);
    for (const k of keys) {
      expect(tr().split(k + ':').length - 1, `${k} needs EN and FR`).toBeGreaterThanOrEqual(2);
    }
  });

  it('the accountants page', () => {
    const keys = [...keysIn(acct()), ...FAQ];
    expect(keys.length).toBeGreaterThan(25);
    for (const k of keys) {
      expect(tr().split(k + ':').length - 1, `${k} needs EN and FR`).toBeGreaterThanOrEqual(2);
    }
  });

  it('the footer links', () => {
    for (const k of ['lp_footer_accountants', 'lp_footer_audit']) {
      expect(tr().split(k + ':').length - 1).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('the audit page keeps its promise', () => {
  it('makes no network call except the analytics counter', () => {
    const src = strip(audit());
    for (const bad of ['fetch(', 'XMLHttpRequest', 'navigator.sendBeacon', 'axios', 'WebSocket', 'firebase']) {
      expect(src, `${bad} contradicts "nothing leaves your browser"`).not.toContain(bad);
    }
    // track() is the one permitted call, and it is only ever handed counts.
    // Each call is sliced to its closing paren by hand: the one-regex version
    // tripped security/detect-unsafe-regex.
    const starts = [...src.matchAll(/track\('[a-z_]+'/g)].map(m => m.index);
    expect(starts.length, 'expected the page to count runs and downloads').toBeGreaterThan(0);
    for (const at of starts) {
      const call = src.slice(at, src.indexOf(')', at) + 1);
      expect(call, 'analytics must carry counts, never labels or amounts')
        .not.toMatch(/label|amount|vendor|raw|report\.subscriptions|csv/);
    }
  });

  it('anything beyond counts leaves only as an email the reader sends', () => {
    // The review lets a reader tell us where the engine was wrong. That goes
    // through their own mail client, which they read before sending: the page
    // opens a mailto built by correctionsMailto and does nothing else.
    const src = strip(audit());
    expect(src).toMatch(/correctionsMailto\(verdicts/);
    expect(src).toMatch(/window\.location\.href = href/);
    expect(src, 'a mailto built in the page could carry anything').not.toContain('mailto:');
    expect(src).not.toContain('window.open');
    // And the email itself is labels and verdicts: the builder never touches
    // an amount or a date.
    const lib = read('src/lib/saasAudit.js');
    const builder = lib.slice(lib.indexOf('export function correctionsEmail'), lib.indexOf('export function correctionsMailto'));
    expect(builder.length).toBeGreaterThan(200);
    expect(builder).not.toMatch(/amount|monthlyEquivalent|\.date\b|transactions/i);
  });

  it('says so where it makes the promise', () => {
    for (const lang of ['en', 'fr']) {
      const block = tr().slice(tr().indexOf(`  ${lang}: {`));
      const body = /audit_privacy_body: "([^"]*)"/.exec(block)[1];
      expect(body, lang).toMatch(/email|messagerie/);
    }
  });

  it('the report print stylesheet cannot blank any other page', () => {
    // It hides everything on <body> except the report. Unscoped, printing the
    // privacy policy would produce a white page.
    const css = read('src/index.css');
    const print = css.slice(css.indexOf('#print-report { display: none; }'));
    const hides = print.match(/[^{}]*\{[^}]*display:\s*none[^}]*\}/g) || [];
    expect(hides.length).toBeGreaterThan(0);
    for (const rule of hides.slice(1)) expect(rule).toMatch(/body\.printing-report/);
  });

  it('does not persist the file anywhere', () => {
    const src = strip(audit());
    for (const bad of ['localStorage', 'sessionStorage', 'indexedDB', 'saveDb', 'setDoc', 'addDoc']) {
      expect(src, `${bad} would keep a client's statement`).not.toContain(bad);
    }
  });

  it('remembers one thing, the firm name, and only through auditPrefs', () => {
    // The page may import storage helpers from one module; that module may
    // touch one key, and only with the firm's name. Anything more would be
    // the first step to keeping a client's figures.
    const imports = [...strip(audit()).matchAll(/from '(\.\.\/lib\/[^']+)'/g)].map((m) => m[1]);
    expect(imports).toContain('../lib/auditPrefs');
    const prefs = strip(read('src/lib/auditPrefs.js'));
    expect(prefs.match(/localStorage\.\w+/g)).toEqual(['localStorage.getItem', 'localStorage.setItem', 'localStorage.removeItem']);
    expect(prefs.match(/'[a-z_]+_firm'/g)).toEqual(["'stacklens_audit_firm'"]);
    expect(prefs).not.toMatch(/sessionStorage|indexedDB|fetch\(|cookie/);
    // …and the page says so, in both languages.
    for (const lang of ['en', 'fr']) {
      const block = tr().slice(tr().indexOf(`  ${lang}: {`));
      const body = /audit_privacy_body: "([^"]*)"/.exec(block)[1];
      expect(body, lang).toMatch(/firm's name|nom de votre cabinet/);
      // The report panel used to say nothing typed there is saved. With the
      // box it can be, so it must not claim otherwise.
      const panel = /audit_report_panel_sub: "([^"]*)"/.exec(block)[1];
      expect(panel, lang).not.toMatch(/saved or sent|enregistré ni envoyé/);
      expect(panel, lang).toMatch(/firm's name|nom de votre cabinet/);
    }
  });

  it('hands a list to the app only on the click that says so, through auditHandoff', () => {
    const page = strip(audit());
    // saveHandoff appears once, inside the click handler, never at render.
    expect(page.match(/saveHandoff\(/g)).toHaveLength(1);
    expect(page).toMatch(/const startWorkspace = \(\) => \{\s*const count = saveHandoff\(report\);/);
    const mod = strip(read('src/lib/auditHandoff.js'));
    expect(mod.match(/localStorage\.\w+/g)).toEqual(['localStorage.setItem', 'localStorage.removeItem', 'localStorage.getItem']);
    expect(mod).not.toMatch(/sessionStorage|indexedDB|fetch\(|cookie|transactions|\.key\b/);
    // Signing out removes a list left waiting, and so does opening the site
    // once it has expired (loadHandoff deletes an expired list).
    expect(read('src/lib/db.js')).toMatch(/'stacklens_audit_handoff'/);
    expect(strip(read('src/main.jsx'))).toMatch(/^loadHandoff\(\);$/m);
    // …and the page says what the click keeps, and for how long.
    for (const lang of ['en', 'fr']) {
      const block = tr().slice(tr().indexOf(`  ${lang}: {`));
      const fine = /audit_handoff_fine: "([^"]*)"/.exec(block)[1];
      expect(fine, lang).toMatch(/\{hours\}/);
      // The vendor name is read from the bank label, so "no bank labels" was
      // not quite true: the page says the name is kept, the lines are not.
      expect(fine, lang).toMatch(/not the bank lines themselves|pas les lignes bancaires/);
      expect(fine, lang).not.toMatch(/no bank labels|aucun libellé bancaire/);
      const body = /audit_privacy_body: "([^"]*)"/.exec(block)[1];
      expect(body, lang).toMatch(/create your workspace|créer votre espace/);
    }
  });

  it('reading several clients at once keeps the same promise', () => {
    // lib/portfolio.js reads every client's file; it must not send or keep
    // anything either, and the page reads each file as bytes like the single one.
    const mod = strip(read('src/lib/portfolio.js'));
    for (const bad of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'indexedDB', 'sendBeacon', 'track(']) {
      expect(mod, `${bad} in lib/portfolio.js`).not.toContain(bad);
    }
    const page = strip(audit());
    const portfolioReads = page.slice(page.indexOf('const onFiles = useCallback'), page.indexOf('const onDrop'));
    expect(portfolioReads).toMatch(/readAsArrayBuffer\(file\)/);
    expect(portfolioReads).toMatch(/decodeBankFile\(reader\.result\)/);
    // Analytics hears how many, never which.
    const run = /track\('audit_portfolio_run', \{([^}]*)\}\)/.exec(page)[1];
    expect(run.replace(/\s/g, '')).toBe('source,clients:clients.length,failed:errors.length,dropped');
  });

  it('reads the file as bytes, so windows-1252 exports decode', () => {
    // readAsText would assume UTF-8 and mangle every "Libellé".
    expect(strip(audit())).toMatch(/readAsArrayBuffer/);
    expect(strip(audit())).toMatch(/decodeBankFile\(/);
  });

  it('the sample data produces a report worth showing', () => {
    // Extracted and executed, not trusted: a sample that parses to nothing
    // would make the "try it" button a demo of an empty screen.
    const report = auditSaas(parseBankExport(sampleBankExport()).transactions);
    expect(audit(), 'the page must use the lib sample, not its own copy')
      .toMatch(/sampleBankExport\(\)/);
    expect(report.totals.subscriptionCount).toBeGreaterThanOrEqual(5);
    expect(report.totals.monthlySaas).toBeGreaterThan(1000);
    const f = report.findings;
    expect(f.multiPerMonth.length, 'Figma twice a month').toBeGreaterThan(0);
    expect(f.priceIncreases.length, 'Notion goes up in April').toBeGreaterThan(0);
    expect(f.forgotten.length, 'Calendly at 10/mo for 6 months').toBeGreaterThan(0);
    expect(report.otherRecurring.length, 'Carrefour is recurring but not software').toBeGreaterThan(0);
  });
});

describe('the accountants page claims only what the product does', () => {
  it('the fifty-workspace figure matches the plan cap', () => {
    // The page says paid plans include up to fifty client workspaces. That
    // number comes from the plan limits, not from copy. If the cap moves, the
    // page must move with it.
    const plan = read('src/lib/plan.js');
    const clients = read('src/pages/ClientsPage.jsx');
    expect(plan + clients, 'the cap of fifty is no longer in the code — update the page')
      .toMatch(/\b(50|fifty)\b/);
    for (const k of ['acct_b2_body', 'audit_cta_body']) {
      const at = tr().indexOf(k + ': "');
      const en = at < 0 ? '' : tr().slice(at + k.length + 3, tr().indexOf('"', at + k.length + 3));
      expect(en, `${k} must state the fifty-workspace cap`).toMatch(/fifty/i);
    }
  });
});
