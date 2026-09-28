#!/usr/bin/env node
// ── The demo kit: one fictional company, every file the site reads ─────────
//
// Atelier Lumen, a 17-person design agency in Lyon (fictional: the domain is
// .example, reserved for documentation, and no SIREN is given). Its story is
// told consistently across five files, so the same company can be shown in
// the free audit (bank statement, FEC) and inside the app (tools, people,
// access):
//
//   releve-bancaire-atelier-lumen.csv  24 months of the business account
//   fec-atelier-lumen-2026-09-30.txt   the ledger for the year to 30 Sept 2026
//   1-outils.csv, 2-employes.csv, 3-acces.csv   the in-app import, in that order
//
// Deterministic: the same script always writes the same bytes, so the guide's
// figures can be asserted by src/lib/demo-kit.test.js. Run from the repo root:
//
//   node tools/make-demo-kit.mjs
//
// Dates are fixed (the story ends 30 September 2026). Inside the app, "idle for
// 90 days" is measured from today, so re-run with a later END to refresh.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'public', 'demo');
const DOMAIN = 'atelier-lumen.example';

// A tiny seeded generator so "random" one-off purchases are the same every run.
let seed = 20260930;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (xs) => xs[Math.floor(rand() * xs.length)];

const fr = (n) => {
  const [int, dec] = Math.abs(n).toFixed(2).split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + dec;
};
const ddmmyyyy = (y, m, d) => `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
const yyyymmdd = (y, m, d) => `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Months of the story: October 2024 → September 2026.
const MONTHS = [];
for (let i = 0; i < 24; i++) {
  const y = 2024 + Math.floor((9 + i) / 12);
  const m = ((9 + i) % 12) + 1;
  MONTHS.push({ y, m, i });
}
const after = ({ y, m }, Y, M) => y > Y || (y === Y && m >= M);

