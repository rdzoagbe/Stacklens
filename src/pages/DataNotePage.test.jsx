import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../firebase-config', () => ({ callAI: vi.fn() }));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('../lib/contact', () => ({ submitContactForm: vi.fn(), mailtoFallback: vi.fn() }));

import { DataNotePage } from './DataNotePage';
import { AccountantsPage } from './AccountantsPage';
import { SaasAuditPage } from './SaasAuditPage';
import { LanguageProvider } from '../contexts/LangContext';
import { LEGAL_ENTITY, EXIT_NOTICE_DAYS } from '../lib/constants';
import { translations } from '../translations';

// ── The data note and the trust lines say only what is true ────────────────
//
// /note-donnees is handed to an accountant's clients, so each sentence is held
// to the thing that makes it true: the exit window to the terms, the storage
// and processing lines to the sub-processors page, the company to the legal
// notice. The audit page tells people to switch the internet off and see the
// audit still run; that it needs no network is accountant-channel.test.js.

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

async function render(el, lang = 'en', path = '/') {
  localStorage.clear();
  localStorage.setItem('language', lang);
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<LanguageProvider><MemoryRouter initialEntries={[path]}>{el}</MemoryRouter></LanguageProvider>); });
}
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; document.body.innerHTML = ''; });

describe('the data note', () => {
  it('quotes the exit window the terms of service give, in English and French', () => {
    expect(translations.en.terms_s10_body).toContain(`${EXIT_NOTICE_DAYS} days to export`);
    expect(translations.fr.terms_s10_body).toContain(`${EXIT_NOTICE_DAYS} jours`);
    for (const lang of ['en', 'fr', 'de', 'es', 'pt']) expect(translations[lang].dn_exit_body).toContain('{days}');
  });

  it('says where data is stored and processed as the sub-processors page does', () => {
    expect(translations.en.subproc_gcp_transfer).toMatch(/stored in EU/);
    expect(translations.en.subproc_gcp_transfer).toMatch(/us-central1/);
    expect(translations.en.dn_ws_body).toMatch(/stored in the EU/);
    expect(translations.en.dn_ws_body).toMatch(/us-central1/);
    expect(translations.en.dn_ws_body).toMatch(/Anthropic/);
    expect(translations.fr.dn_ws_body).toMatch(/us-central1/);
  });

  it('names the company from the legal notice and the exit window, with no placeholder left', async () => {
    await render(<DataNotePage />, 'fr');
    const who = document.querySelector('[data-testid="dn-who"]').textContent;
    expect(who).toContain(LEGAL_ENTITY.publisher);
    expect(who).toContain(LEGAL_ENTITY.siret);
    expect(who).toContain(LEGAL_ENTITY.email);
    expect(who).toContain(LEGAL_ENTITY.city);
    expect(document.querySelector('[data-testid="dn-exit"]').textContent).toContain(`${EXIT_NOTICE_DAYS} jours`);
    expect(document.body.textContent).not.toMatch(/\{\w+\}/);
    expect(document.querySelectorAll('[data-testid="dn-check"] li')).toHaveLength(4);
  });

  it('is routed, described for search engines and in the sitemap', () => {
    expect(read('src/App.jsx')).toMatch(/path="\/note-donnees" element={<DataNotePage \/>}/);
    expect(read('src/lib/seo.js')).toContain("'/note-donnees'");
    expect(read('public/sitemap.xml')).toContain('https://stacklens.fr/note-donnees');
  });
});

describe('the audit page shows how to check that nothing is sent', () => {
  it('explains the offline test and links the note', async () => {
    await render(<SaasAuditPage />);
    const box = document.querySelector('[data-testid="audit-offline-check"]');
    expect(box.textContent).toContain(translations.en.audit_check_body);
    expect(box.querySelector('a[href="/note-donnees"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="audit-offline-now"]')).toBeNull();
  });

  it('says so when the browser is offline', async () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      await render(<SaasAuditPage />);
      expect(document.querySelector('[data-testid="audit-offline-now"]').textContent).toBe(translations.en.audit_offline_now);
    } finally { spy.mockRestore(); }
  });
});

