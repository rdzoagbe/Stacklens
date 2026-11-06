'use strict';

// ── Mandatory company sign-in ───────────────────────────────────────────────
//
// An owner can require that everyone who opens their workspace signed in with
// a Google or Microsoft work account (/users/{uid}.sso_required). The policy
// is checked against the SESSION, not the account: Firebase stamps every ID
// token with the provider that started it (firebase.sign_in_provider), so an
// account that has both a Google and a password sign-in is refused while it
// is signed in with the password. Email and password and the magic link are
// both the "password" provider.
//
// Two places enforce it, and src/lib/sso.js mirrors the constants for the
// screens (sso-parity in src/lib/sso.test.js):
//   - firestore.rules, for the owner's own reads and writes of /userdata;
//   - the workspace function, for a team member or an agency reaching the
//     data through read / write / audit / auditchain.
// Okta and SAML are not providers here: Firebase has none configured.

const SSO_PROVIDERS = ['google.com', 'microsoft.com'];
const SSO_CODE = 'sso_required';

/** The provider that started this session, from a decoded ID token. */
function signInProvider(decoded) {
  return String(decoded?.firebase?.sign_in_provider || '');
}

const isSsoProvider = (provider) => SSO_PROVIDERS.includes(String(provider || ''));

/** Whether a /users document asks for company sign-in. Anything but true is no. */
const ssoRequired = (userDoc) => userDoc?.sso_required === true;

/**
 * null when the session may go on; otherwise the 403 body to send. The body
 * carries a machine-readable code so the browser can show the sign-in screen
 * rather than a sentence, and names the provider it saw, never the account.
 */
function ssoRefusal(userDoc, decoded) {
  if (!ssoRequired(userDoc) || isSsoProvider(signInProvider(decoded))) return null;
  return {
    error: 'This workspace requires signing in with a Google or Microsoft work account.',
    code: SSO_CODE,
    providers: SSO_PROVIDERS,
    signed_in_with: signInProvider(decoded) || 'unknown',
  };
}

module.exports = { SSO_PROVIDERS, SSO_CODE, signInProvider, isSsoProvider, ssoRequired, ssoRefusal };
