// ── The free audit, for a portfolio of clients at once ─────────────────────
//
// An accounting firm does not have one client, it has thirty. Dropping their
// statements one by one and writing each total down is the job this saves:
// several files go in, each is read exactly as the single-file audit reads it
// (bank statement or FEC), and the page shows one row per client, the
// portfolio's total, and each client's full report a click away.
//
// Same promise as the rest of the page: everything happens in the browser.
// Nothing here fetches or stores anything (accountant-channel.test.js checks
// this module with the page).

import { parseBankExport, auditSaas } from './saasAudit';
import { isFec, parseFec, sampleFec } from './fec';
import { sampleBankExport } from './saasAudit';

export const MAX_PORTFOLIO_FILES = 25;

const CURRENCY_HINTS = [
  [/€|\bEUR\b/, '€'], [/£|\bGBP\b/, '£'], [/\$|\bUSD\b/, '$'], [/\bCHF\b/, 'CHF '],
];
/** The currency a statement is in, from the symbols in its text; € otherwise. */
export function detectSymbol(text) {
  for (const [re, sym] of CURRENCY_HINTS) if (re.test(text)) return sym;
  return '€';
}

/** "releve_boulangerie-dupont.2026.csv" → "releve boulangerie dupont 2026" */
export function clientNameFromFile(fileName) {
  const base = String(fileName || '').replace(/\.[a-z0-9]{1,5}$/i, '');
  const name = base.replace(/[_.-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
}

/**
 * One file, read as the single-file audit reads it. Returns the client, or
 * { error } when the file is not a statement or holds no transactions.
 */
export function readClientFile({ name, fileName, text, forceOrder }) {
  const fec = isFec(text);
  const parsed = fec ? parseFec(text) : parseBankExport(text, forceOrder);
  const label = name || clientNameFromFile(fileName) || fileName || '—';
  if (!parsed.columns) return { name: label, fileName, error: 'columns' };
  if (!parsed.transactions.length) return { name: label, fileName, error: 'empty' };
  return {
    name: label, fileName, text,
    format: fec ? 'fec' : 'bank',
    symbol: fec ? '€' : detectSymbol(text),
    transactions: parsed.transactions,
    entries: parsed.entries, skipped: parsed.skipped, credits: parsed.credits || 0, unreadable: parsed.unreadable || [], dateOrder: parsed.dateOrder,
    verdicts: {},
  };
}

const flaggedCount = (f) =>
  f.duplicates.length + f.multiPerMonth.length + f.priceIncreases.length + f.upcomingAnnual.length + f.forgotten.length;

/** The row a client gets in the portfolio table, with that client's review applied. */
export function portfolioRow(client) {
  const r = auditSaas(client.transactions, { verdicts: client.verdicts });
  const f = r.findings;
  return {
    name: client.name, format: client.format, symbol: client.symbol,
    subscriptions: r.totals.subscriptionCount,
    monthly: r.totals.monthlySaas,
    annual: r.totals.annualisedSaas,
    flagged: flaggedCount(f),
    stopped: r.stopped.length,
    duplicates: f.duplicates.length,
    priceIncreases: f.priceIncreases.length,
    renewalsSoon: f.upcomingAnnual.length,
    reviewed: Object.keys(client.verdicts || {}).length,
    asOf: r.asOf,
  };
}

/** Totals across the portfolio. Amounts in different currencies are not added up. */
export function portfolioTotals(rows) {
  const symbols = new Set(rows.map((r) => r.symbol));
  // A ledger (FEC) is before tax; a bank statement is what left the account,
  // tax included. The total still adds them (an accountant wants one figure),
  // but says so, because the sum is then neither all-HT nor all-TTC.
  const mixedTax = new Set(rows.map((r) => r.format === 'fec')).size > 1;
  const additive = symbols.size === 1;
  const round2 = (n) => Math.round(n * 100) / 100;
  return {
    clients: rows.length,
    withFindings: rows.filter((r) => r.flagged > 0).length,
    flagged: rows.reduce((s, r) => s + r.flagged, 0),
    subscriptions: rows.reduce((s, r) => s + r.subscriptions, 0),
    mixedCurrencies: symbols.size > 1,
    mixedTax,
    monthly: additive ? round2(rows.reduce((s, r) => s + r.monthly, 0)) : null,
    annual: additive ? round2(rows.reduce((s, r) => s + r.annual, 0)) : null,
  };
}

/** The portfolio as a CSV, one line per client: figures and counts, never a bank line. */
export function portfolioCsv(rows, style = { sep: ',', decimal: '.' }) {
  const { sep, decimal } = style;
  const cols = ['client', 'source', 'subscriptions', 'monthly_software', 'annualised', 'points_to_check',
    'duplicates', 'price_increases', 'renewals_within_60_days', 'stopped', 'currency', 'statement_up_to'];
  const esc = (v) => {
    let s = v == null ? '' : String(v);
    if (typeof v === 'number' && decimal !== '.') s = s.replace('.', decimal);
    const quote = s.includes('"') || s.includes('\n') || s.includes(sep) || (sep === ',' && s.includes(';'));
    return quote ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const lines = rows.map((r) => [
    r.name, r.format === 'fec' ? 'FEC' : 'bank', r.subscriptions, r.monthly, r.annual, r.flagged,
    r.duplicates, r.priceIncreases, r.renewalsSoon, r.stopped, r.symbol.trim(),
    r.asOf instanceof Date ? r.asOf.toISOString().slice(0, 10) : '',
  ].map(esc).join(sep));
  return [cols.join(sep), ...lines].join('\n') + '\n';
}

// A third, smaller client for the sample portfolio: a design studio paying
// for its tools on one card, with one line charged twice a month.
function sampleStudioExport() {
  const rows = [];
  const line = (d, m, label, debit) =>
    rows.push(`${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/2026;${label};${debit};`);
  for (let m = 1; m <= 6; m++) {
    line(4, m, 'CB ADOBE CREATIVE CLOUD', '71,99');
    line(4, m, 'CB ADOBE CREATIVE CLOUD', '71,99');
    line(8, m, 'CB CANVA PRO', '11,99');
    line(15, m, 'PRLV SEPA DROPBOX', m <= 2 ? '9,99' : '11,99');
    line(20, m, 'CB MIRO', '8,00');
    line(26, m, `CB PICARD SURGELES ${m}/2026`, `${30 + m},40`);
  }
  return 'Date;Libellé;Débit;Crédit\n' + rows.join('\n') + '\n';
}

/** Three fictional clients, so the page can show a portfolio before any file is dropped. */
export function samplePortfolio() {
  return [
    { name: 'Boulangerie Dupont', fileName: 'boulangerie-dupont.csv', text: sampleBankExport() },
    { name: 'Atelier Martin Architectes', fileName: 'atelier-martin-fec.txt', text: sampleFec() },
    { name: 'Studio Lumière', fileName: 'studio-lumiere.csv', text: sampleStudioExport() },
  ];
}
