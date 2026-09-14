import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as client from './revision';

// ── Two implementations of one rule ─────────────────────────────────────────
//
// The revision check runs in two places: the owner's browser writes its own
// document directly (src/firebase-config.js, using ./revision.js), and a
// workspace editor's change is applied server-side by the workspace endpoint
// (functions/, using its own copy in workspace-write.js).
//
// functions/ deploys as its own npm package and cannot import from src/, so
// the logic is genuinely duplicated — the same situation as CHUNKED_KEYS, and
// guarded the same way.
//
// Drift here is not cosmetic. If the two disagree about what counts as a
// stale write, or about what number comes next, the guarantee collapses in the
// exact case it exists for: an owner editing in their browser while an editor
// saves through the endpoint. One of them would be let through against a
// revision the other had already claimed, and somebody's afternoon would
// disappear — which is what this whole mechanism was built to stop.

const require_ = createRequire(import.meta.url);
const server = require_('../../functions/workspace-write.js');

describe('the client and the server agree on the revision rule', () => {
  it('use the same field name', () => {
    // Different field names would mean each side reads a revision the other
    // never wrote: both would see null every time and every write would be
    // accepted, silently restoring the original bug with all the tests green.
    expect(server.REV_FIELD).toBe(client.REV_FIELD);
  });

  it('read a revision off a blob identically', () => {
    const cases = [
      {}, { _rev: 1 }, { _rev: 42 }, { _rev: 0 }, { _rev: -1 }, { _rev: '3' },
      { _rev: null }, { _rev: NaN }, { _rev: Infinity }, { _rev: true },
      { _rev: {} }, null, undefined, 'nope', [],
    ];
    for (const blob of cases) {
      expect(server.revOf(blob), JSON.stringify(blob) ?? String(blob))
        .toBe(client.revOf(blob));
    }
  });

  it('compute the same next revision', () => {
    for (const stored of [null, undefined, 0, 1, 2, 41, -3, NaN, Infinity, '5']) {
      expect(server.nextRev(stored), String(stored)).toBe(client.nextRev(stored));
    }
  });

  it('agree on every stale/fresh combination', () => {
    const values = [null, undefined, 1, 2, 3, 0, -1, NaN, '2'];
    for (const stored of values) {
      for (const base of values) {
        expect(
          server.isStaleWrite(stored, base),
          `stored=${String(stored)} base=${String(base)}`,
        ).toBe(client.isStaleWrite(stored, base));
      }
    }
  });

  it('the server strips the revision out of a member payload', () => {
    // The member's copy carries the revision it read, which is the input to
    // the check. It must not survive into the merged document the server
    // stores — the server sets that fresh. If a member could pin the counter,
    // every later writer would compare against a value that never moves and
    // the check would pass for all of them.
    expect(server.INTERNAL_KEYS).toContain(client.REV_FIELD);
  });
});

// ── The no-op-write check has to know every bookkeeping field ──────────────
//
// sameSubstance decides whether a refused write would have changed anything,
// and it does so by ignoring the fields that carry no user data. If a NEW
// local-only field is added to LOCAL_ONLY_KEYS and not to BOOKKEEPING_FIELDS,
// the local copy carries it and the stored copy never can — so the two are
// permanently "different" and the no-op case stops being recognised. The
// banner comes back for every second tab, quietly, with every test green.
//
// The reverse direction is not checked, because BOOKKEEPING_FIELDS legitimately
// contains fields saveUserData adds on the way up (_uid, _updatedAt, _chunks)
// that are not local-only at all.
describe('the no-op-write check covers every field that is not user data', () => {
  it('ignores every local-only key', async () => {
    const { LOCAL_ONLY_KEYS } = await import('./constants');
    for (const key of LOCAL_ONLY_KEYS) {
      expect(client.BOOKKEEPING_FIELDS, `${key} is stripped before a cloud write, so the `
        + 'stored copy can never have it — sameSubstance must ignore it or no write '
        + 'will ever be recognised as a no-op').toContain(key);
    }
  });

  it('proves it by comparing a blob that carries them all', async () => {
    const { LOCAL_ONLY_KEYS } = await import('./constants');
    const local = { tools: [{ id: 't1' }] };
    for (const key of LOCAL_ONLY_KEYS) local[key] = 'set';
    // What the cloud stores: the same data, none of the local-only fields.
    expect(client.sameSubstance(local, { tools: [{ id: 't1' }], _rev: 7 })).toBe(true);
  });
});
