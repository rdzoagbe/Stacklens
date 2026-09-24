import { describe, it, expect } from 'vitest';
import {
  decodeBankFile, sniffDelimiter, detectColumns, parseAmount, parseDate,
  parseBankExport, normaliseLabel, identifyVendor, detectRecurring, auditSaas,
  reportToCsv, detectDateOrder,
} from './saasAudit';

// ── The public audit has to work on a real French bank export ─────────────
//
// This is the lead magnet for the accountant channel: drop a statement, get
// the recurring software charges back, nothing leaves the browser. It is all
// pure functions, so these CALL it with the kind of file a French bank
// actually produces — ';' delimiters, decimal commas, day-first dates,
// separate Débit/Crédit columns, a preamble before the header — rather than
// the comma-separated, dot-decimal, ISO-dated file every CSV tutorial uses.
//
// If a French export does not parse, the page is a demo for nobody.

const FR_EXPORT = [
  'Compte : FR76 3000 4000 0500 0001 2345 678',
  'Période : 01/01/2026 - 30/06/2026',
  '',
  'Date;Libellé;Débit;Crédit',
  '05/01/2026;PRLV SEPA NOTION LABS INC 05/01 REF 8827361;12,00;',
  '05/02/2026;PRLV SEPA NOTION LABS INC 05/02 REF 8827362;12,00;',
  '05/03/2026;PRLV SEPA NOTION LABS INC 05/03 REF 8827363;12,00;',
  '05/04/2026;PRLV SEPA NOTION LABS INC 05/04 REF 8827364;14,00;',
  '05/05/2026;PRLV SEPA NOTION LABS INC 05/05 REF 8827365;14,00;',
  '05/06/2026;PRLV SEPA NOTION LABS INC 05/06 REF 8827366;14,00;',
  '10/01/2026;CB SLACK TECHNOLOGIES 09/01 CARTE 4974XXXXXXXX1234;1 250,00;',
  '10/02/2026;CB SLACK TECHNOLOGIES 09/02 CARTE 4974XXXXXXXX1234;1 250,00;',
  '10/03/2026;CB SLACK TECHNOLOGIES 09/03 CARTE 4974XXXXXXXX1234;1 250,00;',
  '10/04/2026;CB SLACK TECHNOLOGIES 09/04 CARTE 4974XXXXXXXX1234;1 250,00;',
  '10/05/2026;CB SLACK TECHNOLOGIES 09/05 CARTE 4974XXXXXXXX1234;1 250,00;',
  '10/06/2026;CB SLACK TECHNOLOGIES 09/06 CARTE 4974XXXXXXXX1234;1 250,00;',
  '15/03/2026;CB ADOBE SYSTEMS 14/03 ABONNEMENT ANNUEL;719,88;',
  '20/01/2026;VIR SEPA SALAIRE JANVIER;;3 200,00',
  '20/02/2026;VIR SEPA SALAIRE FEVRIER;;3 200,00',
  '02/01/2026;CB CARREFOUR MARKET 01/01;84,32;',
  '09/01/2026;CB CARREFOUR MARKET 08/01;61,10;',
  '16/02/2026;CB CARREFOUR MARKET 15/02;92,00;',
  '01/02/2026;REMBOURSEMENT NOTION;;12,00',
].join('\n');

describe('decoding a file', () => {
  it('reads UTF-8 as is', () => {
    const bytes = new TextEncoder().encode('Date;Libellé;Montant');
    expect(decodeBankFile(bytes.buffer)).toBe('Date;Libellé;Montant');
  });

  it('falls back to windows-1252 when UTF-8 produces replacement characters', () => {
    // "Libellé" with é as the single byte 0xE9 — what most French banks emit.
    const bytes = Uint8Array.from([...'Date;Libell'].map(c => c.charCodeAt(0)).concat([0xE9]));
    expect(decodeBankFile(bytes.buffer)).toBe('Date;Libellé');
  });
});

