// ============================================================================
// FIREBASE CONFIGURATION — SaasGuard
// ============================================================================
// Data layer:  Firestore (cloud, per-user, cross-device)
// AI layer:    Cloud Functions proxy (API key never in browser)
// Auth:        Google redirect + Magic link
// ============================================================================

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  getIdToken,
  updateProfile,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { getAnalytics, isSupported, setConsent as firebaseSetConsent } from 'firebase/analytics';
import { track } from './lib/analytics';
import { stripLocalOnly } from './lib/constants';
import { REV_FIELD, revOf, nextRev, isStaleWrite, StaleWriteError } from './lib/revision';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// Firebase config — values come from environment variables (VITE_FIREBASE_*).
// In Vite, env vars must be prefixed with VITE_ to be exposed to the client.
// Set these in your .env file (see .env.example for the template).
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const FIREBASE_CONFIGURED = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

/**
 * The same config, for the App Check probe in lib/appCheckProbe.js.
 *
 * Exported so the probe can stand up a SECOND, throwaway Firebase app and
 * attempt an App Check token exchange on that, leaving this one — the app Auth
 * and Firestore are attached to — untouched. Every value here already ships in
 * the client bundle, so exporting it reveals nothing that reading the built
 * JavaScript would not.
 */
export const PUBLIC_FIREBASE_CONFIG = Object.freeze({ ...firebaseConfig });

if (!FIREBASE_CONFIGURED) {
  console.warn(
    '[Stacklens] Firebase config missing — running in offline/demo mode. ' +
    'Set VITE_FIREBASE_* in your .env file to enable auth and cloud sync.'
  );
}

const app = initializeApp(firebaseConfig);

// ── App Check (anti-bot protection) ──────────────────────────────
//
// ENABLED 2026-09-15, after the probe in src/lib/appCheckProbe.js minted a
// real token on stacklens.fr — 950 characters. That makes this the first time
// it has been turned on against evidence instead of hope: it was flipped twice
// before and took sign-in down twice (2026-07-23 the second time).
//
// THE ROOT CAUSE OF BOTH OUTAGES, found 2026-09-15: the reCAPTCHA SECRET key
// field in Firebase Console → App Check → Apps was holding the reCAPTCHA SITE
// key. The two are easy to confuse — same length, both begin `6L`, and the
// site key is the one sitting in plain sight a few lines below — and Firebase
// stores the secret write-only, so no console screen can ever show the
// mistake. Every screen read "Registered" while the exchange returned 400.
// That is why three rounds of re-checking the console found nothing: the one
// wrong value was the one value that cannot be displayed.
//
// Why getting this wrong is so expensive. Once App Check is initialised on
// this app, the Auth SDK attaches an App Check token to every ID-token
// refresh. If minting it fails the refresh is corrupted, and every auth-gated
// call starts returning 401 — checkout, the AI proxy, Firestore. There is no
// fail-open: you cannot ask the Auth SDK to carry on without a token it has
// been told to attach. So the failure mode is not "bot protection is off", it
// is "nobody can sign in".
//
// IF SIGN-IN BREAKS: set this to false and deploy hosting. That is the entire
// rollback and it needs no other change. Then run "Test App Check" on
// /founder-admin before turning it back on — the probe attempts the same
// exchange on a throwaway Firebase app and cannot touch a real session.
//
// Enforcement is a SEPARATE switch, per service, under Firebase Console → App
// Check → APIs. This flag only makes the client SEND tokens; nothing is
// rejected for lacking one until enforcement is turned on there. Watch the
// verified/unverified split on that page for a few days first, or enforcement
// will lock out anything not yet sending tokens.
const APP_CHECK_ENABLED = true;
if (APP_CHECK_ENABLED) {
  try {
    const recaptchaKey = import.meta.env.DEV
      ? import.meta.env.VITE_RECAPTCHA_SITE_KEY
      : '6Ldq47MsAAAAAGks_j_COugB3Pt6ROSuKgQhLrJe';
    if (typeof window !== 'undefined' && recaptchaKey) {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaKey),
        isTokenAutoRefreshEnabled: true,
      });
    }
  } catch (e) {
    console.warn('App Check initialization skipped:', e?.message);
  }
}

