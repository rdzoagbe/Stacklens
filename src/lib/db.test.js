import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(undefined),
  loadUserData: vi.fn().mockResolvedValue(null),
  logConsent: vi.fn().mockResolvedValue(undefined),
  workspaceWrite: vi.fn().mockResolvedValue({ ok: true }),
  workspaceRead: vi.fn().mockResolvedValue({ data: {}, role: 'editor' }),
}));

import { uid, todayISO, safeParseISO, loadDb, saveDb, seedDbIfEmpty, enterSharedView } from './db';
import { saveUserData, workspaceWrite } from '../firebase-config';
import { stripLocalOnly } from './constants';

const LS_KEY = 'accessguard_v1';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// ── uid ──────────────────────────────────────────────────────────────────────

describe('uid', () => {
  it('generates a string starting with prefix', () => {
    expect(uid('emp').startsWith('emp_')).toBe(true);
  });

  it('defaults to id_ prefix', () => {
    expect(uid().startsWith('id_')).toBe(true);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => uid()));
    expect(ids.size).toBe(100);
  });
});

// ── todayISO ─────────────────────────────────────────────────────────────────

describe('todayISO', () => {
  it('returns yyyy-MM-dd format', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches current date', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(todayISO()).toBe(today);
  });
});

// ── safeParseISO ─────────────────────────────────────────────────────────────

describe('safeParseISO', () => {
  it('parses valid ISO date', () => {
    const result = safeParseISO('2024-01-15');
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2024);
  });

  it('returns null for null input', () => {
    expect(safeParseISO(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(safeParseISO('')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(safeParseISO(undefined)).toBeNull();
  });
});

// ── loadDb / saveDb ──────────────────────────────────────────────────────────

describe('loadDb', () => {
  it('returns null when nothing stored', () => {
    expect(loadDb()).toBeNull();
  });

  it('returns parsed object after save', () => {
    const db = { tools: [], employees: [], access: [], user: { email: 'a@b.com' } };
    saveDb(db);
    const loaded = loadDb();
    expect(loaded.tools).toEqual([]);
    expect(loaded.user.email).toBe('a@b.com');
  });

  it('returns null for corrupt JSON', () => {
    localStorage.setItem(LS_KEY, '{invalid-json}');
    expect(loadDb()).toBeNull();
  });

  // Firestore rejects field names that begin AND end with "__" — early spend
  // snapshots used "__unallocated__" and broke every cloud backup.
  it('migrates legacy __unallocated__ spend_history keys on load', () => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      tools: [], employees: [], access: [],
      spend_history: [
        { month: '2026-06', total: 150, by_department: { sales: 50, __unallocated__: 100 } },
        { month: '2026-07', total: 30, by_department: { unallocated: 10, __unallocated__: 20 } },
      ],
    }));
    const loaded = loadDb();
    expect(loaded.spend_history[0].by_department).toEqual({ sales: 50, unallocated: 100 });
    expect(loaded.spend_history[1].by_department).toEqual({ unallocated: 30 });
  });
});

describe('saveDb', () => {
  it('persists _saved_at timestamp', () => {
    const before = Date.now();
    saveDb({ tools: [], employees: [], access: [] });
    const loaded = loadDb();
    expect(loaded._saved_at).toBeGreaterThanOrEqual(before);
  });

  it('does not call Firestore when no _firestoreUid is set', () => {
    // saveDb should not throw when Firestore uid is not configured
    expect(() => saveDb({ tools: [], employees: [], access: [] })).not.toThrow();
  });

  it('round-trips complex objects', () => {
    const db = {
      tools: [{ id: 't1', name: 'Slack', cost_per_month: 100 }],
      employees: [{ id: 'e1', full_name: 'Alice' }],
      access: [{ id: 'a1', tool_id: 't1' }],
      user: { plan: 'pro', email: 'test@co.com' },
    };
    saveDb(db);
    const loaded = loadDb();
    expect(loaded.tools[0].name).toBe('Slack');
    expect(loaded.employees[0].full_name).toBe('Alice');
    expect(loaded.user.plan).toBe('pro');
  });
});

// ── seedDbIfEmpty ─────────────────────────────────────────────────────────────

describe('seedDbIfEmpty', () => {
  it('seeds demo data when localStorage is empty', () => {
    const db = seedDbIfEmpty();
    expect(db.tools.length).toBeGreaterThan(0);
    expect(db.employees.length).toBeGreaterThan(0);
    expect(db.access.length).toBeGreaterThan(0);
  });

  it('does not overwrite existing data', () => {
    const existing = { tools: [{ id: 't1', name: 'Custom' }], employees: [], access: [], user: {} };
    saveDb(existing);
    const db = seedDbIfEmpty();
    expect(db.tools[0].name).toBe('Custom');
  });

  it('seeds data that can be loaded back', () => {
    seedDbIfEmpty();
    const loaded = loadDb();
    expect(loaded).not.toBeNull();
    expect(loaded.tools.length).toBeGreaterThan(0);
  });

  it('saves seeded data to localStorage', () => {
    seedDbIfEmpty();
    const raw = localStorage.getItem(LS_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw);
    expect(parsed.tools).toBeDefined();
  });
});

