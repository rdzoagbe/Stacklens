import { describe, it, expect } from 'vitest';
import {
  REV_FIELD, revOf, nextRev, isStaleWrite, StaleWriteError, isConflictError,
  sameSubstance,
} from './revision';

// ── The check that stops one writer erasing another ────────────────────────
//
// Before this, every cloud write replaced the whole workspace document
// unconditionally. Two writers meant the later one won completely and in
// silence — no error, no warning, nothing in the log. The two real cases:
//
//   one person, two devices   phone saves, then the laptop tab that has been
//                             open since morning autosaves over it
//   two people, one workspace an owner and an editor the same afternoon
//
// Everything below is about one property: a write whose base revision is not
// the stored revision must be refused, and a write that is accepted must move
// the counter so the next one is checked against something new.

describe('revOf', () => {
  it('reads a revision off a blob', () => {
    expect(revOf({ [REV_FIELD]: 7 })).toBe(7);
  });

  it('answers null for a document written before revisions existed', () => {
    // Every document already in production is in this state. If this returned
    // 0 instead of null it would still compare equal to another 0, so the
    // distinction only matters for reading the intent — but see the migration
    // test below, which is the one that must hold.
    expect(revOf({})).toBeNull();
    expect(revOf({ [REV_FIELD]: undefined })).toBeNull();
  });

  it('refuses values that are not a positive count', () => {
    // A hostile or corrupt payload must not be able to hand us a revision.
    // '8' passing as 8 would let a client that stringifies its blob compare
    // equal to a stored number and skip the check.
    for (const bad of ['8', 0, -1, NaN, Infinity, null, {}, [], true]) {
      expect(revOf({ [REV_FIELD]: bad }), String(bad)).toBeNull();
    }
  });

  it('survives a missing or non-object blob', () => {
    expect(revOf(null)).toBeNull();
    expect(revOf(undefined)).toBeNull();
    expect(revOf('nope')).toBeNull();
    expect(revOf([])).toBeNull();
  });
});

describe('nextRev', () => {
  it('starts a pre-revision document at 1', () => {
    expect(nextRev(null)).toBe(1);
    expect(nextRev(undefined)).toBe(1);
  });

  it('increments', () => {
    expect(nextRev(1)).toBe(2);
    expect(nextRev(41)).toBe(42);
  });

  it('never goes backwards, whatever it is handed', () => {
    // Monotonicity is the whole guarantee. If a junk stored value could
    // produce a revision at or below one already handed out, two different
    // writes could share a revision and the loser would be accepted.
    for (const junk of ['5', -3, 0, NaN, Infinity, {}, [], null]) {
      expect(nextRev(junk), String(junk)).toBeGreaterThan(0);
    }
    expect(nextRev(nextRev(3))).toBe(5);
  });
});

describe('isStaleWrite', () => {
  it('accepts a write based on the stored revision', () => {
    expect(isStaleWrite(4, 4)).toBe(false);
  });

  it('refuses a write based on an older revision', () => {
    // The core case: this browser read 3, someone else has since written 4.
    expect(isStaleWrite(4, 3)).toBe(true);
  });

  it('refuses a write that claims a revision ahead of the store', () => {
    // Should not happen, and must not be accepted if it does — accepting it
    // would let a client skip the check by inflating its own counter.
    expect(isStaleWrite(3, 9)).toBe(true);
  });

  it('migrates the documents already in production', () => {
    // Both unknown: a document saved before revisions existed, written by a
    // client that has never seen one. This has to pass, or every existing
    // user's first save after the deploy reports a conflict that is not one.
    expect(isStaleWrite(null, null)).toBe(false);
    expect(isStaleWrite(undefined, undefined)).toBe(false);
  });

  it('refuses a write with no base against a document that has a revision', () => {
    // A copy that predates the counter cannot be known to include what the
    // stored revisions recorded, so it is not safe to let it overwrite.
    expect(isStaleWrite(2, null)).toBe(true);
  });

  it('accepts the first write to a document that has no revision yet', () => {
    expect(isStaleWrite(null, 5)).toBe(true);   // store empty, client invented one
    expect(isStaleWrite(null, null)).toBe(false);
  });
});

describe('conflict errors are told apart from failures', () => {
  it('a StaleWriteError is recognised', () => {
    const err = new StaleWriteError(9);
    expect(isConflictError(err)).toBe(true);
    expect(err.storedRev).toBe(9);
  });

  it('a plain failure is not', () => {
    // This is the distinction the retry path depends on. An ordinary failure
    // gets a retry that re-sends the same payload; doing that to a conflict is
    // the silent overwrite. Misclassifying one as the other is the bug.
    expect(isConflictError(new Error('network down'))).toBe(false);
    expect(isConflictError(null)).toBe(false);
    expect(isConflictError(undefined)).toBe(false);
  });

  it('recognises the flag set across the HTTP boundary', () => {
    // The shared-workspace path gets a 409 from the endpoint, not a thrown
    // StaleWriteError, so callWorkspace flags the Error it constructs.
    const fromFetch = new Error('changed elsewhere');
    fromFetch.isConflict = true;
    expect(isConflictError(fromFetch)).toBe(true);
  });
});

describe('a sequence of writes', () => {
  it('two writers based on the same revision: one wins, one is refused', () => {
    // The scenario, played out. Both read revision 3.
    let stored = 3;
    const phoneBase = 3;
    const laptopBase = 3;

    // The phone commits first.
    expect(isStaleWrite(stored, phoneBase)).toBe(false);
    stored = nextRev(stored);
    expect(stored).toBe(4);

    // The laptop's autosave arrives. Before this fix it overwrote the phone's
    // work and said nothing.
    expect(isStaleWrite(stored, laptopBase)).toBe(true);

    // After the user chooses "keep mine", the laptop re-bases on what is
    // stored now and is accepted.
    expect(isStaleWrite(stored, 4)).toBe(false);
    stored = nextRev(stored);
    expect(stored).toBe(5);
  });
});

