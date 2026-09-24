// ── Deleting an account, and everything it means ────────────────────────────
//
// This existed in two places and both were wrong in the same way.
//
//   src/firebase-config.js deleteAccount()  deleted /userdata/{uid} and
//                                          /users/{uid}
//   functions/index.js founderops deleteUser  the same two, plus the Auth user
//
// Firestore does not cascade a document delete to its subcollections. So
// /userdata/{uid}/chunks/* survived both — and that subcollection is where the
// large arrays live: `employees`, `access` and `audit_log`. Names and work
// email addresses of the customer's staff, who are third parties that never
// signed up for anything, sitting in Firestore indefinitely.
//
// Against a DPA that says "After termination: deleted within 30 days".
//
// purgeClientOrgs did delete the chunks, correctly, which is what makes this
// drift rather than an oversight: three code paths doing one job, and the two
// that a customer actually reaches were the broken ones.
//
// So the job is defined once, here, and both paths call it.
//
// Two properties this module exists to guarantee, beyond deleting the chunks:
//
//   1. The Auth account goes LAST. Every Firestore delete happens first, while
//      the caller could still retry — if the Auth user is removed first and a
//      later step fails, there is no session left to retry with and no user
//      left to ask. That is why the client-side version could not be fixed in
//      place: it deleted Auth first, at which point the rules (isOwner(uid))
//      deny its own follow-up writes, so it very likely left everything
//      behind. The Admin SDK has no such dependency.
//
//   2. Nothing is forgotten. Per-user data is spread over a dozen
//      collections keyed three different ways — by document id, by a `uid`
//      field, by a composite id. PURGED and RETAINED below are a manifest of
//      every one of them, and purge-account.test.js fails if the codebase
//      grows a collection that appears in neither. A new per-user collection
//      added next year cannot quietly escape deletion.

/** Collections whose per-user rows this purge removes, and how each is keyed. */
const PURGED = {
  // Keyed by the uid itself.
  userdata:                 { by: 'doc-id', subcollections: ['chunks'] },
  users:                    { by: 'doc-id' },
  integration_credentials:  { by: 'doc-id' },   // stored vendor secrets
  bank_requisitions:        { by: 'doc-id' },
  alert_state:              { by: 'doc-id' },
  inbox_invoices:           { by: 'doc-id', subcollections: ['items'] },
  // Keyed by a field, so they need a query.
  backups:                  { by: 'field', field: 'uid', subcollections: ['chunks'] },
  api_keys:                 { by: 'field', field: 'uid' },
  inbox_tokens:             { by: 'field', field: 'uid' },
  // Memberships point at the account from both directions: ones it granted to
  // other people, and ones other people granted to it. Leaving either behind
  // leaves a live grant naming a user who no longer exists.
  workspace_members:        { by: 'field', field: ['owner_uid', 'member_uid', 'member_email'] },
  // An agency's client workspaces are its data. Each one is a whole workspace
  // of its own — userdata document, chunks, backups — so they recurse.
  client_orgs:              { by: 'field', field: 'owner_uid', recurses: true },
  // Composite ids: `${prefix}_${uid}`.
  rate_limits:              { by: 'prefixed-id' },
};

/**
 * Collections deliberately left alone, with the reason.
 *
 * Deleting these would break a different promise, so "delete everything" is
 * the wrong instinct here. The manifest test requires every collection to be
 * classified, which forces the reason to be written down rather than implied
 * by absence.
 */
const RETAINED = {
  // The DPA commits to keeping cookie-consent records for three years (CNIL).
  // They carry no uid.
  consent_logs: 'CNIL: 3-year audit trail, not keyed to the account',
  // Evidence that this account accepted the Terms and DPA. French law expects
  // contract evidence to survive the contract; the row is a uid, a list of
  // document versions and a timestamp, which after deletion identifies nobody.
  legal_acceptances: 'contract evidence, required after termination',
  // Uncaught client errors. No uid is recorded, and the collection self-prunes
  // past 300 rows.
  client_errors: 'no uid recorded; self-pruning',
  // Global configuration, not user data.
  app_config: 'not user data',
  // One document holding crash fingerprints and alert send times, so a broken
  // deploy sends one email instead of one per visitor. Not keyed to an account
  // and not per-user: a fingerprint is a crash message with urls, ids and
  // numbers stripped out, which is why it groups the same bug across users in
  // the first place. Nothing here identifies anybody, and there is no account
  // whose deletion it could belong to.
  crash_alert_state: 'global alert bookkeeping, not keyed to any account',
  // Subcollection names, reached through their parents above.
  chunks: 'subcollection of userdata and backups',
  items: 'subcollection of inbox_invoices',
};

/** Every rate-limit prefix in use. MUST match the checkRateLimit callers. */
const RATE_LIMIT_PREFIXES = [
  'ai', 'api', 'bankfeed', 'checkout', 'founderAdmin', 'integrations',
  'invite', 'portal', 'syncuser', 'workspace',
];

const BATCH_LIMIT = 400;

/** Delete every document a query returns, in batches Firestore will accept. */
async function deleteDocs(db, docs) {
  let batch = db.batch();
  let n = 0;
  let written = 0;
  for (const ref of docs) {
    batch.delete(ref);
    written++;
    if (++n % BATCH_LIMIT === 0) { await batch.commit(); batch = db.batch(); }
  }
  if (n % BATCH_LIMIT !== 0 || n === 0) await batch.commit();
  return written;
}

/** Delete a named subcollection under one document. */
async function deleteSubcollection(docRef, name, db) {
  const snap = await docRef.collection(name).get();
  return deleteDocs(db, snap.docs.map(d => d.ref));
}