// Auth and Firestore are guarded — if Firebase credentials are missing the app
// runs in offline mode: onAuthChange immediately fires with null (not signed in)
// and all Firestore reads/writes silently no-op.
let auth        = null;
let firestoreDb = null;
try {
  auth        = getAuth(app);
  firestoreDb = getFirestore(app);
} catch (e) {
  console.warn('[Stacklens] Firebase services unavailable (offline mode):', e?.message);
}
const googleProvider    = new GoogleAuthProvider();
const microsoftProvider = new OAuthProvider('microsoft.com');
microsoftProvider.addScope('email');
microsoftProvider.addScope('profile');
microsoftProvider.setCustomParameters({ prompt: 'select_account' });
let   analytics       = null;

isSupported().then(ok => {
  if (ok) {
    analytics = getAnalytics(app);
    // Expose consent propagation hook so index.html can update Firebase Analytics
    // consent state when the user accepts/rejects cookies.
    if (typeof window !== 'undefined') {
      window.__firebaseAnalyticsSetConsent = function(consentState) {
        try { firebaseSetConsent(consentState); } catch { /* silent */ }
      };
      // If consent was given on a prior visit, apply it now — using the same
      // test and the same state index.html uses. This path used to read
      // localStorage itself, check only `choice === 'accepted'` (so a consent
      // from an old banner version, or older than the 13-month ceiling, was
      // still honoured here while index.html correctly refused it), and grant
      // the three advertising signals nobody had been asked about.
      try {
        if (window.hasStoredAnalyticsConsent && window.hasStoredAnalyticsConsent()) {
          firebaseSetConsent(window.ANALYTICS_CONSENT);
        }
      } catch { /* silent */ }
    }
  }
});

googleProvider.addScope('profile');
googleProvider.addScope('email');

// Cloud Functions base URL — deployed region
const FUNCTIONS_BASE = 'https://us-central1-accessguard-v2.cloudfunctions.net';

// ============================================================================
// AUTH HELPERS
// ============================================================================
async function getToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return getIdToken(user, false);
}

// ============================================================================
// AI PROXY — Cloudflare Worker (preferred) or GCP Cloud Function fallback
// ============================================================================
export async function callAI({ messages, system, max_tokens = 2000 }) {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  const payload = JSON.stringify({ messages, system, max_tokens });

  // Try the Cloudflare Worker first (if configured), then fall back to the
  // Firebase Cloud Function so the AI keeps working if the Worker is down or
  // misconfigured. Both verify the Firebase ID token and proxy to Anthropic.
  const workerUrl = import.meta.env.VITE_WORKER_URL;
  const endpoints = workerUrl ? [workerUrl, `${FUNCTIONS_BASE}/ai`] : [`${FUNCTIONS_BASE}/ai`];

  let lastError = 'AI call failed';
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { method: 'POST', headers, body: payload });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data;
      lastError = data.error || `AI error (${res.status})`;
    } catch (err) {
      lastError = err?.message || 'AI network error';
    }
  }
  throw new Error(lastError);
}

