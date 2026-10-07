import { describe, it, expect } from 'vitest';
import {
  readClientFile, portfolioRow, portfolioTotals, portfolioCsv, samplePortfolio, clientNameFromFile, detectSymbol, MAX_PORTFOLIO_FILES,
} from './portfolio';
import { sampleBankExport, auditSaas, parseBankExport } from './saasAudit';
import { sampleFec } from './fec';

// ── Several clients' files, one table ──────────────────────────────────────

describe('reading each file', () => {
  it('a bank statement and an FEC are read exactly as the single-file audit reads them', () => {
    const bank = readClientFile({ fileName: 'dupont.csv', text: sampleBankExport() });
    expect(bank).toMatchObject({ format: 'bank', symbol: '€', name: 'Dupont' });
    expect(portfolioRow(bank).subscriptions).toBe(auditSaas(parseBankExport(sampleBankExport()).transactions).totals.subscriptionCount);
    expect(readClientFile({ fileName: 'martin.txt', text: sampleFec() }).format).toBe('fec');
  });

  it('a file that is not a statement, or holds nothing, is an error with its name', () => {
    expect(readClientFile({ fileName: 'notes.txt', text: 'hello\nworld\n' })).toMatchObject({ error: 'columns', fileName: 'notes.txt' });
    expect(readClientFile({ fileName: 'vide.csv', text: 'Date;Libellé;Débit;Crédit\n' }).error).toBeTruthy();
  });

  it('names a client from its file, and reads the currency from the text', () => {
    expect(clientNameFromFile('releve_boulangerie-dupont.2026.csv')).toBe('Releve boulangerie dupont 2026');
    expect(clientNameFromFile('')).toBe('');
    expect(detectSymbol('Amount USD')).toBe('$');
    expect(detectSymbol('Montant')).toBe('€');
  });
});

describe('one row per client', () => {
  const [dupont] = samplePortfolio().map(readClientFile);

  it("follows that client's review", () => {
    const before = portfolioRow(dupont);
    const slack = auditSaas(dupont.transactions).subscriptions.find((s) => s.vendor === 'Slack');
    const after = portfolioRow({ ...dupont, verdicts: { [slack.key]: { kind: 'reject' } } });
    expect(after.subscriptions).toBe(before.subscriptions - 1);
    expect(after.monthly).toBeLessThan(before.monthly);
    expect(after.reviewed).toBe(1);
  });

  it('counts what the single report flags, and what stopped', () => {
    const r = portfolioRow(dupont);
    const f = auditSaas(dupont.transactions).findings;
    expect(r.flagged).toBe(f.duplicates.length + f.multiPerMonth.length + f.priceIncreases.length + f.upcomingAnnual.length + f.forgotten.length);
    expect(r.stopped).toBe(1);   // the sample's Zoom
  });
});

describe('the portfolio', () => {
  const rows = samplePortfolio().map(readClientFile).map(portfolioRow);

  it('three sample clients, each with something to look at', () => {
    expect(rows.map((r) => r.name)).toEqual(['Boulangerie Dupont', 'Atelier Martin Architectes', 'Studio Lumière']);
    expect(rows.every((r) => r.subscriptions > 0 && r.flagged > 0)).toBe(true);
  });

  it('adds the clients up, and refuses to add different currencies', () => {
    const t = portfolioTotals(rows);
    expect(t).toMatchObject({ clients: 3, withFindings: 3, mixedCurrencies: false });
    expect(t.monthly).toBeCloseTo(rows.reduce((s, r) => s + r.monthly, 0), 2);
    const mixed = portfolioTotals([rows[0], { ...rows[1], symbol: '$' }]);
    expect(mixed).toMatchObject({ mixedCurrencies: true, monthly: null, annual: null });
  });

  it('flags a total that adds ledgers (before tax) to bank statements (tax included)', () => {
    const t = portfolioTotals(rows);
    expect(rows.some((r) => r.format === 'fec') && rows.some((r) => r.format === 'bank')).toBe(true);
    expect(t.mixedTax).toBe(true);
    expect(portfolioTotals(rows.filter((r) => r.format === 'bank')).mixedTax).toBe(false);
  });

  it('the CSV opens in French Excel: semicolons and decimal commas', () => {
    const csv = portfolioCsv(rows, { sep: ';', decimal: ',' });
    const lines = csv.trim().split('\n');
    expect(lines[0].split(';')).toHaveLength(12);
    expect(lines[1].split(';')).toHaveLength(12);
    expect(lines.slice(1).some((l) => /;\d+,\d+;/.test(l))).toBe(true);
  });

  it('the CSV has one line per client, figures only, never a bank label', () => {
    const csv = portfolioCsv(rows);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('client,source,subscriptions,monthly_software,annualised,points_to_check,duplicates,price_increases,renewals_within_60_days,stopped,currency,statement_up_to');
    expect(lines[2]).toMatch(/^Atelier Martin Architectes,FEC,/);
    expect(csv).not.toMatch(/PRLV|CB |CARTE|SLACK TECHNOLOGIES/);
  });

  it('takes at most 25 files at once', () => {
    expect(MAX_PORTFOLIO_FILES).toBe(25);
  });
});
