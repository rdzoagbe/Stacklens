import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkInvoices } from './invoiceCheck';
import { reportRecipients } from './reportRecipients';
import { seedDbIfEmpty } from './db';

// ── The monthly email and the app must say the same thing ──────────────────
//
// The invoice check and the recipient rule exist twice: in src/lib for the
// screens, and in functions/monthly-report.js for the email sent on the 1st,
// which cannot import this code. A finance lead who reads "2 invoices to
// check" in the email and finds three in Finance → Budget stops trusting
// both. So both copies run on the same inputs here.

const require_ = createRequire(import.meta.url);
const server = require_('../../functions/monthly-report.js');
const NOW = new Date('2026-09-29T12:00:00Z');

let n = 0;
const inv = (vendor, amount, date, extra = {}) => ({ id: `p${++n}`, vendor, amount, invoice_date: date, billing_cycle: 'monthly', ...extra });

const WORKSPACES = [
  { name: 'agreed price, before tax, with and without the HT amount', db: {
    tools: [{ id: 'n', name: 'Notion', agreed_monthly: 80, agreed_basis: 'ht' }],
    invoice_records: [inv('Notion Labs, Inc.', 112, '2026-09-05', { amount_excl_tax: 93.33 }), inv('Notion Labs Inc', 112, '2026-08-05')],
  } },
  { name: 'agreed after tax, yearly invoice', db: {
    tools: [{ id: 'a', name: 'Adobe', agreed_monthly: 200, agreed_basis: 'ttc' }],
    invoice_records: [inv('Adobe Systems', 2880, '2026-03-15', { billing_cycle: 'yearly' })],
  } },
  { name: 'rises, cycles, one-offs', db: {
    tools: [{ id: 'h', name: 'HubSpot' }],
    invoice_records: [inv('HubSpot Inc', 600, '2026-07-02'), inv('HubSpot Inc', 672, '2026-08-02'), inv('HubSpot Inc', 700, '2026-09-02'),
      inv('Miro', 20, '2026-08-01'), inv('Miro', 300, '2026-09-01', { billing_cycle: 'yearly' }),
      inv('Freelance', 500, '2026-08-01', { billing_cycle: 'one_time' }), inv('Freelance', 900, '2026-09-01', { billing_cycle: 'one_time' })],
  } },
  { name: 'duplicates, cleared, cancelled', db: {
    tools: [{ id: 'z', name: 'Zoom', status: 'decommissioned' }],
    invoice_records: [inv('Slack', 147, '2026-09-10'), inv('SLACK LIMITED', 147, '2026-09-10'), inv('Slack', 147, '2026-09-10', { cleared: true }),
      inv('Zoom Video Communications', 16, '2026-09-09'), inv('Zoom', 16, '2026-06-09'), inv('Zoom', 16, '2026-10-09')],
  } },
  { name: 'the tolerance boundaries', db: {
    tools: [{ id: 'm', name: 'Monday', agreed_monthly: 100, agreed_basis: 'ttc' }],
    invoice_records: [inv('Monday', 102.5, '2026-09-01'), inv('Other', 50, '2026-08-01'), inv('Other', 51.2, '2026-09-01'),
      inv('Big', 1000, '2026-08-01'), inv('Big', 1025, '2026-09-01')],
  } },
  { name: 'malformed records', db: {
    tools: [{ id: 'x', name: '' }],
    invoice_records: [null, { id: 'q', vendor: '', amount: 5 }, { id: 'r', vendor: 'A', amount: -3 }, { vendor: 'NoId', amount: 3 }, inv('B', 10, 'not a date')],
  } },
];

describe('the invoice check: app and email agree', () => {
  it.each(WORKSPACES)('$name', ({ db }) => {
    expect(server.checkInvoices(db, { now: NOW })).toEqual(checkInvoices(db, { now: NOW }));
  });

  it('on the demo workspace', () => {
    localStorage.clear();
    const db = seedDbIfEmpty();
    const app = checkInvoices(db, { now: NOW });
    expect(app.length).toBeGreaterThan(0);
    expect(server.checkInvoices(db, { now: NOW })).toEqual(app);
  });
});

describe('the recipient rule: app and server agree', () => {
  const CASES = [
    ['daf@acme.fr', ['dg@acme.fr', 'compta@acme.fr', 'rh@acme.fr', 'extra@acme.fr']],
    ['DAF@Acme.fr', ['DG@ACME.FR', ' dg@acme.fr ', 'x@other.fr', 'dg@acme.fr.evil.com']],
    ['roland@gmail.com', ['friend@gmail.com']],
    ['x@orange.fr', ['y@orange.fr']],
    ['', ['dg@acme.fr']],
    ['daf@acme.fr', 'dg@acme.fr'],
    ['daf@acme.fr', ['not an email', '', null, 'a@b', 'daf@acme.fr']],
    ['person@sub.company.co.uk', ['boss@sub.company.co.uk', 'boss@company.co.uk']],
  ];
  it.each(CASES)('%s', (account, extras) => {
    expect(server.reportRecipients(account, extras)).toEqual(reportRecipients(account, extras));
  });
});

describe('the rules are written the same way in both copies', () => {
  // Identical outputs on a handful of inputs can hide a changed threshold or
  // one domain dropped from a list, so the definitions themselves must match.
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed repo paths
  const src = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
  const def = (text, name) => text.split('\n').find((l) => l.startsWith(`const ${name} =`) || l.startsWith(`export const ${name} =`))?.replace(/^export /, '').replace(/;\s*\/\/.*$/, ';');
  it.each([
    ['src/lib/invoiceCheck.js', ['VAT_RATE', 'TOLERANCE_PCT', 'TOLERANCE_EUR', 'RECENT_AFTER_CANCEL_DAYS', 'PER_MONTH', 'LEGAL']],
    ['src/lib/reportRecipients.js', ['MAX_EXTRA_RECIPIENTS', 'PUBLIC_MAIL', 'isEmail']],
  ])('%s', (file, names) => {
    const app = src(file); const server = src('functions/monthly-report.js');
    for (const name of names) {
      expect(def(app, name), `${name} in ${file}`).toBeTruthy();
      expect(def(server, name), `${name} in functions/monthly-report.js`).toBe(def(app, name));
    }
  });
});
