import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Firestore security rules ────────────────────────────────────────────────
//
// These rules are the entire multi-tenant boundary: everything that keeps one
// customer's employee directory, access map and billing state separate from
// another's. Until now they had never been executed by a test — only read.
//
// Runs against the Firestore emulator. No network, no real project.

const ALICE = 'uid_alice';
const BOB   = 'uid_bob';
// Matches the hardcoded founder UID in firestore.rules.
const FOUNDER_UID   = 'bxIYrZ76z1QKo5ZMpGvEG8GGbNM2';
const FOUNDER_EMAIL = 'rolanddzoagbe@gmail.com';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'stacklens-rules-test',
    firestore: {
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
}, 120_000);

afterAll(async () => { if (testEnv) await testEnv.cleanup(); });
beforeEach(async () => { if (testEnv) await testEnv.clearFirestore(); });

const asAlice   = () => testEnv.authenticatedContext(ALICE).firestore();
const asBob     = () => testEnv.authenticatedContext(BOB).firestore();
const asAnon    = () => testEnv.unauthenticatedContext().firestore();
const asFounder = () => testEnv.authenticatedContext(FOUNDER_UID, { email: FOUNDER_EMAIL }).firestore();
const admin     = (fn) => testEnv.withSecurityRulesDisabled(ctx => fn(ctx.firestore()));

describe('/userdata — the tenant boundary', () => {
  it('an owner reads and writes their own data', async () => {
    await assertSucceeds(setDoc(doc(asAlice(), 'userdata', ALICE), { tools: [] }));
    await assertSucceeds(getDoc(doc(asAlice(), 'userdata', ALICE)));
  });

  it("another signed-in customer CANNOT read someone else's data", async () => {
    await admin(db => setDoc(doc(db, 'userdata', ALICE), { tools: [{ name: 'Secret CRM' }] }));
    await assertFails(getDoc(doc(asBob(), 'userdata', ALICE)));
  });

  it("another signed-in customer CANNOT write over someone else's data", async () => {
    await assertFails(setDoc(doc(asBob(), 'userdata', ALICE), { tools: [] }));
  });

  it('an anonymous visitor cannot read any customer data', async () => {
    await admin(db => setDoc(doc(db, 'userdata', ALICE), { tools: [] }));
    await assertFails(getDoc(doc(asAnon(), 'userdata', ALICE)));
  });

  it('the chunk subcollection is protected too, not just the parent doc', async () => {
    // Rules do not cascade to subcollections; the large arrays (employees,
    // access, audit_log) live in /userdata/{uid}/chunks and would be readable
    // by anyone if that grant were ever dropped.
    await admin(db => setDoc(doc(db, 'userdata', ALICE, 'chunks', 'employees_0'), { rows: ['pii'] }));
    await assertFails(getDoc(doc(asBob(), 'userdata', ALICE, 'chunks', 'employees_0')));
    await assertSucceeds(getDoc(doc(asAlice(), 'userdata', ALICE, 'chunks', 'employees_0')));
  });

  it('even the founder cannot read a customer’s userdata from the client', async () => {
    await admin(db => setDoc(doc(db, 'userdata', ALICE), { tools: [] }));
    await assertFails(getDoc(doc(asFounder(), 'userdata', ALICE)));
  });
});

describe('/users — billing fields cannot be set from the browser', () => {
  it('a user may create their own doc with plan=free', async () => {
    await assertSucceeds(setDoc(doc(asAlice(), 'users', ALICE), { plan: 'free', email: 'a@x.com' }));
  });

  it('a user CANNOT grant themselves a paid plan', async () => {
    await admin(db => setDoc(doc(db, 'users', ALICE), { plan: 'free' }));
    await assertFails(updateDoc(doc(asAlice(), 'users', ALICE), { plan: 'enterprise' }));
  });

  it('a user CANNOT set is_founder', async () => {
    await admin(db => setDoc(doc(db, 'users', ALICE), { plan: 'free' }));
    await assertFails(updateDoc(doc(asAlice(), 'users', ALICE), { is_founder: true }));
  });

  it('a user CANNOT set a Stripe subscription id or status', async () => {
    await admin(db => setDoc(doc(db, 'users', ALICE), { plan: 'free' }));
    await assertFails(updateDoc(doc(asAlice(), 'users', ALICE), { stripe_subscription_id: 'sub_123' }));
    await assertFails(updateDoc(doc(asAlice(), 'users', ALICE), { subscription_status: 'active' }));
  });

  it('a user CANNOT escalate their role', async () => {
    await admin(db => setDoc(doc(db, 'users', ALICE), { plan: 'free' }));
    await assertFails(updateDoc(doc(asAlice(), 'users', ALICE), { role: 'admin' }));
  });

  it('a user may update a harmless profile field', async () => {
    await admin(db => setDoc(doc(db, 'users', ALICE), { plan: 'free' }));
    await assertSucceeds(updateDoc(doc(asAlice(), 'users', ALICE), { displayName: 'Alice' }));
  });

  it("nobody can read another user's billing doc", async () => {
    await admin(db => setDoc(doc(db, 'users', ALICE), { plan: 'pro' }));
    await assertFails(getDoc(doc(asBob(), 'users', ALICE)));
  });

  it('nobody can delete a user doc', async () => {
    await admin(db => setDoc(doc(db, 'users', ALICE), { plan: 'free' }));
    await assertFails(deleteDoc(doc(asAlice(), 'users', ALICE)));
  });

  it('a non-founder cannot list all users', async () => {
    await assertFails(getDocs(collection(asAlice(), 'users')));
  });
});

