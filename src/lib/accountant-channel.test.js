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

  it('does not persist the file anywhere', () => {
    const src = strip(audit());
    for (const bad of ['localStorage', 'sessionStorage', 'indexedDB', 'saveDb', 'setDoc', 'addDoc']) {
      expect(src, `${bad} would keep a client's statement`).not.toContain(bad);
    }
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
