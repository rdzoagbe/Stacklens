import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider, useLang } from '../contexts/LangContext';
import { PAGE_SEO, applySeo } from './seo';

// ── A visitor who picks a language gets that language ──────────────────────
//
// Three ways it did not happen:
//   - 91 Portuguese strings were French, copied across when the block was
//     created and never translated: the legal page headings, the contact
//     form, the landing page footer. A Portuguese reader of the privacy policy
//     met "Politique de confidentialité".
//   - <html lang> stayed "en" whatever was chosen, so screen readers read
//     French with English pronunciation and browsers offered to translate a
//     French page into French.
//   - Page titles and descriptions were English only, including the ones
//     Google shows for a French search.

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const source = readFileSync(resolve(process.cwd(), 'src/translations.js'), 'utf8');

/** { key: value } for one language block, parsed from the file as shipped. */
function block(lang) {
  const heads = [...source.matchAll(/^ {2}([a-z]{2}): \{$/gm)];
  const i = heads.findIndex((h) => h[1] === lang);
  const text = source.slice(heads[i].index, heads[i + 1]?.index);
  return Object.fromEntries([...text.matchAll(/\b([A-Za-z0-9_]+):\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => [m[1], m[2]]));
}

describe('the Portuguese strings are Portuguese', () => {
  const en = block('en');
  const fr = block('fr');
  const es = block('es');
  const pt = block('pt');
  // Identical in French and Portuguese for a real reason: an example value,
  // or an acronym both languages use.
  const SHARED = new Set(['int_tools_placeholder', 'budget_modal_placeholder', 'lp_dpa_link', 'terms_s4_col_limits']);

  it('parses enough of each block for the check to mean something', () => {
    expect(Object.keys(pt).length).toBeGreaterThan(1000);
    expect(Object.keys(fr).length).toBeGreaterThan(1000);
  });

  it('no Portuguese value is a copy of the French one', () => {
    // A word both Romance languages share ("Conforme") also matches Spanish,
    // so it is let through; a French sentence does not.
    const copied = Object.keys(pt).filter((k) =>
      !SHARED.has(k) && fr[k] && pt[k] === fr[k] && fr[k] !== en[k] && pt[k] !== es[k] && fr[k].length > 3);
    expect(copied, `French text in the pt block: ${copied.slice(0, 10).join(', ')}`).toEqual([]);
  });
});

describe('<html lang> follows the chosen language', () => {
  let setLanguage;
  function Probe() { ({ setLanguage } = useLang()); return null; }

  beforeEach(() => { localStorage.clear(); document.documentElement.lang = 'en'; });

  it('is set on load and on every change', async () => {
    localStorage.setItem('language', 'fr');
    const host = document.createElement('div');
    const root = createRoot(host);
    await act(async () => root.render(<LanguageProvider><Probe /></LanguageProvider>));
    expect(document.documentElement.lang).toBe('fr');
    await act(async () => setLanguage('pt'));
    expect(document.documentElement.lang).toBe('pt');
    await act(async () => root.unmount());
  });
});

describe('page titles follow the chosen language', () => {
  it('every public page has a French title and description', () => {
    for (const [path, page] of Object.entries(PAGE_SEO)) {
      const french = page.fr || (/[àâçéèêëîïôûùüÿœ]|\bpour\b|\bdes\b/i.test(page.title + page.description) ? page : null);
      expect(french, `${path} has no French head`).toBeTruthy();
      expect(french.title && french.description, path).toBeTruthy();
    }
  });

  it('a French reader gets the French head, others fall back to English', () => {
    const doc = document.implementation.createHTMLDocument('');
    applySeo('/privacy', doc, 'fr');
    expect(doc.title).toBe('Politique de confidentialité | Stacklens');
    expect(doc.querySelector('meta[name="description"]').getAttribute('content')).toMatch(/RGPD/);
    applySeo('/privacy', doc, 'de');
    expect(doc.title).toBe('Privacy Policy | Stacklens');
    applySeo('/privacy', doc, 'en');
    expect(doc.title).toBe('Privacy Policy | Stacklens');
  });

  it('the canonical URL does not change with the language', () => {
    const a = document.implementation.createHTMLDocument('');
    const b = document.implementation.createHTMLDocument('');
    applySeo('/dpa', a, 'fr');
    applySeo('/dpa', b, 'en');
    expect(a.querySelector('link[rel="canonical"]').href).toBe(b.querySelector('link[rel="canonical"]').href);
  });

  it('the app passes the language in', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8');
    expect(app).toMatch(/applySeo\(pathname, document, language\)/);
  });
});
