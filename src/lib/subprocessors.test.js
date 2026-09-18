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
// drifted: the privacy table omitted Google Cloud Platform and Sentry while
// its own intro read "Your data is processed by the following third-party
// services", presenting itself as complete. Both rows were added on
// 2026-09-17 and both directions are asserted below, so the documents can no
// longer disagree — in either direction, which is what the original omission
// needed and did not have.
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

  it('and nothing on the sub-processors page is missing from the privacy table', () => {
    // Closed on 2026-09-17. The privacy table used to omit Google Cloud
    // Platform and Sentry while its own intro read "Your data is processed by
    // the following third-party services" — presenting itself as complete. It
    // was not, and nothing checked.
    //
    // Both directions are now asserted, so the two documents cannot disagree
    // at all: adding a processor to either list and forgetting the other fails
    // here and names it.
    const priv = privacyTableNames();
    const missing = subprocessorNames().filter(s => !priv.some(p => sameCompany(s, p)));
    expect(missing, 'on the sub-processors page but absent from the privacy ' +
      'table, which claims to list everyone').toEqual([]);
  });

  it('and the two lists are the same length', () => {
    // The set comparisons above are name-based, so a duplicated row would slip
    // past them. This is the cheap arithmetic check that they have not drifted
    // in size.
    expect(privacyTableNames().length).toBe(subprocessorNames().length);
  });
});

// ── Why SendGrid is still listed ──────────────────────────────────────────
//
// Asked to remove it on 2026-09-17. I did, and external-services.test.js
// failed: "Twilio SendGrid" is registered as a personal-data processor but no
// longer appears on the sub-processor page. That guard was right. Five Cloud
// Functions required @sendgrid/mail inline and sent with the secret's value,
// so the request reached sendgrid.net with a recipient address in the body
// whether or not the key authenticated. A dead account does not undo a live
// code path.
//
// Gated on 2026-09-18 (#277). functions/mailer.js is now the only door and it
// decides before the request: no key means nothing is sent, nothing is
// contacted, and @sendgrid/mail is not even loaded. So "we are not using it"
// is now true of the running system rather than only of the billing account.
//
// It stays on both pages anyway, re-described as "optional feature: only when
// an email provider is configured" — following the Bridge precedent already
// there. The capability is one secret value away from active, and a page that
// denies a processor the code can still reach on a config change would be the
// wrong kind of accurate. The wording is true in both states, which is the
// point: it cannot go stale the way a claim about today's deployment would.
//
// Taking it off entirely means deleting the five call sites, which deletes
// invitations, digests, alerts and crash mail. Still available, still the
// founder's call. functions/mailer.test.js holds the gate; the SERVICES
// registry in external-services.test.js is what changes if the capability
// goes.

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
