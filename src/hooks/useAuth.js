import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  signInWithGoogle, signOutUser, onAuthChange,
  getUserPlanFromFirestore, startTrial,
} from '../firebase-config';
import { LS_KEY } from '../lib/constants';
import { loadDb, saveDb, seedDbIfEmpty, setFirestoreUid, hydrateFromFirestore, flushBeforeSignOut, clearLocalWorkspace } from '../lib/db';
import { resolvePlan } from '../lib/plan';
import { useDbQuery } from './useDbQuery';

export function useAuth() {
  const qc = useQueryClient();
  const { data: db } = useDbQuery();
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // There was a 30-line effect here that read a Google redirect result out of
  // sessionStorage under the key 'sg_redirect_user'. Removed 2026-09-16: its
  // body could never run.
  //
  // Nothing wrote that key. The comment on it said "stored in sessionStorage
  // by main.jsx" and main.jsx has never mentioned it. firebase-config's
  // handleRedirectResult() was exported and never called, and grepping the
  // whole of src/ for signInWithRedirect returns nothing — so no redirect
  // sign-in is ever started, and none can come back.
  //
  // Sign-in is popup-only: signInWithGoogle uses signInWithPopup.
  //
  // If redirect sign-in is ever wired up (the honest reason to: signInWithPopup
  // is blocked in iOS in-app browsers, so a visitor arriving from a LinkedIn
  // or Instagram webview can tap Google sign-in and watch nothing happen),
  // do NOT restore what was here. It did
  //
  //   freshDb.user = { is_authenticated: true, ... }
  //
  // with no spread of the existing user, so it discarded every stored user
  // field that Firebase does not re-derive — the same clobber that erased the
  // signup name below, one level up. Merge onto the stored blob instead.
  //
  // signup-flow.test.js fails if the key or the uncalled helper comes back.

  useEffect(() => {
    const unsubscribe = onAuthChange(async (fbUser) => {
      setFirebaseUser(fbUser);
      setLoading(false);

      if (fbUser) {
        let plan = 'free';
        let stripeCustomerId = null;
        let subscriptionStatus = null;
        let isFounder = false;
        let trialStartedAt = null;
        try {
          const tokenResult = await fbUser.getIdTokenResult();
          const claimedPlan = tokenResult.claims?.plan;

          const fsUser = await getUserPlanFromFirestore(fbUser.uid);
          if (fsUser) {
            plan = (claimedPlan && claimedPlan !== 'free') ? claimedPlan : (fsUser.plan || 'free');
            stripeCustomerId   = fsUser.stripe_customer_id  || null;
            subscriptionStatus = fsUser.subscription_status || null;
            isFounder          = fsUser.is_founder === true;
            trialStartedAt     = fsUser.trial_started_at
              ? (typeof fsUser.trial_started_at === 'number'
                  ? fsUser.trial_started_at
                  : (fsUser.trial_started_at?.seconds
                      ? fsUser.trial_started_at.seconds * 1000
                      : Date.parse(fsUser.trial_started_at) || null))
              : null;
          } else if (claimedPlan && claimedPlan !== 'free') {
            plan = claimedPlan;
          }
        } catch { /* default to free */ }

        if (!isFounder && !trialStartedAt && (!plan || plan === 'free') && !stripeCustomerId) {
          plan = 'trial';
          trialStartedAt = Date.now();
          startTrial(fbUser.uid).catch(() => {});
        }

        const effectivePlan = resolvePlan({
          is_founder:      isFounder,
          plan,
          subscription_plan: plan,
          trial_started_at: trialStartedAt,
        });

        // Enable Firestore saves immediately — _firestoreUid was never set for
        // non-redirect sign-ins, so saveDb() silently skipped cloud sync.
        setFirestoreUid(fbUser.uid);

        // Hydrate from Firestore when localStorage is empty (cleared, new device)
        // or on the very first auth event of this browser session.
        // sessionStorage key prevents redundant reads on subsequent navigations.
        const hydratedKey = 'sg_hydrated_' + fbUser.uid;
        const localData = loadDb();
        let cur;
        if (!sessionStorage.getItem(hydratedKey) || !localData) {
          sessionStorage.setItem(hydratedKey, '1');
          const cloudDb = await hydrateFromFirestore(fbUser.uid);
          cur = cloudDb || localData || { user: {}, tools: [], employees: [], access: [], contracts: [], invoices: [], licenses: [] };
        } else {
          cur = localData;
        }

        cur.user = {
          ...cur.user,
          is_authenticated:   true,
          is_demo:            false,
          email:              fbUser.email || fbUser.providerData?.[0]?.email,
          // Falls back to the name already stored, and that last clause is the
          // whole point rather than belt-and-braces.
          //
          // The spread above brings the existing blob in; this key then
          // overwrites it. Without the fallback it overwrites with `undefined`
          // whenever the Firebase user carries no name — and the Auth user
          // restored from persistence on a page load routinely does not, even
          // when updateProfile has since set one on the server.
          //
          // So: signup stores the name (registerWithEmail → saveDisplayName),
          // TrialPage writes it into the blob, TrialPage navigates to
          // /dashboard, and this used to run on that fresh load and erase it.
          // The "What's your name?" gate then asked for the name that had
          // just been given. That gate was removed on 2026-09-16, but the
          // erasure is a bug in its own right.
          //
          // An earlier version of this comment said the sidebar and the
          // Founder view read this field. Both are wrong, and the mistake
          // matters: anyone checking those two places would find the fallback
          // dead and delete it. SidebarFooter reads userProfile.fullName from
          // Firestore, then firebaseUser.displayName, and never the blob;
          // FounderAdminPage reads the /users documents.
          //
          // What actually reads db.user.displayName, verified by grep:
          //
          //   AppShell TopBar          the greeting on every signed-in page,
          //                            falling back to the email prefix
          //   settings/IntegrationsTab userName passed into the integrations UI
          //   finance/LicensesTab      userName, else the string 'IT Admin'
          //   lib/audit.js             the audit actor, after email
          //
          // So without this fallback the top bar greets a new signup by the
          // left half of their email address from their second page view on,
          // and the audit log loses its only non-email actor label.
          displayName:        fbUser.displayName || fbUser.providerData?.[0]?.displayName
                              || cur.user?.displayName || '',
          photoURL:           fbUser.photoURL,
          uid:                fbUser.uid,
          plan:               effectivePlan,
          stripe_customer_id: stripeCustomerId,
          subscription_status: subscriptionStatus,
          is_founder:         isFounder,
          trial_started_at:   trialStartedAt,
        };
        // Bookkeeping, not an edit: every field patched above came from
        // Firebase Auth or the /users document, is re-derived on the next load,
        // and this runs on EVERY auth event — so it used to send the whole
        // chunked blob to Firestore once per page view. saveDb still writes
        // localStorage, and still writes to the cloud if anything in this
        // browser is unsynced. See SYNC_MARK_KEY in lib/db.js.
        saveDb(cur, { cloudSync: false });
        qc.invalidateQueries({ queryKey: ['db'] });
      } else {
        const cur = seedDbIfEmpty();
        if (cur.user?.is_authenticated && !cur.user?.is_demo) {
          cur.user = { ...cur.user, is_authenticated: false, is_demo: false };
          saveDb(cur);
          qc.invalidateQueries({ queryKey: ['db'] });
        }
      }
    });
    return unsubscribe;
  }, [qc]);

  const user    = db?.user || null;
  const isAuthed = Boolean(user?.is_authenticated);
  const isDemo   = Boolean(user?.is_demo);

  const setUser = (patch) => {
    const cur = seedDbIfEmpty();
    cur.user = { ...cur.user, ...patch };
    saveDb(cur);
    qc.invalidateQueries({ queryKey: ['db'] });
  };

  // Returns { user, error } and does NOT toast.
  //
  // It used to do toast.error('Sign in failed: ' + error), which put a raw
  // Firebase string in front of the user — "Sign in failed: Firebase: Error
  // (auth/popup-blocked)." — while the Microsoft button on the same screen
  // mapped the identical failure to a sentence through authErrorKey. Two
  // providers, one screen, two different behaviours.
  //
  // The message cannot be built here: useAuth has no t(). The one caller
  // (TrialPage) has it and already maps the Microsoft path, so the error goes
  // back to it and both providers now run the same three lines.
  const login = async () => {
    const { user: googleUser, error } = await signInWithGoogle();
    if (error) return { user: null, error };
    if (googleUser) {
      const cur = loadDb() || seedDbIfEmpty();
      cur.user = { ...cur.user, is_authenticated: true, is_demo: false, email: googleUser.email, displayName: googleUser.displayName, photoURL: googleUser.photoURL, uid: googleUser.uid };
      saveDb(cur);
      qc.invalidateQueries({ queryKey: ['db'] });
      try {
        const token = await googleUser.getIdToken();
        const r = await fetch('https://us-central1-accessguard-v2.cloudfunctions.net/syncuser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ email: googleUser.email, displayName: googleUser.displayName }),
        });
        const data = await r.json();
        if (data.plan && data.plan !== 'free') {
          const raw = localStorage.getItem('accessguard_v1');
          const db2 = raw ? JSON.parse(raw) : {};
          db2.user.plan = data.plan;
          db2.user.subscription_plan = data.plan;
          setTimeout(() => window.location.reload(), 500);
          db2.user.stripe_customer_id  = data.stripe_customer_id;
          db2.user.subscription_status = data.subscription_status;
          localStorage.setItem('accessguard_v1', JSON.stringify(db2));
        }
      } catch { /* ignore sync errors */ }
      window.location.replace('/dashboard');
    }
    return { user: googleUser, error: null };
  };

  // Signing out removes this account's data from the browser (see
  // clearLocalWorkspace in lib/db). If the cloud may not yet hold everything,
  // it resolves { needsConfirm: true } without signing out, and the caller asks
  // the user; logout({ force: true }) then signs out and discards.
  const logout = async ({ force = false } = {}) => {
    if (!force && !(await flushBeforeSignOut())) return { needsConfirm: true };
    await signOutUser();
    clearLocalWorkspace();
    localStorage.removeItem('sg_auth_uid');
    const cur = seedDbIfEmpty();
    cur.user = { is_authenticated: false, is_demo: false };
    saveDb(cur);
    qc.invalidateQueries({ queryKey: ['db'] });
    return { ok: true };
  };

  const startDemo = () => {
    localStorage.removeItem(LS_KEY);
    const demoDb = seedDbIfEmpty();
    demoDb.user = { is_demo: true, is_authenticated: false, plan: 'demo', subscription_plan: 'demo', email: 'demo@accessguard.app', displayName: 'Demo User' };
    saveDb(demoDb);
    qc.invalidateQueries({ queryKey: ['db'] });
  };

  const endDemo = () => setUser({ is_demo: false });

  return { user, isAuthed, isDemo, login, logout, startDemo, endDemo, firebaseUser, loading };
}
