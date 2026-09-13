import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

/* eslint-disable security/detect-non-literal-fs-filename --
   every path here comes from walking this repository's own src/ tree;
   none of it is user input. */

// ── Nothing personal reaches Google Analytics ───────────────────────────────
//
// track() forwards its params to gtag, which sends them to a third party we
// name on the public sub-processor page. That page promises product usage,
// not customer data, and the DPA is written on the same basis.
//
// The risk is not malice, it is proximity. In OnboardingPage the object being
// tracked sits four lines from formData, which holds workEmail, fullName and
// companyName. In AppShell the tracked action is creating a client workspace,
// whose name is a customer's customer. Spreading the wrong object, or adding
// "just the email so I can follow up", is one keystroke away in both places
// and would be invisible in review — the call still works, the event still
// arrives, and personal data is now in an analytics product we would have to
// disclose and delete.
//
// So the call sites are checked instead of trusted.

const SRC = resolve(process.cwd(), 'src');

const sourceFiles = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.jsx?$/.test(entry) || /\.test\.jsx?$/.test(entry)) return [];
    return [full];
  });

/** Every `track(...)` argument list in the file, with its line number. */
function trackCalls(source) {
  const calls = [];
  const re = /\btrack\s*\(/g;
  let m;
  while ((m = re.exec(source))) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < source.length; i++) {
      if (source[i] === '(') depth++;
      else if (source[i] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    calls.push({
      args: source.slice(m.index + m[0].length, i),
      line: source.slice(0, m.index).split('\n').length,
    });
  }
  return calls;
}

// Key names that are personal data, however they are spelled. `company_size`
// is deliberately not matched: a size bucket identifies nobody.
const FORBIDDEN_KEYS = [
  /e-?mail/i, /first_?name/i, /last_?name/i, /full_?name/i, /display_?name/i,
  /company_?name/i, /\buid\b/i, /user_?id/i, /phone/i, /address/i,
  // A bare `name` is an employee, a workspace or a customer far more often
  // than it is anything safe. No current event uses one, so it costs nothing
  // to refuse it outright.
  /^name$/i,
];

// Value expressions that read an identity off an object, whatever the key is
// called. Deliberately narrow: `.name` alone is a plan name as often as a
// person's, so it is not listed.
const FORBIDDEN_VALUES = [
  '.email', '.workEmail', '.fullName', '.displayName', '.companyName',
  '.uid', 'firebaseUser', 'currentUser',
];

describe('analytics never carries personal data', () => {
  const files = sourceFiles(SRC);

  it('finds the call sites it means to check', () => {
    const total = files.reduce((n, f) => n + trackCalls(readFileSync(f, 'utf8')).length, 0);
    // A floor, not a fixed count — new events are expected and welcome. If
    // this drops, track() calls were removed or renamed and this guard is
    // no longer watching what it thinks it is.
    expect(total).toBeGreaterThanOrEqual(15);
  });

  it('passes no personal key', () => {
    const offences = [];
    for (const file of files) {
      for (const { args, line } of trackCalls(readFileSync(file, 'utf8'))) {
        const keys = [...args.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)].map(k => k[1]);
        for (const key of keys) {
          if (FORBIDDEN_KEYS.some(re => re.test(key))) {
            offences.push(`${relative(process.cwd(), file)}:${line} sends "${key}"`);
          }
        }
      }
    }
    expect(offences, 'Personal data must not reach Google Analytics — it is ' +
      'outside what the sub-processor page and the DPA describe. Send a ' +
      'count, a bucket or an id-free label instead.').toEqual([]);
  });

  it('reads no identity off a user or customer object', () => {
    const offences = [];
    for (const file of files) {
      for (const { args, line } of trackCalls(readFileSync(file, 'utf8'))) {
        for (const bad of FORBIDDEN_VALUES) {
          if (args.includes(bad)) {
            offences.push(`${relative(process.cwd(), file)}:${line} reads ${bad}`);
          }
        }
      }
    }
    expect(offences, 'An analytics event is reading an identity field.').toEqual([]);
  });

  it('has exactly one implementation that talks to gtag', () => {
    const talkers = files.filter(f =>
      /\bgtag\b/.test(readFileSync(f, 'utf8'))
    ).map(f => relative(process.cwd(), f));
    // TrialPage used to keep its own copy calling the bare gtag global, with
    // no try/catch and no window guard. Two wrappers means two consent
    // behaviours, and the second one is always the one nobody updates.
    expect(talkers, 'Call track() from src/lib/analytics.js instead of ' +
      'reaching for gtag directly.').toEqual(['src/lib/analytics.js']);
  });
});
