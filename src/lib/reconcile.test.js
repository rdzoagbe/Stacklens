import { describe, it, expect, vi } from 'vitest';
import { RECONCILED_COLLECTIONS, countsOf, compareCopies, fetchStoredCopy } from './reconcile';

// ── The browser's copy against the stored one ──────────────────────────────

const rows = (prefix, n) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }));

describe('compareCopies', () => {
  it('reports equal copies as the same, with both revisions', () => {
    const here = { _rev: 7, _saved_at: 10, tools: rows('t', 3), employees: rows('e', 2), access: rows('a', 5) };
    const stored = { _rev: 7, _updatedAt: 9, tools: rows('t', 3), employees: rows('e', 2), access: rows('a', 5) };
    const r = compareCopies(here, stored);
    expect(r.same).toBe(true);
    expect(r.rev).toEqual({ here: 7, stored: 7 });
    expect(r.storedAt).toBe(9);
    expect(r.collections.find((c) => c.key === 'access')).toMatchObject({ here: 5, stored: 5, missingHere: 0, unsaved: 0, same: true });
    expect(r.collections.map((c) => c.key)).toEqual(RECONCILED_COLLECTIONS);
  });

  it('counts records missing here and records not yet stored, by id, not by position', () => {
    const here = { _rev: 3, tools: [{ id: 't1' }, { id: 't2' }, { id: 'tNew' }], access: rows('a', 2) };
    const stored = { _rev: 4, tools: [{ id: 't1' }, { id: 't2' }, { id: 'tOld' }], access: rows('a', 2), employees: rows('e', 1) };
    const r = compareCopies(here, stored);
    expect(r.same).toBe(false);
    expect(r.collections.find((c) => c.key === 'tools')).toMatchObject({ here: 3, stored: 3, missingHere: 1, unsaved: 1 });
    expect(r.collections.find((c) => c.key === 'employees')).toMatchObject({ here: 0, stored: 1, missingHere: 1, unsaved: 0 });
    expect(r.missingHere).toBe(2);
    expect(r.unsaved).toBe(1);
    expect(r.rev).toEqual({ here: 3, stored: 4 });
  });

  it('with nothing stored, every local record is unsaved and the copy is flagged as not stored', () => {
    const r = compareCopies({ tools: rows('t', 2) }, null);
    expect(r.stored).toBe(false);
    expect(r.unsaved).toBe(2);
    expect(r.same).toBe(false);
    expect(r.rev).toEqual({ here: null, stored: null });
  });

  it('survives rows without ids and a copy with no collections', () => {
    const r = compareCopies({ tools: [{ name: 'no id' }, { name: 'none either' }] }, { tools: [{ name: 'x' }] });
    expect(r.collections.find((c) => c.key === 'tools')).toMatchObject({ here: 2, stored: 1 });
    expect(countsOf({})).toEqual(Object.fromEntries(RECONCILED_COLLECTIONS.map((k) => [k, 0])));
  });
});

describe('fetchStoredCopy', () => {
  it('reads the own account from Firestore, a shared workspace through the endpoint, and nothing for the demo', async () => {
    const deps = { loadUserData: vi.fn(async () => ({ _rev: 1 })), workspaceRead: vi.fn(async () => ({ data: { _rev: 2 }, role: 'editor' })) };
    expect(await fetchStoredCopy({ user: {} }, 'u1', deps)).toEqual({ _rev: 1 });
    expect(deps.loadUserData).toHaveBeenCalledWith('u1');
    expect(await fetchStoredCopy({ user: {}, _shared_view: { owner_uid: 'o9' } }, 'u1', deps)).toEqual({ _rev: 2 });
    expect(deps.workspaceRead).toHaveBeenCalledWith('o9');
    expect(await fetchStoredCopy({ user: { is_demo: true } }, 'u1', deps)).toBeNull();
    expect(await fetchStoredCopy({ user: {} }, '', deps)).toBeNull();
  });
});
