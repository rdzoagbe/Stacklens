import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join, relative } from 'node:path';
import { monthlySpend, billedToolCount, NOT_BILLED_STATUS } from './waste';

/* eslint-disable security/detect-non-literal-fs-filename --
   every path comes from walking this repository's own src/ tree. */

// ── One answer to "what does this customer pay a month?" ────────────────────
//
// Before this there were five, and three of them disagreed:
//
//   DashboardPage        every tool, no status filter
//   ExecutiveDashboard   every tool, no status filter
//   Finance → Analytics  status === 'active' only
//   weeklySummary email  status !== 'decommissioned'
//   waste.totalSpend     status === 'active' only
//
// On the demo workspace the Dashboard and the Analytics tab already showed
// different figures for identical data, because the seed carries two
// `orphaned` and two `unused` tools that cost money and Analytics dropped
// them. A prospect clicking between two tabs of the demo saw the product
// contradict itself about the one number it exists to report.
//
// The Clients page makes it worse if it drifts, because the list and the
// workspace it links to would disagree about the same customer's bill — and
// the list figure is computed on the server, where it cannot import this
// module, so there are now genuinely two implementations.
//
// Hence this file: the two implementations are compared on the same inputs,
// and no screen is allowed to sum costs by hand again.

const require_ = createRequire(import.meta.url);
const server = require_('../../functions/workspace-write.js');

const SRC = resolve(process.cwd(), 'src');

const tool = (status, cost) => ({ id: status + cost, status, cost_per_month: cost });

describe('the client and the server agree on monthly spend', () => {
  it('agree on the status that stops billing', () => {
    // Different constants here would be the whole bug with none of the
    // symptoms until a customer decommissions something.
    expect(server.NOT_BILLED_STATUS).toBe(NOT_BILLED_STATUS);
  });

  const cases = [
    { name: 'empty', db: {} },
    { name: 'no tools key', db: { employees: [] } },
    { name: 'one active tool', db: { tools: [tool('active', 100)] } },
    {
      name: 'orphaned and unused still bill',
      db: { tools: [tool('active', 100), tool('orphaned', 50), tool('unused', 25)] },
    },
    {
      name: 'decommissioned does not bill',
      db: { tools: [tool('active', 100), tool('decommissioned', 999)] },
    },
    {
      name: 'junk costs',
      db: {
        tools: [
          { id: 'a', status: 'active', cost_per_month: '75' },
          { id: 'b', status: 'active', cost_per_month: null },
          { id: 'c', status: 'active' },
          { id: 'd', status: 'active', cost_per_month: NaN },
          { id: 'e', status: 'active', cost_per_month: -10 },
        ],
      },
    },
    { name: 'a null in the array', db: { tools: [null, tool('active', 10)] } },
    { name: 'tools is not an array', db: { tools: 'nope' } },
    { name: 'no status at all', db: { tools: [{ id: 'x', cost_per_month: 30 }] } },
  ];

  it.each(cases)('$name: same spend', ({ db }) => {
    expect(server.monthlySpend(db)).toBe(monthlySpend(db));
  });

  it.each(cases)('$name: same tool count', ({ db }) => {
    expect(server.billedToolCount(db)).toBe(billedToolCount(db));
  });

  it('counts the tools the product exists to find', () => {
    // Stated as its own assertion rather than left to the parity cases: a
    // tool nobody owns or nobody opens is still on the card every month, and
    // excluding those understates the bill by exactly the amount Stacklens is
    // supposed to be finding. Both `active`-only readings had this wrong.
    const db = { tools: [tool('active', 100), tool('orphaned', 50), tool('unused', 25)] };
    expect(monthlySpend(db)).toBe(175);
    expect(billedToolCount(db)).toBe(3);
  });

  it('a string cost is not concatenated', () => {
    // '75' + 25 is '7525' if the reduce forgets Number(). The figure would be
    // wrong by three orders of magnitude and still render happily.
    const db = {
      tools: [
        { id: 'a', status: 'active', cost_per_month: '75' },
        { id: 'b', status: 'active', cost_per_month: 25 },
      ],
    };
    expect(monthlySpend(db)).toBe(100);
    expect(server.monthlySpend(db)).toBe(100);
  });
});

// ── Nobody sums tool costs by hand ─────────────────────────────────────────
//
// The sibling of the check in waste.test.js that stops a screen inventing a
// savings percentage. This one stops a screen inventing a spend total, which
// is how the five disagreeing versions came to exist in the first place: each
// one was a perfectly reasonable two-line reduce.

const sourceFiles = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.jsx?$/.test(entry) || /\.test\.jsx?$/.test(entry)) return [];
    return [full];
  });

describe('no screen adds up tool costs on its own', () => {
  // The rule is about TOTALS over a workspace's tools, which is the figure
  // that had five definitions. Two other shapes are legitimate and must not
  // be flagged, or the check gets deleted the first time it cries wolf:
  //
  //   per-category breakdowns   ToolsPage and AnalyticsTab accumulate
  //                             cost_per_month into a map keyed by category.
  //                             That is a decomposition of the total, not a
  //                             competing definition of it.
  //   figures about a subset    the cost of just the unused tools is the
  //                             savings figure, which lib/waste owns
  //                             separately via computeWaste().
  //
  // So the check looks for a reduce whose receiver is the whole tool set.
  // Matches the receiver's last segment rather than the whole chain: `tools`,
  // `db.tools`, `data?.tools?` and `activeTools` all end the same way, and
  // spelling out the prefixes only added backtracking.
  const WHOLE_SET = /(?:tools|uniqueTools|activeTools)\??\.reduce\(/;

  it('every spend total comes from lib/waste', () => {
    const offenders = [];
    for (const file of sourceFiles(SRC)) {
      const rel = relative(process.cwd(), file);
      if (rel.endsWith('src/lib/waste.js')) continue;      // the one definition
      const text = readFileSync(file, 'utf8');
      text.split('\n').forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '');
        if (!/cost_per_month/.test(code)) return;
        if (!WHOLE_SET.test(code)) return;
        offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
      });
    }
    expect(offenders, 'These lines total up cost_per_month themselves. Use '
      + 'monthlySpend() from src/lib/waste.js — five hand-written versions of '
      + 'this sum produced three different answers, two of which were on '
      + 'screen at the same time in the demo.\n' + offenders.join('\n')).toEqual([]);
  });

  it('still recognises a hand-rolled total when it sees one', () => {
    // A guard that cannot fail is not a guard. This is the shape that was
    // removed from six files, checked against the matcher directly so the
    // check above cannot quietly stop matching anything.
    for (const sample of [
      'const spend = tools.reduce((sum, t) => sum + Number(t.cost_per_month || 0), 0);',
      'const totalSpend = data?.tools?.reduce((s, t) => s + (t.cost_per_month || 0), 0) || 0;',
      'const totalSpend = activeTools.reduce((s, t) => s + Number(t.cost_per_month || 0), 0);',
      'const spend = db.tools.reduce((sum, t) => sum + Number(t.cost_per_month || 0), 0);',
    ]) {
      expect(WHOLE_SET.test(sample) && /cost_per_month/.test(sample), sample).toBe(true);
    }
  });

  it('does not flag a per-category breakdown', () => {
    // These two are real lines still in the codebase, and correctly so.
    for (const sample of [
      'm[c].cost += Number(t.cost_per_month || 0);',
      'acc[cat].spend += Number(t.cost_per_month || 0);',
    ]) {
      expect(WHOLE_SET.test(sample), sample).toBe(false);
    }
  });
});
