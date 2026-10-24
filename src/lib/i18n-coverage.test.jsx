import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('../firebase-config', () => ({ callAI: vi.fn(() => Promise.reject(new Error('no AI in tests'))) }));

import {
  translations, useTranslation, isLegalKey, LEGAL_LANGUAGES, sourceFingerprint,
} from '../translations';

// ── Every screen in five languages, every contract in two ──────────────────
//
// German, Spanish and Portuguese each lacked about 2,000 of the English
// strings, so a German visitor saw half the landing page in English and a
// signed-in one spent their AI allowance translating the app one key at a
// time. They are filled in. The legal documents are not machine-translated:
// outside English and French they are shown in English, with a note.


const OTHER = ['de', 'es', 'pt'];

describe('coverage', () => {
  it('French has every English key', () => {
    expect(Object.keys(translations.en).filter(k => !(k in translations.fr))).toEqual([]);
  });

  for (const lang of OTHER) {
    it(`${lang} has every English key outside the legal documents`, () => {
      const missing = Object.keys(translations.en).filter(k => !isLegalKey(k) && !(k in translations[lang]));
      expect(missing).toEqual([]);
    });

    it(`${lang} keeps every placeholder of the English`, () => {
      const ph = (s) => (String(s).match(/\{[^}]*\}/g) || []).sort().join(' ');
      const wrong = Object.keys(translations.en)
        .filter(k => !isLegalKey(k) && k in translations[lang])
        .filter(k => ph(translations.en[k]) !== ph(translations[lang][k]));
      expect(wrong).toEqual([]);
    });
  }
});

function render(language, keys, seedCache) {
  localStorage.clear();
  if (seedCache) localStorage.setItem('ag_live_translations', JSON.stringify(seedCache));
  const out = {};
  function Harness() { const t = useTranslation(language); for (const k of keys) out[k] = t(k); return null; }
  const root = createRoot(document.createElement('div'));
  act(() => root.render(<Harness />));
  act(() => root.unmount());
  return out;
}

describe('legal documents', () => {
  it('are English and French only', () => {
    expect(LEGAL_LANGUAGES).toEqual(['en', 'fr']);
    for (const k of ['dpa_title', 'privacy_title', 'terms_title', 'subproc_title', 'legal_title']) expect(isLegalKey(k)).toBe(true);
    for (const k of ['lp_cta_audit', 'nav_finance', 'doc_lang_note']) expect(isLegalKey(k)).toBe(false);
  });

  it('show the English text in German, Spanish and Portuguese, even where a partial translation exists', () => {
    // Portuguese had 38 of the DPA's 89 strings, so the page was half and half.
    const partial = Object.keys(translations.pt).filter(isLegalKey);
    expect(partial.length).toBeGreaterThan(0);
    for (const lang of OTHER) {
      const keys = ['dpa_title', 'terms_title', ...partial.slice(0, 5)];
      const shown = render(lang, keys);
      for (const k of keys) expect(shown[k], `${lang} ${k}`).toBe(translations.en[k]);
    }
  });

  it('never show a cached runtime translation of a contract', () => {
    const key = 'dpa_title';
    const cache = { de: { [key]: { t: 'Maschinell übersetzt', s: sourceFingerprint(translations.en[key]) } } };
    expect(render('de', [key], cache)[key]).toBe(translations.en[key]);
  });

  it('stay as written in French', () => {
    expect(render('fr', ['dpa_title']).dpa_title).toBe(translations.fr.dpa_title);
  });

  it('carry a note saying why, on all five legal pages', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/LegalPages.jsx'), 'utf8');
    expect((page.match(/<DocLanguageNote language=\{language\} t=\{t\} \/>/g) || []).length).toBe(5);
    for (const lang of ['en', 'fr', ...OTHER]) expect(translations[lang].doc_lang_note, lang).toBeTruthy();
  });
});

describe('choosing a language', () => {
  it('both switchers offer all five, so the label never says EN over a German page', () => {
    const shell = readFileSync(resolve(process.cwd(), 'src/components/AppShell.jsx'), 'utf8');
    const list = shell.slice(shell.indexOf('const LANGUAGE_OPTIONS = ['), shell.indexOf('];', shell.indexOf('const LANGUAGE_OPTIONS = [')));
    for (const code of ['en', 'fr', 'de', 'es', 'pt']) expect(list).toContain(`code: '${code}'`);
    expect((shell.match(/const langs = LANGUAGE_OPTIONS;/g) || []).length).toBe(2);
  });

  it('"per year" sticks to the amount the way "/year" does', () => {
    for (const lang of ['en', 'fr', ...OTHER]) expect(translations[lang].per_year, lang).toMatch(/^\//);
  });
});

describe('Finance month names', () => {
  it('follow the reader’s language, not a fixed English list', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/FinancePage.jsx'), 'utf8');
    expect(page).not.toMatch(/\['Jan',\s*'Feb'/);
    expect(page).toMatch(/toLocaleDateString\(language, \{ month: 'short' \}\)/);
  });
});
