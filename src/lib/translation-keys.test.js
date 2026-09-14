import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

/* eslint-disable security/detect-non-literal-fs-filename --
   every path comes from walking this repository's own src/ tree. */

// ── A missing key renders as the key ───────────────────────────────────────
//
// useTranslation's last branch returns the key itself when it exists in no
// dictionary. So a key nobody defined does not throw, does not warn, and does
// not fall back — it puts `ws_manage` on screen where "Manage" belongs.
//
// Worse, it defeats the idiom that looks like protection:
//
//     {t('ws_manage') || 'Manage'}
//
// t() returned the string "ws_manage", which is truthy, so the fallback could
// never fire. Forty-six keys shipped that way across five pull requests in one
// day — the client workspace panel rendered as ws_manage_title, ws_open,
// ws_export, ws_delete — and every check passed, because nothing in lint,
// tests or the build looks at whether a key exists.
//
// This does.

const SRC = resolve(process.cwd(), 'src');
const translations = readFileSync(join(SRC, 'translations.js'), 'utf8');

/**
 * Keys defined in one language block.
 *
 * Deliberately not anchored to the start of a line: this file declares pairs
 * two-per-line in places (`lp_trust_1: "…", lp_trust_1_sub: "…"`). A
 * line-anchored regex reports those as missing — it did, and nearly sent me
 * rewriting fourteen strings that were perfectly fine.
 */
function keysOf(language) {
  const order = ['en', 'fr', 'de', 'es', 'pt'];
  const i = order.indexOf(language);
  const start = translations.indexOf(`  ${language}: {`);
  expect(start, `${language} block not found in translations.js`).toBeGreaterThan(-1);
  const end = i + 1 < order.length
    ? translations.indexOf(`  ${order[i + 1]}: {`)
    : translations.length;
  const block = translations.slice(start, end === -1 ? translations.length : end);
  return new Set([...block.matchAll(/([a-zA-Z0-9_]+):\s*["`]/g)].map(m => m[1]));
}

const sourceFiles = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.jsx?$/.test(entry) || /\.test\.jsx?$/.test(entry)) return [];
    if (entry === 'translations.js') return [];
    return [full];
  });

/** Every `t('key')` literal in the app, with where it is used. */
function usedKeys() {
  const used = new Map();
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_]+)['"]/g)) {
      if (!used.has(m[1])) used.set(m[1], relative(process.cwd(), file));
    }
  }
  return used;
}

describe('every translation key used in the app exists', () => {
  it('finds keys to check', () => {
    expect(usedKeys().size).toBeGreaterThan(100);
    expect(keysOf('en').size).toBeGreaterThan(1000);
  });

  it('has an English string for every key the app asks for', () => {
    const en = keysOf('en');
    const missing = [...usedKeys()]
      .filter(([key]) => !en.has(key))
      .map(([key, file]) => `${key} (${file})`);
    expect(missing, 'Used via t() but absent from the en dictionary. It will ' +
      'render as the raw key on screen — t() returns the key itself when it ' +
      'finds nothing, so a `|| fallback` beside it never fires.').toEqual([]);
  });

  it('has a French string for every key too', () => {
    // Missing keys in other languages fall back to English via t() step 3,
    // which is a degraded but honest result. French is the product's first
    // market, so it is held to the same standard as English.
    const fr = keysOf('fr');
    const missing = [...usedKeys()]
      .filter(([key]) => !fr.has(key))
      .map(([key, file]) => `${key} (${file})`);
    expect(missing, 'Used via t() but absent from the fr dictionary. It shows ' +
      'English to a French user, or waits on an AI translation that a rate ' +
      'limit can prevent.').toEqual([]);
  });
});

// The `t(key) || 'literal'` idiom appears 55 times across 12 files, all
// predating this. Every one is dead code — t() returns the key itself when it
// finds nothing, and that is truthy — but harmless now that the checks above
// make a missing key impossible. Removing them all would touch a dozen files
// unrelated to the bug that prompted this, and bury the fix. Left as its own
// tidy-up; if one is ever written for a key that does not exist, the check
// above fails and names it.