describe('sniffing the delimiter', () => {
  it('picks ; for a French export', () => {
    expect(sniffDelimiter(FR_EXPORT)).toBe(';');
  });

  it('picks , for an English one', () => {
    expect(sniffDelimiter('Date,Description,Amount\n2026-01-05,NOTION,-12.00\n2026-02-05,NOTION,-12.00')).toBe(',');
  });

  it('picks a tab when that is what is there', () => {
    expect(sniffDelimiter('Date\tLabel\tAmount\n2026-01-05\tNOTION\t-12\n2026-02-05\tNOTION\t-12')).toBe('\t');
  });

  it('is not fooled by commas inside quoted labels', () => {
    const t = 'Date;Libellé;Montant\n05/01/2026;"NOTION, INC";-12,00\n05/02/2026;"NOTION, INC";-12,00';
    expect(sniffDelimiter(t)).toBe(';');
  });
});

describe('finding the columns', () => {
  it('handles Débit/Crédit split columns', () => {
    const c = detectColumns(['Date', 'Libellé', 'Débit', 'Crédit']);
    expect(c).toMatchObject({ date: 0, label: 1, debit: 2, credit: 3, amount: -1 });
  });

  it('handles a single signed Montant column', () => {
    const c = detectColumns(['Date opération', 'Libellé', 'Montant']);
    expect(c).toMatchObject({ date: 0, label: 1, amount: 2 });
  });

  it('handles English headers', () => {
    const c = detectColumns(['Booking Date', 'Description', 'Amount', 'Balance']);
    expect(c).toMatchObject({ date: 0, label: 1, amount: 2 });
  });

  it('refuses when there is no date or no money column', () => {
    expect(detectColumns(['Libellé', 'Catégorie'])).toBeNull();
    expect(detectColumns(['Date', 'Libellé'])).toBeNull();
  });
});

describe('parsing values the French way', () => {
  it('decimal comma and space thousands', () => {
    expect(parseAmount('1 250,00')).toBe(1250);
    expect(parseAmount('1 250,50')).toBe(1250.5);
    expect(parseAmount('12,00')).toBe(12);
  });

  it('and the English way, deciding by which mark comes last', () => {
    expect(parseAmount('1,250.00')).toBe(1250);
    expect(parseAmount('-12.30')).toBe(-12.3);
    expect(parseAmount('(45,00)')).toBe(-45);
    expect(parseAmount('12,00 €')).toBe(12);
  });

  it('day-first dates', () => {
    expect(parseDate('05/03/2026').toISOString().slice(0, 10)).toBe('2026-03-05');
    expect(parseDate('05.03.26').toISOString().slice(0, 10)).toBe('2026-03-05');
    expect(parseDate('2026-03-05').toISOString().slice(0, 10)).toBe('2026-03-05');
    expect(parseDate('not a date')).toBeNull();
  });
});

describe('parsing a whole French export', () => {
  const r = parseBankExport(FR_EXPORT);

  it('skips the preamble and finds the header', () => {
    expect(r.columns).not.toBeNull();
    expect(r.delimiter).toBe(';');
  });

  it('keeps only money going out', () => {
    // 6 Notion + 6 Slack + 1 Adobe + 3 Carrefour = 16 debits; salaries and the
    // refund are credits and must not appear.
    expect(r.transactions).toHaveLength(16);
    expect(r.transactions.every(t => t.amount > 0)).toBe(true);
    expect(r.transactions.some(t => /SALAIRE|REMBOURSEMENT/.test(t.label))).toBe(false);
  });

  it('is sorted by date', () => {
    const ts = r.transactions.map(t => t.date.getTime());
    expect([...ts].sort((a, b) => a - b)).toEqual(ts);
  });
});

