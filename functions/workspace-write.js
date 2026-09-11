// ── Deciding whether a member may write, and what they may write ────────────
//
// Phase 1 of multi-tenancy: a workspace member with the editor role can change
// the owner's data. Until now membership was read-only, enforced in three
// places at once (the role was hardcoded to 'viewer', every RoleGate hid the
// edit controls, and saveDb refused to cloud-sync a shared copy).
//
// Relaxing that moves part of the tenant boundary out of firestore.rules and
// into function code. The rules are one line — `isOwner(uid)` — with 40 tests
// behind it; anything replacing it needs the same standard. So the decisions
// live here, pure and synchronous, with no Firestore and no network, and the
// endpoint is left as thin I/O around them.
//
// Two ways a naive implementation destroys the owner's data, both of which
// this module exists to prevent:
//
//   1. The `read` action deliberately strips the owner's billing internals,
//      handing the member a `user` object cut down to six safe fields. If the
//      member's client posts that blob back, the owner's real user record —
//      trial stamp, plan, role, budget cap, settings — is replaced by the
//      stub. So `user` is never taken from a member. Not sanitised: ignored.
//
//   2. saveDb trims the oldest access records when a browser hits its
//      localStorage ceiling and flags the blob `_trimmed`. Syncing a trimmed
//      copy up would delete history the owner still has. A trimmed payload is
//      refused outright rather than partially applied.

/** Roles a workspace member can hold. Owner-side RBAC is a separate concept. */
const MEMBER_ROLES = ['viewer', 'editor'];

/** The only keys a member may modify. Everything else is preserved verbatim. */
const MEMBER_WRITABLE_KEYS = [
  'tools', 'employees', 'access', 'contracts', 'invoices', 'licenses', 'audit_log',
];

/**
 * Keys the persistence layer owns. A member's copy carries stale or
 * viewer-specific values for these, so they are dropped and the writer sets
 * them fresh.
 */
const INTERNAL_KEYS = [
  '_shared_view', '_uid', '_chunks', '_saved_at', '_updatedAt', '_trimmed',
];

/** Guard against a runaway or hostile payload. Well above any real workspace. */
const MAX_ITEMS_PER_COLLECTION = 50000;

/**
 * Chunking parameters, which MUST match saveUserData in src/firebase-config.js.
 *
 * Large arrays are stored as size-capped slices in a `chunks` subcollection
 * because a Firestore document caps at 1MB. The server now writes that layout
 * too, so there are two writers of one format — the duplication pattern that
 * previously produced the broken CSV export and two disagreeing sets of
 * security metrics.
 *
 * functions/ deploys as its own package and cannot import from src/, so the
 * values cannot literally be shared. Instead they are declared here, once, and
 * a test in the main suite reads both files and fails if they ever diverge.
 */
const CHUNKED_KEYS = ['employees', 'access', 'audit_log'];
const CHUNK_MAX_CHARS = 500000;

/**
 * Slice one collection the way the client does: accumulate items until the
 * next one would exceed the cap, then start a new slice. Always yields at
 * least one slice so an emptied collection overwrites its predecessor rather
 * than leaving stale data behind.
 */
function sliceCollection(arr) {
  const items = Array.isArray(arr) ? arr : [];
  const slices = [];
  let current = [];
  let size = 0;
  for (const item of items) {
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
  return slices;
}

class WorkspaceWriteError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'WorkspaceWriteError';
    this.httpStatus = status;
  }
}

/**
 * Find the caller's membership record among the docs for one workspace.
 *
 * Matches on bound uid, or on a verified email for an invite not yet bound.
 * `callerEmail` must already have been gated on email_verified by the caller —
 * an unverified address would let someone register under an invited mailbox
 * they do not own and inherit that membership.
 */
function findMembership(memberships, { callerUid, callerEmail }) {
  if (!callerUid) return null;
  const rows = Array.isArray(memberships) ? memberships : [];
  return rows.find(m =>
    m && (m.member_uid === callerUid ||
      (callerEmail && m.member_email && m.member_email === callerEmail))
  ) || null;
}

/**
 * Throw unless this membership permits writing. Returns the effective role.
 */
function assertCanWrite(membership) {
  if (!membership) {
    throw new WorkspaceWriteError('Not a member of this workspace', 403);
  }
  const role = MEMBER_ROLES.includes(membership.role) ? membership.role : 'viewer';
  if (role !== 'editor') {
    throw new WorkspaceWriteError('Your access to this workspace is read-only', 403);
  }
  return role;
}

/**
 * Merge a member's payload onto the owner's stored data.
 *
 * Starts from the owner's document so that anything a member is not allowed to
 * touch survives untouched, including keys this module has never heard of — a
 * new collection added later is preserved by default rather than silently
 * dropped by an out-of-date allowlist.
 */
function buildSafeUpdate(ownerData, memberPayload) {
  if (!memberPayload || typeof memberPayload !== 'object' || Array.isArray(memberPayload)) {
    throw new WorkspaceWriteError('A workspace payload is required');
  }
  if (memberPayload._trimmed) {
    throw new WorkspaceWriteError(
      'This copy of the workspace was trimmed to fit browser storage and would ' +
      'delete history the owner still has. Reload the workspace and try again.'
    );
  }

  const out = { ...(ownerData && typeof ownerData === 'object' ? ownerData : {}) };

  for (const key of MEMBER_WRITABLE_KEYS) {
    if (!(key in memberPayload)) continue;           // absent: keep the owner's
    const value = memberPayload[key];
    if (!Array.isArray(value)) {
      throw new WorkspaceWriteError(`"${key}" must be an array`);
    }
    if (value.length > MAX_ITEMS_PER_COLLECTION) {
      throw new WorkspaceWriteError(`"${key}" exceeds ${MAX_ITEMS_PER_COLLECTION} items`);
    }
    out[key] = value;
  }

  // The owner's user record is never taken from a member. See note 1 above.
  if (ownerData && 'user' in ownerData) out.user = ownerData.user;
  else delete out.user;

  for (const key of INTERNAL_KEYS) delete out[key];

  return out;
}

module.exports = {
  MEMBER_ROLES,
  MEMBER_WRITABLE_KEYS,
  INTERNAL_KEYS,
  MAX_ITEMS_PER_COLLECTION,
  CHUNKED_KEYS,
  CHUNK_MAX_CHARS,
  WorkspaceWriteError,
  findMembership,
  assertCanWrite,
  buildSafeUpdate,
  sliceCollection,
};
