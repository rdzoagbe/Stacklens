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
  // The member's copy carries the revision it read. It is the input to the
  // staleness check, read before the merge; the merged output must not carry
  // it, or a member could pin the counter and defeat the check for everyone.
  '_rev',
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

// ── Which version of the workspace was this edit based on? ─────────────────
//
// The twin of src/lib/revision.js. A write used to replace the owner's whole
// document unconditionally, so an owner and an editor working the same
// afternoon each silently deleted the other's work and neither found out.
//
// Every accepted write bumps the counter; every write declares the value it
// was based on. If the stored counter has moved on, the write is refused and
// nothing is overwritten. Both null — a document written before this existed,
// edited by a client that never saw one — is a match, which is how the
// existing production documents migrate on their next save.
//
// Kept in step with the client by src/lib/revision-parity.test.js, the same
// way CHUNKED_KEYS above is.
const REV_FIELD = '_rev';

function revOf(blob) {
  const raw = blob && typeof blob === 'object' ? blob[REV_FIELD] : undefined;
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

function nextRev(stored) {
  const n = Number.isFinite(stored) && stored > 0 ? stored : 0;
  return n + 1;
}

function isStaleWrite(stored, base) {
  const s = Number.isFinite(stored) && stored > 0 ? stored : null;
  const b = Number.isFinite(base) && base > 0 ? base : null;
  return s !== b;
}

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


// ── Client workspaces owned by an agency (Phase 2 of multi-tenancy) ─────────
//
// An MSP or fractional IT director manages several companies. Until now a
// workspace existed only because a person signed up, so each client would need
// their own account and their own subscription — which is not how that market
// works.
//
// A client workspace therefore lives at /userdata/org_<random>, and the id is
// deliberately NOT an auth uid. firestore.rules says `isOwner(uid)`, and no
// signed-in user's uid can ever equal "org_...", so the rule can never match
// and every read or write is forced through the endpoint, where ownership is
// checked. The tenant boundary gets stricter here, not looser: there is no
// direct-database path to a client workspace at all.
//
// Ownership is recorded in /client_orgs/{orgId}, which like /workspace_members
// has no security rule and is therefore unreachable from any browser.

const ORG_ID_PREFIX = 'org_';
const ORG_ID_RE = /^org_[a-z0-9]{20}$/;
const MAX_ORG_NAME = 80;

/** True if this workspace id is an agency-owned client workspace. */
function isClientOrgId(id) {
  return typeof id === 'string' && ORG_ID_RE.test(id);
}

/**
 * Generate a client workspace id.
 *
 * `randomHex` is injected so the caller supplies crypto; this module stays
 * free of Node built-ins and therefore testable without mocking them.
 */
function newClientOrgId(randomHex) {
  const raw = String(randomHex || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (raw.length < 20) throw new WorkspaceWriteError('Insufficient randomness for a workspace id', 500);
  return ORG_ID_PREFIX + raw.slice(0, 20);
}

/** Reject a client name that is empty, oversized, or not a string. */
function cleanOrgName(name) {
  const s = typeof name === 'string' ? name.trim() : '';
  if (!s) throw new WorkspaceWriteError('A client name is required');
  if (s.length > MAX_ORG_NAME) throw new WorkspaceWriteError(`Client name must be ${MAX_ORG_NAME} characters or fewer`);
  return s;
}

/**
 * Decide what a caller may do with a workspace, from the two things that can
 * grant access. Pure: the caller does the lookups and passes what it found.
 *
 * An agency owning a client workspace gets 'editor' — it is their data, held
 * on their plan, and there is no separate owner to defer to.
 *
 * Returns { role, via } or null when nothing grants access.
 */
function resolveWorkspaceAccess({ clientOrg, memberships, callerUid, callerEmail }) {
  if (!callerUid) return null;
  if (clientOrg && clientOrg.owner_uid === callerUid) {
    return { role: 'editor', via: 'client_org' };
  }
  const membership = findMembership(memberships, { callerUid, callerEmail });
  if (!membership) return null;
  const role = MEMBER_ROLES.includes(membership.role) ? membership.role : 'viewer';
  return { role, via: 'membership' };
}

// ── A trial that has run out is not a trial ─────────────────────────────────
//
// resolvePlan() in src/lib/plan.js applies trial expiry, but it is client-only
// and nothing server-side or scheduled ever rewrites /users/{uid}.plan from
// 'trial' back to 'free'. So the endpoints read a raw Firestore field that
// still says 'trial' on day 400, and kept granting the trial's allowance of
// client workspaces forever, while the customer's own screen had long since
// shown the trial-expired banner.
//
// Kept in step with the client by src/lib/plan-parity.test.js.
const TRIAL_DAYS = 7;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

/** Milliseconds from a Firestore Timestamp, an epoch number, or an ISO string. */
function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
}

/**
 * The plan a user is actually on right now. Mirrors resolvePlan() for the one
 * case the stored field gets wrong: an expired trial reads as 'free'.
 */
function effectivePlan(userData, now = Date.now()) {
  if (!userData) return 'free';
  if (userData.is_founder === true) return 'scale';
  const stored = userData.plan || userData.subscription_plan;
  if (stored && stored !== 'trial' && stored !== 'free') return stored;
  if (stored === 'trial') {
    const startedAt = toMillis(userData.trial_started_at);
    if (startedAt > 0 && (now - startedAt) < TRIAL_MS) return 'trial';
    return 'free';
  }
  return stored || 'free';
}

// ── The workspace currency, for anything the server renders ─────────────────
//
// Costs are stored as plain numbers and never converted; the currency is only
// a label. But dailyAlerts and weeklySummary hardcoded a euro sign, so a US
// workspace set to USD read "$4,140/yr" in the Renewals tab and received
// "renews 2026-10-02 · EUR 4,140/yr" by email the same morning.
//
// The chosen code now rides along in the workspace blob (db.user.currency),
// written by Settings > General. Kept in step with SUPPORTED_CURRENCIES in
// src/lib/currency.js by src/lib/currency-parity.test.js.
const CURRENCY_SYMBOLS = {
  EUR: '\u20ac',
  USD: '$',
  GBP: '\u00a3',
  CHF: 'CHF ',
  CAD: 'C$',
};

/** The symbol for a workspace blob, falling back to the euro. */
function currencySymbol(data) {
  const code = String(data?.user?.currency || '').toUpperCase();
  return CURRENCY_SYMBOLS[code] || CURRENCY_SYMBOLS.EUR;
}

// ── Deleting a client workspace, reversibly ────────────────────────────────
//
// deleteorg used to batch-delete the chunks, the userdata document and the
// org record in one commit. An agency removing the wrong client — one prompt,
// one click, names that differ by a word — destroyed that company's entire
// inventory with nothing to restore from, and a customer asking for their
// data back a month later got an apology.
//
// So a delete marks the record and stops there. The workspace disappears from
// the switcher, refuses writes, and stays readable so its data can still be
// exported and handed back. After RETENTION_DAYS a scheduled purge removes it
// for good — which is the part that makes "deleted" mean deleted rather than
// "hidden forever and still billed to our storage".
const RETENTION_DAYS = 90;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** The fields that mark an org deleted. Stored as epoch ms, not Timestamps,
 *  so the purge can compare them without a Firestore type dance. */
function softDeleteFields(now = Date.now()) {
  return { deleted_at: now, purge_after: now + RETENTION_MS };
}

/** Clears the marks. Restoring is the exact inverse of deleting. */
function restoreFields() {
  return { deleted_at: null, purge_after: null };
}

function isOrgDeleted(org) {
  return !!(org && Number(org.deleted_at) > 0);
}

/** Whole days left before the purge takes it, floored at 0. */
function daysUntilPurge(org, now = Date.now()) {
  if (!isOrgDeleted(org)) return null;
  const left = Number(org.purge_after || 0) - now;
  if (!Number.isFinite(left) || left <= 0) return 0;
  return Math.ceil(left / (24 * 60 * 60 * 1000));
}

/**
 * Whether the retention window has closed.
 *
 * A record marked deleted but missing purge_after — written by an older build,
 * or half-written — is due. The alternative is data that can never be purged
 * and never be found, which is the worse failure for a retention promise.
 */
function isPurgeDue(org, now = Date.now()) {
  if (!isOrgDeleted(org)) return false;
  const after = Number(org.purge_after);
  if (!Number.isFinite(after) || after <= 0) return true;
  return now >= after;
}

module.exports = {
  REV_FIELD,
  revOf,
  nextRev,
  isStaleWrite,
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
  ORG_ID_PREFIX,
  MAX_ORG_NAME,
  isClientOrgId,
  newClientOrgId,
  cleanOrgName,
  resolveWorkspaceAccess,
  TRIAL_DAYS,
  effectivePlan,
  CURRENCY_SYMBOLS,
  currencySymbol,
  RETENTION_DAYS,
  RETENTION_MS,
  softDeleteFields,
  restoreFields,
  isOrgDeleted,
  daysUntilPurge,
  isPurgeDue,
};
