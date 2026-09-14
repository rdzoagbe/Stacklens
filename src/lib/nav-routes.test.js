import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

// ── A nav entry that goes nowhere ──────────────────────────────────────────
//
// Unknown paths in this app do not 404 visibly: `<Route path="*">` renders
// NotFound, which redirects to `/`. So a sidebar link whose route was never
// added, or was renamed, looks like the sidebar simply ignored the click and
// threw you out to the landing page. Nothing in lint, tests or the build
// notices, because both halves are valid on their own.
//
// The conditional entries have a second way to go wrong. `when: "showClients"`
// is a string looked up on a context object at render time, so a typo or a
// renamed flag reads as `undefined`, which is falsy, which hides the entry
// from every user — the exact shape of the bug that left client workspaces
// unreachable for months.

const SRC = resolve(process.cwd(), 'src');
const appShell = readFileSync(join(SRC, 'components/AppShell.jsx'), 'utf8');
const app = readFileSync(join(SRC, 'App.jsx'), 'utf8');
const clientHook = readFileSync(join(SRC, 'hooks/useClientWorkspaces.js'), 'utf8');

/** The NAV table's link entries, read from source. */
function navLinks() {
  const start = appShell.indexOf('export const NAV = [');
  expect(start, 'NAV table not found in AppShell.jsx').toBeGreaterThan(-1);
  const block = appShell.slice(start, appShell.indexOf('\n];', start));
  return [...block.matchAll(/\{\s*to:\s*"([^"]+)"([^}]*)\}/g)].map(m => ({
    to: m[1],
    when: (/when:\s*"([^"]+)"/.exec(m[2]) || [])[1] || null,
  }));
}

/** Every path the router answers to. */
const routedPaths = new Set(
  [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map(m => m[1]),
);

/** Keys the useClientWorkspaces hook actually returns. */
function hookReturnKeys() {
  const start = clientHook.lastIndexOf('return {');
  expect(start, 'return block not found in useClientWorkspaces.js').toBeGreaterThan(-1);
  const block = clientHook.slice(start, clientHook.indexOf('\n  };', start));
  return new Set([
    // `foo,` shorthand and `foo: expr` alike
    ...[...block.matchAll(/^\s{4}([a-zA-Z0-9_]+)\s*[,:]/gm)].map(m => m[1]),
    // several shorthands on one line
    ...[...block.matchAll(/[,{]\s*([a-zA-Z0-9_]+)\s*,/g)].map(m => m[1]),
  ]);
}

describe('every sidebar entry leads somewhere', () => {
  const links = navLinks();

  it('finds the nav entries', () => {
    expect(links.length).toBeGreaterThan(5);
  });

  it.each(links)('$to has a route in App.jsx', ({ to }) => {
    expect(routedPaths.has(to), `NAV links to ${to}, but App.jsx has no <Route path="${to}">. `
      + 'Unknown paths redirect to /, so the link would silently sign the user out of the app.')
      .toBe(true);
  });
});

describe('every conditional sidebar entry has a flag behind it', () => {
  const conditional = navLinks().filter(n => n.when);

  it('the filter helper is applied by every NAV consumer', () => {
    // The sidebar and the mobile menu each map over NAV separately. Filtering
    // one and not the other shows a hidden entry on phones — and that is the
    // half nobody looks at, because the desktop sidebar is what you develop
    // against.
    const consumers = [...appShell.matchAll(/\bNAV\b((?:(?!\bNAV\b)[\s\S])*?)\.map\(/g)];
    expect(consumers.length, 'no NAV consumer found — has the table been renamed?')
      .toBeGreaterThanOrEqual(2);
    for (const [, between] of consumers) {
      expect(between.includes('navItemVisible'),
        'a NAV consumer maps the table without navItemVisible(), so a conditional '
        + `entry would render unconditionally there. Offending chain: NAV${between}.map(`)
        .toBe(true);
    }
  });

  it.each(conditional)('$when is returned by useClientWorkspaces', ({ when }) => {
    expect(hookReturnKeys().has(when),
      `NAV gates an entry on "${when}", which useClientWorkspaces does not return. `
      + 'An undefined flag is falsy, so the entry would be invisible to everyone.')
      .toBe(true);
  });
});
