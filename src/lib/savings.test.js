import { describe, it, expect } from 'vitest';
import {
  approveSaving, rejectSaving, reopenSaving, realiseSaving, commitmentOf, billingCheck,
  savingsLedger, savingsSummary, savingsCsv,
} from './savings';
import { computeWaste, monthlySpend } from './waste';
import { checkInvoices } from './invoiceCheck';
import { buildSeedDb } from './db';

// ── Savings a finance lead can defend (Priority 5) ─────────────────────────

const TODAY = '2026-11-09';
const AT = new Date('2026-11-09T10:00:00Z');
const tool = (over = {}) => ({ id: 'slack', name: 'Slack', status: 'active', cost_per_month: 100, billing_cycle: 'monthly', owner_email: 'amina@x.fr', ...over });

describe('when the money actually stops', () => {
  it('monthly: after the notice period', () => {
    expect(commitmentOf(tool(), TODAY)).toMatchObject({ stops_on: TODAY, basis: 'monthly', next12: 1200 });
    expect(commitmentOf(tool({ notice_days: 30 }), TODAY)).toMatchObject({ stops_on: '2026-12-09', basis: 'notice', next12: 1101 });
  });

  it('yearly: at the renewal, or the one after when the last day to cancel has passed', () => {
    const y = tool({ billing_cycle: 'yearly', renewal_date: '2027-05-09' });
    expect(commitmentOf(y, TODAY)).toMatchObject({ stops_on: '2027-05-09', basis: 'renewal' });
    expect(commitmentOf(y, TODAY).next12).toBe(Math.round(100 * (12 - 181 / 30.4375)));
    // 30 days' notice before a renewal in 20 days: that renewal is locked in.
    const locked = tool({ billing_cycle: 'yearly', renewal_date: '2026-11-29', notice_days: 30 });
    expect(commitmentOf(locked, TODAY)).toMatchObject({ stops_on: '2027-11-29', basis: 'next_renewal', next12: 0 });
    // A contract that does not renew by itself ends at its date.
    expect(commitmentOf({ ...locked, auto_renew: false }, TODAY)).toMatchObject({ stops_on: '2026-11-29', basis: 'renewal' });
  });

  it('yearly with no renewal date: unknown, never guessed', () => {
    expect(commitmentOf(tool({ billing_cycle: 'yearly' }), TODAY)).toMatchObject({ basis: 'unknown', stops_on: null, next12: null });
  });
});

describe('stages, each with who and when', () => {
  it('approving records whether it was the tool’s owner', () => {
    expect(approveSaving(tool(), { by: 'Amina@x.fr', at: AT }).saving).toEqual({ stage: 'approved', by: 'Amina@x.fr', at: AT.toISOString(), note: '', by_owner: true });
    expect(approveSaving(tool(), { by: 'other@x.fr', at: AT }).saving.by_owner).toBe(false);
  });

  it('"not a saving" needs a reason and takes the tool out of every savings figure', () => {
    expect(() => rejectSaving(tool(), { by: 'a', at: AT, note: ' ' })).toThrow('reason_required');
    const db = { tools: [tool()], access: [] };
    expect(computeWaste(db).recoverable).toBe(100);
    const rejected = { ...db, tools: [rejectSaving(tool(), { by: 'a', at: AT, note: 'used through SSO' })] };
    expect(computeWaste(rejected).recoverable).toBe(0);
    expect(monthlySpend(rejected)).toBe(100); // still paid for
    expect(savingsSummary(rejected, { today: TODAY })).toMatchObject({ suspected: { count: 0 }, rejected: { count: 1, monthly: 100 } });
    expect(reopenSaving(rejected.tools[0])).toEqual(tool());
  });

  it('cancelling needs evidence, stops spend, keeps the approval, and cannot be reopened', () => {
    const approved = approveSaving(tool({ notice_days: 30 }), { by: 'amina@x.fr', at: AT });
    expect(() => realiseSaving(approved, { by: 'b', at: AT, evidence: '' })).toThrow('reason_required');
    const done = realiseSaving(approved, { by: 'b', at: AT, evidence: 'Vendor confirmation FIN-1', today: TODAY });
    expect(done.status).toBe('decommissioned');
    expect(done.saving).toMatchObject({ stage: 'realised', stops_on: '2026-12-09', monthly: 100, evidence: 'Vendor confirmation FIN-1', approved: { by: 'amina@x.fr', by_owner: true } });
    expect(monthlySpend({ tools: [done] })).toBe(0);
    expect(() => reopenSaving(done)).toThrow('realised');
  });
});

