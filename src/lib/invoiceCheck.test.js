import { describe, it, expect } from 'vitest';
import { checkInvoices, invoiceCheckSummary, invoiceVendorKey, vendorMatchesTool } from './invoiceCheck';

// ── Supplier invoices, checked against what was agreed ─────────────────────

const NOW = new Date('2026-09-29T12:00:00Z');
let n = 0;
const inv = (vendor, amount, date, extra = {}) => ({
  id: `inv${++n}`, vendor, amount, invoice_date: date, billing_cycle: 'monthly', currency: 'EUR', ...extra,
});
const check = (db) => checkInvoices(db, { now: NOW });

describe('matching an invoice to a tool', () => {
  it('ignores legal forms and punctuation, and lets the tool name lead the vendor\'s', () => {
    expect(invoiceVendorKey('Notion Labs, Inc.')).toBe('notion labs');
    expect(vendorMatchesTool('Notion Labs, Inc.', 'Notion')).toBe(true);
    expect(vendorMatchesTool('SLACK TECHNOLOGIES LIMITED', 'Slack')).toBe(true);
    expect(vendorMatchesTool('Notionnaire SAS', 'Notion')).toBe(false);
    expect(vendorMatchesTool('Google Cloud France', 'Google Workspace')).toBe(false);
  });
});

describe('above the agreed price', () => {
  const tools = [{ id: 't1', name: 'Notion', agreed_monthly: 80, agreed_basis: 'ht' }];

  it('compares before tax when the invoice says what that is', () => {
    const f = check({ tools, invoice_records: [inv('Notion Labs Inc', 112, '2026-09-05', { amount_excl_tax: 93.33 })] });
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ kind: 'above_agreed', monthly: 93.33, expected: 80, overMonthly: 13.33, overAnnual: 159.96, assumedVat: false, toolId: 't1' });
  });

  it('otherwise adds standard VAT to the agreed price, and says so', () => {
    const f = check({ tools, invoice_records: [inv('Notion Labs Inc', 112, '2026-09-05')] });
    expect(f[0]).toMatchObject({ kind: 'above_agreed', monthly: 112, expected: 96, overMonthly: 16, assumedVat: true });
  });

  it('an invoice at the agreed price, or within rounding, is fine', () => {
    expect(check({ tools, invoice_records: [inv('Notion', 96, '2026-09-05')] })).toEqual([]);
    expect(check({ tools, invoice_records: [inv('Notion', 97.5, '2026-09-05')] })).toEqual([]);   // under 2 %
    expect(check({ tools, invoice_records: [inv('Notion', 96, '2026-09-05', { amount_excl_tax: 80.9 })] })).toEqual([]);   // under 1 €
  });

  it('an agreed price after tax is compared with the total', () => {
    const f = check({ tools: [{ id: 't1', name: 'Notion', agreed_monthly: 96, agreed_basis: 'ttc' }],
      invoice_records: [inv('Notion', 112, '2026-09-05', { amount_excl_tax: 93.33 })] });
    expect(f[0]).toMatchObject({ basis: 'ttc', monthly: 112, expected: 96 });
  });

  it('a yearly invoice is judged per month', () => {
    const f = check({ tools: [{ id: 'a', name: 'Adobe', agreed_monthly: 200, agreed_basis: 'ttc' }],
      invoice_records: [inv('Adobe Systems', 2880, '2026-03-15', { billing_cycle: 'yearly' })] });
    expect(f[0]).toMatchObject({ kind: 'above_agreed', monthly: 240, overAnnual: 480 });
  });

  it('a rise up to the agreed price is not a finding', () => {
    const f = check({ tools: [{ id: 't1', name: 'Notion', agreed_monthly: 112, agreed_basis: 'ttc' }],
      invoice_records: [inv('Notion', 96, '2026-08-05'), inv('Notion', 112, '2026-09-05')] });
    expect(f).toEqual([]);
  });
});

