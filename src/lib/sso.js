// ── Mandatory company sign-in, as the screens see it ────────────────────────
//
// The server twin is functions/sso-policy.js (constants held equal by
// sso.test.js). An owner or admin turns the switch on in Settings → Security;
// it is stored on /users/{uid}.sso_required, which firestore.rules lets only a
// Google or Microsoft session change, and which the rules and the workspace
// function then apply to every session that reaches the data. What the
// browser does: tell the person which sign-in to use. The refusal itself is
// the server's.

export const SSO_PROVIDERS = ['google.com', 'microsoft.com'];
export const SSO_FIELD = 'sso_required';
export const SSO_CODE = 'sso_required';

export const isSsoProvider = (provider) => SSO_PROVIDERS.includes(String(provider || ''));

/** The provider that started this session, from firebaseUser.getIdTokenResult(). */
export const signInProviderOf = (tokenResult) => String(tokenResult?.signInProvider || '');

export const ssoRequiredFor = (userDoc) => userDoc?.[SSO_FIELD] === true;

/** A word for the screen: 'password' covers email and password and the magic link. */
export function providerKind(provider) {
  if (isSsoProvider(provider)) return 'sso';
  if (provider === 'password') return 'password';
  return 'other';
}

// ── The sign-in screen, raised from wherever the refusal arrives ──────────
//
// useAuth raises it for the person's own account (the policy is read before
// anything else is loaded); useClientWorkspaces raises it when the workspace
// function answers 403 with the code. CompanySignInRequired (mounted once in
// App) shows it. Nothing here touches storage.

let block = null; // { scope: 'own' | 'shared', owner, signedInWith }
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(block));

export function subscribeSsoBlock(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const currentSsoBlock = () => block;

export function raiseSsoBlock({ scope = 'own', owner = '', signedInWith = '' } = {}) {
  block = { scope: scope === 'shared' ? 'shared' : 'own', owner: String(owner || ''), signedInWith: String(signedInWith || '') };
  emit();
  return block;
}

export function clearSsoBlock() {
  if (!block) return;
  block = null;
  emit();
}

/** True when a workspace request failed because of the policy. */
export const isSsoRefusal = (err) => err?.code === SSO_CODE || err?.status === 403 && err?.code === SSO_CODE;