/**
 * One workspace: its chunks, its document, and every backup snapshot of it.
 *
 * Used for the account's own workspace and, recursively, for each client
 * workspace an agency owned — a client workspace is not a row, it is a whole
 * workspace, and deleting only the org record would orphan its data exactly
 * the way deleting /userdata orphaned its chunks.
 */
async function purgeWorkspace(db, workspaceId) {
  const counts = { chunks: 0, userdata: 0, backups: 0, backup_chunks: 0 };
  const ref = db.collection('userdata').doc(workspaceId);

  // Subcollection first: once the parent document is gone the subcollection is
  // unreachable by path and stays in Firestore forever. That ordering IS the
  // bug this module was written for.
  counts.chunks += await deleteSubcollection(ref, 'chunks', db);
  await ref.delete();
  counts.userdata += 1;

  const backups = await db.collection('backups').where('uid', '==', workspaceId).get();
  for (const b of backups.docs) {
    counts.backup_chunks += await deleteSubcollection(b.ref, 'chunks', db);
    await b.ref.delete();
    counts.backups += 1;
  }
  return counts;
}

/** Add the second object's counts into the first. */
function addCounts(into, more) {
  for (const [k, v] of Object.entries(more)) into[k] = (into[k] || 0) + v;
  return into;
}

/**
 * Remove an account and all of its data.
 *
 * `deleteAuthUser` is injected rather than imported so the order of operations
 * can be asserted in a test, and so a caller that has already removed the Auth
 * user (or must not) can pass a no-op.
 *
 * Returns a count per collection. Callers log it: "deleted an account" with no
 * numbers is indistinguishable from a purge that silently did nothing.
 */
async function purgeAccount(db, uid, { email = '', deleteAuthUser } = {}) {
  if (!uid || typeof uid !== 'string') throw new Error('uid required');
  const counts = {};

  // The account's own workspace.
  addCounts(counts, await purgeWorkspace(db, uid));

  // Client workspaces it owned, each a workspace in its own right.
  const orgs = await db.collection('client_orgs').where('owner_uid', '==', uid).get();
  for (const org of orgs.docs) {
    addCounts(counts, await purgeWorkspace(db, org.id));
    await org.ref.delete();
    counts.client_orgs = (counts.client_orgs || 0) + 1;
  }

  // Documents keyed by the uid.
  for (const name of ['users', 'integration_credentials', 'bank_requisitions', 'alert_state']) {
    const ref = db.collection(name).doc(uid);
    await ref.delete();
    counts[name] = (counts[name] || 0) + 1;
  }

  // inbox_invoices holds its rows in an `items` subcollection.
  const inboxRef = db.collection('inbox_invoices').doc(uid);
  counts.inbox_items = await deleteSubcollection(inboxRef, 'items', db);
  await inboxRef.delete();
  counts.inbox_invoices = 1;

  // Rows found by a field.
  for (const [name, field] of [['api_keys', 'uid'], ['inbox_tokens', 'uid']]) {
    const snap = await db.collection(name).where(field, '==', uid).get();
    counts[name] = await deleteDocs(db, snap.docs.map(d => d.ref));
  }

  // Memberships in both directions. The email query is skipped when no
  // verified email is known — a query on '' would match rows belonging to
  // everyone whose member_email was never set.
  const memberRefs = [];
  for (const [field, value] of [['owner_uid', uid], ['member_uid', uid], ['member_email', email]]) {
    if (!value) continue;
    const snap = await db.collection('workspace_members').where(field, '==', value).get();
    for (const d of snap.docs) memberRefs.push(d.ref);
  }
  counts.workspace_members = await deleteDocs(
    db, [...new Map(memberRefs.map(r => [r.path, r])).values()],
  );

  // Composite ids.
  counts.rate_limits = await deleteDocs(
    db, RATE_LIMIT_PREFIXES.map(p => db.collection('rate_limits').doc(`${p}_${uid}`)),
  );

  // Auth LAST. Everything above is retryable while the account still exists;
  // once the Auth user is gone there is no session to retry with.
  if (typeof deleteAuthUser === 'function') {
    await deleteAuthUser(uid);
    counts.auth = 1;
  }
  return counts;
}

// ── A subscription that is still billing blocks deletion ────────────────────
//
// purgeAccount erases /users/{uid}, which is the only record that links a
// Stripe customer back to a Stacklens account. It does not touch Stripe. So
// an account deleted while its subscription was live would have gone on being
// charged every month, with nothing left on our side to map the charge to or
// stop it from. The endpoint shipped without a button, so this never
// happened; wiring the button is what would have made it happen.
//
// Deletion is therefore refused while Stripe can still bill, and allowed as
// soon as the customer has cancelled — including a cancellation that takes
// effect at the end of the paid period, which the webhook now records.

/** Stripe statuses under which a future invoice can still be raised. */
const BILLING_STATUSES = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'];

/** True when deleting now would leave a subscription charging a deleted account. */
function subscriptionBlocksDeletion(userDoc) {
  if (!userDoc || !userDoc.stripe_subscription_id) return false;
  if (!BILLING_STATUSES.includes(userDoc.subscription_status)) return false;
  if (userDoc.cancel_at_period_end === true) return false;
  return true;
}

module.exports = {
  BILLING_STATUSES,
  subscriptionBlocksDeletion,
  PURGED,
  RETAINED,
  RATE_LIMIT_PREFIXES,
  BATCH_LIMIT,
  deleteDocs,
  deleteSubcollection,
  purgeWorkspace,
  purgeAccount,
};
