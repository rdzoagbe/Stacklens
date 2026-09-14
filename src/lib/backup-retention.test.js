import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

// ── The backup window against the promise on the legal page ────────────────
//
// The DPA says "After termination: deleted within 30 days". The privacy page
// says the same in prose, in English and in French. Those sentences are the
// commitment a customer's IT consultant will quote back, and they are the ones
// a CNIL complaint would be measured against.
//
// /backups is the collection that can quietly make them false. Deleting an
// account removes /users and /userdata; the snapshots are removed by the
// pruner, on its own schedule, by age. So the retention window IS the
// deletion promise for anything that reached a backup — and it was 35 days
// against a 30-day promise, with the pruner running weekly on top, so the
// real worst case was around six weeks.
//
// Nothing connects those two numbers in the codebase. One lives in a Cloud
// Function, the other in a translation string, and each is perfectly
// reasonable read alone. That is the exact shape of the canonical-URL bug
// (sitemap said index nine pages, index.html said they were all duplicates of
// the homepage) and of the six disagreeing definitions of potential savings.
//
// So this test holds them together: the code's window may not exceed the
// number the legal copy states.

const root = process.cwd();
const functions = readFileSync(join(root, 'functions/index.js'), 'utf8');
const translations = readFileSync(resolve(root, 'src/translations.js'), 'utf8');

/** The retention window the pruner actually applies, in days. */
function codeWindowDays() {
  const m = /const BACKUP_RETENTION_DAYS = (\d+);/.exec(functions);
  expect(m, 'BACKUP_RETENTION_DAYS not found in functions/index.js — if it was '
    + 'renamed or inlined, this check silently stops protecting the promise')
    .toBeTruthy();
  return Number(m[1]);
}

/** The number of days the legal copy commits to, per language. */
function promisedDays(key) {
  // One literal pattern over the whole file, filtered by key, rather than a
  // regex built from the key: the input is a constant in this file either way,
  // but a constructed pattern is the shape that becomes an injection the day
  // somebody parameterises it.
  const hits = [...translations.matchAll(/([a-zA-Z0-9_]+):\s*"([^"]*)"/g)]
    .filter(([, name]) => name === key)
    .map(([, , text]) => [null, text]);
  expect(hits.length, `${key} not found in translations.js`).toBeGreaterThan(0);
  return hits.map(([, text]) => {
    const n = /(\d+)\s*(?:days|jours)/.exec(text);
    expect(n, `${key} no longer states a number of days: "${text}"`).toBeTruthy();
    return { text, days: Number(n[1]) };
  });
}

describe('backups cannot outlive the deletion the legal pages promise', () => {
  it('the pruner window is within the DPA commitment', () => {
    const code = codeWindowDays();
    for (const { text, days } of promisedDays('dpa_s11_item2')) {
      expect(code, `The DPA says "${text}" — ${days} days — but backups are kept `
        + `for ${code}. A snapshot taken the day before an account is deleted `
        + 'survives the whole window, so the longer number is the one that is '
        + 'true, and the promise is not.')
        .toBeLessThanOrEqual(days);
    }
  });

  it('the pruner runs at least daily, so the window is the window', () => {
    // A 30-day cutoff swept weekly is a 37-day guarantee. The schedule is part
    // of the promise, not an implementation detail.
    const block = functions.slice(functions.indexOf('exports.weeklyBackup'));
    const m = /schedule:\s*'([^']+)'/.exec(block);
    expect(m, 'no schedule found on the backup function').toBeTruthy();
    expect(m[1], `backup schedule is "${m[1]}" — anything less frequent than `
      + 'daily adds its own interval on top of the retention window')
      .toMatch(/every day|every 24 hours|every 1 hours|^0 \d+ \* \* \*$/);
  });

  it('a deleted account\'s snapshots are removed without waiting for the cutoff', () => {
    // The age cutoff is a backstop, not the mechanism. Account deletion does
    // not touch /backups, so something has to notice the source is gone —
    // otherwise a workspace full of employee names and emails sits here for
    // the full window after the account that owned it was erased.
    const block = functions.slice(
      functions.indexOf('exports.weeklyBackup'),
      functions.indexOf('exports.', functions.indexOf('exports.weeklyBackup') + 10),
    ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect(block, 'the backup job must check whether each snapshot\'s source '
      + "/userdata document still exists and drop the snapshot when it doesn't")
      .toMatch(/collection\('userdata'\)\.doc\([^)]*\)\.get\(\)/);
    expect(block, 'and it must act on that check')
      .toMatch(/sourceExists/);
  });

  it('the privacy page states the same number in both languages', () => {
    // en and fr are maintained by hand. One of them drifting to a different
    // number is the same contradiction with extra steps.
    const stated = promisedDays('privacy_s5_body').map(p => p.days);
    expect(new Set(stated).size,
      `the privacy page states different retention periods: ${stated.join(' vs ')}`)
      .toBe(1);
    expect(codeWindowDays()).toBeLessThanOrEqual(stated[0]);
  });
});
