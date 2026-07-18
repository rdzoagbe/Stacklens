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
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
  deleteUser,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  getIdToken,
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
} from 'firebase/firestore';
import { getAnalytics, isSupported, setConsent as firebaseSetConsent } from 'firebase/analytics';
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

if (!FIREBASE_CONFIGURED) {
  console.warn(
    '[Stacklens] Firebase config missing — running in offline/demo mode. ' +
    'Set VITE_FIREBASE_* in your .env file to enable auth and cloud sync.'
  );
}

const app = initializeApp(firebaseConfig);

// ── App Check (anti-bot protection) ──────────────────────────────
// TEMPORARILY DISABLED. The reCAPTCHA v3 registration for this web app is
// broken (exchangeRecaptchaV3Token returns 400), so App Check can't mint a
// token. With it initialized, the Auth SDK keeps trying to attach a failing
// App Check token to token refreshes, which corrupts the ID token flow and
// causes 401s on auth-gated calls (checkout, AI, Firestore). Since App Check
// currently provides zero protection (broken + monitoring mode), we skip
// initializing it. Re-enable once the reCAPTCHA v3 key is re-registered in
// Firebase Console → App Check, then flip APP_CHECK_ENABLED back on.
const APP_CHECK_ENABLED = false;
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
      // If consent was given on a prior visit (stored in localStorage), apply it now
      try {
        const raw = localStorage.getItem('cookie_consent_v2');
        if (raw) {
          const stored = JSON.parse(raw);
          if (stored && stored.choice === 'accepted') {
            firebaseSetConsent({
              analytics_storage: 'granted',
              ad_storage: 'granted',
              ad_user_data: 'granted',
              ad_personalization: 'granted',
            });
          }
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
    return snap.exists() ? snap.data() : null;
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

export async function saveUserData(uid, db) {
  if (!firestoreDb) return;
  try {
    await setDoc(
      doc(firestoreDb, 'userdata', uid),
      { ...db, _uid: uid, _updatedAt: Date.now() },
      { merge: false }
    );
  } catch (err) {
    console.error('saveUserData:', err);
    throw err;
  }
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
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/popup-blocked':
    case 'auth/user-cancelled':           return '';   // user dismissed — stay silent
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

export async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) return { user: result.user, error: null };
    return { user: null, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
}

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
export async function registerWithEmail(email, password, _displayName) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(result.user);
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
    await sendEmailVerification(auth.currentUser);
    return { error: null };
  } catch (error) {
    return { error: error.message };
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

// ============================================================================
// 7-DAY TRIAL — start trial for a new user
// Sets plan='trial' and trial_started_at on /users/{uid}.
// Best-effort: silently fails if Firestore rules reject (Cloud Function may have already set it).
// ============================================================================
export async function saveReport(token, payload) {
  if (!firestoreDb) throw new Error('Firestore unavailable');
  try {
    await setDoc(doc(firestoreDb, 'reports', token), payload);
  } catch (err) {
    console.error('saveReport:', err);
    throw err;
  }
}

export async function getReport(token) {
  if (!firestoreDb) return null;
  try {
    const snap = await getDoc(doc(firestoreDb, 'reports', token));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error('getReport:', err);
    return null;
  }
}

export async function deleteReport(token) {
  if (!firestoreDb) return;
  try {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(firestoreDb, 'reports', token));
  } catch (err) {
    console.error('deleteReport:', err);
    throw err;
  }
}

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
  } catch (e) {
    console.warn('startTrial failed (continuing on free):', e?.message);
  }
}

export async function deleteAccount() {
  if (!auth) throw new Error('Firebase auth unavailable');
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const uid = user.uid;
  // Delete auth account first — if this fails with auth/requires-recent-login,
  // Firestore data is still intact and the user can re-authenticate and retry.
  await deleteUser(user);
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(firestoreDb, 'userdata', uid));
  await deleteDoc(doc(firestoreDb, 'users', uid));
  localStorage.removeItem('saasguard_db');
  localStorage.removeItem('accessguard_v1');
}

