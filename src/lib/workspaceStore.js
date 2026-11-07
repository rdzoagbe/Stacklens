import { LS_KEY } from './constants';

// ── Where the workspace lives in this browser ──────────────────────────────
//
// The whole workspace is one JSON string (lib/db.js). It used to live in
// localStorage, which browsers cap at about 5 MB: above 4.5 MB saveDb cut the
// access list down to 150 rows, flagged the blob `_trimmed`, and refused to
// sync it. A company with 3,000 people and their access rows hit that in its
// first import and never saw its own data complete again.
//
// Now the string lives in IndexedDB, which has no such ceiling (hundreds of
// megabytes), behind a synchronous in-memory copy so that loadDb() stays a
// plain function call for the thirty places that use it. localStorage keeps a
// mirror while the blob is small (LS_MIRROR_MAX_BYTES), so an older tab, a
// test, or anything reading the key directly still sees it; above that size
// the mirror is removed rather than truncated. Writes go to memory at once,
// to IndexedDB in the background, and to the other open tabs through a
// BroadcastChannel so two tabs of one workspace keep reading the same copy.
//
// primeWorkspaceStore() runs once before React mounts (main.jsx). Where
// IndexedDB does not exist (tests under jsdom, a locked-down browser) the
// store is a plain pass-through to localStorage, exactly as before.

export const OWN_BACKUP_KEY = 'sg_own_workspace_backup';
export const STORED_KEYS = [LS_KEY, OWN_BACKUP_KEY];
export const LS_MIRROR_MAX_BYTES = 4 * 1024 * 1024;

const DB_NAME = 'stacklens';
const STORE = 'workspace';
const CHANNEL = 'stacklens-workspace';

let primed = false;
const mem = new Map();
let idb = null;
let channel = null;
const listeners = new Set();

const hasIdb = () => typeof indexedDB !== 'undefined' && indexedDB !== null;

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}
function idbGet(key) {
  return new Promise((resolve, reject) => {
    const req = idb.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}
function idbWrite(fn) {
  if (!idb) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, 'readwrite');
    fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }).catch((err) => console.warn('[Stacklens] IndexedDB write failed', err?.message));
}

const savedAt = (raw) => { try { return Number(JSON.parse(raw)?._saved_at) || 0; } catch { return 0; } };

function lsGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function lsSet(key, value) { try { localStorage.setItem(key, value); } catch { /* quota or disabled: IndexedDB has it */ } }
function lsRemove(key) { try { localStorage.removeItem(key); } catch { /* nothing to remove */ } }

/** Load the stored copies into memory. Safe to call more than once. */
export async function primeWorkspaceStore() {
  if (primed || !hasIdb()) return primed;
  try {
    idb = await openIdb();
    for (const key of STORED_KEYS) {
      const fromIdb = await idbGet(key);
      const fromLs = lsGet(key);
      // The newer of the two wins: a tab from before this store wrote only
      // localStorage, and must not be undone by an older IndexedDB copy.
      let value = fromIdb;
      if (fromLs && (!fromIdb || savedAt(fromLs) > savedAt(fromIdb))) value = fromLs;
      if (value != null) mem.set(key, value);
      if (value != null && value !== fromIdb) await idbWrite((s) => s.put(value, key));
    }
    primed = true;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = (e) => {
        const { key, value } = e.data || {};
        if (!STORED_KEYS.includes(key)) return;
        if (value == null) mem.delete(key); else mem.set(key, value);
        listeners.forEach((fn) => { try { fn(key); } catch { /* a listener's problem */ } });
      };
    }
  } catch (err) {
    // No IndexedDB after all: stay a localStorage pass-through.
    console.warn('[Stacklens] IndexedDB unavailable, keeping localStorage', err?.message);
    idb = null;
  }
  return primed;
}

export const isPrimed = () => primed;

export function getItem(key) {
  if (!STORED_KEYS.includes(key)) return lsGet(key);
  return primed ? (mem.get(key) ?? null) : lsGet(key);
}

export function setItem(key, value) {
  if (!STORED_KEYS.includes(key)) return lsSet(key, value);
  if (!primed) return lsSet(key, value);
  mem.set(key, value);
  if (value.length <= LS_MIRROR_MAX_BYTES) lsSet(key, value); else lsRemove(key);
  idbWrite((s) => s.put(value, key));
  channel?.postMessage({ key, value });
}

export function removeItem(key) {
  lsRemove(key);
  if (!STORED_KEYS.includes(key) || !primed) return;
  mem.delete(key);
  idbWrite((s) => s.delete(key));
  channel?.postMessage({ key, value: null });
}

/** Called when another tab changed a stored key; receives the key. */
export function onWorkspaceChangedElsewhere(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Tests only: forget everything, including the IndexedDB connection. */
export function _resetWorkspaceStoreForTests() {
  primed = false; mem.clear(); listeners.clear();
  if (channel) { try { channel.close(); } catch { /* already closed */ } channel = null; }
  if (idb) { try { idb.close(); } catch { /* already closed */ } idb = null; }
}