describe('without an agreed price', () => {
  it('a rise over the previous invoice on the same cycle is flagged', () => {
    const f = check({ tools: [{ id: 'h', name: 'HubSpot' }], invoice_records: [
      inv('HubSpot Inc', 600, '2026-07-02'), inv('HubSpot Inc', 600, '2026-08-02'), inv('HubSpot Inc', 672, '2026-09-02'),
    ] });
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ kind: 'price_rise', monthly: 672, expected: 600, pct: 12, overAnnual: 864 });
  });

  it('a monthly and a yearly invoice from one vendor are not compared', () => {
    // 300 a year is 25 a month, above the 20 monthly: a different plan, not a rise.
    expect(check({ tools: [], invoice_records: [
      inv('Miro', 20, '2026-08-01'), inv('Miro', 300, '2026-09-01', { billing_cycle: 'yearly' }),
    ] })).toEqual([]);
  });

  it('one-off invoices are never compared', () => {
    expect(check({ tools: [], invoice_records: [
      inv('Freelance', 500, '2026-08-01', { billing_cycle: 'one_time' }), inv('Freelance', 900, '2026-09-01', { billing_cycle: 'one_time' }),
    ] })).toEqual([]);
  });
});

describe('billed twice, and billed after cancelling', () => {
  it('the same vendor, amount and date twice is a duplicate, reported once', () => {
    const a = inv('Slack Technologies', 147, '2026-09-10'); const b = inv('SLACK TECHNOLOGIES LIMITED', 147, '2026-09-10');
    const f = check({ tools: [], invoice_records: [a, b] });
    expect(f).toEqual([expect.objectContaining({ kind: 'duplicate', invoiceId: b.id, firstInvoiceId: a.id, overAnnual: 1764 })]);
  });

  it('the same amount on another date is not a duplicate', () => {
    expect(check({ tools: [], invoice_records: [inv('Slack', 147, '2026-08-10'), inv('Slack', 147, '2026-09-10')] })).toEqual([]);
  });

  it('a recent invoice for a decommissioned tool is flagged; an old one is not', () => {
    const tools = [{ id: 'z', name: 'Zoom', status: 'decommissioned' }];
    expect(check({ tools, invoice_records: [inv('Zoom Video Communications', 16, '2026-09-09')] })[0])
      .toMatchObject({ kind: 'after_cancel', overAnnual: 192 });
    expect(check({ tools, invoice_records: [inv('Zoom', 16, '2026-06-09')] })).toEqual([]);
  });
});

describe('explained findings, and the summary', () => {
  it('a cleared invoice is no longer reported', () => {
    const tools = [{ id: 't1', name: 'Notion', agreed_monthly: 80 }];
    expect(check({ tools, invoice_records: [inv('Notion', 112, '2026-09-05', { cleared: true })] })).toEqual([]);
    // …nor a duplicate someone explained (two seats bought the same day).
    expect(check({ tools: [], invoice_records: [inv('Slack', 147, '2026-09-10'), inv('Slack', 147, '2026-09-10', { cleared: true })] })).toEqual([]);
  });

  it('adds up what is at stake and counts billed tools with no agreed price', () => {
    const db = {
      tools: [{ id: 't1', name: 'Notion', agreed_monthly: 80 }, { id: 'h', name: 'HubSpot' }, { id: 's', name: 'Slack' }],
      // The costlier finding (HubSpot) is the later invoice: the order is by money, not by date.
      invoice_records: [inv('Notion', 112, '2026-08-05'), inv('HubSpot', 600, '2026-08-02'), inv('HubSpot', 672, '2026-09-02'), inv('Slack', 147, '2026-09-10')],
    };
    const f = checkInvoices(db, { now: NOW });
    expect(f.map((x) => x.kind)).toEqual(['price_rise', 'above_agreed']);   // costliest first
    expect(invoiceCheckSummary(db, f)).toEqual({ count: 2, annualAtStake: 864 + 192, toolsWithoutAgreedPrice: 2 });
  });
});

describe('the demo workspace', () => {
  it('shows each kind of finding a prospect should see', async () => {
    const { seedDbIfEmpty } = await import('./db');
    localStorage.clear();
    const db = seedDbIfEmpty();
    const kinds = checkInvoices(db).map((f) => `${f.kind}:${f.toolName}`).sort();
    expect(kinds).toEqual(['above_agreed:Notion', 'duplicate:Slack', 'price_rise:HubSpot']);
  });
});