// ── The subscriptions, as the bank sees them (TTC) and the ledger books them ─
//
// Each: bank label, day, TTC amount by month (null = no charge), the ledger
// account and supplier sub-account, whether VAT applies.
const SUBS = [
  { label: 'PRLV SEPA SLACK TECHNOLOGIES LTD', day: 3, ttc: () => 147.0, account: '6135', accountLib: 'Locations logiciels', aux: 'SLACK TECHNOLOGIES LIMITED', lib: 'Slack Pro' },
  { label: 'PRLV GOOGLE WORKSPACE ATELIERLUMEN', day: 2, ttc: () => 231.84, account: '6135', accountLib: 'Locations logiciels', aux: 'GOOGLE CLOUD FRANCE', lib: 'Google Workspace Business' },
  // A price rise in April 2026.
  { label: 'CB NOTION LABS INC', day: 6, ttc: (mo) => (after(mo, 2026, 4) ? 138.24 : 115.2), account: '6512', accountLib: 'Licences logiciels', aux: 'NOTION LABS INC', lib: 'Notion Plus' },
  // A second Notion workspace on someone's card, since June 2025: a duplicate.
  { label: 'CB NOTION.SO', day: 17, ttc: (mo) => (after(mo, 2025, 6) ? 14.4 : null), account: '6512', accountLib: 'Licences logiciels', aux: 'NOTION LABS INC', lib: 'Notion (espace perso)' },
  // Two seats bought separately, twice a month.
  { label: 'CB FIGMA INC', day: 5, ttc: () => 54.0, account: '6512', accountLib: 'Licences logiciels', aux: 'FIGMA INC', lib: 'Figma Professional' },
  { label: 'CB FIGMA INC', day: 21, ttc: () => 54.0, account: '6512', accountLib: 'Licences logiciels', aux: 'FIGMA INC', lib: 'Figma Professional' },
  // Annual, renewing 14 October 2026: two weeks after the story ends.
  { label: 'CB ADOBE *CREATIVE CLOUD', day: 14, ttc: (mo) => (mo.m === 10 ? 3239.88 : null), account: '6512', accountLib: 'Licences logiciels', aux: 'ADOBE SYSTEMS SOFTWARE IRELAND', lib: 'Adobe Creative Cloud (annuel)' },
  { label: 'PRLV HUBSPOT IRELAND LTD', day: 8, ttc: (mo) => (after(mo, 2026, 1) ? 712.8 : 648.0), account: '6135', accountLib: 'Locations logiciels', aux: 'HUBSPOT IRELAND LTD', lib: 'HubSpot Sales Pro' },
  { label: 'CB ZOOM.US', day: 11, ttc: () => 15.99, account: '6135', accountLib: 'Locations logiciels', aux: 'ZOOM VIDEO COMMUNICATIONS', lib: 'Zoom Pro' },
  { label: 'CB CANVA* PRO', day: 12, ttc: () => 11.99, account: '6512', accountLib: 'Licences logiciels', aux: 'CANVA PTY LTD', lib: 'Canva Pro' },
  { label: 'CB DROPBOX', day: 19, ttc: () => 19.99, account: '6135', accountLib: 'Locations logiciels', aux: 'DROPBOX INTERNATIONAL', lib: 'Dropbox Plus' },
  // Booked by the bookkeeper to office supplies (6064): a neutral account, so
  // in the FEC the vendor name decides, as it does on a statement.
  { label: 'CB CALENDLY LLC', day: 15, ttc: () => 12.0, account: '6064', accountLib: 'Fournitures administratives', aux: 'CALENDLY LLC', lib: 'Calendly' },
  { label: 'CB MIRO.COM', day: 23, ttc: () => 19.2, account: '6135', accountLib: 'Locations logiciels', aux: 'REALTIMEBOARD INC', lib: 'Miro Starter' },
  // Cancelled in June 2026: the charges stop.
  { label: 'CB LOOM SUBSCRIPTION', day: 9, ttc: (mo) => (after(mo, 2026, 6) ? null : 14.4), account: '6135', accountLib: 'Locations logiciels', aux: 'LOOM INC', lib: 'Loom Business' },
  // Accounting software. The bookkeeper books it with the accountant's fees
  // (6226), an account the FEC reader excludes: the one it gets wrong.
  { label: 'PRLV PENNYLANE', day: 4, ttc: () => 70.8, account: '6226', accountLib: 'Honoraires comptables', aux: 'PENNYLANE', lib: 'Pennylane' },
  // Software the name list has never heard of: invisible on a statement,
  // found in the ledger because it is booked to software licences.
  { label: 'PRLV WIMI SAS', day: 7, ttc: () => 34.8, account: '6512', accountLib: 'Licences logiciels', aux: 'WIMI SAS', lib: 'Wimi (espace collaboratif)' },

  // ── The traps: they look like software on a statement ─────────────────
  { label: 'PRLV SEPA GOOGLE ADS 1234-5678-9012', day: 10, ttc: (mo) => 360 + ((mo.i * 37) % 240), account: '6231', accountLib: 'Annonces et insertions', aux: 'GOOGLE IRELAND LTD', lib: 'Google Ads' },
  { label: 'CB QONTO ABONNEMENT', day: 1, ttc: () => 29.0, vat: false, account: '6278', accountLib: 'Autres frais bancaires', aux: 'QONTO', lib: 'Abonnement Qonto Smart' },
  { label: 'CB MONDAY CAFE LYON 2', day: 13, ttc: (mo) => 32 + (mo.i % 5) * 3.5, account: '6257', accountLib: 'Réceptions', aux: 'MONDAY CAFE', lib: 'Petit-déjeuner équipe' },
  { label: 'CB MONDAY CAFE LYON 2', day: 27, ttc: (mo) => 28 + (mo.i % 4) * 4, account: '6257', accountLib: 'Réceptions', aux: 'MONDAY CAFE', lib: 'Petit-déjeuner équipe' },

  // ── Recurring, and plainly not software ───────────────────────────────
  { label: 'PRLV SCI BELLECOUR LOYER', day: 1, ttc: () => 2880.0, account: '6132', accountLib: 'Locations immobilières', aux: 'SCI BELLECOUR', lib: 'Loyer atelier' },
  { label: 'PRLV EDF PRO', day: 16, ttc: (mo) => 96 + ([0, 1, 2, 3, 4, 10, 11].includes(mo.m - 1) ? 64 : 12), account: '6061', accountLib: 'Fournitures non stockables', aux: 'EDF', lib: 'Électricité' },
  { label: 'PRLV FREE PRO', day: 20, ttc: () => 59.99, account: '626', accountLib: 'Frais de télécommunications', aux: 'FREE PRO', lib: 'Fibre et téléphonie' },
];

