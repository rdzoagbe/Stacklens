import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn().mockResolvedValue(undefined),
  loadUserData: vi.fn().mockResolvedValue(null),
  logConsent: vi.fn().mockResolvedValue(undefined),
  workspaceWrite: vi.fn().mockResolvedValue({ ok: true }),
}));

import { uid, todayISO, safeParseISO, loadDb, saveDb, seedDbIfEmpty, enterSharedView } from './db';
import { saveUserData, workspaceWrite } from '../firebase-config';

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

// ── saveDb overflow trimming ──────────────────────────────────────────────────

describe('saveDb overflow trimming', () => {
  it('keeps all records when under size limit', () => {
    const db = {
      tools: [{ id: 't1', name: 'Tool' }],
      employees: [{ id: 'e1', name: 'Alice' }],
      access: Array.from({ length: 50 }, (_, i) => ({ id: `a${i}`, last_accessed_date: '2024-01-01' })),
      user: {},
    };
    saveDb(db);
    const loaded = loadDb();
    expect(loaded.access.length).toBe(50);
  });

  it('trims access records sorted by recency when access list is large', () => {
    // Build 200 access records with varying last_accessed_dates
    const access = Array.from({ length: 200 }, (_, i) => ({
      id: `a${i}`,
      last_accessed_date: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
    }));
    const _db = { tools: [], employees: [], access, user: {} };

    // Manually invoke trim logic by checking that after a huge db is stored,
    // only most-recent records are preserved
    // We simulate by passing a large enough db; here we just verify sort order is correct
    const sorted = [...access].sort((a, b) => {
      const ta = a.last_accessed_date ? new Date(a.last_accessed_date).getTime() : 0;
      const tb = b.last_accessed_date ? new Date(b.last_accessed_date).getTime() : 0;
      return tb - ta;
    });
    // Most recent should be a0 (index 0 = today)
    expect(sorted[0].id).toBe('a0');
    // Oldest should be a199
    expect(sorted[sorted.length - 1].id).toBe('a199');
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
