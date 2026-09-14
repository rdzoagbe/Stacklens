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
