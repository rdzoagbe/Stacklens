#!/usr/bin/env node
// Records the technical baseline for the Innov'up dossier.
//
//   node scripts/record-baseline.mjs
//
// Scores src/lib/saasAudit.js against the labelled sets in
// test-data/innovup-baseline/ and writes:
//   docs/grants/innovup/evidence/baseline-results.json   (numbers + every miss)
//   the block between <!-- baseline:start --> and <!-- baseline:end --> in
//   docs/grants/innovup/02-technical-baseline.md
//
// src/lib/baseline.test.js fails whenever either is out of date, so the
// dossier can only ever quote what the shipped code measures. Re-run this
// when the engine changes — and if that happens after the grant is filed,
// keep the old results file: the before/after is the evidence.

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { runBaseline, baselineSummary, renderBaselineMarkdown } from '../src/lib/baseline.js';

const root = resolve(new URL('..', import.meta.url).pathname);
const read = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));

const result = runBaseline({
  labels: read('test-data/innovup-baseline/bank-labels.json'),
  recurrence: read('test-data/innovup-baseline/recurrence-cases.json'),
  statements: read('test-data/innovup-baseline/statements.json'),
});

let commit = 'unknown';
try { commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch { /* not a checkout */ }

const out = {
  _about: 'Measured by scripts/record-baseline.mjs over src/lib/saasAudit.js. Do not edit by hand.',
  recorded_at: new Date().toISOString().slice(0, 10),
  commit,
  engine: 'src/lib/saasAudit.js',
  summary: baselineSummary(result),
  detail: result,
};
writeFileSync(resolve(root, 'docs/grants/innovup/evidence/baseline-results.json'), JSON.stringify(out, null, 2) + '\n');

const docPath = resolve(root, 'docs/grants/innovup/02-technical-baseline.md');
const START = '<!-- baseline:start -->', END = '<!-- baseline:end -->';
let doc = '';
try { doc = readFileSync(docPath, 'utf8'); } catch { /* first run: the doc is written by hand around the block */ }
if (doc.includes(START) && doc.includes(END)) {
  const before = doc.slice(0, doc.indexOf(START) + START.length);
  const after = doc.slice(doc.indexOf(END));
  writeFileSync(docPath, `${before}\n${renderBaselineMarkdown(result)}\n${after}`);
  console.log('updated', docPath);
} else {
  console.log('no marker block in', docPath, '— JSON written only');
}
console.log(JSON.stringify(out.summary, null, 2));
