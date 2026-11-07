// ── Does this browser hold what the server holds? ──────────────────────────
//
// Every figure on the screens is computed from the browser's copy of the
// workspace (lib/db.js); the stored copy is Firestore (the owner's own
// account) or the workspace endpoint (a shared or client workspace). The two
// are kept equal by debounced, revision-checked saves, but "kept equal" is a
// claim, and a reviewer is right to ask for the check. This compares the two
// copies collection by collection, by record id, and reports what is missing
// on either side and which revision each holds. It changes nothing.

export const RECONCILED_COLLECTIONS = [
  'tools', 'employees', 'access', 'contracts', 'invoices', 'licenses',
  'assets', 'access_reviews', 'invoice_records', 'audit_log',
];

const ids = (rows) => new Set((Array.isArray(rows) ? rows : []).map((r, i) => String(r?.id ?? `#${i}`)));

/** Per-collection counts of a copy. */
export function countsOf(db) {
  const out = {};
  for (const key of RECONCILED_COLLECTIONS) out[key] = Array.isArray(db?.[key]) ? db[key].length : 0;
  return out;
}

/**
 * The browser's copy against the stored one. `stored` null means nothing is
 * stored yet (a new account, or the demo): every local record is unsaved.
 */
export function compareCopies(here, stored) {
  const collections = RECONCILED_COLLECTIONS.map((key) => {
    const a = ids(here?.[key]);
    const b = ids(stored?.[key]);
    let missingHere = 0, unsaved = 0;
    for (const id of b) if (!a.has(id)) missingHere++;
    for (const id of a) if (!b.has(id)) unsaved++;
    return { key, here: a.size, stored: b.size, missingHere, unsaved, same: missingHere === 0 && unsaved === 0 };
  });
  const rev = { here: Number(here?._rev) || null, stored: Number(stored?._rev) || null };
  const same = collections.every((c) => c.same);
  return {
    collections,
    same,
    stored: !!stored,
    rev,
    storedAt: Number(stored?._updatedAt) || Number(stored?._saved_at) || null,
    savedAt: Number(here?._saved_at) || null,
    missingHere: collections.reduce((s, c) => s + c.missingHere, 0),
    unsaved: collections.reduce((s, c) => s + c.unsaved, 0),
  };
}

/**
 * Read the stored copy for the workspace this browser holds: the signed-in
 * account's own document, or the shared workspace through the endpoint. The
 * demo has no stored copy. `deps` are the two readers, injected for tests.
 */
export async function fetchStoredCopy(db, uid, deps) {
  if (!db || db.user?.is_demo) return null;
  if (db._shared_view?.owner_uid) {
    const r = await deps.workspaceRead(db._shared_view.owner_uid);
    return r?.data || null;
  }
  if (!uid) return null;
  return (await deps.loadUserData(uid)) || null;
}