describe('a single signed Montant column', () => {
  // The FR_EXPORT fixture uses split Débit/Crédit columns, so nothing above
  // exercises the other branch. A mutation that counted credits as spend in
  // the signed-column path survived every test here — this one is the fix.
  const signed = [
    'Date;Libellé;Montant',
    '05/01/2026;PRLV SEPA NOTION LABS;-12,00',
    '05/02/2026;PRLV SEPA NOTION LABS;-12,00',
    '20/01/2026;VIR SEPA SALAIRE;3 200,00',
    '01/02/2026;REMBOURSEMENT NOTION;12,00',
  ].join('\n');
  const r = parseBankExport(signed);

  it('keeps the negatives as spend, positive', () => {
    expect(r.transactions).toHaveLength(2);
    expect(r.transactions.every(t => t.amount === 12)).toBe(true);
  });

  it('drops the credits rather than counting them', () => {
    expect(r.transactions.some(t => /SALAIRE|REMBOURSEMENT/.test(t.label))).toBe(false);
    expect(r.skipped).toBe(2);
  });
});

describe('normalising a bank label', () => {
  it('strips the SEPA and card noise to leave the merchant', () => {
    expect(normaliseLabel('PRLV SEPA NOTION LABS INC 05/01 REF 8827361')).toBe('NOTION LABS');
    expect(normaliseLabel('CB SLACK TECHNOLOGIES 09/01 CARTE 4974XXXXXXXX1234')).toBe('SLACK TECHNOLOGIES');
    expect(normaliseLabel('STRIPE *FIGMA 12/03 FR')).toBe('STRIPE FIGMA');
  });

  it('is stable across months, which is what grouping depends on', () => {
    expect(normaliseLabel('PRLV SEPA NOTION LABS INC 05/01 REF 8827361'))
      .toBe(normaliseLabel('PRLV SEPA NOTION LABS INC 05/06 REF 8827366'));
  });
});

describe('recognising vendors', () => {
  it('knows the common ones', () => {
    expect(identifyVendor('NOTION LABS')).toMatchObject({ name: 'Notion', confidence: 'known' });
    expect(identifyVendor('SLACK TECHNOLOGIES')).toMatchObject({ name: 'Slack' });
    expect(identifyVendor('GOOGLE GSUITE')).toMatchObject({ name: 'Google Workspace' });
    expect(identifyVendor('PENNYLANE')).toMatchObject({ name: 'Pennylane', category: 'Finance' });
  });

  it('calls a stranger with software words "likely", not "known"', () => {
    expect(identifyVendor('ACME CLOUD ABONNEMENT')).toMatchObject({ confidence: 'likely' });
  });

  it('and a supermarket nothing at all', () => {
    expect(identifyVendor('CARREFOUR MARKET')).toBeNull();
  });
});

describe('detecting recurrence', () => {
  const r = detectRecurring(parseBankExport(FR_EXPORT).transactions);
  const byVendor = Object.fromEntries(r.map(g => [g.vendor, g]));

  it('finds the monthly ones and their cadence', () => {
    expect(byVendor.Notion.cadence).toBe('monthly');
    expect(byVendor.Notion.charges).toBe(6);
    expect(byVendor.Slack.cadence).toBe('monthly');
    expect(byVendor.Slack.monthlyEquivalent).toBe(1250);
  });

  it('does not list something charged once', () => {
    // Adobe appears once — recurrence needs two.
    expect(byVendor.Adobe).toBeUndefined();
  });

  it('lists the supermarket as recurring but not as SaaS', () => {
    const c = r.find(g => /carrefour/i.test(g.key));
    expect(c).toBeDefined();
    expect(c.saas).toBe(false);
  });

  it('orders by monthly cost, biggest first', () => {
    expect(r[0].vendor).toBe('Slack');
  });
});

