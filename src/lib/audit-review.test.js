import { describe, it, expect } from 'vitest';
import {
  parseBankExport, auditSaas, sampleBankExport, reviewCounts,
  correctionsEmail, correctionsMailto, CORRECTIONS_ADDRESS,
} from './saasAudit';

// ── The reader corrects the engine ─────────────────────────────────────────
//
// The engine is right about seven lines in ten. The person holding the
// statement knows the rest, so each line takes a verdict and the whole report
// is rebuilt from it. These pin that a verdict changes everything that is
// derived from the line (totals, findings, the list) and nothing else, and
// that the corrections email carries labels and verdicts, never money.

const tx = parseBankExport(sampleBankExport()).transactions;
const base = auditSaas(tx);
const keyOf = (vendor) => base.subscriptions.find((s) => s.vendor === vendor).key;

describe('verdicts rebuild the report', () => {
  it('no verdicts is exactly the engine', () => {
    expect(auditSaas(tx, { verdicts: {} }).totals).toEqual(base.totals);
    expect(base.rejected).toEqual([]);
  });

  it('"not software" takes a line out of the list, the totals and the findings', () => {
    const figma = keyOf('Figma');
    const r = auditSaas(tx, { verdicts: { [figma]: { kind: 'reject' } } });
    expect(r.subscriptions.map((s) => s.vendor)).not.toContain('Figma');
    expect(r.rejected.map((s) => s.key)).toEqual([figma]);
    expect(r.totals.subscriptionCount).toBe(base.totals.subscriptionCount - 1);
    const figmaMonthly = base.subscriptions.find((s) => s.key === figma).monthlyEquivalent;
    expect(r.totals.monthlySaas).toBeCloseTo(base.totals.monthlySaas - figmaMonthly, 2);
    // Figma was the "several charges a month" finding; it goes with it.
    expect(base.findings.multiPerMonth.map((m) => m.vendor)).toContain('Figma');
    expect(r.findings.multiPerMonth.map((m) => m.vendor)).not.toContain('Figma');
  });

  it('renaming corrects the vendor everywhere and counts as known', () => {
    const cal = keyOf('Calendly');
    const r = auditSaas(tx, { verdicts: { [cal]: { kind: 'rename', name: 'Cal.com' } } });
    const row = r.subscriptions.find((s) => s.key === cal);
    expect(row.vendor).toBe('Cal.com');
    expect(row.reviewed).toBe('renamed');
    expect(r.findings.forgotten.map((g) => g.vendor)).toContain('Cal.com');
    expect(r.totals.subscriptionCount).toBe(base.totals.subscriptionCount);
  });

  it('a rename with no name is ignored rather than blanking the vendor', () => {
    const cal = keyOf('Calendly');
    const r = auditSaas(tx, { verdicts: { [cal]: { kind: 'rename', name: '   ' } } });
    expect(r.subscriptions.find((s) => s.key === cal).vendor).toBe('Calendly');
  });

  it('"it\'s software" brings a missed line into the list and the total', () => {
    const carrefour = base.otherRecurring[0];
    const r = auditSaas(tx, { verdicts: { [carrefour.key]: { kind: 'add' } } });
    expect(r.subscriptions.map((s) => s.key)).toContain(carrefour.key);
    expect(r.totals.subscriptionCount).toBe(base.totals.subscriptionCount + 1);
    expect(r.totals.monthlySaas).toBeGreaterThan(base.totals.monthlySaas);
  });

  it('a verdict for a line that is not in this file changes nothing', () => {
    expect(auditSaas(tx, { verdicts: { 'NOT IN FILE': { kind: 'reject' } } }).totals).toEqual(base.totals);
  });

  it('counts each kind', () => {
    expect(reviewCounts({ a: { kind: 'confirm' }, b: { kind: 'reject' }, c: { kind: 'rename', name: 'X' }, d: { kind: 'add' }, e: { kind: 'rename', name: '' } }))
      .toEqual({ confirmed: 1, rejected: 1, renamed: 1, added: 1 });
  });
});

describe('the corrections email', () => {
  const verdicts = {
    [keyOf('Figma')]: { kind: 'reject' },
    [keyOf('Calendly')]: { kind: 'rename', name: 'Cal.com' },
    [base.otherRecurring[0].key]: { kind: 'add', name: 'Carrefour Pro' },
    [keyOf('Slack')]: { kind: 'confirm' },
  };

  it('lists the corrected labels with what the reader said', () => {
    const { body, count } = correctionsEmail(verdicts, { intro: 'Hi' });
    expect(count).toBe(3);
    expect(body).toContain(`NOT SOFTWARE | ${keyOf('Figma')}`);
    expect(body).toContain(`WRONG VENDOR | ${keyOf('Calendly')} -> Cal.com`);
    expect(body).toContain('MISSED |');
    expect(body).toContain('CONFIRMED CORRECT: 1');
    // A confirmed line is counted, not named: only corrections are listed.
    expect(body).not.toContain(keyOf('Slack'));
  });

  it('never carries an amount', () => {
    const { body } = correctionsEmail(verdicts);
    for (const s of base.subscriptions) {
      expect(body).not.toContain(String(s.avgAmount));
      expect(body).not.toContain(String(s.avgAmount).replace('.', ','));
    }
  });

  it('stays short enough for every mail client, and says what it left out', () => {
    const many = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`VENDOR NUMBER ${i} WITH A LONG LABEL`, { kind: 'reject' }]));
    const { body } = correctionsEmail(many);
    expect(body.length).toBeLessThan(1900);
    expect(body).toMatch(/\(\+\d+ more\)/);
  });

  it('is a mailto to Stacklens, which opens the reader\'s own mail app', () => {
    const { href } = correctionsMailto(verdicts);
    expect(href.startsWith(`mailto:${CORRECTIONS_ADDRESS}?subject=`)).toBe(true);
  });
});
