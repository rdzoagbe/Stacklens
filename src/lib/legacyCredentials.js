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

// Every vendor credential older builds kept in the browser. All are now held
// in /integration_credentials/{uid} and posted through the integrations
// endpoint; none of these keys is written any more.
//
//   Zoom          S2S client secret — admin-scoped over the whole account,
//                 never expires. The worst of the set.
//   Salesforce    refresh token — grants persistent re-authentication.
//   Okta          API token — org-wide directory read.
//   GitHub        personal access token — as broad as the PAT's scopes.
//   Slack, Asana  workspace tokens.
//
// The non-secret companions (org name, Okta domain, instance URL) are purged
// alongside them: without the token they are useless, and leaving them behind
// would make a disconnected integration look half-connected.
const PURGED_KEYS = [
  'sg_zoom_account_id', 'sg_zoom_client_id', 'sg_zoom_client_secret',
  'sg_slack_token',
  'sg_okta_token', 'sg_okta_domain',
  'sg_github_token', 'sg_github_org',
  'sg_asana_token',
  'sg_sf_refresh_token', 'sg_sf_client_id', 'sg_sf_instance_url', 'sg_sf_login_url',
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