// ============================================================================
// FIRESTORE DATA LAYER
// /userdata/{uid} → { tools, employees, access, user }
// ============================================================================
export async function loadUserData(uid) {
  if (!firestoreDb) return null;
  try {
    const snap = await getDoc(doc(firestoreDb, 'userdata', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    // Reassemble chunked arrays (see saveUserData). Pre-chunking docs have no
    // _chunks field and pass through unchanged.
    if (data._chunks) {
      const chunkSnap = await getDocs(collection(firestoreDb, 'userdata', uid, 'chunks'));
      const byId = {};
      chunkSnap.forEach(d => { byId[d.id] = d.data().items || []; });
      for (const [key, count] of Object.entries(data._chunks)) {
        const arr = [];
        for (let i = 0; i < count; i++) arr.push(...(byId[`${key}_${i}`] || []));
        data[key] = arr;
      }
      delete data._chunks;
    }
    return data;
  } catch (err) {
    console.error('loadUserData:', err);
    return null;
  }
}

// Read billing plan directly from users collection (updated by Stripe webhook)
export async function getUserPlanFromFirestore(uid) {
  if (!firestoreDb) return null;
  try {
    const snap = await getDoc(doc(firestoreDb, 'users', uid));
    if (snap.exists()) return snap.data();
    return null;
  } catch {
    return null;
  }
}

// Firestore rejects documents over 1MB. Real customer data (hundreds of
// employees, thousands of access records) blows past that as a single doc —
// every write then fails and the SDK's retry queue floods ("Write stream
// exhausted"). So the unbounded arrays are stored as size-capped slices in a
// /userdata/{uid}/chunks subcollection, reassembled on load. Small collections
// (tools, contracts, invoices, licenses, user, settings) stay inline.
const CHUNKED_KEYS = ['employees', 'access', 'audit_log'];
const CHUNK_MAX_CHARS = 500000; // ~500KB serialized per slice

export async function saveUserData(uid, db) {
  if (!firestoreDb) return;
  try {
    const meta = stripLocalOnly({ ...db, _uid: uid, _updatedAt: Date.now() });
    const chunkCounts = {};
    const chunksRef = collection(firestoreDb, 'userdata', uid, 'chunks');
    const chunkWrites = [];

    for (const key of CHUNKED_KEYS) {
      const arr = Array.isArray(db[key]) ? db[key] : [];
      delete meta[key];
      const slices = [];
      let current = [];
      let size = 0;
      for (const item of arr) {
        const itemSize = JSON.stringify(item).length;
        if (size + itemSize > CHUNK_MAX_CHARS && current.length) {
          slices.push(current);
          current = [];
          size = 0;
        }
        current.push(item);
        size += itemSize;
      }
      if (current.length || slices.length === 0) slices.push(current);
      chunkCounts[key] = slices.length;
      slices.forEach((items, i) => chunkWrites.push([doc(chunksRef, `${key}_${i}`), { items }]));
    }
    meta._chunks = chunkCounts;

    // Slices left over from a previous, larger save. Read outside the
    // transaction: the Firestore Web SDK allows only single-document gets
    // inside one, not a collection query.
    const existing = await getDocs(chunksRef);
    const staleChunks = [];
    existing.forEach(d => {
      const m = d.id.match(/^(.+)_(\d+)$/);
      if (!m || !(m[1] in chunkCounts) || Number(m[2]) >= chunkCounts[m[1]]) {
        staleChunks.push(d.ref);
      }
    });

    // Conditional on the revision this edit was based on, so a save from
    // another tab or device cannot be silently overwritten. A transaction
    // rather than a batch: the stored revision has to be read and compared
    // inside the same atomic unit that writes, or two saves landing together
    // both pass the check and one still disappears.
    const baseRev = revOf(db);
    const ownerRef = doc(firestoreDb, 'userdata', uid);
    await runTransaction(firestoreDb, async (tx) => {
      const snap = await tx.get(ownerRef);
      const storedRev = snap.exists() ? revOf(snap.data()) : null;
      if (snap.exists() && isStaleWrite(storedRev, baseRev)) {
        throw new StaleWriteError(storedRev);
      }
      meta[REV_FIELD] = nextRev(storedRev);
      tx.set(ownerRef, meta);
      for (const [ref, value] of chunkWrites) tx.set(ref, value);
      for (const ref of staleChunks) tx.delete(ref);
    });
    return meta[REV_FIELD];
  } catch (err) {
    // A conflict is an expected outcome, not a fault: it means the guard did
    // its job. Logging it as an error trains you to ignore the console.
    if (err instanceof StaleWriteError) throw err;
    console.error('saveUserData:', err);
    throw err;
  }
}

// Set the signed-in user's full name on both the Firebase Auth profile and
// their /users doc. Used by the "enter your name" gate for accounts that
// arrived without one (email/password, magic link, or an OAuth account with
// no name), so the founder view always has Full Name + Email.
export async function saveDisplayName(name) {
  const clean = String(name || '').trim();
  if (!clean) throw new Error('Name required');
  const u = auth.currentUser;
  if (!u) throw new Error('Not signed in');
  await updateProfile(u, { displayName: clean });
  await syncUserProfile({ uid: u.uid, email: u.email, displayName: clean, photoURL: u.photoURL });
  return clean;
}

export async function syncUserProfile(user) {
  if (!firestoreDb) return { isNew: false };
  try {
    const ref = doc(firestoreDb, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        plan: 'free',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { isNew: true };
    }
    const data = snap.data();
    if (!data.email || !data.displayName) {
      await updateDoc(ref, {
        ...(user.email && !data.email ? { email: user.email } : {}),
        ...(user.displayName && !data.displayName ? { displayName: user.displayName } : {}),
        ...(user.photoURL && !data.photoURL ? { photoURL: user.photoURL } : {}),
        updatedAt: Date.now(),
      });
    }
    return { isNew: false, plan: data.plan || 'free', stripe_customer_id: data.stripe_customer_id || null, subscription_status: data.subscription_status || null };
  } catch (err) {
    console.error('syncUserProfile:', err);
    return { isNew: false };
  }
}

// ============================================================================
// AUTHENTICATION
// ============================================================================
export async function signInWithGoogleWorkspace() {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/admin.directory.user.readonly');
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    return { accessToken: credential?.accessToken || null, error: null };
  } catch (error) {
    return { accessToken: null, error: error.message };
  }
}

// Maps a raw Firebase auth error (message string or Error) to a translation key
// for a friendly, user-facing message. Returns '' for cases we should stay
// silent on (e.g. the user closed the popup themselves). The UI resolves the
// key with t() and falls back to 'err_auth_generic'.
export function authErrorKey(raw) {
  const code = (String(raw?.code || raw?.message || raw || '').match(/auth\/[\w-]+/) || [])[0] || '';
  switch (code) {
    case 'auth/user-disabled':            return 'err_auth_disabled';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':       return 'err_auth_bad_creds';
    case 'auth/user-not-found':           return 'err_auth_no_account';
    case 'auth/invalid-email':            return 'err_auth_invalid_email';
    case 'auth/email-already-in-use':     return 'err_auth_email_used';
    case 'auth/weak-password':            return 'err_auth_weak_pw';
    case 'auth/too-many-requests':        return 'err_auth_too_many';
    case 'auth/network-request-failed':   return 'err_auth_network';
    case 'auth/account-exists-with-different-credential': return 'err_auth_diff_cred';
    // A BLOCKED popup is not a dismissed one, and grouping them was the bug.
    //
    // auth/popup-blocked means the browser refused to open the window. The
    // person did tap the button; the browser stopped it. Returning '' for that
    // says nothing at all, which is indistinguishable from the app being
    // broken — and it is exactly what happens in an iOS in-app browser
    // (LinkedIn, Instagram, Facebook), where signInWithPopup cannot work. So a
    // visitor arriving from a social link taps "Continue with Google" and is
    // told nothing.
    //
    // auth/operation-not-supported-in-this-environment is the same situation
    // reported differently, so it maps here too.
    //
    // These stay silent, and should: the person closed the window themselves,
    // or a second popup superseded the first.
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':           return '';   // user dismissed — stay silent
    case 'auth/popup-blocked':
    case 'auth/operation-not-supported-in-this-environment':
                                          return 'err_auth_popup_blocked';
    default:                              return 'err_auth_generic';
  }
}

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
}

