// ── One-off purge of credentials that used to live in the browser ──────────
//
// Integration credentials are moving server-side, vendor by vendor. Anyone who
// connected before a given vendor was migrated still has that credential
// sitting in localStorage, where any XSS could read it. Migrating the code is
// not enough — the already-stored value has to be removed from the browsers
// that hold it.
//
// This runs on every app load (from main.jsx) so it reaches users who never
// open Settings. It is deliberately dependency-free and never throws, because
// it runs before React mounts.
//
// Purging is safe: once a vendor is migrated its credentials are held in
// /integration_credentials/{uid}, which is server-only. A user who has not yet
// reconnected is simply prompted to reconnect.

// Zoom: Server-to-Server OAuth. The client secret is admin-scoped over the
// customer's whole Zoom account and does not expire — the worst of the set.
const PURGED_KEYS = [
  'sg_zoom_account_id',
  'sg_zoom_client_id',
  'sg_zoom_client_secret',
];

export function purgeLegacyCredentials() {
  const purged = [];
  try {
    for (const key of PURGED_KEYS) {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        purged.push(key);
      }
    }
  } catch {
    // Storage unavailable (private mode, disabled cookies) — nothing to purge.
  }
  return purged;
}
