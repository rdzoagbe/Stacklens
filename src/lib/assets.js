// ── The hardware register: who holds which device ───────────────────────────
//
// A record of the company's physical devices (laptops, phones, screens…),
// kept in the workspace as `db.assets`. Like the rest of Stacklens it records,
// it does not act: marking a laptop returned says somebody has it back, it
// does not lock, wipe or locate anything. Nothing here talks to a device or a
// device-management service.
//
// An asset row:
//   { id, kind, name, serial, status,
//     assigned_to, assigned_name, assigned_email,   // the holder, if any
//     purchase_date, purchase_cost,
//     coverage_type, coverage_end,                  // warranty or lease end
//     notes, returned_at,
//     origin, mdm }                                 // set when read from Intune
//
// The holder is stored by employee id, with the name and email beside it (as
// access rows do), so a device still says who had it after that person was
// deleted from the people list.

import { csvAmount } from './csvHeaders';
import { csvText } from './csvSafe';

export const ASSET_KINDS = ['laptop', 'desktop', 'phone', 'tablet', 'monitor', 'accessory', 'other'];
export const ASSET_STATUSES = ['in_use', 'in_stock', 'in_repair', 'retired', 'lost'];
export const COVERAGE_TYPES = ['warranty', 'lease'];

/** Where a device came from when the app recorded it by itself (lib/intuneDevices.js). */
export const ASSET_ORIGINS = ['intune'];
const COMPLIANCE = ['unknown', 'compliant', 'noncompliant', 'conflict', 'error', 'inGracePeriod', 'configManager'];

/**
 * The snapshot a device-management read leaves on a device, or null. Only
 * these fields, so nothing else Microsoft returns can ride along into the
 * workspace.
 */
export function cleanMdm(mdm) {
  if (!mdm || typeof mdm !== 'object' || mdm.source !== 'intune') return null;
  const s = (v, n = 80) => String(v ?? '').trim().slice(0, n);
  return {
    source: 'intune',
    id: s(mdm.id, 64),
    compliance: COMPLIANCE.includes(mdm.compliance) ? mdm.compliance : 'unknown',
    encrypted: typeof mdm.encrypted === 'boolean' ? mdm.encrypted : null,
    os: s(mdm.os, 40),
    os_version: s(mdm.os_version, 40),
    last_sync: isoDate(mdm.last_sync),
    read_at: isoDate(mdm.read_at),
  };
}

/** How far ahead a warranty or lease end counts as coming up. */
export const COVERAGE_SOON_DAYS = 30;

/** A device someone may still hold: in use, or away for repair. */
const HELD = ['in_use', 'in_repair'];
/** A device that no longer needs cover: written off or missing. */
const GONE = ['retired', 'lost'];

const str = (v) => String(v ?? '').trim();