describe('what the suspicion rests on', () => {
  it('no access recorded at all is said apart from access that was removed', () => {
    const db = {
      tools: [tool(), tool({ id: 'zoom', name: 'Zoom' })],
      access: [{ id: 'a', tool_id: 'slack', status: 'revoked' }],
    };
    const by = Object.fromEntries(savingsLedger(db, { today: TODAY }).map((i) => [i.id, i]));
    expect(by.slack).toMatchObject({ access: 'no_active_access', access_rows: { total: 1, removed: 1 } });
    expect(by.zoom.access).toBe('no_access_recorded');
    expect(savingsSummary(db, { today: TODAY }).unrecordedAccess).toMatchObject({ count: 1, monthly: 100 });
  });

  it('a tool with someone on an approved-but-not-done removal is not a saving yet', () => {
    for (const status of ['active', 'pending_revocation']) {
      const db = { tools: [tool()], access: [{ id: 'a', tool_id: 'slack', status }] };
      expect(savingsLedger(db, { today: TODAY }), status).toEqual([]);
    }
  });
});

describe('realised savings are checked against the bills', () => {
  const done = realiseSaving(tool(), { by: 'b', at: AT, evidence: 'Vendor confirmation', stops_on: '2026-08-01' });
  const inv = (date, extra = {}) => ({ id: date, vendor: 'Slack Technologies LLC', amount: 120, invoice_date: date, billing_cycle: 'monthly', ...extra });

  it('confirmed once a full period passes with no invoice, earlier invoices to compare with', () => {
    expect(billingCheck({ invoice_records: [inv('2026-07-01'), inv('2026-08-01')] }, done, TODAY)).toMatchObject({ state: 'confirmed', last_invoice: '2026-08-01' });
  });
  it('contradicted when the vendor billed after the stop date', () => {
    expect(billingCheck({ invoice_records: [inv('2026-07-01'), inv('2026-10-01')] }, done, TODAY)).toMatchObject({ state: 'contradicted', last_invoice: '2026-10-01' });
    // An invoice someone explained (Justified in the invoice check) does not count.
    expect(billingCheck({ invoice_records: [inv('2026-07-01'), inv('2026-10-01', { cleared: true })] }, done, TODAY).state).toBe('confirmed');
  });
  it('awaiting before a full period has passed; no_billing without any invoice', () => {
    const recent = realiseSaving(tool(), { by: 'b', at: AT, evidence: 'Vendor confirmation', stops_on: '2026-11-01' });
    expect(billingCheck({ invoice_records: [inv('2026-10-01')] }, recent, TODAY)).toMatchObject({ state: 'awaiting', until: '2026-12-09' });
    expect(billingCheck({ invoice_records: [] }, done, TODAY)).toMatchObject({ state: 'no_billing' });
  });
  it('the last invoice before the stop date is not "billed after cancellation"', () => {
    const db = { tools: [realiseSaving(tool(), { by: 'b', at: AT, evidence: 'confirmation', stops_on: '2026-11-30' })], invoice_records: [inv('2026-11-01')] };
    expect(checkInvoices(db, { now: new Date('2026-11-09T00:00:00Z') }).filter((f) => f.kind === 'after_cancel')).toEqual([]);
  });
});

describe('the demo company and the ledger file', () => {
  it('has one saving at each stage, and the dashboard figure is unchanged by them', () => {
    const db = buildSeedDb();
    const s = savingsSummary(db);
    const stage = Object.fromEntries(s.items.map((i) => [i.name, i.stage]));
    expect(stage).toMatchObject({ Loom: 'approved', Typeform: 'rejected', Calendly: 'realised', Hotjar: 'realised' });
    const billing = Object.fromEntries(s.items.filter((i) => i.billing).map((i) => [i.name, i.billing.state]));
    expect(billing).toEqual({ Calendly: 'confirmed', Hotjar: 'awaiting' });
    expect(computeWaste(db).recoverable).toBe(150); // Loom only: Typeform is not a saving
    expect(checkInvoices(db).filter((f) => f.kind === 'after_cancel')).toEqual([]);
  });

  it('every row of the CSV carries its evidence, and a spreadsheet cannot run it', () => {
    const db = { tools: [rejectSaving(tool({ name: '=cmd' }), { by: 'a', at: AT, note: '@SUM(1)' })], access: [] };
    const csv = savingsCsv(db, { sep: ';', decimal: ',', today: TODAY });
    const [head, row] = csv.trim().split('\n');
    expect(head.split(';')[0]).toBe('tool');
    expect(row).toContain("'=cmd;rejected;100;1200");
    expect(row).toContain("'@SUM(1)");
  });
});