describe('/users — the trial cannot be replayed', () => {
  it('a free user may self-start a trial once', async () => {
    await admin(db => setDoc(doc(db, 'users', ALICE), { plan: 'free' }));
    await assertSucceeds(updateDoc(doc(asAlice(), 'users', ALICE), {
      plan: 'trial', trial_started_at: Date.now(),
    }));
  });

  it('a user CANNOT move the trial stamp to extend the trial', async () => {
    await admin(db => setDoc(doc(db, 'users', ALICE), { plan: 'trial', trial_started_at: 1000 }));
    await assertFails(updateDoc(doc(asAlice(), 'users', ALICE), { trial_started_at: Date.now() }));
  });

  it('a user CANNOT clear the stamp and restart the trial', async () => {
    // The replay attack: drop back to free, wipe the stamp, start again.
    await admin(db => setDoc(doc(db, 'users', ALICE), { plan: 'trial', trial_started_at: 1000 }));
    await assertFails(updateDoc(doc(asAlice(), 'users', ALICE), {
      plan: 'free', trial_started_at: null,
    }));
  });

  it('an expired trial user cannot start a second trial', async () => {
    await admin(db => setDoc(doc(db, 'users', ALICE), { plan: 'free', trial_started_at: 1000 }));
    await assertFails(updateDoc(doc(asAlice(), 'users', ALICE), {
      plan: 'trial', trial_started_at: Date.now(),
    }));
  });

  it('a user cannot smuggle a paid plan in alongside the trial start', async () => {
    await admin(db => setDoc(doc(db, 'users', ALICE), { plan: 'free' }));
    await assertFails(updateDoc(doc(asAlice(), 'users', ALICE), {
      plan: 'trial', trial_started_at: Date.now(), subscription_plan: 'enterprise',
    }));
  });
});

describe('/integration_credentials — vendor secrets are server-only', () => {
  it('the owner cannot read back their own stored Zoom secret', async () => {
    await admin(db => setDoc(doc(db, 'integration_credentials', ALICE), {
      zoom: { clientSecret: 'super-secret' },
    }));
    await assertFails(getDoc(doc(asAlice(), 'integration_credentials', ALICE)));
  });

  it('nobody can write a credential document from the client', async () => {
    await assertFails(setDoc(doc(asAlice(), 'integration_credentials', ALICE), { zoom: {} }));
  });

  it('another customer certainly cannot read it', async () => {
    await admin(db => setDoc(doc(db, 'integration_credentials', ALICE), { zoom: {} }));
    await assertFails(getDoc(doc(asBob(), 'integration_credentials', ALICE)));
  });
});

describe('/rate_limits — readable by the owner, never writable', () => {
  it('a user cannot reset their own rate limit', async () => {
    await admin(db => setDoc(doc(db, 'rate_limits', `ai_${ALICE}`), { count: 20 }));
    await assertFails(setDoc(doc(asAlice(), 'rate_limits', `ai_${ALICE}`), { count: 0 }));
  });
});