describe('the audit report', () => {
  const report = auditSaas(parseBankExport(FR_EXPORT).transactions);

  it('totals only the software, not the groceries', () => {
    // Slack 1250 + Notion avg(12,12,12,14,14,14)=13 → 1263
    expect(report.totals.monthlySaas).toBe(1263);
    expect(report.totals.annualisedSaas).toBe(1263 * 12);
    expect(report.totals.subscriptionCount).toBe(2);
    expect(report.totals.knownVendors).toBe(2);
  });

  it('flags the price rise', () => {
    expect(report.findings.priceIncreases).toEqual([
      { vendor: 'Notion', from: 12, to: 14, pct: 17 },
    ]);
  });

  it('dates itself from the file, not the wall clock', () => {
    // The latest transaction is 10/06/2026. A statement from last year must
    // not report every annual subscription as overdue.
    expect(report.asOf.toISOString().slice(0, 10)).toBe('2026-06-10');
  });

  it('keeps the non-software recurring charges separately, not silently dropped', () => {
    expect(report.otherRecurring.some(o => /carrefour/i.test(o.key))).toBe(true);
    expect(report.subscriptions.some(s => /carrefour/i.test(s.key))).toBe(false);
  });
});

describe('the findings', () => {
  const mk = (rows) => parseBankExport('Date;Libellé;Montant\n' + rows.join('\n')).transactions;

  it('two labels for one vendor is a duplicate', () => {
    const tx = mk([
      '05/01/2026;PRLV SEPA NOTION LABS;-12,00',
      '05/02/2026;PRLV SEPA NOTION LABS;-12,00',
      '07/01/2026;CB NOTION;-8,00',
      '07/02/2026;CB NOTION;-8,00',
    ]);
    const r = auditSaas(tx);
    expect(r.findings.duplicates).toEqual([
      { vendor: 'Notion', lines: 2, monthlyEquivalent: 20 },
    ]);
  });

  it('the same label twice a month, repeatedly, is several seats on one card', () => {
    const tx = mk([
      '05/01/2026;CB FIGMA;-15,00', '19/01/2026;CB FIGMA;-15,00',
      '05/02/2026;CB FIGMA;-15,00', '19/02/2026;CB FIGMA;-15,00',
      '05/03/2026;CB FIGMA;-15,00', '19/03/2026;CB FIGMA;-15,00',
    ]);
    const r = auditSaas(tx);
    expect(r.findings.multiPerMonth.map(m => m.vendor)).toEqual(['Figma']);
  });

  it('an annual charge about to come round again is upcoming', () => {
    const tx = mk([
      '15/03/2025;CB ADOBE ANNUEL;-719,88',
      '15/03/2026;CB ADOBE ANNUEL;-719,88',
      '01/02/2027;CB CARREFOUR;-10,00',   // pushes asOf to Feb 2027
      '01/02/2027;CB CARREFOUR;-10,00',
    ]);
    const r = auditSaas(tx);
    expect(r.findings.upcomingAnnual).toHaveLength(1);
    expect(r.findings.upcomingAnnual[0]).toMatchObject({ vendor: 'Adobe', amount: 719.88 });
    expect(r.findings.upcomingAnnual[0].inDays).toBeGreaterThan(30);
    expect(r.findings.upcomingAnnual[0].inDays).toBeLessThanOrEqual(60);
  });

  it('but not one that renewed six months ago', () => {
    const tx = mk([
      '15/03/2025;CB ADOBE ANNUEL;-719,88',
      '15/03/2026;CB ADOBE ANNUEL;-719,88',
      '01/09/2026;CB CARREFOUR;-10,00',
      '01/09/2026;CB CARREFOUR;-10,00',
    ]);
    expect(auditSaas(tx).findings.upcomingAnnual).toEqual([]);
  });

  it('a small charge that has run for months is a forgotten candidate', () => {
    const rows = [];
    for (let m = 1; m <= 8; m++) rows.push(`05/${String(m).padStart(2, '0')}/2026;CB CALENDLY;-9,00`);
    const r = auditSaas(mk(rows));
    expect(r.findings.forgotten).toEqual([{ vendor: 'Calendly', monthlyEquivalent: 9, charges: 8 }]);
  });

  it('a big charge is never "forgotten", however long it has run', () => {
    const rows = [];
    for (let m = 1; m <= 8; m++) rows.push(`05/${String(m).padStart(2, '0')}/2026;CB SLACK;-900,00`);
    expect(auditSaas(mk(rows)).findings.forgotten).toEqual([]);
  });

  it('twice-monthly charges still count towards the monthly total', () => {
    // Found by driving the page: Figma on the 5th and the 21st came out as
    // "Irregular · —" and was absent from the total, while the finding right
    // beside it flagged the same charges as "several a month". Estimated from
    // the span now: 6 x 45 over roughly two and a half months ≈ 108/mo.
    const tx = mk([
      '05/01/2026;CB FIGMA;-45,00', '21/01/2026;CB FIGMA;-45,00',
      '05/02/2026;CB FIGMA;-45,00', '21/02/2026;CB FIGMA;-45,00',
      '05/03/2026;CB FIGMA;-45,00', '21/03/2026;CB FIGMA;-45,00',
    ]);
    const r = auditSaas(tx);
    const figma = r.subscriptions.find(s => s.vendor === 'Figma');
    expect(figma.cadence).toBe('irregular');
    expect(figma.monthlyEquivalent, 'must not be null').toBeGreaterThan(80);
    expect(figma.monthlyEquivalent).toBeLessThan(120);
    expect(r.totals.monthlySaas, 'and it must be in the total').toBe(figma.monthlyEquivalent);
  });

  it('accepts an explicit now for the renewal window', () => {
    const tx = mk(['15/03/2025;CB ADOBE ANNUEL;-719,88', '15/03/2026;CB ADOBE ANNUEL;-719,88']);
    const r = auditSaas(tx, { now: new Date(Date.UTC(2027, 1, 1)) });
    expect(r.findings.upcomingAnnual).toHaveLength(1);
  });
});

