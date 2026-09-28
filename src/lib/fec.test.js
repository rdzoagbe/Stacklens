import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isFec, parseFec, parseFecDate, accountClass, sampleFec } from './fec';
import { auditSaas, parseBankExport } from './saasAudit';

// ── Reading an FEC ─────────────────────────────────────────────────────────
//
// The ledger export every French accounting package produces. These pin the
// format (both separators, both amount layouts, the fixed date), what counts
// as a charge (class 6 lines of one entry, net of credit notes, VAT and
// payments left out), and the reason to read it at all: the expense account
// settles the cases a bank line cannot.

const HEADER = 'JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise';
const row = (num, date, account, aux, label, debit, credit) =>
  `HA|Achats|${num}|${date}|${account}|lib|||P|${date}|${label}|${debit}|${credit}||||||`;
const rowAux = (num, date, aux, label, credit) =>
  `HA|Achats|${num}|${date}|401000|Fournisseurs|F1|${aux}|P|${date}|${label}|0,00|${credit}||||||`;

describe('recognising the format', () => {
  it('knows an FEC by its header, and a bank export is not one', () => {
    expect(isFec(HEADER + '\n')).toBe(true);
    expect(isFec(HEADER.replaceAll('|', '\t'))).toBe(true);
    expect(isFec('Date;Libellé;Débit;Crédit\n05/01/2026;CB SLACK;12,00;\n')).toBe(false);
  });

  it('reads the fixed date format and rejects impossible dates', () => {
    expect(parseFecDate('20260315').toISOString().slice(0, 10)).toBe('2026-03-15');
    expect(parseFecDate('20260231')).toBeNull();
    expect(parseFecDate('15/03/2026')).toBeNull();
  });
});

describe('the expense account decides', () => {
  it.each([
    ['6512', 'software'], ['651', 'software'], ['6135', 'software'], ['6156', 'software'],
    ['6132', 'excluded'], ['6231', 'excluded'], ['6278', 'excluded'], ['6257', 'excluded'],
    ['6226', 'excluded'], ['641', 'excluded'], ['6541', 'excluded'],
    ['6061', 'neutral'], ['6064', 'neutral'], ['626', 'neutral'], ['6183', 'neutral'],
    ['401000', null], ['512000', null], ['44566', null],
  ])('%s → %s', (account, cls) => {
    expect(accountClass(account)).toBe(cls);
  });
});

describe('what counts as a charge', () => {
  const { transactions, entries } = parseFec(sampleFec());

  it('one charge per purchase entry; payments and VAT are not charges', () => {
    // 9 suppliers × 6 months of purchases. The bank journal paying each one
    // has no class 6 line and must not appear.
    expect(entries).toBe(54);
    expect(transactions).toHaveLength(54);
  });

  it('amounts are the ledger\'s: excluding VAT', () => {
    const slack = transactions.find((t) => t.label === 'SLACK TECHNOLOGIES LIMITED');
    expect(slack.amount).toBe(1041.67);
  });

  it('is named after the supplier sub-account', () => {
    expect(transactions.some((t) => t.label === 'ZEENDOC SAS')).toBe(true);
  });

  it('nets credits inside an entry; a credit note on its own is not a charge', () => {
    // A credit note is its own entry and is not matched to the invoice it
    // refunds: the prototype drops it rather than guess which month it offsets.
    const text = [HEADER,
      row('A1', '20260105', '6135', '', 'Slack', '120,00', '0,00'), row('A1', '20260105', '6135', '', 'Remise', '0,00', '20,00'),
      rowAux('A1', '20260105', 'SLACK', 'Slack', '100,00'),
      row('A2', '20260110', '6135', '', 'Avoir Slack', '0,00', '30,00'), rowAux('A2', '20260110', 'SLACK', 'Avoir', '-30,00'),
      row('A3', '20260115', '6135', '', 'Avoir total', '0,00', '50,00'),
    ].join('\n');
    const r = parseFec(text);
    expect(r.transactions.map((t) => t.amount)).toEqual([100]);
    expect(r.skipped).toBe(2);
  });

  it('falls back to the entry label when the supplier account is a catch-all', () => {
    const text = [HEADER,
      row('B1', '20260105', '6512', '', 'Licence Zeendoc', '49,00', '0,00'),
      rowAux('B1', '20260105', 'FOURNISSEURS DIVERS', 'Licence Zeendoc', '49,00'),
    ].join('\n');
    expect(parseFec(text).transactions[0].label).toBe('Licence Zeendoc');
  });

  it('reads the tab-separated variant with a Montant and Sens column', () => {
    const head = 'JournalCode\tJournalLib\tEcritureNum\tEcritureDate\tCompteNum\tCompteLib\tCompAuxNum\tCompAuxLib\tPieceRef\tPieceDate\tEcritureLib\tMontant\tSens\tEcritureLet\tDateLet\tValidDate\tMontantdevise\tIdevise';
    const text = [head,
      'HA\tAchats\tC1\t20260105\t6512\tLicences\t\t\tP\t20260105\tNotion\t80,00\tD\t\t\t\t\t',
      'HA\tAchats\tC1\t20260105\t401000\tFournisseurs\tF1\tNOTION LABS\tP\t20260105\tNotion\t80,00\tC\t\t\t\t\t',
    ].join('\n');
    const r = parseFec(text);
    expect(r.transactions).toHaveLength(1);
    expect(r.transactions[0]).toMatchObject({ label: 'NOTION LABS', amount: 80 });
  });
});

