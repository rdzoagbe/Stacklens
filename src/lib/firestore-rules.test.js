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

describe('/reports — shareable snapshots expire', () => {
  const future = () => Date.now() + 86_400_000;
  const past   = () => Date.now() - 1000;

  it('anyone holding the token may read an unexpired report', async () => {
    await admin(db => setDoc(doc(db, 'reports', 'tok1'), { owner_uid: ALICE, expires_at: future() }));
    await assertSucceeds(getDoc(doc(asAnon(), 'reports', 'tok1')));
  });

  it('an EXPIRED report can no longer be read', async () => {
    await admin(db => setDoc(doc(db, 'reports', 'tok2'), { owner_uid: ALICE, expires_at: past() }));
    await assertFails(getDoc(doc(asAnon(), 'reports', 'tok2')));
  });

  it('a user cannot create a report owned by someone else', async () => {
    await assertFails(setDoc(doc(asAlice(), 'reports', 'tok3'), {
      owner_uid: BOB, expires_at: future(),
    }));
  });

  it('a report cannot be created already-expired or non-expiring', async () => {
    await assertFails(setDoc(doc(asAlice(), 'reports', 'tok4'), { owner_uid: ALICE, expires_at: past() }));
    await assertFails(setDoc(doc(asAlice(), 'reports', 'tok5'), { owner_uid: ALICE }));
  });

  it('only the owner can delete a report, and nobody can edit one', async () => {
    await admin(db => setDoc(doc(db, 'reports', 'tok6'), { owner_uid: ALICE, expires_at: future() }));
    await assertFails(deleteDoc(doc(asBob(), 'reports', 'tok6')));
    await assertFails(updateDoc(doc(asAlice(), 'reports', 'tok6'), { expires_at: future() }));
    await assertSucceeds(deleteDoc(doc(asAlice(), 'reports', 'tok6')));
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