describe('/consent_logs — append-only, schema-enforced', () => {
  const valid = {
    choice: 'accepted', version: 'v2', userAgent: 'Mozilla/5.0',
    language: 'fr', timestamp: serverTimestamp(),
  };

  it('an anonymous visitor may record a consent choice', async () => {
    await assertSucceeds(setDoc(doc(asAnon(), 'consent_logs', 'log1'), valid));
  });

  it('nobody can read the consent trail back', async () => {
    await admin(db => setDoc(doc(db, 'consent_logs', 'log1'), { choice: 'accepted' }));
    await assertFails(getDoc(doc(asAlice(), 'consent_logs', 'log1')));
  });

  it('a consent record cannot be altered or deleted after the fact', async () => {
    await admin(db => setDoc(doc(db, 'consent_logs', 'log1'), { choice: 'accepted' }));
    await assertFails(updateDoc(doc(asAlice(), 'consent_logs', 'log1'), { choice: 'rejected' }));
    await assertFails(deleteDoc(doc(asAlice(), 'consent_logs', 'log1')));
  });

  it('an arbitrary choice value is rejected', async () => {
    await assertFails(setDoc(doc(asAnon(), 'consent_logs', 'log2'), { ...valid, choice: 'whatever' }));
  });

  it('an oversized userAgent is rejected (storage-abuse guard)', async () => {
    await assertFails(setDoc(doc(asAnon(), 'consent_logs', 'log3'), {
      ...valid, userAgent: 'x'.repeat(400),
    }));
  });

  it('a back-dated timestamp is rejected', async () => {
    await assertFails(setDoc(doc(asAnon(), 'consent_logs', 'log4'), { ...valid, timestamp: 0 }));
  });
});

describe('/legal_acceptances — you can only accept as yourself', () => {
  it('a signed-in user may record their own acceptance', async () => {
    await assertSucceeds(setDoc(doc(asAlice(), 'legal_acceptances', 'a1'), {
      uid: ALICE, documents: ['terms', 'privacy'], accepted_at: serverTimestamp(),
    }));
  });

  it('a user CANNOT record an acceptance in another user’s name', async () => {
    await assertFails(setDoc(doc(asAlice(), 'legal_acceptances', 'a2'), {
      uid: BOB, documents: ['terms'], accepted_at: serverTimestamp(),
    }));
  });

  it('an anonymous visitor cannot record an acceptance', async () => {
    await assertFails(setDoc(doc(asAnon(), 'legal_acceptances', 'a3'), {
      uid: ALICE, documents: ['terms'], accepted_at: serverTimestamp(),
    }));
  });
});

// ── /reports is closed, and stays closed ──────────────────────────────────
//
// This collection had a rule permitting an unauthenticated read of any
// unexpired token, for a shareable-report feature that was never finished:
// /report/:token rendered <NotFound> and nothing ever called saveReport, so
// no document could exist for the rule to hand out. The rule, the three
// client functions and the route were removed together.
//
// Replacing the five tests that covered that rule with these two is
// deliberate: deleting coverage for a removed rule leaves nothing to notice
// if the rule comes back without the page.

describe('/reports stays closed', () => {
  it('is unreadable, even to its own signed-in owner', async () => {
    await admin(db => setDoc(doc(db, 'reports', 'tok1'), {
      owner_uid: ALICE, expires_at: Date.now() + 86_400_000,
    }));
    await assertFails(getDoc(doc(asAnon(), 'reports', 'tok1')));
    await assertFails(getDoc(doc(asAlice(), 'reports', 'tok1')));
  });

  it('cannot be written to', async () => {
    await assertFails(setDoc(doc(asAlice(), 'reports', 'tok2'), {
      owner_uid: ALICE, expires_at: Date.now() + 86_400_000,
    }));
  });
});

describe('default deny — an unlisted collection is closed', () => {
  it('a signed-in user cannot invent a collection and write to it', async () => {
    await assertFails(setDoc(doc(asAlice(), 'anything_else', 'x'), { a: 1 }));
    await assertFails(getDoc(doc(asAlice(), 'anything_else', 'x')));
  });

  it('server-only collections used by Cloud Functions are unreachable', async () => {
    for (const path of ['workspace_members', 'bank_requisitions', 'api_keys', 'inbox_tokens']) {
      await assertFails(getDoc(doc(asAlice(), path, ALICE)));
      await assertFails(setDoc(doc(asAlice(), path, ALICE), { a: 1 }));
    }
  });
});