describe('exporting the report', () => {
  it('produces a CSV with a header and one row per recurring charge', () => {
    const report = auditSaas(parseBankExport(FR_EXPORT).transactions);
    const csv = reportToCsv(report);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toMatch(/^vendor,category,confidence,cadence,charges/);
    // 2 subscriptions + 1 other recurring (Carrefour)
    expect(lines).toHaveLength(1 + 3);
    expect(csv).toContain('Slack');
    expect(csv).toContain('Notion');
  });
});

describe('what it must never do', () => {
  it('the module makes no network calls and touches no storage', () => {
    // The pitch is "nothing leaves your browser". That is only true if it is
    // structurally true, so it is asserted on the source rather than trusted.
    const src = require('node:fs').readFileSync(
      require('node:path').resolve(process.cwd(), 'src/lib/saasAudit.js'), 'utf8');
    for (const bad of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'navigator.sendBeacon', 'import(']) {
      expect(src, `${bad} has no business in a browser-only audit`).not.toContain(bad);
    }
  });
});


// ── Day-first or month-first, read off the file ───────────────────────────
//
// `04/03/2026` is 4 March nearly everywhere and 3 April in the United States,
// and the value alone cannot say which. Reading everything day-first did not
// fail loudly on a US export, it failed twice and quietly: a day past the
// 12th became an impossible month and the row was dropped in with the other
// skipped lines, and a day of 12 or less was accepted with the day and month
// swapped. Five US rows in gave three silently gone and two silently wrong,
// and the cadence, the monthly total and the renewal dates were then all
// computed from dates that were never in the file.
//
// The statement carries the proof, so it is read rather than assumed.

const usExport = (dates, label = 'NOTION LABS INC', amount = '-96.00') =>
  ['Date,Description,Amount', ...dates.map(d => `${d},${label},${amount}`)].join('\n');

