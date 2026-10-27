import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  exportedFunctions, functionsUsingSecret, selectFunctions, onlyArguments, BATCH_SIZE,
} from '../tools/functions-to-redeploy.mjs';

// ── The manual redeploy picks the right functions ──────────────────────────
//
// A new secret version reaches only the functions deployed after it. The
// "Redeploy functions" workflow reads which ones use a secret from the code,
// so this pins that reading against the real functions/index.js.

const read = (p) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const src = read('functions/index.js');

describe('functions that use a secret', () => {
  it('finds every function that sends mail through Brevo', () => {
    expect(functionsUsingSecret(src, 'BREVO_API_KEY').sort()).toEqual(
      ['clientErrors', 'dailyAlerts', 'founderops', 'monthlyReport', 'reportnow', 'sendInvite', 'weeklySummary'].sort());
  });

  it('finds the Stripe and Anthropic users', () => {
    expect(functionsUsingSecret(src, 'STRIPE_SECRET_KEY')).toEqual(expect.arrayContaining(['createCheckout', 'createPortal', 'stripeWebhook']));
    expect(functionsUsingSecret(src, 'ANTHROPIC_API_KEY')).toEqual(expect.arrayContaining(['ai', 'weeklySummary']));
  });

  it('reads only the options, never the handler body', () => {
    const fake = [
      "const K = defineSecret('K');",
      'exports.a = onRequest({ secrets: [K] }, async (req, res) => {});',
      'exports.b = onRequest({ cors: true }, async (req, res) => { const secrets = [K]; });',
    ].join('\n');
    expect(functionsUsingSecret(fake, 'K')).toEqual(['a']);
  });

  it('every secret the workflow offers is used by at least one function', () => {
    const wf = read('.github/workflows/redeploy-functions.yml');
    const offered = [...wf.matchAll(/^\s+- ([A-Z][A-Z0-9_]+)$/gm)].map((m) => m[1]);
    expect(offered.length).toBeGreaterThan(0);
    for (const s of offered) expect(functionsUsingSecret(src, s), s).not.toHaveLength(0);
  });
});

describe('choosing and batching', () => {
  it('"all" is every export', () => {
    expect(selectFunctions(src, 'all')).toEqual(exportedFunctions(src));
  });

  it('named functions must exist', () => {
    expect(selectFunctions(src, 'sendInvite, founderops')).toEqual(['sendInvite', 'founderops']);
    expect(() => selectFunctions(src, 'sendInvite,nope')).toThrow(/nope/);
    expect(() => selectFunctions(src, '')).toThrow();
    expect(() => selectFunctions(src, 'NOT_A_SECRET')).toThrow(/NOT_A_SECRET/);
  });

  it('never names anything that is not a plain function name', () => {
    expect(() => selectFunctions(src, 'sendInvite;rm -rf /')).toThrow();
  });

  it('batches of five, each ready for --only', () => {
    const names = selectFunctions(src, 'all');
    const lines = onlyArguments(names);
    expect(lines).toHaveLength(Math.ceil(names.length / BATCH_SIZE));
    for (const l of lines) {
      expect(l.split(',').length).toBeLessThanOrEqual(BATCH_SIZE);
      expect(l).toMatch(/^functions:[A-Za-z0-9]+(,functions:[A-Za-z0-9]+)*$/);
    }
  });
});
