// ── Microsoft 365 write-back: block an ex-employee's sign-in ────────────────
//
// This is the first action in Stacklens that changes something outside
// Stacklens. Everything else records; this revokes. That difference drives
// every decision in this file.
//
// WHAT IT DOES
// PATCH /users/{id} { accountEnabled: false } — Entra ID's "block sign-in".
// Chosen over DELETE because it is reversible: an admin can re-enable the
// account in one click if the wrong person is blocked. Blocking sign-in also
// cascades — it kills access to every downstream app federated through the
// tenant, which is exactly the risk the Offboarding page is about.
//
// SCOPE
// Requested incrementally. Directory sync keeps User.Read.All; the broader
// User.ReadWrite.All is only requested the first time someone actually blocks
// a user, so customers who just want to import their directory never have to
// grant write access to their tenant.
//
// SAFETY
// The email in Stacklens is user-entered and may not match the tenant exactly,
// so resolution is deliberately strict:
//   - exact, case-insensitive match on mail OR userPrincipalName
//   - zero matches  -> refuse, say so
//   - many matches  -> refuse, never guess which human to lock out
// A wrong block locks a real employee out of their email, files and every
// federated app. Refusing is always the cheaper mistake.

const GRAPH = 'https://graph.microsoft.com/v1.0';

/** Scope needed to change accountEnabled. Requested only when blocking. */
export const GRAPH_WRITE_SCOPES = ['https://graph.microsoft.com/User.ReadWrite.All'];

export class M365WriteError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'M365WriteError';
    this.code = code; // not_found | ambiguous | forbidden | failed
  }
}

/**
 * Find exactly one directory user for an email address.
 * Exported for testing; `fetchImpl` is injectable so the resolution rules can
 * be verified without a tenant.
 */
export async function resolveGraphUser(email, accessToken, fetchImpl = fetch) {
  const address = String(email || '').trim().toLowerCase();
  if (!address) throw new M365WriteError('not_found', 'No email address to look up.');

  // Ask the tenant for both fields — a user's mail and userPrincipalName often
  // differ, and Stacklens may hold either.
  const escaped = address.replace(/'/g, "''"); // OData string escaping
  const url = `${GRAPH}/users?$filter=${encodeURIComponent(
    `mail eq '${escaped}' or userPrincipalName eq '${escaped}'`
  )}&$select=id,displayName,mail,userPrincipalName,accountEnabled&$top=5`;

  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 403) {
    throw new M365WriteError('forbidden',
      'Microsoft refused the change. A Global Administrator must approve the User.ReadWrite.All permission for Stacklens.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new M365WriteError('failed', body?.error?.message || `Directory lookup failed (HTTP ${res.status}).`);
  }

  const found = (await res.json()).value || [];
  if (found.length === 0) {
    throw new M365WriteError('not_found', `No Microsoft 365 account found for ${email}.`);
  }
  if (found.length > 1) {
    throw new M365WriteError('ambiguous',
      `${found.length} Microsoft 365 accounts match ${email}. Stacklens will not guess which one to block — resolve it in Entra ID.`);
  }
  return found[0];
}

/**
 * Block a single user's sign-in. Resolves first so the caller can show exactly
 * who is about to be affected, then patches.
 */
export async function blockGraphUserSignIn(email, accessToken, fetchImpl = fetch) {
  const user = await resolveGraphUser(email, accessToken, fetchImpl);

  if (user.accountEnabled === false) {
    // Already blocked — report it rather than pretending we did something.
    return { alreadyBlocked: true, user };
  }

  const res = await fetchImpl(`${GRAPH}/users/${encodeURIComponent(user.id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountEnabled: false }),
  });

  if (res.status === 403) {
    throw new M365WriteError('forbidden',
      'Microsoft refused the change. The signing-in user must be able to manage this account, and Stacklens needs User.ReadWrite.All admin consent.');
  }
  // Graph refuses to disable privileged accounts unless the caller outranks
  // them; surface that plainly rather than as a generic failure.
  if (res.status === 400 || res.status === 404) {
    const body = await res.json().catch(() => ({}));
    throw new M365WriteError('failed', body?.error?.message || 'Microsoft rejected the change.');
  }
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new M365WriteError('failed', body?.error?.message || `Could not block sign-in (HTTP ${res.status}).`);
  }

  return { alreadyBlocked: false, user };
}
