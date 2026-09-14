// ── Handing a client's data back ────────────────────────────────────────────
//
// An agency deleting a client needs to be able to keep what that company's
// records were, because "can we have our inventory back?" arrives months
// later and the honest answer cannot be no. The Data tab's CSVs cover tools,
// employees, access and the audit log one file at a time and only for the
// workspace you are currently inside; this is the whole workspace in one
// file, from the list, without having to enter it.
//
// JSON rather than CSV on purpose: it keeps nesting, keeps empty collections
// (so "no invoices" is recorded rather than absent) and can be read back.
// The CSVs stay for handing a spreadsheet to someone.

import { downloadText, toCsv } from './dataUtils';

/** Collections worth exporting, in the order a reader would want them. */
const COLLECTIONS = [
  'tools', 'employees', 'access', 'contracts', 'invoices', 'licenses', 'audit_log',
];

/** A safe-ish filename fragment from a client name. */
export function exportSlug(name) {
  const clean = String(name || 'client')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return clean || 'client';
}

/**
 * The export document: the data, plus enough context to know what it is a
 * year from now. Billing internals are not included — the server does not
 * send them for a client workspace and they are not the client's data.
 */
export function buildWorkspaceExport({ name, orgId, data, exportedAt = new Date() }) {
  const counts = {};
  for (const key of COLLECTIONS) {
    counts[key] = Array.isArray(data?.[key]) ? data[key].length : 0;
  }
  const payload = {
    stacklens_export: 1,
    client_name: name || null,
    client_workspace_id: orgId || null,
    exported_at: exportedAt.toISOString(),
    counts,
  };
  for (const key of COLLECTIONS) {
    payload[key] = Array.isArray(data?.[key]) ? data[key] : [];
  }
  return payload;
}

/** Filename: readable, sortable, and unambiguous about which client. */
export function exportFilename(name, exportedAt = new Date()) {
  return `stacklens-${exportSlug(name)}-${exportedAt.toISOString().slice(0, 10)}.json`;
}

/** Download the whole workspace as one JSON file. */
export function downloadWorkspaceExport({ name, orgId, data }) {
  const at = new Date();
  const payload = buildWorkspaceExport({ name, orgId, data, exportedAt: at });
  downloadText(exportFilename(name, at), JSON.stringify(payload, null, 2));
  return payload;
}

/** A flat CSV of one collection, for handing to someone with a spreadsheet. */
export function downloadCollectionCsv({ name, data, collection }) {
  const rows = Array.isArray(data?.[collection]) ? data[collection] : [];
  const columns = [...new Set(rows.flatMap(r => Object.keys(r || {})))];
  const at = new Date();
  downloadText(
    `stacklens-${exportSlug(name)}-${collection}-${at.toISOString().slice(0, 10)}.csv`,
    toCsv(rows, columns.length ? columns : ['(empty)'])
  );
}

export { COLLECTIONS as EXPORT_COLLECTIONS };