// ── 1. The bank statement ──────────────────────────────────────────────────
function bankStatement() {
  const rows = [];
  const add = (y, m, d, label, debit, credit = null) => rows.push({ key: iso(y, m, d), line: `${ddmmyyyy(y, m, d)};${label};${debit == null ? '' : fr(debit)};${credit == null ? '' : fr(credit)}` });
  for (const mo of MONTHS) {
    const { y, m } = mo;
    for (const s of SUBS) {
      const amount = s.ttc(mo);
      if (amount != null) add(y, m, s.day, s.label, amount);
    }
    add(y, m, 5, 'PRLV URSSAF RHONE ALPES', 9800 + (mo.i % 3) * 140);
    add(y, m, 28, `VIR SEPA SALAIRES ${String(m).padStart(2, '0')}/${y}`, 41250 + (mo.i % 2) * 380);
    // Money in: ignored by the audit, present because a statement has it.
    for (let k = 0; k < 3; k++) add(y, m, 8 + k * 7, `VIR SEPA RECU CLIENT ${pick(['MAISON VERNE', 'BIOCOOP RHONE', 'CAVE DES CANUTS', 'LYON PARC AUTO', 'OPERA NOUVEL'])}`, null, 9000 + Math.round(rand() * 24000));
    // One-off spending: noise the audit must not call a subscription.
    for (let k = 0; k < 4; k++) {
      const d = 2 + Math.floor(rand() * 26);
      add(y, m, d, pick(['CB SNCF INTERNET', 'CB FNAC LYON BELLECOUR', 'CB AMAZON MKTPLACE FR', 'CB BRASSERIE GEORGES', 'CB BOULANGER LYON', 'CB IKEA SAINT PRIEST', 'CB LA POSTE LYON']) + ` ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`, 12 + Math.round(rand() * 380 * 100) / 100);
    }
  }
  rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return [
    'Relevé de compte — ATELIER LUMEN SAS — Compte courant professionnel',
    '',
    'Date;Libellé;Débit;Crédit',
    ...rows.map((r) => r.line),
  ].join('\n') + '\n';
}