// ── saveDb keeps everything ────────────────────────────────────────────────
//
// It used to cut the access list down to 150 rows above 4.5 MB (the
// localStorage ceiling) and flag the blob `_trimmed`. The workspace now lives
// in IndexedDB behind lib/workspaceStore.js, so a save is the whole workspace
// at any size; the shared-workspace sync still refuses a blob an older build
// flagged, because that one is known to be incomplete.

describe('saveDb keeps every record', () => {
  it('keeps a small workspace whole', () => {
    const db = {
      tools: [{ id: 't1', name: 'Tool' }],
      employees: [{ id: 'e1', name: 'Alice' }],
      access: Array.from({ length: 50 }, (_, i) => ({ id: `a${i}`, last_accessed_date: '2024-01-01' })),
      user: {},
    };
    saveDb(db);
    expect(loadDb().access.length).toBe(50);
    expect(loadDb()._trimmed).toBeUndefined();
  });

  it('keeps a large access list whole, and never flags it (the full-size case is scale.test.js)', () => {
    const access = Array.from({ length: 12000 }, (_, i) => ({
      id: `a${i}`, employee_id: `e${i % 3000}`, tool_id: `t${i % 40}`, access_level: 'viewer', status: 'active',
      granted_date: '2024-01-01', last_accessed_date: '2024-06-01',
    }));
    const db = { tools: [], employees: [], access, user: {} };
    saveDb(db);
    const loaded = loadDb();
    expect(loaded.access).toHaveLength(12000);
    expect(loaded.access[11999].id).toBe('a11999');
    expect(loaded._trimmed).toBeUndefined();
  });
});


// ── Where a save goes when you are inside someone else's workspace ─────────
// Phase 1 of multi-tenancy made membership writable, so saveDb now has three
// destinations rather than two: the viewer's own Firestore document, the
// owner's document via the workspace endpoint, or nowhere. Sending a save to
// the wrong one either silently discards an edit or writes into the wrong
// company, so the routing is pinned here.

