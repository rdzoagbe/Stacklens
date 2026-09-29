// ── Reviewing tools the app added on its own ───────────────────────────────
//
// Several paths create a tool without anyone typing it: an invoice read by the
// AI or received by email, a recurring charge found by the bank connection
// (all three through Finance → Budget), and an app found through Google
// Workspace sign-ins (Tools → sync usage). Both can be wrong in the way the
// free audit is wrong — a bank fee read as software, a vendor under the wrong
// name — and the person who knows is the one looking at the list. So each
// such tool carries a "to check" mark until someone says Correct, renames it,
// or says it is not software.
//
// "Not software" removes the tool and remembers the vendor in
// db.rejected_vendors, so the next invoice from them does not bring it back.
// Nothing here leaves the workspace.

export const REVIEW_ORIGINS = ['invoice', 'bank', 'google-workspace'];

// Tools created before `origin` existed are recognised by the note each path
// has always written.
const LEGACY_NOTES = [
  ['Created from invoice import', 'invoice'],
  ['Discovered via Google Workspace', 'google-workspace'],
];

/** Where an automatically added tool came from, or null for one a person added. */
export function toolOrigin(tool) {
  if (!tool) return null;
  if (REVIEW_ORIGINS.includes(tool.origin)) return tool.origin;
  const notes = String(tool.notes || '');
  const legacy = LEGACY_NOTES.find(([prefix]) => notes.startsWith(prefix));
  return legacy ? legacy[1] : null;
}

/** Added automatically and not yet looked at. */
export function needsReview(tool) {
  return !!toolOrigin(tool) && !tool.reviewed;
}

export const vendorKey = (name) => String(name || '').toLowerCase().trim().replace(/\s+/g, ' ');

/** Did someone in this workspace already say this vendor is not software? */
export function isRejectedVendor(db, name) {
  const key = vendorKey(name);
  return !!key && (db?.rejected_vendors || []).includes(key);
}

/** The origin a tool created from an imported row gets. */
export const originOfRow = (row) => (row?.source === 'bank' ? 'bank' : 'invoice');
