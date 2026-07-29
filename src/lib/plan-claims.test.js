// Guard test: marketing copy must never promise more than the product enforces.
//
// Six audit findings came from plan numbers being hand-copied into separate
// files — a "14-day free trial" banner on a 7-day trial, an HR & Finance card
// promising 250 tools against an enforced 100, JSON-LD offers with numbers from
// an older pricing table. The UI now derives its numbers from PLAN_LIMITS; this
// test covers the places that cannot (static translation strings, JSON-LD) so
// the drift fails CI instead of reaching a customer.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PLAN_LIMITS, TRIAL_DAYS } from './plan';

// Read from disk relative to the repo root: these files are the shipped
// artefacts (static strings, JSON-LD) that cannot import PLAN_LIMITS.
const readRepo = (rel) => readFileSync(resolve(process.cwd(), rel), 'utf8');
const translations = readRepo('src/translations.js');
const indexHtml = readRepo('index.html');

const enDict = translations.slice(translations.indexOf('  en: {'), translations.indexOf('  fr: {'));

function enValue(key) {
  const m = new RegExp(`\\b${key}: "((?:[^"\\\\]|\\\\.)*)"`).exec(enDict);
  return m ? m[1] : null;
}
// "Up to 1,500 employees" → 1500
const numberIn = (s) => (s ? Number((s.match(/[\d][\d,\s.]*/)?.[0] || '').replace(/[,\s.]/g, '')) : NaN);

describe('plan claims match enforced limits', () => {
  const cases = [
    ['f_free_1', PLAN_LIMITS.free.tools],
    ['f_free_2', PLAN_LIMITS.free.employees],
    ['f_starter_1', PLAN_LIMITS.starter.tools],
    ['f_starter_2', PLAN_LIMITS.starter.employees],
    ['f_pro_1', PLAN_LIMITS.pro.tools],
    ['f_pro_2', PLAN_LIMITS.pro.employees],
  ];

  it.each(cases)('%s advertises exactly what PLAN_LIMITS enforces', (key, expected) => {
    const value = enValue(key);
    expect(value, `translation key ${key} is missing`).toBeTruthy();
    expect(numberIn(value), `"${value}" does not match the enforced limit`).toBe(expected);
  });

  it('the free-plan fine print on the landing page matches the free limits', () => {
    const fine = enValue('lp_hero_fine_print');
    expect(fine).toBeTruthy();
    expect(fine).toContain(String(PLAN_LIMITS.free.tools));
    expect(fine).toContain(String(PLAN_LIMITS.free.employees));
  });
});

describe('trial length is stated consistently', () => {
  // Catches the exact bug that shipped: a 14-day banner over a 7-day trial.
  it('no user-facing string promises a trial longer than TRIAL_DAYS', () => {
    const offenders = [];
    const re = /(\w+): "((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(translations))) {
      const [, key, value] = m;
      // Only strings that are *about* the trial — "renews in 30 days" and
      // "unused for 90 days" are legitimately different numbers.
      if (!/trial|essai|prueba|teste|test(?:zeitraum|version)/i.test(value)) continue;
      const trial = /(\d+)[-\s]?(?:day|jour|tage|tägig|día|dia)/i.exec(value);
      if (trial && Number(trial[1]) !== TRIAL_DAYS) offenders.push(`${key}: "${value}"`);
    }
    expect(offenders, `strings disagreeing with TRIAL_DAYS=${TRIAL_DAYS}`).toEqual([]);
  });
});

describe('structured data (JSON-LD) matches enforced limits', () => {
  // These numbers reach Google's search results, where a stale value is both
  // public and hard to notice.
  it('the Free offer states the real free limits', () => {
    const offer = /"name": "Free",[\s\S]{0,220}?"description": "([^"]+)"/.exec(indexHtml);
    expect(offer, 'Free offer not found in index.html JSON-LD').toBeTruthy();
    expect(offer[1]).toContain(String(PLAN_LIMITS.free.tools));
    expect(offer[1]).toContain(String(PLAN_LIMITS.free.employees));
  });

  it('no offer claims unlimited capacity for a capped plan', () => {
    const capped = /"name": "(Starter|Pro)",[\s\S]{0,220}?"description": "([^"]+)"/g;
    let m;
    while ((m = capped.exec(indexHtml))) {
      expect(m[2].toLowerCase(), `${m[1]} offer claims unlimited`).not.toContain('unlimited');
    }
  });
});
