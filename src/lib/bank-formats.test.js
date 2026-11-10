import { describe, it, expect } from 'vitest';
import { parseBankExport, auditSaas } from './saasAudit';
import { detectSymbol } from './portfolio';

// ── Bank exports from outside France ──────────────────────────────────────
//
// Before writing to firms in Germany, Switzerland, Belgium, Luxembourg,
// Portugal and the UK, each country's usual export was run through the
// audit: German, Swiss, Portuguese and Dutch-language Belgian files found
// nothing (their date, amount and payee columns had names the audit did not
// know), and PostFinance's "KAUF/DIENSTLEISTUNG VOM … KARTEN NR." hid the
// merchant. These are layouts as each bank documents them, written by hand
// with the same five subscriptions and one payment received a month; a real
// file from a tester should be added here when one arrives.
const SUBS = [['SLACK TECHNOLOGIES', 87.5], ['ZOOM.US', 149.9], ['NOTION LABS', 96], ['ADOBE CREATIVE CLOUD', 59.99], ['MICROSOFT 365', 264]];
const pad = (n) => String(n).padStart(2, '0');
const fr = (x) => x.toFixed(2).replace('.', ',');
const months = Array.from({ length: 12 }, (_, i) => i + 1);
const F = {
  'DE Sparkasse': () => ['"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Glaeubiger ID";"Mandatsreferenz";"Kundenreferenz (End-to-End)";"Sammlerreferenz";"Lastschrift Ursprungsbetrag";"Auslagenersatz Ruecklastschrift";"Beguenstigter/Zahlungspflichtiger";"Kontonummer/IBAN";"BIC (SWIFT-Code)";"Betrag";"Waehrung";"Info"',
    ...months.flatMap(m => [...SUBS.map(([n, a]) => `"DE123";"15.${pad(m)}.26";"15.${pad(m)}.26";"FOLGELASTSCHRIFT";"Abo ${m}/2026";"";"";"";"";"";"";"${n}";"IE000";"BIC";"-${fr(a)}";"EUR";"Umsatz gebucht"`), `"DE123";"28.${pad(m)}.26";"28.${pad(m)}.26";"GUTSCHRIFT";"Rechnung";"";"";"";"";"";"";"KUNDE GMBH";"DE999";"BIC";"5000,00";"EUR";"Umsatz gebucht"`])],
  'DE DKB': () => ['"Buchungsdatum";"Wertstellung";"Status";"Zahlungspflichtige*r";"Zahlungsempfänger*in";"Verwendungszweck";"Umsatztyp";"IBAN";"Betrag (€)";"Gläubiger-ID";"Mandatsreferenz";"Kundenreferenz"',
    ...months.flatMap(m => [...SUBS.map(([n, a]) => `"15.${pad(m)}.26";"15.${pad(m)}.26";"Gebucht";"Max GmbH";"${n}";"Abo";"Ausgang";"IE000";"-${fr(a)}";"";"";""`), `"28.${pad(m)}.26";"28.${pad(m)}.26";"Gebucht";"Kunde AG";"Max GmbH";"Rechnung";"Eingang";"DE999";"5000,00";"";"";""`])],
  'UK Barclays': () => ['Number,Date,Account,Amount,Subcategory,Memo',
    ...months.flatMap(m => [...SUBS.map(([n, a]) => `,15/${pad(m)}/2026,20-32-06 12345678,-${a},Direct Debit,${n}`), `,28/${pad(m)}/2026,20-32-06 12345678,5000.00,Bank Credit,CUSTOMER LTD`])],
  'UK Monzo': () => ['Transaction ID,Date,Time,Type,Name,Emoji,Category,Amount,Currency,Local amount,Local currency,Notes and #tags,Address,Receipt,Description,Category split,Money Out,Money In',
    ...months.flatMap(m => [...SUBS.map(([n, a], i) => `tx_${m}_${i},15/${pad(m)}/2026,09:00:00,Card payment,${n},,Bills,-${a},GBP,-${a},GBP,,,,${n} LONDON,,-${a},`), `tx_${m}_c,28/${pad(m)}/2026,10:00:00,Faster payment,Customer Ltd,,Income,5000.00,GBP,5000.00,GBP,,,,CUSTOMER LTD,,,5000.00`])],
  'UK Starling': () => ['Date,Counter Party,Reference,Type,Amount (GBP),Balance (GBP),Spending Category,Notes',
    ...months.flatMap(m => [...SUBS.map(([n, a]) => `15/${pad(m)}/2026,${n},${n} SUB,CARD PAYMENT,-${a},1000.00,BILLS AND SERVICES,`), `28/${pad(m)}/2026,Customer Ltd,INV,FASTER PAYMENT,5000.00,6000.00,INCOME,`])],
  'CH PostFinance': () => ['Buchungsdatum;Avisierungstext;Gutschrift in CHF;Lastschrift in CHF;Valuta;Saldo in CHF',
    ...months.flatMap(m => [...SUBS.map(([n, a]) => `15.${pad(m)}.2026;KAUF/DIENSTLEISTUNG VOM 14.${pad(m)}.2026 KARTEN NR. XXXX1234 ${n};;-${a.toFixed(2)};15.${pad(m)}.2026;`), `28.${pad(m)}.2026;GUTSCHRIFT KUNDE AG;5000.00;;28.${pad(m)}.2026;`])],
  'CH UBS': () => ['Kontonummer;Kartennummer;Konto/Kartenintaber;Einkaufsdatum;Buchungstext;Branche;Betrag;Originalwährung;Kurs;Währung;Belastung;Gutschrift;Buchung',
    ...months.flatMap(m => [...SUBS.map(([n, a]) => `123;XXXX;MAX;15.${pad(m)}.2026;${n};Software;${a.toFixed(2)};CHF;;CHF;${a.toFixed(2)};;16.${pad(m)}.2026`), `123;XXXX;MAX;28.${pad(m)}.2026;GUTSCHRIFT;;5000.00;CHF;;CHF;;5000.00;28.${pad(m)}.2026`])],
  'BE Belfius': () => ['Compte;Date de comptabilisation;Numéro d\'extrait;Numéro de transaction;Compte contrepartie;Nom contrepartie contient;Rue et numéro;Code postal et localité;Transaction;Date valeur;Montant;Devise;BIC;Code pays;Communications',
    ...months.flatMap(m => [...SUBS.map(([n, a], i) => `BE12;15/${pad(m)}/2026;${m};${i};IE00;${n};;;DOMICILIATION EUROPEENNE;15/${pad(m)}/2026;-${fr(a)};EUR;BIC;IE;Abonnement`), `BE12;28/${pad(m)}/2026;${m};9;BE99;CLIENT SA;;;VIREMENT;28/${pad(m)}/2026;5000,00;EUR;BIC;BE;Facture`])],
  'BE KBC': () => ['Rekeningnummer;Rubrieknaam;Naam;Munt;Afschriftnummer;Datum;Omschrijving;Valuta;Bedrag;Saldo;credit;debet;rekeningnummer tegenpartij;BIC tegenpartij;Naam tegenpartij;Adres tegenpartij;gestructureerde mededeling;Vrije mededeling',
    ...months.flatMap(m => [...SUBS.map(([n, a]) => `BE12;;MAX BV;EUR;${m};15/${pad(m)}/2026;EUROPESE DOMICILIERING ${n};15/${pad(m)}/2026;-${fr(a)};1000,00;;${fr(a)};IE00;BIC;${n};;;`), `BE12;;MAX BV;EUR;${m};28/${pad(m)}/2026;OVERSCHRIJVING KLANT NV;28/${pad(m)}/2026;5000,00;1000,00;5000,00;;BE99;BIC;KLANT NV;;;`])],
  'LU Spuerkeess': () => ['Date;Libellé;Montant;Devise;Solde',
    ...months.flatMap(m => [...SUBS.map(([n, a]) => `15/${pad(m)}/2026;DOMICILIATION ${n};-${fr(a)};EUR;1000,00`), `28/${pad(m)}/2026;VIREMENT CLIENT SARL;5000,00;EUR;6000,00`])],
  'PT Millennium': () => ['Data lançamento;Data valor;Descrição;Montante;Saldo',
    ...months.flatMap(m => [...SUBS.map(([n, a]) => `15-${pad(m)}-2026;15-${pad(m)}-2026;DD ${n};-${fr(a)};1000,00`), `28-${pad(m)}-2026;28-${pad(m)}-2026;TRF CLIENTE LDA;5000,00;6000,00`])],
  'PT CGD': () => ['Data mov.;Data valor;Descrição;Débito;Crédito;Saldo contabilístico;Saldo disponível;Categoria',
    ...months.flatMap(m => [...SUBS.map(([n, a]) => `15-${pad(m)}-2026;15-${pad(m)}-2026;COMPRA ${n};${fr(a)};;1000,00;1000,00;Software`), `28-${pad(m)}-2026;28-${pad(m)}-2026;TRF CLIENTE;;5000,00;6000,00;6000,00;Receitas`])],
};

