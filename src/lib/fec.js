// ── The FEC: an accountant's ledger export, read like a bank statement ─────
//
// Every French accounting package can export the Fichier des Écritures
// Comptables (article A47 A-1 of the Livre des procédures fiscales): one line
// per ledger movement, 18 named columns, tab- or pipe-separated. An accountant
// holds one for every client, so reading it means the free audit works on the
// files they already have, without asking a client for a bank export.
//
// It also knows something a bank line cannot: the expense account each charge
// was booked to. "PRLV SEPA GOOGLE ADS" and "PRLV GOOGLE GSUITE" look the same
// on a statement; in the ledger one is advertising (623) and the other a
// software rental (6135). The account settles what the name cannot, so each
// charge carries its account class into the audit engine:
//
//   software  booked where software goes (licences 651, rentals 6135,
//             maintenance 6156): a recurring charge here is software even if
//             we do not know the vendor's name
//   excluded  booked where software does not go (rent, insurance, fees,
//             advertising, travel, bank charges, tax, payroll…): never
//             software, whatever the name says
//   neutral   anywhere else (purchases 60x, telecoms 626, other 61x/62x):
//             the vendor name decides, as it does for bank lines
//
// This is a prototype, measured only on synthetic files so far. Bookkeepers
// choose accounts differently; the classes above are the plan comptable
// général's defaults. docs/fec-prototype.md says what real files must show.
//
// Nothing here touches the network: the file is read in the browser, like the
// bank statement, and accountant-channel.test.js holds the page to that.

import { parseAmount, splitLine } from './saasAudit';

const REQUIRED = ['journalcode', 'ecriturenum', 'comptenum'];

/** Is this text an FEC? Its header names the standard columns. */
export function isFec(text) {
  const header = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].toLowerCase();
  return REQUIRED.every((c) => header.includes(c));
}

// Account classes, by prefix. Longest matching prefix wins, so 6135 (software
// rental) beats 613 (rentals) and 6512 beats 65.
const SOFTWARE_PREFIXES = ['651', '6135', '6156'];
const EXCLUDED_PREFIXES = [
  '6132',              // property rent
  '614',               // service charges
  '616',               // insurance
  '621', '622',        // outside staff, fees (accountant, lawyer)
  '623',               // advertising (Google Ads, Meta)
  '624',               // transport
  '625',               // travel, meals, receptions
  '627',               // bank charges (the Qonto plan fee)
  '63', '64',          // tax, payroll
  '652', '653', '654', '655', '656', '657', '658', // other 65x, but not 651
  '66', '67', '68', '69',
];

export function accountClass(account) {
  const a = String(account || '').trim();
  if (!a.startsWith('6')) return null;
  let best = { len: 0, cls: 'neutral' };
  for (const p of SOFTWARE_PREFIXES) if (a.startsWith(p) && p.length > best.len) best = { len: p.length, cls: 'software' };
  for (const p of EXCLUDED_PREFIXES) if (a.startsWith(p) && p.length > best.len) best = { len: p.length, cls: 'excluded' };
  return best.cls;
}

/** 20260315 → Date (UTC). The FEC date format is fixed: AAAAMMJJ. */
export function parseFecDate(raw) {
  const s = String(raw || '').trim();
  if (!/^\d{8}$/.test(s)) return null;
  const y = Number(s.slice(0, 4)); const m = Number(s.slice(4, 6)); const d = Number(s.slice(6, 8));
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

// A supplier sub-account used as a catch-all names nobody.
const CATCH_ALL = /\b(DIVERS|FOURNISSEURS?|FRNS|VARIOUS|SUNDRY)\b/i;

/**
 * FEC text → { transactions, skipped, entries, columns, source: 'fec' }.
 * One transaction per journal entry: the expense lines (class 6) summed,
 * credit notes netted, named after the supplier sub-account where there is
 * one, and dated by the invoice (PieceDate) rather than the posting.
 * Amounts are what the ledger says: excluding VAT.
 */
export function parseFec(text) {
  // Exports from Windows packages often begin with a byte-order mark, which
  // would otherwise glue itself to the first column name.
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  const empty = { transactions: [], skipped: lines.length, entries: 0, columns: null, source: 'fec' };
  if (lines.length < 2 || !isFec(lines[0])) return empty;

  const delimiter = lines[0].includes('\t') ? '\t' : '|';
  const head = splitLine(lines[0], delimiter).map((h) => h.trim().toLowerCase());
  const col = (name) => head.indexOf(name);
  const c = {
    journal: col('journalcode'), num: col('ecriturenum'), date: col('ecrituredate'),
    account: col('comptenum'), accountLabel: col('comptelib'),
    auxLabel: col('compauxlib'), pieceDate: col('piecedate'), label: col('ecriturelib'),
    debit: col('debit'), credit: col('credit'), amount: col('montant'), sense: col('sens'),
  };
  if (c.account < 0 || c.num < 0 || (c.debit < 0 && c.amount < 0)) return empty;

  // Group by entry: every line of one invoice shares journal + entry number.
  const entries = new Map();
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const f = splitLine(line, delimiter);
    const key = `${f[c.journal] ?? ''}|${f[c.num] ?? ''}`;
    let debit; let credit;
    if (c.debit >= 0) {
      debit = parseAmount(f[c.debit]) || 0;
      credit = parseAmount(f[c.credit]) || 0;
    } else {
      // The allowed variant: one Montant column and a Sens of D or C.
      const m = Math.abs(parseAmount(f[c.amount]) || 0);
      const isCredit = String(f[c.sense] || '').trim().toUpperCase().startsWith('C');
      debit = isCredit ? 0 : m; credit = isCredit ? m : 0;
    }
    if (!entries.has(key)) entries.set(key, []);
    entries.get(key).push({
      account: String(f[c.account] ?? '').trim(),
      accountLabel: String(f[c.accountLabel] ?? '').trim(),
      auxLabel: String(f[c.auxLabel] ?? '').trim(),
      label: String(f[c.label] ?? '').trim(),
      date: parseFecDate(f[c.pieceDate]) || parseFecDate(f[c.date]),
      debit, credit,
    });
  }

  const transactions = [];
  let expenseEntries = 0;
  for (const rows of entries.values()) {
    const expenses = rows.filter((r) => r.account.startsWith('6'));
    if (!expenses.length) continue;         // a payment, a sale, VAT: not a cost
    expenseEntries++;
    // The main expense line decides the class and the label: the largest.
    const main = [...expenses].sort((a, b) => (b.debit - b.credit) - (a.debit - a.credit))[0];
    const amount = Math.round(expenses.reduce((s, r) => s + r.debit - r.credit, 0) * 100) / 100;
    const date = main.date || rows.find((r) => r.date)?.date;
    const supplier = rows.find((r) => r.account.startsWith('40') && r.auxLabel && !CATCH_ALL.test(r.auxLabel))?.auxLabel;
    const label = supplier || main.label || main.accountLabel;
    if (!date || !(amount > 0) || !label) { skipped++; continue; }
    transactions.push({
      date, label, amount,
      ledger: { account: main.account, accountLabel: main.accountLabel, class: accountClass(main.account) },
    });
  }
  transactions.sort((a, b) => a.date - b.date);
  return { transactions, skipped, entries: expenseEntries, columns: 'fec', source: 'fec' };
}