describe('saveDb routing inside a shared workspace', () => {
  const shared = (role) => enterSharedView(
    { tools: [{ id: 't1' }], user: { email: 'owner@acme.com' } },
    { owner_uid: 'owner1', owner_email: 'owner@acme.com', role }
  );

  it('a viewer\'s edit is never synced anywhere', () => {
    vi.useFakeTimers();
    const db = shared('viewer');
    saveDb({ ...db, tools: [] });
    vi.advanceTimersByTime(2000);
    expect(workspaceWrite).not.toHaveBeenCalled();
    expect(saveUserData).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('an editor\'s edit goes to the owner, through the endpoint', async () => {
    vi.useFakeTimers();
    const db = shared('editor');
    saveDb({ ...db, tools: [{ id: 't2' }] });
    vi.advanceTimersByTime(2000);
    expect(workspaceWrite).toHaveBeenCalledTimes(1);
    expect(workspaceWrite.mock.calls[0][0]).toBe('owner1');
    // Never the viewer\'s own document.
    expect(saveUserData).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('an unknown role is treated as a viewer, not as an editor', () => {
    vi.useFakeTimers();
    for (const role of ['owner', 'admin', 'EDITOR', '', undefined, null]) {
      vi.clearAllMocks();
      const db = shared(role);
      saveDb({ ...db, tools: [] });
      vi.advanceTimersByTime(2000);
      expect(workspaceWrite, String(role)).not.toHaveBeenCalled();
    }
    vi.useRealTimers();
  });

  it('refuses to sync a copy this browser had to trim', () => {
    // saveDb archives the oldest access records when localStorage fills.
    // Pushing that up would delete history the owner still has.
    vi.useFakeTimers();
    const db = shared('editor');
    saveDb({ ...db, _trimmed: true });
    vi.advanceTimersByTime(2000);
    expect(workspaceWrite).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('an edit still reaches localStorage so the screen stays consistent', () => {
    const db = shared('editor');
    saveDb({ ...db, tools: [{ id: 'local' }] });
    expect(loadDb().tools).toEqual([{ id: 'local' }]);
  });
});


// ── Getting out of the trimmed state ──────────────────────────────────────
//
// `_trimmed` says "this browser's copy is missing records the source of truth
// still has", and saveDb rightly refuses to push such a copy into a shared
// workspace. But nothing ever cleared it, so the first time an editor hit the
// 4.5 MB localStorage ceiling every later save was refused for good — even
// after they deleted enough data to fit — and saveUserData stored the flag in
// Firestore, so the next hydrate handed it straight back, on every device.
//
// These pin both halves: the flag survives an ordinary save, and a copy that
// is complete by definition clears it.

describe('the trimmed flag can be recovered from', () => {
  it('survives an ordinary save, because the data is still incomplete', () => {
    // The blob now fits precisely because it was cut down. Clearing the flag
    // here is what would let truncated data overwrite the owner's history.
    saveDb({ tools: [], employees: [], access: [], user: {}, _trimmed: true });
    expect(loadDb()._trimmed).toBe(true);
  });

  it('is cleared by entering a shared workspace, which is a fresh server read', () => {
    saveDb({ tools: [], employees: [], access: [], user: {}, _trimmed: true });
    expect(loadDb()._trimmed).toBe(true);

    const view = enterSharedView(
      { tools: [{ id: 't1' }], employees: [], access: [], user: {} },
      { owner_uid: 'owner1', owner_email: 'owner@acme.com', role: 'editor' }
    );
    expect(view._trimmed).toBeUndefined();
    expect(loadDb()._trimmed).toBeUndefined();
  });

  it('does not carry a stale flag out of the workspace payload either', () => {
    // If an older build stored the flag in the owner's Firestore document, it
    // comes back down inside the shared blob.
    const view = enterSharedView(
      { tools: [], employees: [], access: [], user: {}, _trimmed: true },
      { owner_uid: 'owner1', owner_email: 'owner@acme.com', role: 'editor' }
    );
    expect(view._trimmed).toBeUndefined();
  });

  it('lets an editor sync again once the flag is gone', async () => {
    vi.useFakeTimers();
    saveDb({ tools: [], employees: [], access: [], user: {}, _trimmed: true });
    const view = enterSharedView(
      { tools: [{ id: 't1' }], employees: [], access: [], user: {} },
      { owner_uid: 'owner1', owner_email: 'owner@acme.com', role: 'editor' }
    );
    saveDb({ ...view, tools: [{ id: 't2' }] });
    vi.advanceTimersByTime(2000);
    expect(workspaceWrite).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

// ── What must never become workspace data ─────────────────────────────────
//
// saveUserData spreads the whole blob into the Firestore document. `_trimmed`
// is a property of one browser, and `_shared_view` marks the blob as somebody
// else's workspace — stored in the owner's own document, the next hydrate
// would load it and the app would believe the user is inside a workspace they
// may not have access to.
//
// firebase-config is mocked in this file (it boots the Firebase SDK), so the
// stripping is checked against the source: the object saveUserData writes must
// have every LOCAL_ONLY_KEYS entry deleted from it.

describe('browser-local markers stay out of the cloud', () => {
  it('removes both markers', () => {
    const out = stripLocalOnly({
      tools: [{ id: 't1' }], user: { plan: 'pro' },
      _trimmed: true, _shared_view: { owner_uid: 'someone-else' },
    });
    expect(out._trimmed).toBeUndefined();
    expect(out._shared_view).toBeUndefined();
  });

  it('keeps everything else exactly as it was', () => {
    const blob = { tools: [{ id: 't1' }], employees: [], user: { plan: 'pro' }, _saved_at: 123 };
    expect(stripLocalOnly(blob)).toEqual(blob);
  });

  it('does not mutate the caller\'s object', () => {
    // saveDb hands its live blob to saveUserData; stripping in place would
    // clear the flag the very next save depends on.
    const blob = { tools: [], _trimmed: true };
    stripLocalOnly(blob);
    expect(blob._trimmed).toBe(true);
  });

  it('survives an empty or absent blob', () => {
    expect(stripLocalOnly({})).toEqual({});
    expect(stripLocalOnly(undefined)).toEqual({});
  });

  it('is what saveUserData writes to Firestore', () => {
    // firebase-config boots the Firebase SDK and is mocked here, so this last
    // step is checked against the source — with comments removed first,
    // because an earlier version of this guard was satisfied by the comment
    // describing the code rather than the code itself.
    const source = readFileSync(resolve(process.cwd(), 'src/firebase-config.js'), 'utf8');
    const start = source.indexOf('export async function saveUserData');
    expect(start, 'saveUserData not found').toBeGreaterThan(-1);
    const next = source.indexOf('\nexport ', start + 1);
    const body = source.slice(start, next === -1 ? undefined : next)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(body, 'saveUserData spreads the whole blob into the Firestore ' +
      'document, so it must pass it through stripLocalOnly first or a ' +
      'browser-local marker becomes workspace data on every device.'
    ).toMatch(/stripLocalOnly\(/);
    // The main document is now written inside a transaction (the revision
    // check has to read and compare in the same atomic unit as the write), so
    // the assertion follows the ref rather than the old batch call — still
    // checking the same thing: the stripped blob is what lands on the doc.
    expect(body).toMatch(/ownerRef = doc\(firestoreDb, 'userdata', uid\)/);
    expect(body).toMatch(/tx\.set\(ownerRef, meta\)/);
  });
});
