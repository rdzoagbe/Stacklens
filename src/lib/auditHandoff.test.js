import { describe, it, expect, beforeEach } from 'vitest';
import { parseBankExport, auditSaas, sampleBankExport } from './saasAudit';
import {
  HANDOFF_KEY, handoffFromReport, saveHandoff, loadHandoff, clearHandoff, planHandoffImport, appCategory,
} from './auditHandoff';

// ── The free audit hands its list to the app, and nothing more ─────────────

const report = (verdicts) => auditSaas(parseBankExport(sampleBankExport()).transactions, { verdicts });
const NOW = new Date('2026-09-29T10:00:00Z');

beforeEach(() => localStorage.clear());

describe('what leaves the audit page for the app', () => {
  it('only the summary of each active subscription, never a bank label or a transaction', () => {
    const h = handoffFromReport(report(), NOW);
    expect(h.subscriptions.length).toBe(report().subscriptions.length);
    for (const s of h.subscriptions) {
      expect(Object.keys(s).sort()).toEqual(['cadence', 'category', 'charges', 'last', 'monthly', 'reviewed', 'vendor']);
    }
    const text = JSON.stringify(h);
    expect(text).not.toMatch(/PRLV|CB |CARTE|REF \d|SALAIRES|CARREFOUR/);
  });

  it('leaves out what is not software, what stopped, and what the reader rejected', () => {
    const r = report();
    const slack = r.subscriptions.find((s) => s.vendor === 'Slack');
    const h = handoffFromReport(report({ [slack.key]: { kind: 'reject' } }), NOW);
    const vendors = h.subscriptions.map((s) => s.vendor);
    expect(vendors).not.toContain('Slack');                 // rejected
    expect(vendors).not.toContain('Zoom');                  // stopped in March
    expect(vendors.some((v) => /carrefour/i.test(v))).toBe(false); // not software
  });

  it('marks the lines the reader confirmed', () => {
    const r = report();
    const notion = r.subscriptions.find((s) => s.vendor === 'Notion');
    const h = handoffFromReport(report({ [notion.key]: { kind: 'confirm' } }), NOW);
    expect(h.subscriptions.find((s) => s.vendor === 'Notion').reviewed).toBe(true);
    expect(h.subscriptions.find((s) => s.vendor === 'Figma').reviewed).toBe(false);
  });
});

describe('the list waits in this browser, briefly', () => {
  it('is saved under one key and read back', () => {
    const n = saveHandoff(report(), NOW);
    expect(n).toBeGreaterThan(0);
    expect(Object.keys({ ...localStorage })).toEqual([HANDOFF_KEY]);
    expect(loadHandoff(new Date(NOW.getTime() + 60_000)).subscriptions).toHaveLength(n);
  });

  it('is deleted once it is two hours old', () => {
    saveHandoff(report(), NOW);
    expect(loadHandoff(new Date(NOW.getTime() + 2 * 3_600_000))).not.toBeNull();
    expect(loadHandoff(new Date(NOW.getTime() + 2 * 3_600_000 + 1000))).toBeNull();
    expect(localStorage.getItem(HANDOFF_KEY)).toBeNull();
  });

  it('an unreadable or empty one is deleted, and clearing works', () => {
    localStorage.setItem(HANDOFF_KEY, '{not json');
    expect(loadHandoff(NOW)).toBeNull();
    expect(localStorage.getItem(HANDOFF_KEY)).toBeNull();
    saveHandoff(report(), NOW);
    clearHandoff();
    expect(localStorage.getItem(HANDOFF_KEY)).toBeNull();
  });
});

describe('what importing it would do', () => {
  const handoff = {
    v: 1, created_at: NOW.toISOString(),
    subscriptions: [
      { vendor: 'Slack', category: 'Communication', cadence: 'monthly', monthly: 1250, last: '2026-09-10', charges: 9, reviewed: true },
      { vendor: 'Adobe', category: 'Design', cadence: 'annual', monthly: 60, last: '2026-03-15', charges: 2, reviewed: false },
      { vendor: 'HubSpot', category: 'CRM', cadence: 'monthly', monthly: 90, last: '2026-09-02', charges: 9, reviewed: false },
      { vendor: 'Qonto Abonnement', category: 'Software (unverified)', cadence: 'monthly', monthly: 29, last: '2026-09-01', charges: 9, reviewed: false },
    ],
  };
  const db = { tools: [{ name: 'hubspot ' }], rejected_vendors: ['qonto abonnement'] };

  it('adds what is new, and names what is already there or was rejected here', () => {
    const p = planHandoffImport(handoff, db);
    expect(p.toAdd.map((r) => r.name)).toEqual(['Slack', 'Adobe']);
    expect(p.existing).toEqual(['HubSpot']);
    expect(p.skipped).toEqual(['Qonto Abonnement']);
  });

  it('gives each tool its cost, its category, its origin, and the renewal of an annual one', () => {
    const [slack, adobe] = planHandoffImport(handoff, db).toAdd;
    expect(slack).toMatchObject({ category: 'communication', cost_per_month: 1250, origin: 'audit', reviewed: 'confirmed', renewal_date: '' });
    expect(adobe).toMatchObject({ category: 'design', cost_per_month: 60, renewal_date: '2027-03-15' });
    expect(adobe).not.toHaveProperty('reviewed');
  });

  it('one vendor on two bank lines becomes one tool costing both', () => {
    const twice = { ...handoff, subscriptions: [
      { vendor: 'Notion', category: 'Productivity', cadence: 'monthly', monthly: 96, last: '2026-09-05', charges: 16, reviewed: true },
      { vendor: 'notion', category: 'Productivity', cadence: 'monthly', monthly: 12, last: '2026-09-17', charges: 9, reviewed: false },
    ] };
    const { toAdd } = planHandoffImport(twice, { tools: [] });
    expect(toAdd).toHaveLength(1);
    expect(toAdd[0]).toMatchObject({ name: 'Notion', cost_per_month: 108 });
    expect(toAdd[0].notes).toMatch(/25 charge\(s\), last on 2026-09-17; paid through 2 separate bank lines/);
    expect(toAdd[0]).not.toHaveProperty('reviewed');   // one of the two was never looked at
  });

  it('maps the audit\'s categories onto the app\'s list', () => {
    expect(appCategory('CRM')).toBe('sales');
    expect(appCategory('Identity')).toBe('security');
    expect(appCategory('Software (unverified)')).toBe('other');
    expect(appCategory('finance')).toBe('finance');
  });
});
