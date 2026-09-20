import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  runBaseline, baselineSummary, renderBaselineMarkdown,
  scoreVendorLabels, scoreRecurrence, scoreFindings,
} from './baseline';

// ── The dossier can only quote what the code measures ─────────────────────
//
// docs/grants/innovup/ tells the Région what the inference engine can and
// cannot do today, with numbers. Those numbers are produced by
// tools/record-baseline.mjs from the labelled sets in
// test-data/innovup-baseline/. Three ways for them to go stale:
//
//   1. someone improves saasAudit.js and the dossier keeps the old figures,
//   2. someone edits a labelled set and does not re-record,
//   3. someone edits the Markdown table by hand.
//
// All three fail here. The fix is the same each time: run the script, look
// at the diff, and keep the previous results file if the project has already
// been filed — a before/after is the evidence the grant is for.

const root = process.cwd();
const read = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const datasets = () => ({
  labels: read('test-data/innovup-baseline/bank-labels.json'),
  recurrence: read('test-data/innovup-baseline/recurrence-cases.json'),
  statements: read('test-data/innovup-baseline/statements.json'),
});
const recorded = () => read('docs/grants/innovup/evidence/baseline-results.json');
const doc = () => readFileSync(resolve(root, 'docs/grants/innovup/02-technical-baseline.md'), 'utf8');