/** YYYY-MM-DD from an ISO date or a French/European DD/MM/YYYY, else ''. */
export function isoDate(v) {
  const s = str(v);
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

/** Today as YYYY-MM-DD, in UTC like todayISO() in lib/db.js. */
function dayOf(now) {
  return new Date(now).toISOString().slice(0, 10);
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** A serial number compared without case, spaces or dashes. */
export function serialKey(serial) {
  return str(serial).toUpperCase().replace(/[\s-]/g, '');
}

/**
 * A clean asset from form or import input. Unknown kinds and statuses fall
 * back to `other` / a status that matches the holder, so a stored row is
 * always one the screens know how to show.
 *
 * Status and holder are kept consistent: a device in stock, retired or lost
 * has no holder; a device with a holder and no stated status is in use.
 */
export function cleanAsset(input = {}) {
  const kind = ASSET_KINDS.includes(input.kind) ? input.kind : 'other';
  const holder = str(input.assigned_to);
  // Someone named by email only (not in the people list) still holds it.
  const held = !!(holder || str(input.assigned_email));
  let status = ASSET_STATUSES.includes(input.status) ? input.status : (held ? 'in_use' : 'in_stock');
  if (status === 'in_use' && !held) status = 'in_stock';
  const keepsHolder = HELD.includes(status);
  const cost = csvAmount(input.purchase_cost);
  return {
    kind,
    name: str(input.name),
    serial: str(input.serial),
    status,
    assigned_to: keepsHolder ? holder : '',
    assigned_name: keepsHolder ? str(input.assigned_name) : '',
    assigned_email: keepsHolder ? str(input.assigned_email) : '',
    purchase_date: isoDate(input.purchase_date),
    purchase_cost: cost > 0 ? Math.round(cost * 100) / 100 : 0,
    coverage_type: COVERAGE_TYPES.includes(input.coverage_type) ? input.coverage_type : '',
    coverage_end: isoDate(input.coverage_end),
    notes: str(input.notes),
    ...(isoDate(input.returned_at) ? { returned_at: isoDate(input.returned_at) } : {}),
    ...(ASSET_ORIGINS.includes(input.origin) ? { origin: input.origin } : {}),
    ...(cleanMdm(input.mdm) ? { mdm: cleanMdm(input.mdm) } : {}),
  };
}

/** The holder fields for an employee, or none. */
export function holderFields(employee) {
  if (!employee) return { assigned_to: '', assigned_name: '', assigned_email: '' };
  return {
    assigned_to: employee.id,
    assigned_name: employee.full_name || '',
    assigned_email: employee.email || '',
  };
}

/** The person holding a device, by id first, then by email; null if none. */
export function holderOf(asset, employees = []) {
  if (!asset) return null;
  if (asset.assigned_to) {
    const byId = employees.find((e) => e.id === asset.assigned_to);
    if (byId) return byId;
  }
  const email = str(asset.assigned_email).toLowerCase();
  if (!email) return null;
  return employees.find((e) => str(e.email).toLowerCase() === email) || null;
}

/** Devices a given person holds. */
export function assetsHeldBy(db, employee) {
  if (!employee) return [];
  const employees = db?.employees || [];
  return (db?.assets || []).filter((a) => HELD.includes(a.status) && holderOf(a, employees)?.id === employee.id);
}

/**
 * Devices still held by someone who is leaving or has left: what the
 * Offboarding page asks to get back. Sorted by leaving date, earliest first.
 */
export function devicesToReturn(db) {
  const employees = db?.employees || [];
  const out = [];
  for (const asset of db?.assets || []) {
    if (!HELD.includes(asset.status)) continue;
    const employee = holderOf(asset, employees);
    if (employee && (employee.status === 'offboarding' || employee.status === 'offboarded')) {
      out.push({ asset, employee });
    }
  }
  return out.sort((a, b) => (a.employee.end_date || '9999') < (b.employee.end_date || '9999') ? -1 : 1);
}

/**
 * Where a device's warranty or lease stands on `now`:
 *   'expired'  the end date has passed
 *   'soon'     it ends within `days`
 *   'ok'       later than that
 *   null       no date, or the device is retired or lost
 */
export function coverageState(asset, { now = Date.now(), days = COVERAGE_SOON_DAYS } = {}) {
  if (!asset?.coverage_end || GONE.includes(asset.status)) return null;
  const today = dayOf(now);
  if (asset.coverage_end < today) return 'expired';
  if (asset.coverage_end <= addDays(today, days)) return 'soon';
  return 'ok';
}

/** Devices whose warranty or lease ends within `days`, soonest first. */
export function coverageEnding(db, { now = Date.now(), days = COVERAGE_SOON_DAYS } = {}) {
  return (db?.assets || [])
    .filter((a) => coverageState(a, { now, days }) === 'soon')
    .sort((a, b) => (a.coverage_end < b.coverage_end ? -1 : 1));
}

/** Compliance states Microsoft reports for a device that fails a policy or could not be judged. */
export const MDM_CONCERN_STATES = ['noncompliant', 'inGracePeriod', 'conflict', 'error'];

/**
 * What the last device-management read said needs a look on a device still in
 * service: [] when nothing, else any of 'noncompliant' / 'not_encrypted'.
 */
export function mdmConcerns(asset) {
  if (!asset?.mdm || GONE.includes(asset.status)) return [];
  const out = [];
  if (MDM_CONCERN_STATES.includes(asset.mdm.compliance)) out.push('noncompliant');
  if (asset.mdm.encrypted === false) out.push('not_encrypted');
  return out;
}

/** Counts for the register's summary row. */
export function assetSummary(db, { now = Date.now() } = {}) {
  const assets = db?.assets || [];
  const by = (s) => assets.filter((a) => a.status === s).length;
  return {
    total: assets.length,
    in_use: by('in_use'),
    in_stock: by('in_stock'),
    to_return: devicesToReturn(db).length,
    coverage_soon: coverageEnding(db, { now }).length,
  };
}

// ── CSV import ──────────────────────────────────────────────────────────────
//
// The column names people write, French and English, each mapped to one
// field. A header is compared without case, accents or punctuation.

const CSV_COLUMNS = {
  name:           ['name', 'model', 'device', 'device_name', 'nom', 'modele', 'appareil', 'materiel', 'equipement'],
  kind:           ['kind', 'type', 'device_type', 'categorie', 'category', 'type_appareil'],
  serial:         ['serial', 'serial_number', 'serialnumber', 'sn', 'numero_de_serie', 'n_de_serie', 'no_serie', 'num_serie'],
  assigned_email: ['assigned_email', 'employee_email', 'email', 'e_mail', 'mail', 'courriel', 'user_email', 'utilisateur', 'email_utilisateur', 'attribue_a', 'assigned_to'],
  status:         ['status', 'statut', 'etat'],
  purchase_date:  ['purchase_date', 'date_achat', 'date_d_achat', 'achat', 'bought'],
  purchase_cost:  ['purchase_cost', 'cost', 'price', 'prix', 'prix_achat', 'cout', 'montant'],
  coverage_type:  ['coverage_type', 'contract', 'contrat', 'type_contrat', 'garantie_ou_location'],
  coverage_end:   ['coverage_end', 'warranty_end', 'lease_end', 'fin_garantie', 'fin_de_garantie', 'fin_location', 'fin_de_location', 'fin_contrat', 'end_date', 'warranty'],
  notes:          ['notes', 'note', 'comment', 'commentaire', 'remarques'],
};

const KIND_WORDS = {
  laptop: ['laptop', 'portable', 'ordinateur_portable', 'notebook', 'macbook'],
  desktop: ['desktop', 'fixe', 'ordinateur_fixe', 'pc', 'imac', 'tour'],
  phone: ['phone', 'mobile', 'smartphone', 'telephone', 'iphone'],
  tablet: ['tablet', 'tablette', 'ipad'],
  monitor: ['monitor', 'screen', 'ecran', 'display'],
  accessory: ['accessory', 'accessoire', 'dock', 'keyboard', 'clavier', 'souris', 'mouse', 'headset', 'casque'],
};
const STATUS_WORDS = {
  in_use: ['in_use', 'assigned', 'attribue', 'en_service', 'utilise', 'active', 'actif'],
  in_stock: ['in_stock', 'stock', 'en_stock', 'available', 'disponible', 'spare'],
  in_repair: ['in_repair', 'repair', 'reparation', 'en_reparation', 'sav'],
  retired: ['retired', 'reforme', 'retire', 'recycle', 'sold', 'vendu', 'disposed'],
  lost: ['lost', 'perdu', 'stolen', 'vole'],
};
const COVERAGE_WORDS = {
  warranty: ['warranty', 'garantie'],
  lease: ['lease', 'location', 'leasing', 'loa', 'lld'],
};

/** A header or value compared without case, accents or punctuation. */
function norm(s) {
  return str(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function wordFor(table, value) {
  const v = norm(value);
  if (!v) return '';
  for (const [key, words] of Object.entries(table)) if (words.includes(v)) return key;
  return '';
}

/** One parsed CSV row (header → value) as asset input, by the aliases above. */
function readRow(row) {
  const byNorm = {};
  for (const [h, v] of Object.entries(row || {})) byNorm[norm(h)] = v;
  const out = {};
  for (const [field, aliases] of Object.entries(CSV_COLUMNS)) {
    const hit = aliases.find((a) => a in byNorm && str(byNorm[a]));
    if (hit) out[field] = byNorm[hit];
  }
  return out;
}

/**
 * Asset records from parsed CSV rows (lib/dataUtils parseCsv). A row needs a
 * name or a serial number; anything else is optional. The holder is matched to
 * the people list by email; an address nobody has is kept as written, and the
 * row counted in `unmatched` so the screen can say so.
 */
export function assetsFromCsv(rows, employees = []) {
  const records = [];
  let skipped = 0; let unmatched = 0;
  const byEmail = new Map(employees.map((e) => [str(e.email).toLowerCase(), e]));
  for (const row of rows || []) {
    const r = readRow(row);
    if (!str(r.name) && !str(r.serial)) { skipped++; continue; }
    const email = str(r.assigned_email).toLowerCase();
    const employee = email ? byEmail.get(email) : null;
    if (email && !employee) unmatched++;
    const status = wordFor(STATUS_WORDS, r.status);
    const coverageType = wordFor(COVERAGE_WORDS, r.coverage_type);
    // The fields this row actually filled: an update to a device already in
    // the register changes those and nothing else (see mergeAssets).
    const given = Object.keys(r).filter((f) => f !== 'assigned_email'
      && !(f === 'status' && !status) && !(f === 'coverage_type' && !coverageType));
    if (email) given.push('assigned_to', 'assigned_name', 'assigned_email');
    records.push({
      ...cleanAsset({
        ...r,
        kind: wordFor(KIND_WORDS, r.kind) || (ASSET_KINDS.includes(norm(r.kind)) ? norm(r.kind) : 'other'),
        status: status || undefined,
        coverage_type: coverageType,
        ...(employee ? holderFields(employee) : email ? { assigned_email: email } : {}),
      }),
      _given: given,
    });
  }
  return { records, skipped, unmatched };
}

/**
 * Merge imported records into the register. A record whose serial number is
 * already there updates that device, with only the fields the file filled
 * (`_given`, from assetsFromCsv): a file without a status column leaves a
 * laptop in use. Any other record is added. `makeId` gives new rows their id.
 */
export function mergeAssets(existing = [], records = [], makeId) {
  const out = existing.map((a) => ({ ...a }));
  const index = new Map();
  out.forEach((a, i) => { const k = serialKey(a.serial); if (k) index.set(k, i); });
  let created = 0; let updated = 0;
  for (const { _given, ...rec } of records) {
    const k = serialKey(rec.serial);
    if (k && index.has(k)) {
      const i = index.get(k);
      const fields = Array.isArray(_given) ? _given : Object.keys(rec);
      const patch = Object.fromEntries(fields.filter((f) => f in rec).map((f) => [f, rec[f]]));
      // A holder named without a status means the device is with them now.
      if (patch.assigned_email && !('status' in patch) && !HELD.includes(out[i].status)) patch.status = 'in_use';
      const { id, returned_at } = out[i];
      out[i] = { ...cleanAsset({ ...out[i], ...patch }), id, ...(returned_at ? { returned_at } : {}) };
      updated++;
    } else {
      out.unshift({ ...rec, id: makeId() });
      // Positions shift by one on every unshift.
      for (const [key, i] of index) index.set(key, i + 1);
      if (k) index.set(k, 0);
      created++;
    }
  }
  return { assets: out, created, updated };
}

// ── CSV export ──────────────────────────────────────────────────────────────
//
// The register as a spreadsheet, for the fixed-asset register, the insurer or
// the auditor. The columns are the import template's, plus the holder's name
// for whoever reads it; the import ignores that one and finds the holder by
// email, so an exported file goes back in unchanged (assets.test.js).

/** The export's columns, in order. */
export const ASSET_EXPORT_COLUMNS = ['name', 'kind', 'serial', 'assigned_email', 'assigned_name', 'status',
  'purchase_date', 'purchase_cost', 'coverage_type', 'coverage_end', 'notes'];

/** Byte-order mark: French Excel needs it to read the accents of a semicolon file. */
export const ASSET_CSV_BOM = '﻿';

/**
 * The register as CSV. English keeps commas and decimal points; any other
 * language gets semicolons and decimal commas, which French Excel opens as
 * columns and numbers (the import reads both). Text a person or Intune typed
 * that begins with = + - @ is prefixed with ' so a spreadsheet shows it
 * instead of running it as a formula.
 */
export function assetsToCsv(assets = [], language = 'en') {
  const sep = !language || language === 'en' ? ',' : ';';
  const esc = (v, field) => {
    let s;
    if (field === 'purchase_cost') {
      s = Number(v) > 0 ? String(Math.round(Number(v) * 100) / 100) : '';
      if (sep === ';') s = s.replace('.', ',');
    } else {
      s = csvText(str(v));
    }
    return /["\n\r]/.test(s) || s.includes(sep) || (sep === ',' && s.includes(';')) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const rows = (assets || []).filter(Boolean).map((a) => ASSET_EXPORT_COLUMNS.map((c) => esc(a[c], c)).join(sep));
  return `${[ASSET_EXPORT_COLUMNS.join(sep), ...rows].join('\n')}\n`;
}

/** The file to download: name and content (with the mark outside English). */
export function assetsCsvFile(assets, language, today) {
  const text = assetsToCsv(assets, language);
  return { filename: `stacklens_devices_${today}.csv`, text: !language || language === 'en' ? text : ASSET_CSV_BOM + text };
}

/** The CSV template the import offers, every column optional but one of name/serial. */
export const ASSET_CSV_TEMPLATE =
  'name,kind,serial,assigned_email,status,purchase_date,purchase_cost,coverage_type,coverage_end,notes\n'
  + 'MacBook Air 13 M3,laptop,C02XK1ABCD12,jane@company.com,in_use,2025-02-10,1299,warranty,2027-02-10,\n'
  + 'Dell P2723QE,monitor,CN0ABC123,jane@company.com,in_use,2025-02-10,489,warranty,2028-02-10,\n'
  + 'iPhone 15,phone,F2LXK9ABCD,,in_stock,2024-09-20,969,lease,2026-09-20,Spare\n';
