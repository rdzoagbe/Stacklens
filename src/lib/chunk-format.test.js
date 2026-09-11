import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// ── Two writers, one format ─────────────────────────────────────────────────
//
// Large collections are stored as size-capped slices in a `chunks`
// subcollection because a Firestore document caps at 1MB. Since workspace
// members can write, that layout is produced in two places: saveUserData in
// src/firebase-config.js (the owner's browser) and the workspace endpoint in
// functions/ (a member's edit, applied server-side).
//
// If the two disagree on which keys are chunked or how big a slice may be, one
// writer produces a layout the other cannot reassemble and the owner's
// employees or access records come back truncated or empty. That is the exact
// failure mode of the duplicated toCsv and the duplicated security metrics,
// and it cannot be prevented by re-exporting a shared module here because
// functions/ deploys as its own package.
//
// So it is prevented by this test instead: the server's declared values are
// compared against the literals in the client source.

const require_ = createRequire(import.meta.url);
const server = require_('../../functions/workspace-write.js');

const clientSource = readFileSync(
  resolve(__dirname, '../firebase-config.js'), 'utf8'
);

describe('the client and the server agree on the chunk format', () => {
  it('chunk the same keys', () => {
    const m = clientSource.match(/const CHUNKED_KEYS = \[([^\]]*)\]/);
    expect(m, 'CHUNKED_KEYS not found in src/firebase-config.js').toBeTruthy();
    const clientKeys = m[1].split(',')
      .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
    expect(clientKeys).toEqual(server.CHUNKED_KEYS);
  });

  it('cap a slice at the same size', () => {
    const m = clientSource.match(/const CHUNK_MAX_CHARS = (\d+)/);
    expect(m, 'CHUNK_MAX_CHARS not found in src/firebase-config.js').toBeTruthy();
    expect(Number(m[1])).toBe(server.CHUNK_MAX_CHARS);
  });
});

describe('slicing behaviour a reassembler depends on', () => {
  it('always emits at least one slice, so emptying a collection is persisted', () => {
    // With no slice written, the previous slices would survive and the
    // reassembled collection would still contain the deleted records.
    expect(server.sliceCollection([])).toEqual([[]]);
    expect(server.sliceCollection(null)).toEqual([[]]);
  });

  it('keeps a small collection in a single slice', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(server.sliceCollection(items)).toEqual([items]);
  });

  it('splits once a slice would exceed the cap, and loses nothing', () => {
    // Each item is ~100KB, so six of them must not fit in one 500KB slice.
    const items = Array.from({ length: 6 }, (_, i) => ({ id: i, pad: 'x'.repeat(100000) }));
    const slices = server.sliceCollection(items);
    expect(slices.length).toBeGreaterThan(1);
    expect(slices.flat()).toHaveLength(6);
    expect(slices.flat().map(o => o.id)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('never drops an item larger than the cap on its own', () => {
    // A single oversized record cannot be split, so it must still be written
    // rather than silently discarded.
    const items = [{ id: 'big', pad: 'x'.repeat(600000) }];
    expect(server.sliceCollection(items).flat()).toHaveLength(1);
  });

  it('preserves order across slices', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ id: i, pad: 'y'.repeat(60000) }));
    const flat = server.sliceCollection(items).flat();
    expect(flat.map(o => o.id)).toEqual(items.map(o => o.id));
  });
});