describe('detectDateOrder', () => {
  it('proves day-first from a first component above 12', () => {
    const r = detectDateOrder(['15/01/2026', '05/02/2026']);
    expect(r.order).toBe('dmy');
    expect(r.evidence).toBe('proven');
  });

  it('proves month-first from a second component above 12', () => {
    const r = detectDateOrder(['01/15/2026', '02/05/2026']);
    expect(r.order).toBe('mdy');
    expect(r.evidence).toBe('proven');
  });

  it('says so when nothing in the column can settle it, and takes the hint', () => {
    const dates = ['05/01/2026', '05/02/2026', '05/03/2026'];
    expect(detectDateOrder(dates)).toMatchObject({ order: 'dmy', evidence: 'assumed' });
    expect(detectDateOrder(dates, 'mdy')).toMatchObject({ order: 'mdy', evidence: 'assumed' });
  });

  it('reports a conflict and follows the weight of evidence', () => {
    const r = detectDateOrder(['15/01/2026', '02/20/2026', '16/01/2026']);
    expect(r.evidence).toBe('conflict');
    expect(r.dayFirstProof).toBe(2);
    expect(r.monthFirstProof).toBe(1);
    expect(r.order).toBe('dmy');
  });

  it('is not confused by ISO dates or by rows with no date at all', () => {
    expect(detectDateOrder(['2026-01-15', '', null, 'n/a'])).toMatchObject({ evidence: 'none' });
  });
});

describe('parseDate honours the order it is given', () => {
  it('reads the same value both ways', () => {
    expect(parseDate('04/03/2026', 'dmy').toISOString().slice(0, 10)).toBe('2026-03-04');
    expect(parseDate('04/03/2026', 'mdy').toISOString().slice(0, 10)).toBe('2026-04-03');
  });

  it('defaults to day-first, so every existing caller is unchanged', () => {
    expect(parseDate('04/03/2026').toISOString().slice(0, 10)).toBe('2026-03-04');
  });

  it('leaves ISO alone, which is unambiguous', () => {
    expect(parseDate('2026-03-04', 'mdy').toISOString().slice(0, 10)).toBe('2026-03-04');
  });
});

describe('a US bank export', () => {
  const text = usExport(['01/15/2026', '02/15/2026', '03/15/2026', '04/03/2026', '05/03/2026']);

  it('keeps every row instead of dropping the ones past the 12th', () => {
    const p = parseBankExport(text);
    expect(p.transactions).toHaveLength(5);
    expect(p.skipped).toBe(0);
  });

  it('reads the dates the way the statement meant them', () => {
    const p = parseBankExport(text);
    expect(p.transactions.map(t => t.date.toISOString().slice(0, 10))).toEqual([
      '2026-01-15', '2026-02-15', '2026-03-15', '2026-04-03', '2026-05-03',
    ]);
  });

  it('says how it decided, so a wrong guess is visible rather than silent', () => {
    expect(parseBankExport(text).dateOrder).toMatchObject({ order: 'mdy', evidence: 'proven' });
  });

  it('now detects the monthly cadence it used to read as irregular', () => {
    const report = auditSaas(parseBankExport(text).transactions);
    expect(report.subscriptions).toHaveLength(1);
    expect(report.subscriptions[0].cadence).toBe('monthly');
    expect(report.subscriptions[0].vendor).toBe('Notion');
  });

  it('the regression in full: day-first parsing loses three of five and moves the rest', () => {
    // What the old code did, reproduced through the public function.
    const asIfDayFirst = parseBankExport(text).transactions
      .map(t => parseDate(t.raw.split(',')[0], 'dmy'))
      .filter(Boolean);
    expect(asIfDayFirst).toHaveLength(2);
    expect(asIfDayFirst.map(d => d.toISOString().slice(0, 10))).toEqual(['2026-03-04', '2026-03-05']);
  });
});

describe('the French export is untouched by all of this', () => {
  it('still reads day-first, and says it proved it', () => {
    const p = parseBankExport(FR_EXPORT);
    expect(p.dateOrder).toMatchObject({ order: 'dmy', evidence: 'proven' });
  });

  it('a semicolon file with only low dates is still assumed day-first', () => {
    const text = ['Date;Libellé;Débit',
      '05/01/2026;PRLV SEPA NOTION LABS INC;96,00',
      '05/02/2026;PRLV SEPA NOTION LABS INC;96,00'].join('\n');
    const p = parseBankExport(text);
    expect(p.dateOrder).toMatchObject({ order: 'dmy', evidence: 'assumed' });
    expect(p.transactions.map(t => t.date.toISOString().slice(0, 10)))
      .toEqual(['2026-01-05', '2026-02-05']);
  });
});
