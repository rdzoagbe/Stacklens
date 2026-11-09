import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SOURCE_FACTS, SOURCE_IDS } from './dataSources';
import { PUBLIC_MENU_LINKS } from '../components/PublicMenu';

// ── /fonctionnalites says only what the code does (Priority 9) ─────────────
//
// The page tells a prospect what Stacklens does by itself, what is left to
// them, and what does not exist. When a test here fails, change the page,
// not the test: a public sentence has just stopped being true.

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');
const page = read('src/pages/CapabilitiesPage.jsx');
const en = (() => {
  const s = read('src/translations.js');
  return s.slice(s.indexOf('\n  en: {'), s.indexOf('\n  fr: {'));
})();
const enText = (key) => (new RegExp(`^ {4}${key}: "(.*)",$`, 'm').exec(en) || [])[1] || '';

describe('the connector table is the code’s own list', () => {
  it('renders SOURCE_FACTS itself, connectors and files, nothing typed by hand', () => {
    expect(page).toMatch(/SOURCE_IDS\.filter\(\(id\) => SOURCE_FACTS\[id\]\.connector\)/);
    expect(page).toMatch(/SOURCE_IDS\.filter\(\(id\) => !SOURCE_FACTS\[id\]\.connector\)/);
    expect(page).not.toMatch(/['"](slack|okta|github|zoom|asana|salesforce)['"]/);
  });

  it('only Microsoft 365 changes anything at a vendor, and the page says what', () => {
    expect(SOURCE_IDS.filter((id) => SOURCE_FACTS[id].writes)).toEqual(['microsoft-365']);
    expect(page).toMatch(/f\.writes \? t\('cap_writes_block_signin'\) : t\('cap_writes_none'\)/);
    expect(enText('cap_writes_block_signin')).toMatch(/only when you confirm/);
  });

  it('every way of connecting has a sentence, and the token sentence matches the security page', () => {
    for (const auth of new Set(SOURCE_IDS.map((id) => SOURCE_FACTS[id].auth))) {
      expect(page, auth).toContain(`${auth}: 'cap_auth_${auth}'`);
      expect(enText(`cap_auth_${auth}`), auth).not.toBe('');
    }
    expect(enText('sec_real_creds')).toMatch(/write-only/);
    expect(enText('cap_auth_token')).toMatch(/write-only/);
  });
});

describe('every "works today" row names the code that does it', () => {
  const rows = [...page.matchAll(/\{ key: '(cap_[a-z_]+)', proof: \['([^']+)', '([A-Za-z]+)'\] \}/g)];
  it('nine rows, each with a module and a function that exist', () => {
    expect(rows).toHaveLength(9);
    for (const [, key, file, fn] of rows) {
      const src = read(file);
      expect(src, `${key}: ${fn} in ${file}`).toMatch(new RegExp(`(export (async )?function ${fn}\\b|function ${fn}\\b[\\s\\S]*module\\.exports[\\s\\S]*\\b${fn}\\b|export const ${fn}\\b)`));
      for (const part of ['title', 'does', 'you']) expect(enText(`${key}_${part}`), `${key}_${part}`).not.toBe('');
    }
  });

  it('what the page says Stacklens does is what the code does', () => {
    // Removal: the one action at a vendor is the Microsoft 365 block.
    expect(enText('cap_removals_you')).toMatch(/Microsoft 365 sign-in/);
    expect(read('src/lib/m365-writeback.js')).toMatch(/accountEnabled: false/);
    // Renewals: 30 and 7 days, from the server's thresholds.
    expect(enText('cap_renewals_does')).toMatch(/30 and 7 days/);
    expect(read('functions/threshold-alerts.js')).toMatch(/THRESHOLDS = \[30, 7\]|THRESHOLDS = \[7, 30\]/);
    // Devices: never locked, wiped or located.
    expect(enText('cap_leavers_you')).toMatch(/never locks, wipes or locates/);
    // Invoices: the four kinds the check reports.
    for (const kind of ['duplicate', 'after_cancel', 'above_agreed', 'price_rise']) expect(read('src/lib/invoiceCheck.js')).toContain(`'${kind}'`);
  });
});

describe('what does not exist is the security page’s own list', () => {
  it('reuses every sec_large_not line, and adds only the removal sentence', () => {
    const listed = /const NOT_AVAILABLE = \[([^\]]+)\]/.exec(page)[1].match(/'([a-z_0-9]+)'/g).map((k) => k.slice(1, -1));
    const securityNots = [...en.matchAll(/^ {4}(sec_large_not_\d+):/gm)].map((m) => m[1]);
    expect(listed.filter((k) => k.startsWith('sec_large_not_'))).toEqual(securityNots);
    expect(listed.filter((k) => !k.startsWith('sec_large_not_'))).toEqual(['cap_not_removal']);
  });
});

describe('a prospect can find it', () => {
  it('is routed, in the public menu and in the sitemap', () => {
    expect(read('src/App.jsx')).toMatch(/<Route path="\/fonctionnalites" element=\{<CapabilitiesPage \/>\} \/>/);
    expect(PUBLIC_MENU_LINKS.map((l) => l.to)).toContain('/fonctionnalites');
    expect(read('public/sitemap.xml')).toContain('<loc>https://stacklens.fr/fonctionnalites</loc>');
  });
  it('links the trust documents to routes that exist', () => {
    const routes = new Set([...read('src/App.jsx').matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]));
    for (const [, to] of page.matchAll(/\{ to: '([^']+)', key: 'cap_trust_/g)) expect(routes.has(to), to).toBe(true);
  });
});
