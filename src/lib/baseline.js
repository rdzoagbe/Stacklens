// ── The technical baseline: what the inference engine can do today ─────────
//
// Innov'up funds the reduction of technical uncertainty, and the application
// has to show the uncertainty is real: measured, dated, before any funded work
// starts. So this module scores the engine we actually ship — the vendor
// identification, recurrence detection and findings in saasAudit.js — against
// three small labelled sets in test-data/innovup-baseline/.
//
// It is deliberately a scorer and nothing else. It does not tune, it does not
// fix, and it must not be run as a feedback loop before the project is filed:
// a baseline that has been optimised against its own test set is not a
// baseline. `node tools/record-baseline.mjs` writes the numbers to
// docs/grants/innovup/evidence/, and baseline.test.js holds the recorded
// numbers equal to what the code produces, so the dossier cannot quote a
// figure the engine no longer earns.

import { normaliseLabel, identifyVendor, detectRecurring, auditSaas } from './saasAudit.js';

const round3 = (n) => Math.round(n * 1000) / 1000;
const ratio = (a, b) => (b === 0 ? null : round3(a / b));

/**
 * Is-it-SaaS classification and vendor naming, over labelled bank lines.
 * Precision/recall/F1 on the yes/no question; name accuracy on the lines the
 * engine correctly called SaaS.
 */
export function scoreVendorLabels(cases) {
  let tp = 0, fp = 0, fn = 0, tn = 0, named = 0, namedRight = 0;
  const misses = [];
  for (const c of cases) {
    const key = normaliseLabel(c.label);
    const hit = identifyVendor(key);
    const predicted = !!hit;
    if (predicted && c.saas) {
      tp++;
      named++;
      if (hit.name === c.vendor) namedRight++;
      else misses.push({ label: c.label, kind: 'wrong_vendor', expected: c.vendor, got: hit.name, note: c.note });
    } else if (predicted && !c.saas) {
      fp++;
      misses.push({ label: c.label, kind: 'false_positive', expected: null, got: `${hit.name} (${hit.confidence})`, note: c.note });
    } else if (!predicted && c.saas) {
      fn++;
      misses.push({ label: c.label, kind: 'false_negative', expected: c.vendor, got: null, note: c.note });
    } else {
      tn++;
    }
  }
  const precision = ratio(tp, tp + fp);
  const recall = ratio(tp, tp + fn);
  const f1 = precision == null || recall == null || precision + recall === 0
    ? null : round3(2 * precision * recall / (precision + recall));
  return {
    cases: cases.length,
    positives: tp + fn,
    negatives: fp + tn,
    tp, fp, fn, tn,
    precision, recall, f1,
    vendor_name_accuracy: ratio(namedRight, named),
    misses,
  };
}

const toTx = (label, dates, amounts) =>
  dates.map((d, i) => ({ date: new Date(d + 'T00:00:00Z'), label, amount: amounts[i] }));

/** Cadence accuracy over labelled charge sequences. */
export function scoreRecurrence(cases) {
  let right = 0;
  const misses = [];
  cases.forEach((c, i) => {
    // One label per case so the groups never merge across cases.
    const groups = detectRecurring(toTx(`CB VENDOR${i}`, c.dates, c.amounts));
    const got = groups.length ? groups[0].cadence : 'single';
    if (got === c.expected) right++;
    else misses.push({ name: c.name, expected: c.expected, got });
  });
  return { cases: cases.length, correct: right, accuracy: ratio(right, cases.length), misses };
}

/**
 * Findings over labelled statements: for each finding family, does the engine
 * raise exactly the number a bookkeeper would? Scored per (statement, family)
 * pair so one over-eager rule cannot hide behind a quiet one.
 */
export function scoreFindings(cases) {
  const families = ['duplicates', 'priceIncreases', 'multiPerMonth'];
  let checks = 0, right = 0;
  const misses = [];
  for (const c of cases) {
    const txs = c.rows.map(([d, label, amount]) => ({ date: new Date(d + 'T00:00:00Z'), label, amount }));
    const report = auditSaas(txs);
    for (const f of families) {
      if (!(f in c.expected)) continue;
      checks++;
      const got = report.findings[f].length;
      if (got === c.expected[f]) right++;
      else misses.push({ name: c.name, family: f, expected: c.expected[f], got });
    }
  }
  return { checks, correct: right, accuracy: ratio(right, checks), misses };
}

/** Everything the dossier quotes, from the three labelled sets. */
export function runBaseline({ labels, recurrence, statements }) {
  return {
    vendor: scoreVendorLabels(labels.cases),
    recurrence: scoreRecurrence(recurrence.cases),
    findings: scoreFindings(statements.cases),
  };
}

/** The numbers alone, without the per-case detail: what the test pins. */
export function baselineSummary(result) {
  const { vendor: v, recurrence: r, findings: f } = result;
  return {
    vendor: { cases: v.cases, tp: v.tp, fp: v.fp, fn: v.fn, tn: v.tn, precision: v.precision, recall: v.recall, f1: v.f1, vendor_name_accuracy: v.vendor_name_accuracy },
    recurrence: { cases: r.cases, correct: r.correct, accuracy: r.accuracy },
    findings: { checks: f.checks, correct: f.correct, accuracy: f.accuracy },
  };
}

/** The Markdown block the technical-baseline document carries between its markers. */
export function renderBaselineMarkdown(result) {
  const { vendor: v, recurrence: r, findings: f } = result;
  const pct = (x) => (x == null ? 'n/a' : `${Math.round(x * 100)}%`);
  const lines = [
    '| Engine | Labelled set | Measure | Result |',
    '|---|---|---|---|',
    `| Vendor identification | ${v.cases} bank lines (${v.positives} software, ${v.negatives} not) | Precision | ${pct(v.precision)} (${v.tp} right of ${v.tp + v.fp} flagged) |`,
    `| | | Recall | ${pct(v.recall)} (${v.tp} found of ${v.positives}) |`,
    `| | | F1 | ${pct(v.f1)} |`,
    `| | | Vendor named correctly, when flagged | ${pct(v.vendor_name_accuracy)} |`,
    `| Recurrence (cadence) | ${r.cases} charge sequences | Accuracy | ${pct(r.accuracy)} (${r.correct} of ${r.cases}) |`,
    `| Findings (duplicates, price rises, multi-charge) | ${f.checks} checks over 5 statements | Accuracy | ${pct(f.accuracy)} (${f.correct} of ${f.checks}) |`,
    '',
    '**Vendor identification misses**',
    '',
    '| Bank line | Kind | Expected | Engine said | Why it is hard |',
    '|---|---|---|---|---|',
    ...v.misses.map(m => `| \`${m.label}\` | ${m.kind.replace('_', ' ')} | ${m.expected ?? '—'} | ${m.got ?? '—'} | ${m.note} |`),
    '',
    '**Recurrence misses**',
    '',
    '| Case | Expected | Engine said |',
    '|---|---|---|',
    ...r.misses.map(m => `| ${m.name} | ${m.expected} | ${m.got} |`),
    '',
    '**Findings misses**',
    '',
    '| Statement | Finding | Expected | Engine raised |',
    '|---|---|---|---|',
    ...f.misses.map(m => `| ${m.name} | ${m.family} | ${m.expected} | ${m.got} |`),
  ];
  return lines.join('\n');
}