// ── Starting a trial: the path every new signup takes ──────────────────────
//
// Reported from production: a brand-new email/password signup logged
// "startTrial failed (continuing on free): Missing or insufficient
// permissions" and landed on the free plan. Silently — startTrial swallows
// the error by design, so nobody finds out except by reading the console.
//
// The rules LOOK like they allow it (protectedFieldsSafe has an isTrialStart
// branch, trialStampImmutable permits the first stamp), which is exactly why
// this needs executing rather than reading. These cases are the shapes the
// /users document can actually be in when startTrial runs.
describe('a new signup can start their trial', () => {
  // Byte-for-byte what src/firebase-config.js startTrial() sends.
  const startTrial = (db, uid) => setDoc(
    doc(db, 'users', uid),
    { plan: 'trial', trial_started_at: serverTimestamp() },
    { merge: true },
  );

  it('with no /users document yet', async () => {
    await assertSucceeds(startTrial(asAlice(), ALICE));
  });

  it('with the document exactly as the syncuser function creates it', async () => {
    // functions/index.js syncuser: set({ uid, email, displayName, photoURL,
    // plan: 'free', createdAt, updatedAt, last_seen_at })
    await admin(db => setDoc(doc(db, 'users', ALICE), {
      uid: ALICE, email: 'a@b.com', displayName: 'Jay tester', photoURL: '',
      plan: 'free', createdAt: Date.now(), updatedAt: Date.now(),
      last_seen_at: Date.now(),
    }));
    await assertSucceeds(startTrial(asAlice(), ALICE));
  });

  it('with billing fields present but empty', async () => {
    // A doc the Stripe webhook has touched and cleared, or one carrying the
    // nulls syncuser reports back. These keys are in the protected list, and
    // on a merge write request.resource.data is the MERGED document — so if
    // their mere presence blocked the trial branch, no such user could ever
    // start one.
    await admin(db => setDoc(doc(db, 'users', ALICE), {
      uid: ALICE, email: 'a@b.com', plan: 'free',
      stripe_customer_id: null, subscription_status: null,
    }));
    await assertSucceeds(startTrial(asAlice(), ALICE));
  });

  it('with a role field present', async () => {
    await admin(db => setDoc(doc(db, 'users', ALICE), {
      uid: ALICE, email: 'a@b.com', plan: 'free', role: 'owner',
    }));
    await assertSucceeds(startTrial(asAlice(), ALICE));
  });

  it('but NOT from a paid plan — no self-upgrade to trial', async () => {
    // Found by mutation: removing the replay guard from isTrialStart left all
    // 44 tests green, because trialStampImmutable independently blocks a
    // SECOND stamp. What the guard uniquely protects is this — `trial` is
    // tier 4, the same as scale, so a starter or pro subscriber who has never
    // had a trial could grant themselves full access by writing plan='trial'.
    // The stamp then freezes, so it is once per account, which is exactly
    // once too many.
    await admin(db => setDoc(doc(db, 'users', ALICE), {
      uid: ALICE, email: 'a@b.com', plan: 'starter',
    }));
    await assertFails(startTrial(asAlice(), ALICE));
  });

  it('but NOT twice — the trial stamp still cannot be replayed', async () => {
    // The protection this must not weaken.
    await admin(db => setDoc(doc(db, 'users', ALICE), {
      uid: ALICE, plan: 'trial', trial_started_at: new Date('2026-01-01'),
    }));
    await assertFails(startTrial(asAlice(), ALICE));
  });
});

// ── A token with no email claim must not break the rules ───────────────────
//
// Found by the emulator while reproducing the trial bug, not by reading:
//
//   evaluation error at L93:24 for 'update' … Property email is undefined
//
// isFounder() evaluates isFounderEmail() first, and that dereferences
// request.auth.token.email. In Firestore rules, reading a property that is not
// there is not "false" — it is an evaluation ERROR, which aborts the whole
// expression and denies.
//
// The sting is that the rules already know this can happen: the comment above
// isFounderUid() says the allowlist exists BECAUSE the founder's Google
// sign-in has no email claim. So the one account the UID fallback was written
// for is the account whose token makes the check before it throw — and an
// error short-circuits the `||` before the fallback is ever reached.
describe('rules survive a token with no email claim', () => {
  const noEmail = () => testEnv.authenticatedContext('uid_no_email').firestore();

  it('the founder UID fallback still works when the token carries no email', async () => {
    // The founder's own token, as the rules comment describes it: right uid,
    // no email claim. If isFounderEmail() throws first, the founder is denied
    // their own admin access.
    const founderNoEmail = () => testEnv.authenticatedContext(FOUNDER_UID).firestore();
    await assertSucceeds(getDocs(collection(founderNoEmail(), 'users')));
  });

  it('an ordinary user with no email claim is denied cleanly, not by an error', async () => {
    // Same outcome either way here, but an evaluation error means the rule
    // stopped being evaluated — so nothing after it can be trusted.
    await assertFails(getDocs(collection(noEmail(), 'users')));
  });
});