const EXPECTED = ['Adobe', 'Microsoft 365', 'Notion', 'Slack', 'Zoom'];
const CURRENCY = {
  'DE Sparkasse': '€', 'DE DKB': '€', 'UK Barclays': '£', 'UK Monzo': '£', 'UK Starling': '£',
  'CH PostFinance': 'CHF ', 'CH UBS': 'CHF ', 'BE Belfius': '€', 'BE KBC': '€', 'LU Spuerkeess': '€',
  'PT Millennium': '€', 'PT CGD': '€',
};

describe('bank exports from outside France', () => {
  for (const [name, gen] of Object.entries(F)) {
    it(`${name}: reads every line and finds the five subscriptions`, () => {
      const text = gen().join('\n');
      const p = parseBankExport(text);
      expect(p.transactions).toHaveLength(60);
      expect(p.credits).toBe(12);
      expect(p.skipped).toBe(0);
      expect(p.dateOrder).toMatchObject({ order: 'dmy', evidence: 'proven' });
      const vendors = auditSaas(p.transactions, { now: new Date('2026-12-20') }).subscriptions.map((s) => s.vendor).sort();
      expect(vendors).toEqual(EXPECTED);
      expect(detectSymbol(text, p.dateOrder)).toBe(CURRENCY[name]);
    });
  }
});