// ── A sample FEC ────────────────────────────────────────────────────────────
//
// Six months of a small company's purchase journal, built so the page can
// show an accountant what a ledger reveals before they drop a real one. It
// includes the three lines that fool the bank-statement audit — Google Ads,
// the Qonto plan fee, a café called Monday — booked where a bookkeeper would
// book them, plus a software vendor nobody has heard of, booked as software.
const FEC_HEADER = 'JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise';

export function sampleFec() {
  const out = [FEC_HEADER];
  let n = 0;
  const entry = (m, day, account, accountLabel, aux, label, ht, vat = true) => {
    n++;
    const d = `2026${String(m).padStart(2, '0')}${String(day).padStart(2, '0')}`;
    const amt = (x) => x.toFixed(2).replace('.', ',');
    const tva = Math.round(ht * 0.2 * 100) / 100;
    const ttc = vat ? ht + tva : ht;
    const num = `HA${String(n).padStart(4, '0')}`;
    out.push(`HA|Achats|${num}|${d}|${account}|${accountLabel}|||F${n}|${d}|${label}|${amt(ht)}|0,00||||||`);
    if (vat) out.push(`HA|Achats|${num}|${d}|44566|TVA déductible|||F${n}|${d}|${label}|${amt(tva)}|0,00||||||`);
    out.push(`HA|Achats|${num}|${d}|401000|Fournisseurs|${aux ? 'F' + aux.slice(0, 5).toUpperCase() : ''}|${aux}|F${n}|${d}|${label}|0,00|${amt(ttc)}||||||`);
    // …and the bank journal paying it, which the reader must ignore.
    out.push(`BQ|Banque|BQ${String(n).padStart(4, '0')}|${d}|401000|Fournisseurs|||F${n}|${d}|Règlement ${label}|${amt(ttc)}|0,00||||||`);
    out.push(`BQ|Banque|BQ${String(n).padStart(4, '0')}|${d}|512000|Banque|||F${n}|${d}|Règlement ${label}|0,00|${amt(ttc)}||||||`);
  };
  for (let m = 1; m <= 6; m++) {
    entry(m, 5, '6135', 'Locations logiciels', 'SLACK TECHNOLOGIES LIMITED', 'Slack Pro', 1041.67);
    entry(m, 3, '6135', 'Locations logiciels', 'GOOGLE CLOUD FRANCE', 'Google Workspace', 288.0);
    entry(m, 5, '6512', 'Licences logiciels', 'NOTION LABS INC', 'Notion Plus', m <= 3 ? 80 : 93.33);
    entry(m, 12, '6512', 'Licences logiciels', 'ZEENDOC SAS', 'Abonnement GED', 49.0);
    entry(m, 9, '6231', 'Annonces et insertions', 'GOOGLE IRELAND LTD', 'Google Ads', 400 + m * 25);
    entry(m, 1, '6278', 'Autres frais bancaires', 'QONTO', 'Abonnement Qonto', 29.0, false);
    entry(m, 18, '6257', 'Réceptions', 'MONDAY CAFE', 'Petit-déjeuner équipe', 62.5);
    entry(m, 1, '6132', 'Locations immobilières', 'SCI DES LILAS', 'Loyer bureau', 1800.0);
    entry(m, 20, '6061', 'Fournitures non stockables', 'EDF', 'Électricité', 95 + m);
  }
  return out.join('\n') + '\n';
}
