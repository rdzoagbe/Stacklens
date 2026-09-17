import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Two lists of sub-processors, and they can disagree ────────────────────
//
// The same processors are written out twice by hand: a `processors` array on
// SubProcessorsPage, and a separate <table> on PrivacyPage. Two hand-kept
// lists of the same facts is the setup for drift, on the pair of pages whose
// entire job is accuracy — and they are the GDPR-facing pair, so "close
// enough" is not a standard that applies.
//
// This came out of being asked to remove SendGrid from both. They had already
// drifted: the privacy table omits Google Cloud Platform and Sentry while its
// own intro reads "Your data is processed by the following third-party
// services", which presents itself as complete. Nothing would have caught
// that, and nothing would have caught editing one list and not the other.
//
// The names are spelled differently across the two ("Google Firebase" vs
// "Firebase (Google)"), so they are compared on distinctive words with
// 'google' dropped — otherwise Google Cloud Platform and Google Analytics
// match each other, which is worse than not comparing at all.

const legal = () => readFileSync(resolve(process.cwd(), 'src/pages/LegalPages.jsx'), 'utf8');

const subprocessorNames = () => {
  const src = legal();
  const fn = src.slice(src.indexOf('export function SubProcessorsPage'));
  const arr = fn.slice(fn.indexOf('const processors = ['), fn.indexOf('  ];'));
  return [...arr.matchAll(/\{ name: '([^']+)'/g)].map(m => m[1]);
};

const privacyTableNames = () => {
  const src = legal();
  let tb = src.slice(src.indexOf('<tbody className="text-slate-300">'));
  tb = tb.slice(0, tb.indexOf('</tbody>'));
  return tb.split('<tr')
    .filter(r => r.includes('py-2 pr-4'))
    .map(r => /<td className="py-2 pr-4">([^<{]+)<\/td>/.exec(r))
    .filter(Boolean)
    .map(m => m[1].trim());
};

// 'google' is dropped because it prefixes three different products here.
const GENERIC = new Set(['google', 'inc', 'the']);
const words = (name) => new Set(
  name.toLowerCase().split(/[^a-z0-9]+/).filter(w => w && !GENERIC.has(w)));
const sameCompany = (a, b) => [...words(a)].some(w => words(b).has(w));

describe('the two sub-processor lists agree', () => {
  // Asserted FIRST and on purpose. Both readers scrape markup, so a rename or
  // a reformat could return [] and make every assertion below pass on empty
  // sets. That failure mode has already happened once in this repo.
  it('both lists actually parse', () => {
    expect(subprocessorNames().length,
      'the processors array did not parse — fix the reader, do not delete the test')
      .toBeGreaterThan(5);
    expect(privacyTableNames().length, 'the privacy table did not parse')
      .toBeGreaterThan(5);
  });

  it('nothing in the privacy table is missing from the sub-processors page', () => {
    // The dangerous direction. The sub-processors page is the authoritative
    // list; the privacy table naming somebody absent from it means one of the
    // two documents is wrong about who receives personal data.
    const sub = subprocessorNames();
    const orphans = privacyTableNames().filter(p => !sub.some(s => sameCompany(s, p)));
    expect(orphans, 'named in the privacy table but not on the sub-processors page')
      .toEqual([]);
  });

  it('the gap in the other direction is only the two already reported', () => {
    // NOT an endorsement. privacy_s3_intro reads "Your data is processed by the
    // following third-party services", which presents the table as complete,
    // and it omits these two. Reported to the founder on 2026-09-17, left as
    // it is because adding rows means writing legal copy in five languages and
    // that is their call, not mine.
    //
    // Pinned so the gap cannot quietly grow: add a processor to one list and
    // forget the other, and this fails and names it.
    const priv = privacyTableNames();
    const missing = subprocessorNames().filter(s => !priv.some(p => sameCompany(s, p)));
    expect(missing.sort()).toEqual([
      'Google Cloud Platform',
      'Sentry (Functional Software, Inc.)',
    ]);
  });
});

// ── Why SendGrid is still listed ──────────────────────────────────────────
//
// Asked to remove it on 2026-09-17 — custom SMTP is off, the trial is not
// being renewed, and Firebase's built-in sender handles auth email. I removed
// it from both lists and external-services.test.js failed:
//
//   "Twilio SendGrid" is registered as a personal-data processor but no
//   longer appears on the sub-processor page.
//
// That guard is right and I was wrong. Five Cloud Functions still call
// sgMail.send with a recipient address in the body — sendInvite, dailyAlerts,
// weeklySummary, clientErrors and founderops. The request reaches sendgrid.net
// whether or not the key still authenticates, so personal data is still
// transmitted and the page must say so. A dead account does not undo a live
// code path.
//
// So the page cannot be corrected until the capability is removed. That means
// deleting or gating those five call sites, which deletes real features, and
// that is the founder's call. Recorded rather than worked around: the SERVICES
// registry in external-services.test.js is the place to change when it
// happens.

describe('every listed processor has copy to render', () => {
  it('each purpose and transfer key exists in English', () => {
    // An entry added without its strings renders the raw key —
    // "subproc_foo_purpose" — on a page that exists to be precise.
    const src = legal();
    const fn = src.slice(src.indexOf('export function SubProcessorsPage'));
    const arr = fn.slice(fn.indexOf('const processors = ['), fn.indexOf('  ];'));
    const keys = [...new Set([...arr.matchAll(/t\('(subproc_[a-z0-9_]+)'\)/g)].map(m => m[1]))];
    expect(keys.length, 'no translation keys found in the processors array')
      .toBeGreaterThan(10);

    const tr = readFileSync(resolve(process.cwd(), 'src/translations.js'), 'utf8');
    for (const key of keys) {
      expect(tr.split(key + ':').length - 1, `${key} is rendered but has no string`)
        .toBeGreaterThanOrEqual(1);
    }
  });

  it('and no orphan subproc_ strings survive a removal', () => {
    // The reverse: a processor removed from the array but its copy left in
    // translations. Harmless to render, but it is how a dropped processor gets
    // silently reinstated later.
    const src = legal();
    const fn = src.slice(src.indexOf('export function SubProcessorsPage'));
    const arr = fn.slice(fn.indexOf('const processors = ['), fn.indexOf('  ];'));
    const used = new Set([...arr.matchAll(/t\('(subproc_[a-z0-9_]+)'\)/g)].map(m => m[1]));

    const tr = readFileSync(resolve(process.cwd(), 'src/translations.js'), 'utf8');
    const defined = new Set([...tr.matchAll(/^\s*(subproc_[a-z0-9_]+(?:purpose|transfer)):/gm)]
      .map(m => m[1]));
    const orphans = [...defined].filter(k => !used.has(k));
    expect(orphans, 'defined in translations but no longer rendered').toEqual([]);
  });
});