describe('why read the ledger at all', () => {
  // The three lines the bank-statement audit gets wrong (docs/grants/innovup/02,
  // and the LinkedIn post): each looks like software on a statement.
  const traps = ['PRLV SEPA GOOGLE ADS', 'CB QONTO ABONNEMENT', 'CB MONDAY CAFE PARIS 11'];

  it('on a bank statement the traps read as software', () => {
    const lines = ['Date;Libellé;Débit;Crédit'];
    for (let m = 1; m <= 6; m++) for (const t of traps) lines.push(`0${m % 9 + 1}/0${m}/2026;${t};100,00;`);
    const r = auditSaas(parseBankExport(lines.join('\n')).transactions);
    expect(r.totals.subscriptionCount).toBe(3);
  });

  it('in the ledger they are booked where they belong, and are not', () => {
    const r = auditSaas(parseFec(sampleFec()).transactions);
    const vendors = r.subscriptions.map((s) => s.vendor);
    expect(vendors).toEqual(expect.arrayContaining(['Slack', 'Google Workspace', 'Notion']));
    expect(vendors).not.toContain('monday.com');
    expect(r.subscriptions.some((s) => /QONTO|GOOGLE IRELAND/.test(s.key))).toBe(false);
    expect(r.otherRecurring.map((o) => o.key)).toEqual(expect.arrayContaining(['GOOGLE IRELAND', 'QONTO', 'MONDAY CAFE']));
  });

  it('and a vendor nobody has listed is found by its account', () => {
    const r = auditSaas(parseFec(sampleFec()).transactions);
    const z = r.subscriptions.find((s) => s.key === 'ZEENDOC');
    expect(z).toMatchObject({ confidence: 'likely', ledgerClass: 'software', account: '6512' });
  });

  it('an annual licence booked once in the year is kept, and its renewal flagged', () => {
    // One fiscal year holds one charge of a yearly licence. It used to be
    // dropped for lack of a second charge: the biggest software line gone.
    const text = [HEADER,
      row('Y1', '20251014', '6512', '', 'Adobe CC annuel', '2699,90', '0,00'),
      rowAux('Y1', '20251014', 'ADOBE SYSTEMS SOFTWARE IRELAND', 'Adobe', '3239,88'),
      row('Y2', '20260920', '6135', '', 'Slack', '122,50', '0,00'), rowAux('Y2', '20260920', 'SLACK', 'Slack', '147,00'),
      row('Y3', '20260920', '6064', '', 'Clé USB', '19,90', '0,00'), rowAux('Y3', '20260920', 'FNAC', 'Clé USB', '23,88'),
    ].join('\n');
    const r = auditSaas(parseFec(text).transactions);
    const adobe = r.subscriptions.find((s) => s.vendor === 'Adobe');
    expect(adobe).toMatchObject({ cadence: 'annual', singleCharge: true, charges: 1 });
    expect(adobe.monthlyEquivalent).toBeCloseTo(2699.9 / 12, 1);
    expect(r.findings.upcomingAnnual.map((u) => u.vendor)).toContain('Adobe');
    // A single charge anywhere else is still not a subscription.
    expect(r.subscriptions.some((s) => /FNAC/.test(s.key))).toBe(false);
    expect(r.subscriptions.some((s) => s.vendor === 'Slack')).toBe(true);
  });

  it('bank transactions are untouched by the ledger rules', () => {
    const tx = parseBankExport('Date;Libellé;Débit;Crédit\n05/01/2026;CB SLACK;12,00;\n05/02/2026;CB SLACK;12,00;\n').transactions;
    expect(auditSaas(tx).subscriptions[0]).not.toHaveProperty('ledgerClass');
  });
});

describe('real files', () => {
  it('reads a file that starts with a byte-order mark', () => {
    const r = parseFec('\uFEFF' + sampleFec());
    expect(r.entries).toBe(54);
    expect(r.transactions[0].label).toBeTruthy();
  });

  it('reads a year of a busy company quickly enough for a browser', () => {
    // ~60,000 lines: a year of daily purchases with VAT, supplier and bank
    // lines. The reader is one pass plus a group-by; this guards against
    // anything quadratic creeping in.
    const lines = [HEADER];
    for (let i = 0; i < 12000; i++) {
      const d = `2026${String(1 + (i % 12)).padStart(2, '0')}${String(1 + (i % 28)).padStart(2, '0')}`;
      const num = `E${i}`;
      lines.push(row(num, d, '6064', '', `Achat ${i % 400}`, '10,00', '0,00'));
      lines.push(row(num, d, '44566', '', 'TVA', '2,00', '0,00'));
      lines.push(rowAux(num, d, `FOURNISSEUR ${i % 400}`, 'Achat', '12,00'));
      lines.push(`BQ|Banque|B${i}|${d}|401000|F|||P|${d}|Règlement|12,00|0,00||||||`);
      lines.push(`BQ|Banque|B${i}|${d}|512000|B|||P|${d}|Règlement|0,00|12,00||||||`);
    }
    const started = performance.now();
    const r = parseFec(lines.join('\n'));
    auditSaas(r.transactions);
    expect(r.entries).toBe(12000);
    expect(performance.now() - started).toBeLessThan(3000);
  });
});

describe('the ledger stays in the browser', () => {
  it('lib/fec.js makes no network call', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/fec.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const bad of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'import(', 'localStorage']) {
      expect(src, bad).not.toContain(bad);
    }
  });
});
