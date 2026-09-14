// Cloud-sync status — observable store.
//
// saveDb() writes to localStorage first and fires the Firestore backup as a
// debounced, fire-and-forget promise. That promise used to end in an empty
// catch, so a failed cloud write (offline, quota, rules) was completely
// invisible: the UI still said "saved" while the data existed in one browser
// only. This store records the outcome so the UI can say so.
//
// Deliberately dependency-free and non-throwing: it only observes the write
// path, it never alters it. A bug here can make the indicator wrong; it can
// never break a save.

let _state = { status: 'idle', error: null };
let _retry = null;
// A conflict needs two different resolutions rather than one retry, so they
// are held separately from _retry — see markSyncConflict.
let _resolve = null;
const _listeners = new Set();

function set(next) {
  _state = { ..._state, ...next };
  _listeners.forEach((fn) => {
    try { fn(); } catch { /* a listener must never break the save path */ }
  });
}

export function subscribeSync(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// Stable reference between changes — required by useSyncExternalStore.
export function getSyncSnapshot() {
  return _state;
}

export function markSyncSaving() {
  set({ status: 'saving' });
}

export function markSyncSaved() {
  _retry = null;
  _resolve = null;
  set({ status: 'saved', error: null });
}

// retryFn re-attempts the exact write that failed, so the user's pending
// changes are what gets retried — not whatever is in the store later.
export function markSyncFailed(err, retryFn) {
  _retry = typeof retryFn === 'function' ? retryFn : null;
  _resolve = null;
  set({ status: 'error', error: err?.message || String(err || 'unknown error') });
}

// ── Somebody else saved first ──────────────────────────────────────────────
//
// A conflict is not a failed write, and the difference matters: the standard
// failure path offers a retry that re-sends the same payload, which for a
// conflict is precisely the silent overwrite the revision check exists to
// prevent. So it gets its own status, and no _retry.
//
// Two resolutions, both explicit choices by the person who is about to lose
// something:
//
//   keepTheirs  discard the edits in this browser and load the stored copy
//   keepMine    replace the stored copy, knowing what that means
//
// The local data is never thrown away on its own. Silent loss becomes a
// question — that is the entire fix; merging the two copies properly is a
// separate and much larger piece of work.
export function markSyncConflict(err, { keepTheirs, keepMine } = {}) {
  _retry = null;
  _resolve = {
    keepTheirs: typeof keepTheirs === 'function' ? keepTheirs : null,
    keepMine: typeof keepMine === 'function' ? keepMine : null,
  };
  set({
    status: 'conflict',
    error: err?.message || 'This workspace was changed somewhere else.',
  });
}

/**
 * Apply one of the two conflict resolutions.
 *
 * `which` is 'theirs' or 'mine'. Returns false when there is no conflict
 * pending or that resolution was not supplied, so a stray click cannot put the
 * indicator into a state the data does not match.
 */
export async function resolveConflict(which) {
  const fn = which === 'mine' ? _resolve?.keepMine : _resolve?.keepTheirs;
  if (!fn) return false;
  set({ status: 'saving' });
  try {
    await fn();
    markSyncSaved();
    return true;
  } catch (err) {
    markSyncFailed(err, null);
    return false;
  }
}

export async function retrySync() {
  if (!_retry) return false;
  const attempt = _retry;
  set({ status: 'saving' });
  try {
    await attempt();
    markSyncSaved();
    return true;
  } catch (err) {
    markSyncFailed(err, attempt);
    return false;
  }
}

// Test-only reset.
export function _resetSyncStatus() {
  _state = { status: 'idle', error: null };
  _retry = null;
  _resolve = null;
  _listeners.clear();
}
