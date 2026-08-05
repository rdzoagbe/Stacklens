import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

// ── Guard: one name, one implementation ─────────────────────────────────────
//
// Three separate production bugs traced to the same root cause — a function
// existing twice, in two files, with the two copies drifted apart:
//
//   toCsv        lib/utils.js vs lib/dataUtils.js, opposite argument order.
//                AuditPage imported one and called it like the other, so the
//                CSV export shipped with no header row and junk rows.
//
//   security     Dashboard and SecurityCompliancePage each computed MFA
//   metrics      coverage, orphaned tools and the security score. They
//                disagreed on live data: 0% vs 100%, 72 vs 82, 1 vs 0.
//
//   getCurrency  lib/currency.js vs lib/dataUtils.js. A Spanish user saw "$"
//                on Employees and "€" on Dashboard, same data.
//
// Reviews caught these one at a time, after they shipped. This catches the
// next one before it does.
//
// Re-exports (`export { x } from './y'`) are fine and expected — that is the
// fix, not the problem. Only a second *definition* of the same exported name
// fails.

const LIB = resolve(process.cwd(), 'src/lib');

function jsFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return jsFiles(full);
    if (!/\.js$/.test(entry) || /\.test\.js$/.test(entry)) return [];
    return [full];
  });
}

/** Names this file *defines* and exports — not names it merely re-exports. */
function definedExports(source) {
  const names = new Set();
  const patterns = [
    /^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm,
    /^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
    /^export\s+class\s+([A-Za-z_$][\w$]*)/gm,
  ];
  for (const re of patterns) {
    for (const m of source.matchAll(re)) names.add(m[1]);
  }
  return names;
}

describe('src/lib exports exactly one definition per name', () => {
  it('has no name defined in two different modules', () => {
    const owners = new Map(); // name -> [files]
    for (const file of jsFiles(LIB)) {
      const rel = file.slice(file.indexOf('src/lib'));
      for (const name of definedExports(readFileSync(file, 'utf8'))) {
        if (!owners.has(name)) owners.set(name, []);
        owners.get(name).push(rel);
      }
    }

    const clashes = [...owners.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([name, files]) => `  ${name} — defined in ${files.join(' and ')}`);

    expect(
      clashes.join('\n'),
      clashes.length
        ? `\n\n${clashes.length} exported name(s) defined more than once in src/lib.\n` +
          `Two copies drift, and callers silently get whichever one they imported.\n` +
          `Keep one implementation and re-export it:  export { name } from './owner'\n\n` +
          clashes.join('\n') + '\n'
        : undefined,
    ).toBe('');
  });

  it('recognises a re-export as not a definition', () => {
    // Guards the guard: dataUtils re-exports the money helpers from currency.js
    // and that must stay legal, or the fix for the last bug would fail this test.
    expect(definedExports("export { getCurrency } from './currency';").size).toBe(0);
    expect(definedExports('export function getCurrency() {}').has('getCurrency')).toBe(true);
    expect(definedExports('export const TRIAL_DAYS = 7;').has('TRIAL_DAYS')).toBe(true);
  });
});
