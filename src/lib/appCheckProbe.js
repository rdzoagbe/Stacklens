// ── Would App Check work if we turned it on? ───────────────────────────────
//
// APP_CHECK_ENABLED in src/firebase-config.js has been flipped to true twice
// and taken sign-in down twice. The second time, after re-registering the
// reCAPTCHA key, production still returned exchangeRecaptchaV3Token 400s and
// appCheck/throttled (2026-07-23).
//
// The reason it is so expensive to get wrong is the failure mode. Once App
// Check is initialised on the app that Auth uses, the Auth SDK attaches an App
// Check token to every ID-token refresh. If minting that token fails, the
// refresh is corrupted and every auth-gated call starts returning 401 —
// checkout, the AI proxy, Firestore. There is no fail-open: you cannot ask the
// Auth SDK to carry on without the token it has been told to attach.
//
// So the flag is not the problem. The problem is that flipping it is the only
// way anyone has had to find out whether it works, and the answer arrives as
// an outage.
//
// This probe is the missing step. It attempts exactly the exchange that fails
// — reCAPTCHA v3 site key to App Check token — on a SECOND, throwaway Firebase
// app, one that nothing else in the product holds a reference to. No Auth
// instance, no Firestore instance, and no token auto-refresh, so a failure
// cannot reach a real user's session. Run it on the live domain, read the
// result, and then flipping the flag is a verified change rather than a third
// attempt.

import { initializeApp, deleteApp, getApps } from 'firebase/app';
import {
  initializeAppCheck, ReCaptchaV3Provider, getToken,
} from 'firebase/app-check';

/**
 * The reCAPTCHA v3 site key App Check would use.
 *
 * Kept identical to the branch in firebase-config: a probe against a different
 * key proves nothing about the thing we are trying to turn on. The site key is
 * public by design — it ships in the bundle — and the SECRET half lives only in
 * the Google Cloud Console, which is exactly what the failing exchange
 * depends on and the only thing a probe cannot check for itself.
 */
export const PROBE_SITE_KEY = import.meta.env.DEV
  ? import.meta.env.VITE_RECAPTCHA_SITE_KEY
  : '6Ldq47MsAAAAAGks_j_COugB3Pt6ROSuKgQhLrJe';

/** A name nothing else uses, so the probe app can never be picked up by accident. */
const PROBE_APP_NAME = 'appcheck-probe';

/**
 * Turn whatever Firebase threw into something worth reading.
 *
 * The two codes that have actually happened here are worth naming, because
 * "it failed" sends you to the wrong console page. A 400 on the exchange is a
 * key-registration problem in Google Cloud; throttling is App Check refusing
 * after repeated failures, which means the underlying problem is unfixed AND
 * you now have to wait.
 */
export function explain(err) {
  const code = err?.code || '';
  const message = err?.message || String(err || 'unknown error');
  // Always carried through. The first run of this probe on the live site came
  // back "throttled" and the canned explanation was all it showed — which said
  // what to do but not what had actually gone wrong, and the throttle then
  // stops the next attempt from finding out. Firebase error strings carry a
  // code and an HTTP status, never a credential, so there is no reason to drop
  // them. `raw` is the line to paste when asking someone what it means.
  const raw = [code, message].filter(Boolean).join(': ');

  if (/throttl/i.test(code) || /throttl/i.test(message)) {
    return {
      verdict: 'throttled',
      raw,
      detail: 'App Check is throttling, which it does after a failed exchange — '
        + 'so throttling is the symptom and the registration is still the cause. '
        + 'Firebase backs off for up to a day after a 403. Fix the registration '
        + 'first, then retry once the throttle has expired; retrying before that '
        + 'tells you nothing either way.',
    };
  }
  if (/40[03]/.test(message) || /recaptcha/i.test(message)) {
    return {
      verdict: 'rejected',
      raw,
      detail: 'The reCAPTCHA v3 exchange was rejected. This is the July failure: '
        + 'the web app in Firebase Console → App Check → Apps must have the '
        + 'reCAPTCHA v3 provider registered with the SECRET key that pairs with '
        + 'this site key, and this domain must be in the reCAPTCHA '
        + 'allowed-domains list in Google Cloud Console.',
    };
  }
  return { verdict: 'failed', raw, detail: message };
}

/**
 * Attempt one App Check token exchange in isolation.
 *
 * Resolves either way — a probe that throws is a probe that tells you nothing.
 * Always deletes its app, including on failure, so repeated runs do not
 * accumulate Firebase instances in the page.
 */
export async function probeAppCheck(
  firebaseConfig,
  // siteKey is injectable so this function can be tested without a build-time
  // env var, and so a future caller could probe a replacement key before
  // switching to it. The default is the one the real initialisation uses,
  // which is the only one worth probing today.
  { siteKey = PROBE_SITE_KEY, timeoutMs = 15000 } = {},
) {
  if (typeof window === 'undefined') {
    return { ok: false, verdict: 'unavailable', detail: 'Needs a browser.' };
  }
  if (!firebaseConfig?.apiKey || !firebaseConfig?.projectId) {
    return { ok: false, verdict: 'unavailable', detail: 'Firebase is not configured here.' };
  }
  if (!siteKey) {
    return {
      ok: false,
      verdict: 'unavailable',
      detail: 'No reCAPTCHA site key available in this build.',
    };
  }

  let probeApp = null;
  try {
    // A fresh app every run: reusing one would reuse its cached App Check
    // token, and a cached success would keep reporting success long after the
    // registration behind it had been changed.
    const existing = getApps().find(a => a.name === PROBE_APP_NAME);
    if (existing) await deleteApp(existing).catch(() => {});
    probeApp = initializeApp(firebaseConfig, PROBE_APP_NAME);

    const appCheck = initializeAppCheck(probeApp, {
      provider: new ReCaptchaV3Provider(siteKey),
      // Deliberately off. The point is one exchange now, not a background
      // refresh loop living on in the page after the probe has reported.
      isTokenAutoRefreshEnabled: false,
    });

    // forceRefresh, or a token cached by an earlier attempt answers instead of
    // the exchange we are actually asking about.
    const result = await Promise.race([
      getToken(appCheck, /* forceRefresh */ true),
      new Promise((_, reject) => setTimeout(
        () => reject(new Error('Timed out waiting for an App Check token')), timeoutMs)),
    ]);

    if (!result?.token) {
      return { ok: false, verdict: 'failed', detail: 'The exchange returned no token.' };
    }
    return {
      ok: true,
      verdict: 'ok',
      // Never the token itself. It is a credential, and it would end up pasted
      // into a chat or a screenshot the moment it appears on screen.
      detail: `App Check minted a token (${result.token.length} characters). `
        + 'The reCAPTCHA registration and this domain both check out, so '
        + 'APP_CHECK_ENABLED can be flipped.',
    };
  } catch (err) {
    return { ok: false, ...explain(err) };
  } finally {
    if (probeApp) await deleteApp(probeApp).catch(() => {});
  }
}
