import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  signInWithGoogle, signOutUser, onAuthChange, syncUserProfile,
  getUserPlanFromFirestore, startTrial,
} from '../firebase-config';
import { LS_KEY } from '../lib/constants';
import { loadDb, saveDb, seedDbIfEmpty, setFirestoreUid, hydrateFromFirestore } from '../lib/db';
import { resolvePlan } from '../lib/plan';
import { useDbQuery } from './useDbQuery';

export function useAuth() {
  const qc = useQueryClient();
  const { data: db } = useDbQuery();
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Handle Google redirect result stored in sessionStorage by main.jsx
  useEffect(() => {
    const stored = sessionStorage.getItem('sg_redirect_user');
    if (stored) {
      try {
        const redirectUser = JSON.parse(stored);
        sessionStorage.removeItem('sg_redirect_user');
        setFirestoreUid(redirectUser.uid);
        hydrateFromFirestore(redirectUser.uid).then(cloudDb => {
          const freshDb = cloudDb || {
            user: {}, tools: [], employees: [], access: [],
            contracts: [], invoices: [], licenses: [],
            audit_log: [], settings: {},
          };
          freshDb.user = {
            is_authenticated: true, is_demo: false,
            email:       redirectUser.email,
            displayName: redirectUser.displayName,
            photoURL:    redirectUser.photoURL,
            uid:         redirectUser.uid,
          };
          saveDb(freshDb);
          syncUserProfile({ uid: redirectUser.uid, email: redirectUser.email, displayName: redirectUser.displayName, photoURL: redirectUser.photoURL }).catch(() => {});
          qc.invalidateQueries({ queryKey: ['db'] });
          localStorage.setItem('sg_onboarded_' + redirectUser.uid, 'true');
          window.location.replace('/dashboard');
        });
      } catch (e) { /* ignore parse errors */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        let fsUserExists = false;
        try {
          const tokenResult = await fbUser.getIdTokenResult();
          const claimedPlan = tokenResult.claims?.plan;

          const fsUser = await getUserPlanFromFirestore(fbUser.uid);
          if (fsUser) {
            fsUserExists = true;
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
        } catch (e) { /* default to free */ }

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
          displayName:        fbUser.displayName || fbUser.providerData?.[0]?.displayName,
          photoURL:           fbUser.photoURL,
          uid:                fbUser.uid,
          plan:               effectivePlan,
          stripe_customer_id: stripeCustomerId,
          subscription_status: subscriptionStatus,
          is_founder:         isFounder,
          trial_started_at:   trialStartedAt,
        };
        saveDb(cur);
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

  const login = async () => {
    const { user: googleUser, error } = await signInWithGoogle();
    if (error) { toast.error('Sign in failed: ' + error); return null; }
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
      } catch (e) { /* ignore sync errors */ }
      window.location.replace('/dashboard');
    }
    return googleUser;
  };

  const logout = async () => {
    await signOutUser();
    localStorage.removeItem('sg_auth_uid');
    const cur = seedDbIfEmpty();
    cur.user = { is_authenticated: false, is_demo: false };
    saveDb(cur);
    qc.invalidateQueries({ queryKey: ['db'] });
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