// ── 2. The FEC, fiscal year 1 Oct 2025 → 30 Sept 2026 ──────────────────────
function fec() {
  const H = 'JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise';
  const out = [H];
  const n = { HA: 0, BQ: 0, VE: 0, OD: 0 };
  const num = (j) => `${j}${String(++n[j]).padStart(5, '0')}`;
  const amt = (x) => x.toFixed(2).replace('.', ',');
  const line = (j, jl, e, date, acc, accLib, auxNum, aux, piece, label, debit, credit) =>
    out.push([j, jl, e, date, acc, accLib, auxNum, aux, piece, date, label, amt(debit), amt(credit), '', '', date, '', ''].join('|'));

  for (const mo of MONTHS.filter((x) => after(x, 2025, 10))) {
    const { y, m } = mo;
    for (const s of SUBS) {
      const ttc = s.ttc(mo);
      if (ttc == null) continue;
      const vat = s.vat === false ? 0 : Math.round((ttc - ttc / 1.2) * 100) / 100;
      const ht = Math.round((ttc - vat) * 100) / 100;
      const date = yyyymmdd(y, m, s.day);
      const e = num('HA');
      const auxNum = 'F' + s.aux.replace(/[^A-Z]/g, '').slice(0, 7);
      line('HA', 'Achats', e, date, s.account, s.accountLib, '', '', e, s.lib, ht, 0);
      if (vat) line('HA', 'Achats', e, date, '445660', 'TVA déductible sur ABS', '', '', e, s.lib, vat, 0);
      line('HA', 'Achats', e, date, '401000', 'Fournisseurs', auxNum, s.aux, e, s.lib, 0, ttc);
      const b = num('BQ');
      line('BQ', 'Banque Qonto', b, date, '401000', 'Fournisseurs', auxNum, s.aux, e, `Règlement ${s.lib}`, ttc, 0);
      line('BQ', 'Banque Qonto', b, date, '512000', 'Banque Qonto', '', '', e, `Règlement ${s.lib}`, 0, ttc);
    }
    // Sales and payroll: real ledgers have them; neither is a cost to audit
    // for software (payroll is class 64, excluded).
    for (let k = 0; k < 3; k++) {
      const ht = 8000 + Math.round(rand() * 20000);
      const e = num('VE');
      const date = yyyymmdd(y, m, 8 + k * 7);
      line('VE', 'Ventes', e, date, '411000', 'Clients', 'C0' + k, `CLIENT ${k + 1}`, e, 'Facture prestation design', ht * 1.2, 0);
      line('VE', 'Ventes', e, date, '706000', 'Prestations de services', '', '', e, 'Facture prestation design', 0, ht);
      line('VE', 'Ventes', e, date, '445710', 'TVA collectée', '', '', e, 'Facture prestation design', 0, ht * 0.2);
    }
    const e = num('OD');
    const date = yyyymmdd(y, m, 28);
    line('OD', 'Opérations diverses', e, date, '641000', 'Rémunérations du personnel', '', '', e, `Salaires ${String(m).padStart(2, '0')}/${y}`, 52900, 0);
    line('OD', 'Opérations diverses', e, date, '421000', 'Personnel - rémunérations dues', '', '', e, `Salaires ${String(m).padStart(2, '0')}/${y}`, 0, 41250);
    line('OD', 'Opérations diverses', e, date, '431000', 'Sécurité sociale', '', '', e, `Salaires ${String(m).padStart(2, '0')}/${y}`, 0, 11650);
  }
  return out.join('\n') + '\n';
}

// ── 3. The in-app import: tools, then employees, then access ───────────────
//
// In that order: importing tools while employees exist gives each tool's owner
// an admin grant automatically, which would duplicate 3-acces.csv.
const P = (first, last) => `${first.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${last.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@${DOMAIN}`;
const PEOPLE = [
  ['Camille', 'Durand', 'Direction', 'Gérante', 'active', '2019-03-01', ''],
  ['Thomas', 'Bernard', 'Design', 'Directeur artistique', 'active', '2019-09-02', ''],
  ['Léa', 'Martin', 'Design', 'Designer', 'active', '2021-01-11', ''],
  ['Hugo', 'Petit', 'Design', 'Designer', 'active', '2022-04-04', ''],
  ['Chloé', 'Robert', 'Design', 'Motion designer', 'active', '2023-02-06', ''],
  ['Jade', 'Fontaine', 'Design', 'Designer junior', 'active', '2026-09-01', ''],
  ['Lucas', 'Richard', 'Développement', 'Développeur web', 'active', '2020-06-15', ''],
  ['Emma', 'Dubois', 'Développement', 'Développeuse web', 'active', '2022-10-03', ''],
  ['Paul', 'Rousseau', 'Développement', 'Développeur web', 'active', '2024-01-08', ''],
  ['Nathan', 'Laurent', 'Commercial', 'Chargé d’affaires', 'active', '2021-05-17', ''],
  ['Manon', 'Simon', 'Commercial', 'Chargée d’affaires', 'active', '2023-09-04', ''],
  ['Inès', 'Michel', 'Marketing', 'Responsable marketing', 'active', '2022-02-14', ''],
  ['Louis', 'Garcia', 'Administration', 'Office manager', 'active', '2020-11-02', ''],
  ['Sophie', 'Vincent', 'Administration', 'Assistante comptable', 'active', '2024-03-18', ''],
  // Leavers whose access was never removed, and one on the way out.
  ['Julien', 'Moreau', 'Commercial', 'Directeur commercial', 'offboarded', '2020-01-06', '2026-06-30'],
  ['Sarah', 'Lefèvre', 'Design', 'Designer', 'offboarded', '2021-09-06', '2026-08-31'],
  ['Maxime', 'Blanc', 'Développement', 'Développeur web', 'offboarding', '2023-05-02', '2026-10-15'],
];
const email = (first) => { const p = PEOPLE.find((x) => x[0] === first); return P(p[0], p[1]); };

