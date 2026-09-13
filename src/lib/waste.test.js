import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { computeWaste, enrichToolCosts, EXPENSIVE_PER_USER } from './waste';

/* eslint-disable security/detect-non-literal-fs-filename --
   every path here comes from walking this repository's own src/ tree. */

const tool = (id, cost, extra = {}) => ({ id, name: id, status: 'active', cost_per_month: cost, ...extra });
const grant = (toolId, status = 'active') => ({ tool_id: toolId, status });

describe('recoverable spend counts only what is really recoverable', () => {
  it('is the cost of tools nobody holds active access to', () => {
    const db = {
      tools: [tool('a', 100), tool('b', 250), tool('c', 40)],
      access: [grant('a'), grant('c')],
    };
    // b has no grants at all -> its full cost is recoverable. a and c are used.
    expect(computeWaste(db).recoverable).toBe(250);
  });

  it('does not count a tool whose only grants are revoked as used', () => {
    const db = { tools: [tool('a', 90)], access: [grant('a', 'revoked')] };
    expect(computeWaste(db).recoverable).toBe(90);
  });

  it('is zero for a workspace with nothing wrong with it', () => {
    // The formulas this replaced were a percentage of total spend, so they
    // reported savings for a workspace where every tool was in use.
    const db = { tools: [tool('a', 500), tool('b', 900)], access: [grant('a'), grant('b')] };
    const w = computeWaste(db);
    expect(w.totalSpend).toBe(1400);
    expect(w.recoverable).toBe(0);
    expect(w.wastePercent).toBe(0);
  });

  it('never counts a free tool as recoverable', () => {
    const db = { tools: [tool('a', 0)], access: [] };
    expect(computeWaste(db).recoverable).toBe(0);
    expect(computeWaste(db).unusedTools).toHaveLength(0);
  });

  it('keeps expensive-per-user tools out of the savings figure', () => {
    // One user on a costly tool is a review candidate, not money already
    // recoverable — the seat is in use and the price is the customer's call.
    const db = { tools: [tool('a', EXPENSIVE_PER_USER * 3)], access: [grant('a')] };
    const w = computeWaste(db);
    expect(w.expensiveTools).toHaveLength(1);
    expect(w.recoverable).toBe(0);
  });

  it('ignores archived tools and counts each grant once', () => {
    const db = {
      tools: [tool('a', 100, { status: 'archived' }), tool('b', 60)],
      access: [grant('b'), grant('b')],
    };
    const enriched = enrichToolCosts(db);
    expect(enriched).toHaveLength(1);
    expect(enriched[0].activeUsers).toBe(2);
    expect(enriched[0].costPerUser).toBe(30);
  });

  it('survives an empty or malformed workspace', () => {
    for (const db of [undefined, {}, { tools: null, access: null }]) {
      const w = computeWaste(db);
      expect(w.recoverable).toBe(0);
      expect(w.totalSpend).toBe(0);
    }
  });
});

// ── One savings figure, everywhere ─────────────────────────────────────────
//
// "Potential savings" was computed six different ways, so one workspace was
// told six different numbers — and three of them were a flat percentage of
// total spend, which measures nothing. Two more screens invented seat counts
// from `used * 1.2` and `used * 0.12`, and Finance compared this month
// against `thisMonth * 0.95`.
//
// They are all gone. This stops the seventh from arriving: a screen that
// multiplies spend, cost or a user count by a fraction is manufacturing a
// number, and it must come from lib/waste instead.

const SRC = resolve(process.cwd(), 'src');

const sourceFiles = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.jsx?$/.test(entry) || /\.test\.jsx?$/.test(entry)) return [];
    return [full];
  });

// A line that both talks about money or seats and multiplies by a fraction.
// Deliberately not anchored to the identifier sitting next to the operator:
// the original defect was written `(derived.spend || 0) * 0.14`, where the
// token before `*` is `0)`, and an adjacency rule walks straight past it.
const SUBJECT = /(spend|cost|waste|used|seats|licen[cs]e|users|savings)/i;
const FRACTION = /\*\s*\(?\s*\d*\.\d+|\d*\.\d+\s*\*/;
const looksFabricated = (line) => SUBJECT.test(line) && FRACTION.test(line);

describe('no screen manufactures its own figures', () => {
  it('nothing outside lib/waste scales spend or seats by a fraction', () => {
    const offences = [];
    for (const file of sourceFiles(SRC)) {
      const rel = relative(process.cwd(), file);
      if (rel === 'src/lib/waste.js') continue;
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return;
        if (looksFabricated(line)) offences.push(`${rel}:${i + 1}`);
      });
    }
    expect(offences, 'A savings, waste or seat figure is being derived from a ' +
      'multiplier instead of measured. Use computeWaste() from lib/waste.').toEqual([]);
  });

  it('the expensive-per-user threshold is defined once', () => {
    const holders = sourceFiles(SRC)
      .filter(f => /costPerUser\s*>\s*\d/.test(readFileSync(f, 'utf8')))
      .map(f => relative(process.cwd(), f));
    expect(holders, 'The high-cost-per-user rule is re-implemented with a ' +
      'hardcoded number. Import EXPENSIVE_PER_USER from lib/waste instead.').toEqual([]);
  });
});