describe('the accountants page', () => {
  it('links the data note and says who is behind Stacklens', async () => {
    await render(<AccountantsPage />);
    expect(document.querySelector('[data-testid="acct-data-note"]').getAttribute('href')).toBe('/note-donnees');
    const who = document.querySelector('[data-testid="acct-who"]').textContent;
    expect(who).toContain(LEGAL_ENTITY.publisher);
    expect(who).toContain(LEGAL_ENTITY.siret);
  });

  it('gives a proposal with the fee left blank: Stacklens suggests no price', async () => {
    for (const lang of ['en', 'fr', 'de', 'es', 'pt']) {
      const tpl = translations[lang].acct_bill_template;
      expect(tpl, lang).not.toMatch(/\d/);
      expect(tpl, lang).toMatch(/\[[^\]]+\]/);
    }
    await render(<AccountantsPage />, 'fr');
    expect(document.querySelector('[data-testid="acct-bill-template"]').textContent).toBe(translations.fr.acct_bill_template);
  });

  it('early access asks for written feedback; the call is offered, never required', () => {
    for (const lang of ['en', 'fr', 'de', 'es', 'pt']) {
      expect(translations[lang].ea_get_3, lang).toContain('{minutes}');
      expect(translations[lang].ea_give_1, lang).not.toContain('{minutes}');
      expect(JSON.stringify(translations[lang]), lang).not.toContain('{calls}');
    }
    expect(read('src/pages/AccountantsPage.jsx')).toMatch(/ea_get_3[\s\S]*ea_get_4/);
  });
});

describe('the Cabinet plan is offered to firms, not beside Pro', () => {
  it('the landing grid leaves Cabinet out and links to the accountants page instead', () => {
    const landing = read('src/pages/TrialPage.jsx');
    expect(landing).toMatch(/PLAN_CARDS\.filter\(\(c\) => c\.id !== 'cabinet'\)/);
    expect(landing).toContain('/experts-comptables#cabinet');
  });
  it('the accountants page shows the Cabinet plan with its price and lines', async () => {
    await render(<AccountantsPage />, 'fr');
    const box = document.querySelector('[data-testid="acct-cabinet"]');
    expect(box.id).toBe('cabinet');
    expect(box.textContent).toContain('€79');
    expect(box.textContent).not.toMatch(/\{\w+\}/);
  });
  it('arriving from the pricing grid scrolls to the Cabinet plan', async () => {
    vi.useFakeTimers();
    const seen = [];
    const had = globalThis.Element.prototype.scrollIntoView;
    globalThis.Element.prototype.scrollIntoView = function () { seen.push(this.id); };
    try {
      await render(<AccountantsPage />, 'fr', '/experts-comptables#cabinet');
      await act(async () => { vi.advanceTimersByTime(100); });
      expect(seen).toEqual(['cabinet']);
    } finally {
      globalThis.Element.prototype.scrollIntoView = had;
      vi.useRealTimers();
    }
  });
});

// ── Where Stacklens is established ─────────────────────────────────────────
//
// The legal notice must give the place the business is registered (the SIRET
// is registered in Bondy). Every page that names the publisher's location
// reads LEGAL_ENTITY.city; none types a town of its own.
describe('the publisher\'s location is one value', () => {
  it('is Bondy, and no legal page or the DPA types another town', () => {
    expect(LEGAL_ENTITY.city).toBe('Bondy, Seine-Saint-Denis, France');
    const legal = read('src/pages/LegalPages.jsx');
    expect(legal).not.toMatch(/>\s*Paris, France/);
    expect((legal.match(/LEGAL_ENTITY\.city/g) || []).length).toBeGreaterThanOrEqual(3);
    for (const lang of ['en', 'fr']) {
      expect(translations[lang].dpa_s1_body).toContain('{city}');
      expect(translations[lang].dpa_s1_body).not.toMatch(/Paris/);
    }
  });
});
