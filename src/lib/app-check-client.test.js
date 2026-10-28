import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── The browser sends its App Check token to our own functions ─────────────
//
// The Firebase SDK attaches the token to Firestore and Auth requests on its
// own. Our functions are called with a plain fetch, which carries nothing
// unless each call spreads appCheckHeader() into its headers. One call left
// out is one endpoint that breaks the day APP_CHECK_ENFORCE is flipped.

// Paths come only from the three literals below; the rule cannot see that
// through the helper.
// eslint-disable-next-line security/detect-non-literal-fs-filename
const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('appCheckHeader', () => {
  const cfg = read('src/firebase-config.js');

  it('never throws and never blocks a call', () => {
    // The whole function: from its export line to the first brace back at column 0.
    const start = cfg.indexOf('export async function appCheckHeader');
    const fn = cfg.slice(start, cfg.indexOf('\n}\n', start) + 2);
    expect(fn).toMatch(/if \(!appCheckInstance\) return \{\};/);
    expect(fn).toMatch(/catch \{\s*return \{\};/);
    expect(fn).toMatch(/getAppCheckToken\(appCheckInstance, false\)/);
  });

  it('rides every fetch to a function in firebase-config', () => {
    const lines = cfg.split('\n');
    const calls = lines.map((l, i) => (l.includes('fetch(`${FUNCTIONS_BASE}/') ? i : -1)).filter((i) => i >= 0);
    expect(calls.length).toBeGreaterThanOrEqual(16);
    for (const i of calls) {
      const window = lines.slice(Math.max(0, i - 8), i + 6).join('\n');
      expect(window, `the fetch at firebase-config.js:${i + 1} sends no App Check token`).toMatch(/appCheckHeader\(\)/);
    }
  });

  it('rides the sign-in sync call too', () => {
    const auth = read('src/hooks/useAuth.js');
    const i = auth.indexOf('cloudfunctions.net/syncuser');
    expect(auth.slice(i, i + 400)).toMatch(/appCheckHeader\(\)/);
  });

  it('never gates a crash report, which may fire before App Check exists', () => {
    const main = read('src/main.jsx');
    const i = main.indexOf('cloudfunctions.net/clientErrors');
    expect(i).toBeGreaterThan(0);
    expect(main.slice(i, i + 600)).not.toMatch(/appCheckHeader|X-Firebase-AppCheck/);
  });
});
