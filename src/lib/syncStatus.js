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
  set({ status: 'saved', error: null });
}

// retryFn re-attempts the exact write that failed, so the user's pending
// changes are what gets retried — not whatever is in the store later.
export function markSyncFailed(err, retryFn) {
  _retry = typeof retryFn === 'function' ? retryFn : null;
  set({ status: 'error', error: err?.message || String(err || 'unknown error') });
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
  _listeners.clear();
}
