// ── The second step of a sign-in, asked for in one place ───────────────────
//
// An account with two-step sign-in (an authenticator app, TOTP) finishes every
// sign-in, whichever button started it, with a six-digit code. Firebase says
// so by failing the first step with auth/multi-factor-auth-required; the
// sign-in functions in firebase-config.js then call askForSecondFactor and
// wait. SecondFactorPrompt (mounted once in App) shows the code field, calls
// `verify` with what was typed, and resolves or cancels the wait. So no
// sign-in screen has to know about the second step, and none can forget it.

let pending = null; // { verify(code) -> Promise<credential>, resolve, reject }
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(pending));

export function subscribeSecondFactor(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const currentSecondFactor = () => pending;

/** Wait for the code. `verify(code)` must finish the sign-in or throw. */
export function askForSecondFactor(verify) {
  if (pending) pending.reject(cancelled());
  return new Promise((resolve, reject) => {
    pending = { verify, resolve, reject };
    emit();
  });
}

/** The code typed: resolves the sign-in, or throws so the field can say why. */
export async function submitSecondFactor(code) {
  if (!pending) throw new Error('No sign-in waiting for a code');
  const p = pending;
  const credential = await p.verify(String(code || '').replace(/\s+/g, ''));
  if (pending === p) { pending = null; emit(); }
  p.resolve(credential);
  return credential;
}

/** The person closed the prompt: the sign-in ends, silently. */
export function cancelSecondFactor() {
  if (!pending) return;
  const p = pending;
  pending = null;
  emit();
  p.reject(cancelled());
}

// The same code Firebase uses for a closed popup, so authFail logs nothing and
// the sign-in screen says nothing: the person chose to stop.
function cancelled() {
  const err = new Error('Firebase: Two-step sign-in cancelled (auth/user-cancelled).');
  err.code = 'auth/user-cancelled';
  return err;
}

// Firebase's answers, in words a person can act on.
const MFA_ERROR_KEYS = {
  'auth/requires-recent-login': 'mfa_recent_login',
  'auth/unverified-email': 'mfa_need_verified',
  'auth/operation-not-allowed': 'mfa_not_available',
  'auth/admin-restricted-operation': 'mfa_not_available',
  'auth/invalid-verification-code': 'mfa_wrong_code',
};

/** The sentence for a failed set-up or code. */
export function mfaErrorText(err, t) {
  const code = String(err?.code || (String(err?.message || '').match(/auth\/[\w-]+/) || [''])[0]);
  const key = MFA_ERROR_KEYS[code];
  return key ? t(key) : t('mfa_failed').replace('{code}', code || 'error');
}