describe('the recorded baseline equals what the engine produces now', () => {
  it('summary numbers match evidence/baseline-results.json', () => {
    const live = baselineSummary(runBaseline(datasets()));
    expect(live, 'The engine or a labelled set changed. Run ' +
      '`node tools/record-baseline.mjs` and commit the new results with the ' +
      'change that caused them.').toEqual(recorded().summary);
  });

  it('every miss listed in the evidence file is still a miss', () => {
    const live = runBaseline(datasets());
    const r = recorded().detail;
    expect(live.vendor.misses.map(m => m.label)).toEqual(r.vendor.misses.map(m => m.label));
    expect(live.recurrence.misses.map(m => m.name)).toEqual(r.recurrence.misses.map(m => m.name));
    expect(live.findings.misses.map(m => `${m.name}/${m.family}`)).toEqual(r.findings.misses.map(m => `${m.name}/${m.family}`));
  });

  it('the table in 02-technical-baseline.md is the rendered one, not a hand edit', () => {
    const START = '<!-- baseline:start -->', END = '<!-- baseline:end -->';
    const src = doc();
    const at = src.indexOf(START), to = src.indexOf(END);
    expect(at, 'marker block missing from the baseline document').toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(at);
    const block = src.slice(at + START.length, to).trim();
    expect(block).toBe(renderBaselineMarkdown(runBaseline(datasets())).trim());
  });

  it('the evidence file names the engine it measured and a date', () => {
    const r = recorded();
    expect(r.engine).toBe('src/lib/saasAudit.js');
    expect(r.recorded_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('the labelled sets are well-formed', () => {
  it('every bank line has a consistent truth', () => {
    for (const c of datasets().labels.cases) {
      expect(typeof c.label, JSON.stringify(c)).toBe('string');
      expect(typeof c.saas).toBe('boolean');
      if (c.saas) expect(typeof c.vendor, `${c.label} is software but names no vendor`).toBe('string');
      else expect(c.vendor, `${c.label} is not software but names a vendor`).toBeNull();
    }
  });

  it('has enough of both classes for precision and recall to mean something', () => {
    const cases = datasets().labels.cases;
    expect(cases.filter(c => c.saas).length).toBeGreaterThanOrEqual(25);
    expect(cases.filter(c => !c.saas).length).toBeGreaterThanOrEqual(25);
    // No label appears twice: a duplicated line would count one case twice.
    expect(new Set(cases.map(c => c.label)).size).toBe(cases.length);
  });

  it('every recurrence case is dated in order, one amount per date', () => {
    for (const c of datasets().recurrence.cases) {
      expect(c.amounts.length, c.name).toBe(c.dates.length);
      const ms = c.dates.map(d => Date.parse(d));
      expect(ms.every(Number.isFinite), c.name).toBe(true);
      expect([...ms].sort((a, b) => a - b), `${c.name} is not in date order`).toEqual(ms);
    }
  });
});

describe('the scorer counts correctly', () => {
  // The scorer is what turns the engine's answers into grant evidence, so it
  // gets its own checks against hand-computed cases — a scorer that always
  // said 100% would pass the parity tests above just as well.
  it('a perfect set scores 1.0 across the board', () => {
    const s = scoreVendorLabels([
      { label: 'CB SLACK TECHNOLOGIES', saas: true, vendor: 'Slack', note: '' },
      { label: 'CB CARREFOUR MARKET', saas: false, vendor: null, note: '' },
    ]);
    expect([s.tp, s.fp, s.fn, s.tn]).toEqual([1, 0, 0, 1]);
    expect([s.precision, s.recall, s.f1, s.vendor_name_accuracy]).toEqual([1, 1, 1, 1]);
    expect(s.misses).toEqual([]);
  });

  it('a false positive lowers precision, not recall', () => {
    const s = scoreVendorLabels([
      { label: 'CB SLACK TECHNOLOGIES', saas: true, vendor: 'Slack', note: '' },
      { label: 'CB MONDAY CAFE', saas: false, vendor: null, note: 'collision' },
    ]);
    expect([s.tp, s.fp, s.fn, s.tn]).toEqual([1, 1, 0, 0]);
    expect(s.precision).toBe(0.5);
    expect(s.recall).toBe(1);
    expect(s.misses[0]).toMatchObject({ kind: 'false_positive', got: 'monday.com (known)' });
  });

  it('a false negative lowers recall, not precision', () => {
    const s = scoreVendorLabels([
      { label: 'CB SLACK TECHNOLOGIES', saas: true, vendor: 'Slack', note: '' },
      { label: 'CB DEEPL SE', saas: true, vendor: 'DeepL', note: '' },
    ]);
    expect([s.tp, s.fp, s.fn]).toEqual([1, 0, 1]);
    expect(s.precision).toBe(1);
    expect(s.recall).toBe(0.5);
  });

  it('a right flag with the wrong name counts against naming only', () => {
    const s = scoreVendorLabels([
      { label: 'CB SLACK TECHNOLOGIES', saas: true, vendor: 'Slack Technologies', note: '' },
    ]);
    expect(s.tp).toBe(1);
    expect(s.vendor_name_accuracy).toBe(0);
    expect(s.misses[0].kind).toBe('wrong_vendor');
  });

  it('an empty set yields null, not a division error', () => {
    const s = scoreVendorLabels([]);
    expect([s.precision, s.recall, s.f1, s.vendor_name_accuracy]).toEqual([null, null, null, null]);
    expect(scoreRecurrence([]).accuracy).toBeNull();
    expect(scoreFindings([]).accuracy).toBeNull();
  });

  it('reads a one-charge sequence as single and a six-monthly one as monthly', () => {
    const s = scoreRecurrence([
      { name: 'one', expected: 'single', dates: ['2026-01-01'], amounts: [1] },
      { name: 'six', expected: 'monthly', dates: ['2026-01-01', '2026-02-01', '2026-03-01'], amounts: [1, 1, 1] },
      { name: 'wrong', expected: 'annual', dates: ['2026-01-01', '2026-02-01', '2026-03-01'], amounts: [1, 1, 1] },
    ]);
    expect(s.correct).toBe(2);
    expect(s.misses).toEqual([{ name: 'wrong', expected: 'annual', got: 'monthly' }]);
  });

  it('scores findings per family, so one miss cannot hide behind two hits', () => {
    const s = scoreFindings([{
      name: 'rise',
      rows: [
        ['2026-01-05', 'PRLV SEPA NOTION LABS INC', 96], ['2026-02-05', 'PRLV SEPA NOTION LABS INC', 96],
        ['2026-03-05', 'PRLV SEPA NOTION LABS INC', 96], ['2026-04-05', 'PRLV SEPA NOTION LABS INC', 112],
      ],
      expected: { duplicates: 0, priceIncreases: 0, multiPerMonth: 0 },
    }]);
    expect(s.checks).toBe(3);
    expect(s.correct).toBe(2);
    expect(s.misses).toEqual([{ name: 'rise', family: 'priceIncreases', expected: 0, got: 1 }]);
  });
});