// ── The banner that fired when nothing was wrong ────────────────────────────
//
// useAuth calls saveDb on every auth event, so every page load sends a write
// carrying the same data plus a freshly-patched user block. Open a second tab
// and both fire seconds apart: one commits, the other's base revision is
// behind, and the person is asked to choose between two copies that are the
// same copy — having touched nothing.
//
// That is how an alarm gets ignored. sameSubstance exists to recognise the
// no-op write, and its one hard requirement is asymmetry: claiming two
// DIFFERENT copies are the same would suppress a banner somebody needed and
// lose their work. Claiming two identical copies differ only costs a banner
// nobody needed, which is where we already were.
describe('two copies of the same workspace', () => {
  const blob = () => ({
    user: { email: 'a@b.com', plan: 'pro' },
    tools: [{ id: 't1', name: 'Figma', cost: 12 }],
    employees: [{ id: 'e1', full_name: 'Amina' }],
    access: [], contracts: [], invoices: [], licenses: [],
  });

  it('are the same when only the revision differs', () => {
    // The two-tab race, exactly: identical data, different base revision.
    expect(sameSubstance({ ...blob(), _rev: 4 }, { ...blob(), _rev: 5 })).toBe(true);
  });

  it('are the same across every bookkeeping field', () => {
    // These are added by saveDb and saveUserData on the way past, not by a
    // person. A difference in them is not a difference in the workspace.
    const mine = { ...blob(), _rev: 1, _saved_at: 111, _trimmed: true, _shared_view: { role: 'editor' } };
    const theirs = { ...blob(), _rev: 9, _updatedAt: 999, _uid: 'u1', _chunks: { employees: 2 } };
    expect(sameSubstance(mine, theirs)).toBe(true);
  });

  it('are the same whatever order the keys are in', () => {
    // JSON key order is not data, and Firestore does not promise to preserve
    // it. A comparison sensitive to it would call every round-trip a conflict.
    const mine = { user: { plan: 'pro', email: 'a@b.com' }, tools: [] };
    const theirs = { tools: [], user: { email: 'a@b.com', plan: 'pro' } };
    expect(sameSubstance(mine, theirs)).toBe(true);
  });

  it('are the same when one side spells an absent value as undefined', () => {
    // localStorage and Firestore both drop undefined on the way through, so
    // one copy having the key and the other not is a round-trip artefact.
    expect(sameSubstance({ tools: [], note: undefined }, { tools: [] })).toBe(true);
  });
});

describe('two copies that genuinely differ', () => {
  const mine = {
    user: { email: 'a@b.com' },
    tools: [{ id: 't1', name: 'Figma' }],
    employees: [], access: [],
  };

  it('differ when a record was added somewhere else', () => {
    const theirs = { ...mine, tools: [...mine.tools, { id: 't2', name: 'Slack' }] };
    expect(sameSubstance(mine, theirs)).toBe(false);
  });

  it('differ when a record was removed somewhere else', () => {
    expect(sameSubstance(mine, { ...mine, tools: [] })).toBe(false);
  });

  it('differ when a field inside a record was edited', () => {
    // The case a shallow comparison would miss, and the commonest real edit.
    const theirs = { ...mine, tools: [{ id: 't1', name: 'Figma', cost: 40 }] };
    expect(sameSubstance(mine, theirs)).toBe(false);
  });

  it('differ when a nested field deep in the blob was edited', () => {
    const a = { settings: { alerts: { slack: { webhook: 'x' } } } };
    const b = { settings: { alerts: { slack: { webhook: 'y' } } } };
    expect(sameSubstance(a, b)).toBe(false);
  });

  it('differ when the same records are in a different order', () => {
    // Order is treated as data. Not because order is precious, but because
    // this function may only ever say "same" when it is certain — the cost of
    // a wrong "same" is somebody's work.
    const a = { tools: [{ id: 't1' }, { id: 't2' }] };
    const b = { tools: [{ id: 't2' }, { id: 't1' }] };
    expect(sameSubstance(a, b)).toBe(false);
  });

  it('differ when the user block was changed', () => {
    // The user block is mostly cloud-derived, but it also carries settings a
    // person edits, so it is compared like any other data rather than waved
    // through as bookkeeping.
    expect(sameSubstance(
      { user: { email: 'a@b.com', company: 'Acme' } },
      { user: { email: 'a@b.com', company: 'Acme SAS' } },
    )).toBe(false);
  });
});

describe('sameSubstance refuses to guess', () => {
  it('says different for anything that is not a pair of blobs', () => {
    // Every one of these reaching `true` would suppress a real conflict.
    const cases = [
      [null, {}], [{}, null], [undefined, {}], [{}, undefined],
      ['a', 'a'], [1, 1], [{}, 'x'], [[], []], [{ tools: [] }, [{ tools: [] }]],
    ];
    for (const [a, b] of cases) {
      expect(sameSubstance(a, b), JSON.stringify([a, b])).toBe(false);
    }
  });

  it('says different rather than throwing on a circular blob', () => {
    const a = { tools: [] };
    a.self = a;
    expect(() => sameSubstance(a, { tools: [] })).not.toThrow();
    expect(sameSubstance(a, { tools: [] })).toBe(false);
  });

  it('two empty blobs are the same, and that is safe', () => {
    // Nothing on either side means nothing to lose either way.
    expect(sameSubstance({}, { _rev: 3 })).toBe(true);
  });
});