// cost_per_month is the ledger's monthly figure, excluding VAT.
const TOOLS = [
  ['Slack', 'communication', 'Louis', 'high', 'https://slack.com', 'active', 122.5, '2026-09-24', ''],
  ['Google Workspace', 'productivity', 'Louis', 'high', 'https://workspace.google.com', 'active', 193.2, '2026-09-24', ''],
  ['Notion', 'productivity', 'Inès', 'medium', 'https://notion.so', 'active', 127.2, '2026-09-24', ''],
  ['Figma', 'design', 'Thomas', 'high', 'https://figma.com', 'active', 90, '2026-09-24', ''],
  ['Adobe Creative Cloud', 'design', 'Thomas', 'high', 'https://adobe.com', 'active', 225, '2026-09-24', '2026-10-14'],
  ['HubSpot', 'sales', 'Nathan', 'high', 'https://hubspot.com', 'active', 594, '2026-09-24', '2026-11-30'],
  ['Zoom', 'communication', 'Julien', 'low', 'https://zoom.us', 'active', 13.33, '2026-04-10', ''],
  ['Canva', 'design', 'Inès', 'low', 'https://canva.com', 'active', 9.99, '2026-09-22', ''],
  ['Dropbox', 'storage', 'Sarah', 'low', 'https://dropbox.com', 'active', 16.66, '2026-05-18', ''],
  ['Calendly', 'productivity', 'Manon', 'low', 'https://calendly.com', 'active', 10, '2026-09-24', ''],
  ['Pennylane', 'finance', 'Sophie', 'high', 'https://pennylane.com', 'active', 59, '2026-09-24', ''],
  ['Wimi', 'productivity', 'Louis', 'medium', 'https://wimi-teamwork.com', 'active', 29, '2026-09-18', ''],
  ['Miro', 'design', '', 'low', 'https://miro.com', 'active', 16, '2026-03-02', ''],
  ['Loom', 'communication', 'Chloé', 'low', 'https://loom.com', 'decommissioned', 12, '2026-05-30', ''],
];

