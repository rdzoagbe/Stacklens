// ── Which version of the workspace was this edit based on? ─────────────────
//
// Every cloud write used to be an unconditional overwrite of the whole blob.
// There is one document per workspace and the client sends all of it, so two
// writers meant the later one won completely and silently:
//
//   You add three tools on your phone. You come back to the laptop tab that
//   has been open since this morning. The laptop autosaves. Your three tools
//   are gone — no error, no warning, nothing in the log.
//
// The shared-workspace case is worse, because it is two different people: an
// owner and an editor working the same afternoon would each delete the other's
// work, and neither would ever find out.
//
// The fix is the smallest thing that turns a silent loss into a visible one: a
// counter on the stored document. Every accepted write bumps it, and every
// write declares which value it was based on. If the stored counter has moved
// on, somebody else wrote in the meantime, so the write is refused and nothing
// is overwritten — the user is told and chooses.
//
// Deliberately NOT a merge. Merging two divergent copies of a workspace is a
// real project (per-collection, per-record, with a conflict UI). This is the
// part that stops data disappearing, and it has to come first: a merge that
// arrives later can only be built on top of knowing that a conflict happened.

/** The field holding the counter, on both the stored document and the blob. */
export const REV_FIELD = '_rev';

/**
 * The revision a blob claims, or null when it has none.
 *
 * null is the honest answer for a document written before this existed, and it
 * is not the same as 0: it means "unknown", and `isStaleWrite` treats an
 * unknown base against an unknown stored value as a match so that existing
 * documents migrate on their next save instead of all reporting a conflict.
 */
export function revOf(blob) {
  const raw = blob && typeof blob === 'object' ? blob[REV_FIELD] : undefined;
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

/** The revision to stamp on a write that is replacing `stored`. */
export function nextRev(stored) {
  const n = Number.isFinite(stored) && stored > 0 ? stored : 0;
  return n + 1;
}

/**
 * Must this write be refused?
 *
 * `stored` is the revision on the document right now; `base` is the revision
 * the writer read before making its edit. They have to be equal — anything
 * else means the document moved underneath the writer.
 *
 * Both null (a pre-revision document edited by a client that never saw one) is
 * a match, which is what migrates the existing production documents.
 */
export function isStaleWrite(stored, base) {
  const s = Number.isFinite(stored) && stored > 0 ? stored : null;
  const b = Number.isFinite(base) && base > 0 ? base : null;
  return s !== b;
}

/**
 * Thrown by a refused write, and recognised by the sync indicator.
 *
 * A conflict must never be retried with the same payload — that is exactly the
 * overwrite this module exists to prevent — so it carries a flag rather than
 * being told apart by matching on the message.
 */
export class StaleWriteError extends Error {
  constructor(storedRev) {
    super('This workspace was changed somewhere else while you were editing.');
    this.name = 'StaleWriteError';
    this.isConflict = true;
    this.storedRev = Number.isFinite(storedRev) ? storedRev : null;
  }
}

/** True for any error that means "someone else wrote first". */
export function isConflictError(err) {
  return !!(err && (err.isConflict === true || err.name === 'StaleWriteError'));
}

// ── A conflict that would change nothing is not a conflict ─────────────────
//
// The counter above answers "did the document move underneath this writer?".
// That is the right question for an edit, and the wrong question for the write
// the app makes on every page load.
//
// useAuth saves unconditionally on every auth event: it patches the user block
// with what Firebase Auth and /users just told it and calls saveDb. So opening
// a second tab, or a phone and a laptop waking at the same time, fires two
// writes carrying identical data seconds apart. One commits, the other's base
// revision is now behind, and the person is asked to choose between two copies
// that are the same copy — having touched nothing. An alarm that fires when
// nothing is wrong is how people learn to dismiss the one that matters.
//
// So before asking, check whether there is anything to ask about. If the local
// blob and the stored blob carry the same data, whichever one "wins" leaves
// the same workspace behind and the local copy only needs the stored
// revision stamped on it.
//
// This deliberately does NOT merge or resolve anything. It recognises the case
// where there is nothing to resolve, and narrows the banner to real
// divergence. Anything it cannot prove identical stays a conflict.

/**
 * Fields that carry no user data, so a difference in them means nothing.
 *
 * `_rev` and `_saved_at` are this module's and saveDb's own bookkeeping;
 * `_updatedAt`, `_uid` and `_chunks` are added by saveUserData on the way up;
 * `_trimmed` and `_shared_view` are local-only (LOCAL_ONLY_KEYS in
 * lib/constants — revision-parity.test.js fails if that list grows a key this
 * one does not have).
 */
export const BOOKKEEPING_FIELDS = [
  REV_FIELD, '_saved_at', '_updatedAt', '_uid', '_chunks', '_trimmed', '_shared_view',
];

/**
 * The same value with object keys ordered, so two copies can be compared.
 *
 * Undefined properties are dropped rather than nulled, because that is what
 * JSON.stringify does and both of these blobs have been through it — the local
 * one into localStorage, the stored one into Firestore. Treating an absent key
 * as different from an undefined one would report divergence for a round-trip
 * artefact.
 */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] === undefined) continue;
      out[key] = canonical(value[key]);
    }
    return out;
  }
  return value;
}

/**
 * Do these two workspace copies hold the same data?
 *
 * Conservative in one direction on purpose: it must never claim two different
 * copies are the same, because that would suppress a banner somebody needed.
 * Claiming two identical copies are different only costs a banner nobody
 * needed, which is where we already are. So anything unexpected — a
 * non-object, a value that will not serialise — answers false.
 *
 * Array ORDER counts as data. Two devices holding the same records in a
 * different order are reported as diverged, which is the safe direction: the
 * point here is to recognise the no-op write, not to decide equivalence.
 */
export function sameSubstance(mine, theirs) {
  if (!mine || !theirs || typeof mine !== 'object' || typeof theirs !== 'object') return false;
  if (Array.isArray(mine) || Array.isArray(theirs)) return false;
  const substance = (blob) => {
    const out = {};
    for (const key of Object.keys(blob)) {
      if (BOOKKEEPING_FIELDS.includes(key)) continue;
      out[key] = blob[key];
    }
    return out;
  };
  try {
    return JSON.stringify(canonical(substance(mine)))
      === JSON.stringify(canonical(substance(theirs)));
  } catch {
    return false;
  }
}