export async function signInWithMicrosoft() {
  try {
    const result = await signInWithPopup(auth, microsoftProvider);
    return { user: result.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
}

// handleRedirectResult() was here. Removed 2026-09-16: exported, never called,
// and unreachable by construction — nothing in src/ calls signInWithRedirect,
// so there was never a redirect for it to report on. The matching reader in
// useAuth (a sessionStorage key no code ever wrote) went at the same time.
//
// Sign-in is popup-only. Wiring redirect up is a real option — signInWithPopup
// is blocked in iOS in-app browsers, so a visitor arriving from a LinkedIn or
// Instagram webview taps "Continue with Google" and nothing happens — but it
// needs the redirect started on the way out as well as handled on the way
// back. Half of that pair is worse than neither: it reads as handled.

export async function signOutUser() {
  try {
    await signOut(auth);
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
}

export function onAuthChange(callback) {
  if (!auth) {
    // No Firebase auth — fire immediately with null (not signed in) so the app
    // doesn't hang on the loading spinner in offline/dev mode.
    const timer = setTimeout(() => callback(null), 0);
    return () => clearTimeout(timer);
  }
  return onAuthStateChanged(auth, callback);
}

export async function sendMagicLink(email) {
  const actionCodeSettings = {
    url: window.location.origin + '/finishSignUp',
    handleCodeInApp: true,
  };
  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
}

export async function completeMagicLinkSignIn() {
  if (isSignInWithEmailLink(auth, window.location.href)) {
    let email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
      email = window.prompt('Please provide your email for confirmation');
    }
    try {
      const result = await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem('emailForSignIn');
      return { user: result.user, error: null };
    } catch (error) {
      return { user: null, error: error.message };
    }
  }
  return { user: null, error: 'Invalid sign-in link' };
}

export { auth, firestoreDb as db, analytics };

// ============================================================================
// STRIPE BILLING HELPERS
// ============================================================================
// Force-refresh the Firebase ID token so new custom claims (plan) take effect immediately.
// Call this after a successful Stripe checkout.
export async function refreshClaims() {
  if (!auth.currentUser) return null;
  await auth.currentUser.getIdToken(true);
  const result = await auth.currentUser.getIdTokenResult();
  return result.claims;
}

// Tell the server to sync Firestore plan → custom claims (use after Stripe redirect).
export async function syncClaimsFromServer() {
  try {
    const token = await getToken();
    if (!token) return null;
    const res = await fetch(`${FUNCTIONS_BASE}/refreshClaims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    await auth.currentUser?.getIdToken(true);
    return data.plan;
  } catch { return null; }
}

// Send a team invite email via SendGrid Cloud Function.
export async function sendInviteEmail({ inviteeEmail, inviterName, orgName }) {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${FUNCTIONS_BASE}/sendInvite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ inviteeEmail, inviterName, orgName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Invite failed');
  return data;
}

export async function createCheckoutSession(priceId) {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${FUNCTIONS_BASE}/createCheckout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ priceId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Checkout failed');
  return data;
}

export async function createBillingPortal() {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${FUNCTIONS_BASE}/createPortal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Portal failed');
  return data;
}


// Email/Password Registration
export async function registerWithEmail(email, password, displayName) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    // The signup form asks for a full name. This used to take it as
    // `_displayName` — the repo's convention for a parameter deliberately
    // unused — and drop it on the floor. So somebody typed their name, pressed
    // Continue, and the very next screen was a modal asking "What's your
    // name?". They had just answered that.
    //
    // Stored BEFORE the verification email goes out: the name is then already
    // on the account if the send fails, and Firebase's own template can use it.
    //
    // A failure here must not fail the registration — the account exists by
    // this point, and losing the signup over a name would be a far worse
    // outcome. Nothing catches it afterwards any more: the "What's your name?"
    // gate that used to was removed on 2026-09-16, so this is the only place
    // an email/password signup's name is recorded.
    if (displayName && String(displayName).trim()) {
      try {
        await saveDisplayName(displayName);
      } catch (e) {
        console.warn('registerWithEmail: could not store the display name:', e?.message);
      }
    }

    // Continue URL so the verification link returns the user to the app instead
    // of dead-ending on Firebase's hosted "email verified" page.
    await sendEmailVerification(result.user, { url: window.location.origin + '/dashboard' });
    return { user: result.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
}

// Email/Password Sign In
export async function signInWithEmail(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
}

// Resend email verification to current user
export async function resendEmailVerification() {
  try {
    if (!auth.currentUser) return { error: 'Not signed in' };
    await sendEmailVerification(auth.currentUser, { url: window.location.origin + '/dashboard' });
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Ask the server whether this account's email is verified yet.
 *
 * The "I've verified — continue" button used to do
 *
 *   await firebaseUser.reload();
 *   if (!firebaseUser.emailVerified) setError(...)
 *
 * with a comment saying onAuthStateChanged would then re-render. It does not:
 * that listener fires on sign-in and sign-out, not on reload(). So for the
 * person who HAD clicked the link, no error was set, no state changed, and the
 * wall stayed exactly as it was. The button appeared to do nothing, which is
 * the one thing it must never do — it is the only way out of that screen.
 *
 * reload() is what actually re-reads the flag from the server; the persisted
 * user restored on a page load can carry a stale one, which is why reloading
 * the page was not a fix either. The forced ID-token refresh is for the Cloud
 * Functions, which read the claims: without it the next call still carries a
 * token minted before verification.
 */
export async function refreshEmailVerified() {
  try {
    if (!auth?.currentUser) return { verified: false, error: 'Not signed in' };
    await auth.currentUser.reload();
    const verified = !!auth.currentUser.emailVerified;
    if (verified) await getIdToken(auth.currentUser, true);
    return { verified, error: null };
  } catch (error) {
    return { verified: false, error: error.message };
  }
}

// Password Reset
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
}

// Create Billing Portal Session

// ============================================================================
// COOKIE CONSENT AUDIT LOG (CNIL compliance)
// Records every consent choice to /consent_logs for audit trail purposes.
// No PII — we deliberately do NOT log IP, email, or user ID.
// CNIL requires proof of consent existence, not user identification.
// ============================================================================
export async function logConsent({ choice, version, userAgent, language }) {
  if (!firestoreDb) return;
  try {
    await addDoc(collection(firestoreDb, 'consent_logs'), {
      choice,                          // 'accepted' or 'rejected'
      version,                         // e.g. 'v2-2026-04'
      userAgent: (userAgent || '').slice(0, 300),
      language: (language || '').slice(0, 16),
      timestamp: serverTimestamp(),    // server-side truth, not client clock
    });
  } catch (e) {
    // Best-effort — never block the UI on failure
    console.warn('consent log failed', e?.message);
  }
}

// ============================================================================
// LEGAL ACCEPTANCE LOG — GDPR/LCEN audit trail
// Writes to /legal_acceptances/{uid}_{ts} — best-effort, never blocks UI.
// ============================================================================
export async function logLegalAcceptance(uid, email, planId) {
  if (!firestoreDb) return;
  try {
    await setDoc(
      doc(firestoreDb, 'legal_acceptances', `${uid}_${Date.now()}`),
      {
        uid,
        email: email || '',
        accepted_at: serverTimestamp(),
        documents: ['terms', 'privacy', 'dpa'],
        plan_id: planId,
        ip_hint: 'client',
      }
    );
  } catch { /* best-effort — never block checkout */ }
}

// ============================================================================
// FOUNDER ADMIN — read all users, extend trials
// ============================================================================
export async function loadAllUsersAdmin() {
  if (!firestoreDb) return [];
  try {
    const snap = await getDocs(query(collection(firestoreDb, 'users'), orderBy('trial_started_at', 'desc')));
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch (err) {
    console.error('loadAllUsersAdmin:', err);
    throw err;
  }
}

export async function founderExtendTrial(targetUid, extraDays = 7) {
  if (!firestoreDb) throw new Error('Firestore unavailable');
  const newStartMs = Date.now() - (7 - extraDays) * 24 * 60 * 60 * 1000;
  await updateDoc(doc(firestoreDb, 'users', targetUid), {
    plan: 'trial',
    trial_started_at: Timestamp.fromMillis(newStartMs),
  });
}

export async function founderSetPlan(targetUid, plan) {
  if (!firestoreDb) throw new Error('Firestore unavailable');
  const validPlans = ['free', 'trial', 'starter', 'hr_finance', 'pro', 'enterprise', 'scale'];
  if (!validPlans.includes(plan)) throw new Error('Invalid plan');
  await updateDoc(doc(firestoreDb, 'users', targetUid), { plan });
}

// Ask the founderAdmin function to backfill missing displayName/email on
// /users docs from Firebase Auth (accounts created while syncuser was broken).
export async function founderEnrichProfiles() {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${FUNCTIONS_BASE}/founderops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ action: 'enrichProfiles' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Profile enrichment failed');
  return data;
}

// ── API key management (server-backed; only hashes are stored) ──────────────
async function callApiKeys(body) {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${FUNCTIONS_BASE}/apikeys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'API key request failed');
  return data;
}
// Directory integrations — credentials are posted once and then held
// server-side. The browser never stores, and can never read back, a vendor
// token. `vendor` is one of slack | okta | github | asana | salesforce | zoom.
export async function integrationCall(vendor, action, credentials) {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${FUNCTIONS_BASE}/integrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ vendor, action, credentials }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Integration request failed');
  return data;
}

// Workspace sharing — read-only viewers via the server-verified endpoint
async function callWorkspace(body) {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${FUNCTIONS_BASE}/workspace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Workspace request failed');
    // A 409 from the write action means somebody else saved first. The flag
    // and the stored revision have to survive being turned into an Error, or
    // the caller cannot tell a conflict from a network failure — and it would
    // then offer a retry that re-sends the same payload and overwrites them.
    if (res.status === 409 && data.conflict) {
      err.isConflict = true;
      err.rev = Number.isFinite(data.rev) ? data.rev : null;
    }
    err.status = res.status;
    throw err;
  }
  return data;
}
export const workspaceInvite  = (email) => callWorkspace({ action: 'invite', email });
export const workspaceMembers = () => callWorkspace({ action: 'members' });
export const workspaceRevoke  = (id) => callWorkspace({ action: 'revoke', id });
export const workspaceMine    = () => callWorkspace({ action: 'mine' });
export const workspaceRead    = (ownerUid) => callWorkspace({ action: 'read', ownerUid });
export const workspaceSetRole = (id, role) => callWorkspace({ action: 'setrole', id, role });
// A member with the editor role saving the owner's data. The browser has no
// Firestore credentials for someone else's workspace — the rules are
// isOwner(uid) — so this is the only write path, and the endpoint decides what
// of the payload it trusts (see functions/workspace-write.js).
export const workspaceWrite   = (ownerUid, data) => callWorkspace({ action: 'write', ownerUid, data });
// Client workspaces an agency manages on its own plan. The id is not an auth
// uid, so there is no direct Firestore path to one — these are the only way in.
export const workspaceCreateOrg = (name) => callWorkspace({ action: 'createorg', name });
export const workspaceListOrgs  = () => callWorkspace({ action: 'listorgs' });
export const workspaceDeleteOrg  = (id) => callWorkspace({ action: 'deleteorg', id });
export const workspaceRestoreOrg = (id) => callWorkspace({ action: 'restoreorg', id });

// Bank feed — GoCardless open-banking connection + recurring-charge sync
async function callBankfeed(body) {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${FUNCTIONS_BASE}/bankfeed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Bank feed request failed');
  return data;
}
export const bankConnect      = () => callBankfeed({ action: 'connect' });
export const bankStatus       = () => callBankfeed({ action: 'status' });
export const bankSync         = () => callBankfeed({ action: 'sync' });
export const bankDisconnect   = () => callBankfeed({ action: 'disconnect' });

// Invoice email inbox — unique per-user address + staged invoices from email
async function callInvoiceInbox(body) {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${FUNCTIONS_BASE}/invoiceInbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Invoice inbox request failed');
  return data;
}
export const invoiceInboxAddress = () => callInvoiceInbox({ action: 'get' });
export const invoiceInboxList    = () => callInvoiceInbox({ action: 'list' });
export const invoiceInboxAck     = (ids) => callInvoiceInbox({ action: 'ack', ids });

export const apiKeysList   = () => callApiKeys({ action: 'list' });
export const apiKeysCreate = (name) => callApiKeys({ action: 'create', name });
export const apiKeysRevoke = (keyId) => callApiKeys({ action: 'revoke', keyId });
export const API_BASE_URL = `${FUNCTIONS_BASE}/api/v1`;

// Permanently delete a user (Auth account + /users + /userdata) via founderAdmin.
export async function founderDeleteUser(targetUid) {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${FUNCTIONS_BASE}/founderops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ action: 'deleteUser', targetUid }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Delete failed');
  return data;
}

// Bank-provider (Bridge) credentials — set/check from the Founder Admin page.
async function callFounderops(body) {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${FUNCTIONS_BASE}/founderops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
export const founderSetBankCreds   = (clientId, clientSecret) => callFounderops({ action: 'setBankCreds', clientId, clientSecret });
export const founderBankCredsStatus = () => callFounderops({ action: 'bankCredsStatus' });
export const founderListErrors      = () => callFounderops({ action: 'listErrors' });

// Founder diagnostic: send a real test email and get SendGrid's response back.
export async function founderTestEmail(to) {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${FUNCTIONS_BASE}/founderops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ action: 'testEmail', to }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.sendgrid_error) throw new Error(data.error || 'Test email failed');
  return data;
}

// ============================================================================
// 7-DAY TRIAL — start trial for a new user
// Sets plan='trial' and trial_started_at on /users/{uid}.
// Best-effort: silently fails if Firestore rules reject (Cloud Function may have already set it).
// ============================================================================

export async function startTrial(uid) {
  if (!firestoreDb) return;
  try {
    await setDoc(
      doc(firestoreDb, 'users', uid),
      {
        plan: 'trial',
        trial_started_at: serverTimestamp(),
      },
      { merge: true }
    );
    track('trial_started');
  } catch (e) {
    console.warn('startTrial failed (continuing on free):', e?.message);
  }
}

/**
 * Delete this account and everything belonging to it.
 *
 * Runs entirely server-side, and has to.
 *
 * The previous version did it from here: delete the Auth user, then delete
 * /userdata/{uid} and /users/{uid}. Three things were wrong with that.
 *
 *   1. It deleted the Auth user FIRST, and the Firestore rules are
 *      isOwner(uid). By the time those two deleteDoc calls ran there was no
 *      signed-in user, so the rules denied them — the account went and the
 *      data very likely stayed.
 *   2. Deleting /userdata/{uid} does not delete /userdata/{uid}/chunks.
 *      Firestore has no cascade. That subcollection holds employees, access
 *      and audit_log, so the names and work email addresses of the customer's
 *      staff survived every deletion.
 *   3. It could not have reached most of the rest even with a valid session:
 *      backups, client_orgs, workspace_members and integration_credentials are
 *      server-only by rule, deliberately. Only a function can clear them.
 *
 * So the browser asks and the server does it, with the Admin SDK, in an order
 * that leaves the account intact until its data is gone. `confirmEmail` must
 * match the caller's verified address — an irreversible erasure should not
 * rest on a single bearer token.
 *
 * Never called on success: the Auth user no longer exists, so there is nothing
 * to sign out of. Local storage is cleared anyway, because a stale blob would
 * otherwise be hydrated by the next person to sign in on this browser.
 */
export async function deleteAccount(confirmEmail) {
  if (!auth) throw new Error('Firebase auth unavailable');
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  await callWorkspace({ action: 'deleteaccount', confirmEmail });
  localStorage.removeItem('saasguard_db');
  localStorage.removeItem('accessguard_v1');
  localStorage.removeItem('sg_auth_uid');
  localStorage.removeItem('sg_own_workspace_backup');
}

