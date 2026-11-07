import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  primeWorkspaceStore, isPrimed, getItem, setItem, removeItem, onWorkspaceChangedElsewhere,
  LS_MIRROR_MAX_BYTES, OWN_BACKUP_KEY, _resetWorkspaceStoreForTests,
} from './workspaceStore';
import { LS_KEY } from './constants';

// ── The workspace's home in the browser: IndexedDB, memory, a small mirror ──

const blob = (n, savedAt = 1) => JSON.stringify({ _saved_at: savedAt, access: Array.from({ length: n }, (_, i) => ({ id: 'a' + i, employee_id: 'emp' + (i % 3000), tool_id: 'tool' + (i % 40), status: 'active', granted_date: '2024-01-01' })) });
const fresh = () => { globalThis.indexedDB = new IDBFactory(); };

beforeEach(() => { _resetWorkspaceStoreForTests(); localStorage.clear(); fresh(); });
afterEach(() => { _resetWorkspaceStoreForTests(); });

describe('before priming, or without IndexedDB', () => {
  it('is a plain pass-through to localStorage, as every test in this repo expects', () => {
    expect(isPrimed()).toBe(false);
    setItem(LS_KEY, '{"a":1}');
    expect(localStorage.getItem(LS_KEY)).toBe('{"a":1}');
    expect(getItem(LS_KEY)).toBe('{"a":1}');
    removeItem(LS_KEY);
    expect(localStorage.getItem(LS_KEY)).toBeNull();
  });
  it('stays a pass-through when the browser has no IndexedDB', async () => {
    const saved = globalThis.indexedDB;
    globalThis.indexedDB = undefined;
    try { expect(await primeWorkspaceStore()).toBe(false); } finally { globalThis.indexedDB = saved; }
    setItem(LS_KEY, 'x'); expect(localStorage.getItem(LS_KEY)).toBe('x');
  });
});

describe('once primed', () => {
  it('keeps a blob far beyond the localStorage ceiling, whole, and reads it back after a reload', async () => {
    await primeWorkspaceStore();
    expect(isPrimed()).toBe(true);
    const big = blob(60000); // well over 4 MB of access rows
    expect(big.length).toBeGreaterThan(LS_MIRROR_MAX_BYTES);
    setItem(LS_KEY, big);
    expect(getItem(LS_KEY)).toBe(big);
    // Too big for the mirror: localStorage holds nothing rather than a cut copy.
    expect(localStorage.getItem(LS_KEY)).toBeNull();
    // A new tab (new process, same IndexedDB) reads it back complete.
    _resetWorkspaceStoreForTests();
    await primeWorkspaceStore();
    expect(getItem(LS_KEY)).toBe(big);
    expect(JSON.parse(getItem(LS_KEY)).access).toHaveLength(60000);
  });

  it('mirrors a small blob to localStorage, and removes the mirror once it outgrows it', async () => {
    await primeWorkspaceStore();
    setItem(LS_KEY, blob(10));
    expect(localStorage.getItem(LS_KEY)).toBe(blob(10));
    setItem(LS_KEY, blob(60000));
    expect(localStorage.getItem(LS_KEY)).toBeNull();
    setItem(LS_KEY, blob(5));
    expect(localStorage.getItem(LS_KEY)).toBe(blob(5));
  });

  it('migrates a copy an older build left in localStorage, and the newer of two copies wins', async () => {
    localStorage.setItem(LS_KEY, blob(3, 100));
    await primeWorkspaceStore();
    expect(getItem(LS_KEY)).toBe(blob(3, 100));
    // Now IndexedDB holds it; an older localStorage copy must not undo a newer stored one.
    setItem(LS_KEY, blob(4, 200));
    localStorage.setItem(LS_KEY, blob(2, 150));
    _resetWorkspaceStoreForTests();
    await primeWorkspaceStore();
    expect(JSON.parse(getItem(LS_KEY)).access).toHaveLength(4);
    // …but a newer localStorage copy does win (a tab from before the store).
    localStorage.setItem(LS_KEY, blob(7, 300));
    _resetWorkspaceStoreForTests();
    await primeWorkspaceStore();
    expect(JSON.parse(getItem(LS_KEY)).access).toHaveLength(7);
  });

  it('removes from memory, the mirror and IndexedDB together', async () => {
    await primeWorkspaceStore();
    setItem(LS_KEY, blob(2)); setItem(OWN_BACKUP_KEY, blob(1));
    removeItem(LS_KEY);
    expect(getItem(LS_KEY)).toBeNull();
    expect(localStorage.getItem(LS_KEY)).toBeNull();
    expect(getItem(OWN_BACKUP_KEY)).toBe(blob(1));
    _resetWorkspaceStoreForTests();
    await primeWorkspaceStore();
    expect(getItem(LS_KEY)).toBeNull();
    expect(getItem(OWN_BACKUP_KEY)).toBe(blob(1));
  });

  it('a key it does not own goes straight to localStorage', async () => {
    await primeWorkspaceStore();
    setItem('language', 'fr');
    expect(localStorage.getItem('language')).toBe('fr');
    expect(getItem('language')).toBe('fr');
  });

  it('tells the page when another tab wrote the workspace', async () => {
    if (typeof BroadcastChannel === 'undefined') return;
    await primeWorkspaceStore();
    const seen = [];
    onWorkspaceChangedElsewhere((k) => seen.push(k));
    const other = new BroadcastChannel('stacklens-workspace');
    other.postMessage({ key: LS_KEY, value: blob(9, 5) });
    await new Promise((r) => setTimeout(r, 20));
    other.close();
    expect(seen).toEqual([LS_KEY]);
    expect(JSON.parse(getItem(LS_KEY)).access).toHaveLength(9);
  });
});