// [tool, person, level, last accessed, last reviewed]
const OLD_REVIEW = '2025-09-15';   // over 180 days: admin reviews overdue
const RECENT_REVIEW = '2026-07-01';
const ACCESS = [];
// A later grant for the same tool and person replaces the earlier one (an
// admin who was first added as a member is one grant, not two).
const grant = (tool, who, level = 'member', last = '2026-09-24', reviewed = RECENT_REVIEW) => {
  const at = ACCESS.findIndex((a) => a[0] === tool && a[1] === who);
  if (at >= 0) ACCESS.splice(at, 1);
  ACCESS.push([tool, who, level, last, reviewed]);
};
const activePeople = PEOPLE.filter((p) => p[4] !== 'offboarded').map((p) => p[0]);
for (const who of activePeople) { grant('Slack', who); grant('Google Workspace', who); grant('Notion', who); }
grant('Slack', 'Louis', 'admin', '2026-09-24', OLD_REVIEW);
grant('Google Workspace', 'Louis', 'admin', '2026-09-24', OLD_REVIEW);
for (const who of ['Léa', 'Hugo', 'Chloé', 'Jade']) grant('Figma', who, 'editor');
grant('Figma', 'Thomas', 'admin', '2026-09-24', OLD_REVIEW);
for (const who of ['Léa', 'Hugo', 'Chloé']) grant('Adobe Creative Cloud', who, 'member', '2026-09-24');
grant('Adobe Creative Cloud', 'Thomas', 'admin', '2026-09-24');
grant('HubSpot', 'Nathan', 'admin', '2026-09-24');
grant('HubSpot', 'Manon'); grant('HubSpot', 'Inès');
grant('Zoom', 'Camille', 'member', '2026-04-10'); grant('Zoom', 'Nathan', 'member', '2026-03-22');
grant('Canva', 'Inès', 'admin', '2026-09-22'); grant('Canva', 'Chloé', 'member', '2026-09-15');
grant('Dropbox', 'Camille', 'member', '2026-05-18');
grant('Calendly', 'Manon', 'admin', '2026-09-24'); grant('Calendly', 'Nathan', 'member', '2026-09-10');
grant('Pennylane', 'Sophie', 'admin', '2026-09-24'); grant('Pennylane', 'Camille', 'member', '2026-09-15');
grant('Wimi', 'Louis', 'admin', '2026-09-18'); grant('Wimi', 'Camille', 'member', '2026-09-02');
// Nobody holds Miro: paid for, used by no one.
// The leavers, still in.
grant('Slack', 'Julien', 'member', '2026-06-30'); grant('Google Workspace', 'Julien', 'member', '2026-06-30');
grant('HubSpot', 'Julien', 'admin', '2026-06-29', OLD_REVIEW); grant('Zoom', 'Julien', 'admin', '2026-04-09', OLD_REVIEW);
grant('Slack', 'Sarah', 'member', '2026-08-31'); grant('Notion', 'Sarah', 'member', '2026-08-30');
grant('Figma', 'Sarah', 'editor', '2026-08-29'); grant('Dropbox', 'Sarah', 'admin', '2026-05-18', OLD_REVIEW);

const csv = (rows) => rows.map((r) => r.map((v) => (/[",]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : v)).join(',')).join('\n') + '\n';

function toolsCsv() {
  return csv([
    ['name', 'category', 'owner_email', 'owner_name', 'criticality', 'url', 'status', 'cost_per_month', 'last_used_date', 'renewal_date'],
    ...TOOLS.map(([name, cat, owner, crit, url, status, cost, used, renewal]) => {
      const p = PEOPLE.find((x) => x[0] === owner);
      return [name, cat, owner ? email(owner) : '', p ? `${p[0]} ${p[1]}` : '', crit, url, status, cost, used, renewal];
    }),
  ]);
}
function employeesCsv() {
  return csv([
    ['full_name', 'email', 'department', 'role', 'status', 'start_date', 'end_date'],
    ...PEOPLE.map(([f, l, dept, role, status, start, end]) => [`${f} ${l}`, P(f, l), dept, role, status, start, end]),
  ]);
}
function accessCsv() {
  return csv([
    ['tool_name', 'employee_email', 'access_level', 'granted_date', 'last_accessed_date', 'last_reviewed_date', 'status'],
    ...ACCESS.map(([tool, who, level, last, reviewed]) => {
      const p = PEOPLE.find((x) => x[0] === who);
      return [tool, email(who), level, p[5], last, reviewed, 'active'];
    }),
  ]);
}

const FILES = {
  'releve-bancaire-atelier-lumen.csv': bankStatement,
  'fec-atelier-lumen-2026-09-30.txt': fec,
  '1-outils.csv': toolsCsv,
  '2-employes.csv': employeesCsv,
  '3-acces.csv': accessCsv,
};

/** { filename: contents }, byte-identical on every call. */
export function buildKit() {
  const out = {};
  for (const [name, make] of Object.entries(FILES)) {
    seed = 20260930;
    out[name] = make();
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(OUT, { recursive: true });
  for (const [name, body] of Object.entries(buildKit())) {
    writeFileSync(join(OUT, name), body);
    console.log(`public/demo/${name}  ${body.split('\n').length - 1} lines`);
  }
}
