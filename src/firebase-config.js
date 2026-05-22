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
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
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
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
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

// Sanity check — fail loud in dev if env vars aren't set
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    '❌ Firebase config missing! Make sure your .env file has VITE_FIREBASE_* variables set. ' +
    'See .env.example for the template.'
  );
}

const app             = initializeApp(firebaseConfig);

// ── App Check (anti-bot protection) ──────────────────────────────
// Activates only when VITE_RECAPTCHA_SITE_KEY is set in .env
// Silently does nothing otherwise — so local dev works without a key
try {
  const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (typeof window !== 'undefined' && recaptchaKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
} catch (e) {
  console.warn('App Check initialization skipped:', e?.message);
}

const auth            = getAuth(app);
const firestoreDb     = getFirestore(app);
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
        try { firebaseSetConsent(consentState); } catch (e) { /* silent */ }
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
      } catch (e) { /* silent */ }
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
// AI PROXY — Anthropic calls go through Cloud Function only
// ============================================================================
export async function callAI({ messages, system, max_tokens = 2000 }) {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${FUNCTIONS_BASE}/ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ messages, system, max_tokens }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'AI call failed');
  return data;
}

// ============================================================================
// FIRESTORE DATA LAYER
// /userdata/{uid} → { tools, employees, access, user }
// ============================================================================
export async function loadUserData(uid) {
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
  try {
    const snap = await getDoc(doc(firestoreDb, 'users', uid));
    if (snap.exists()) return snap.data();
    return null;
  } catch(e) {
    return null;
  }
}

export async function saveUserData(uid, db) {
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
  try {
    const token = await getIdToken(user);
    const res = await fetch(`${FUNCTIONS_BASE}/syncuser`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        email:       user.email,
        displayName: user.displayName,
        photoURL:    user.photoURL,
      }),
    });
    return await res.json();
  } catch (err) {
    console.error('syncUserProfile:', err);
    return { isNew: false };
  }
}

// ============================================================================
// AUTHENTICATION
// ============================================================================
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
// 7-DAY TRIAL — start trial for a new user
// Sets plan='trial' and trial_started_at on /users/{uid}.
// Best-effort: silently fails if Firestore rules reject (Cloud Function may have already set it).
// ============================================================================
export async function startTrial(uid) {
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
    // Likely a rules rejection — that's OK, the user is just on free tier
    console.warn('startTrial failed (continuing on free):', e?.message);
  }
}

