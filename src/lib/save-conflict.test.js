import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Does the call site actually use the check? ──────────────────────────────
//
// revision.test.js proves the rule is right. That is not the part that goes
// wrong in this repository. What goes wrong is a correct rule wired up wrongly:
// the `_trimmed` guard was written, tested, and then satisfied by its own
// comment; the waste guard passed with the bug put back.
//
// So this file tests the wiring, through saveDb, with the debounce and the
// promises really running:
//
//   * a successful save teaches the local copy the revision it just committed
//     — without that, the NEXT save declares a stale base and the app
//     conflicts with itself on every second edit
//   * a conflict goes to the conflict state, never to the failure state,
//     because the failure state offers a retry that re-sends this payload and
//     silently destroys the other writer's work
//   * an ordinary failure still goes to the failure state and still retries
//   * "keep mine" re-bases on the stored revision instead of resending
//   * "keep theirs" does not send anything at all

vi.mock('../firebase-config', () => ({
  saveUserData: vi.fn(),
  loadUserData: vi.fn().mockResolvedValue(null),
  logConsent: vi.fn().mockResolvedValue(undefined),
  workspaceWrite: vi.fn(),
  workspaceRead: vi.fn().mockResolvedValue({ data: {}, role: 'editor' }),
}));

import { saveDb, enterSharedView } from './db';
import { saveUserData, loadUserData, workspaceWrite, workspaceRead } from '../firebase-config';
import { getSyncSnapshot, resolveConflict, _resetSyncStatus } from './syncStatus';
import { StaleWriteError } from './revision';

const LS_KEY = 'accessguard_v1';

/** A blob saveDb will treat as a real signed-in user's own workspace. */
const ownDb = (extra = {}) => ({
  user: { is_authenticated: true, is_demo: false },
  tools: [{ id: 't1', name: 'Figma' }],
  employees: [], access: [], contracts: [], invoices: [], licenses: [],
  ...extra,
});

/** Run the debounced cloud write and let its promise chain settle. */
async function flushSave() {
  await vi.advanceTimersByTimeAsync(1600);
  // The handlers chain a couple of awaits (re-read, re-save), so drain the
  // microtask queue rather than assuming one tick is enough.
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await vi.advanceTimersByTimeAsync(0);
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

const localBlob = () => JSON.parse(localStorage.getItem(LS_KEY));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  _resetSyncStatus();
  vi.useFakeTimers();
  // db.js remembers the uid from hydrateFromFirestore; set it the way the app
  // does rather than reaching into module state.
  localStorage.setItem('sg_auth_uid', 'u1');
});

afterEach(() => {
  vi.useRealTimers();
});

// hydrateFromFirestore is what sets the module-level uid that saveDb checks,
// so every test here goes through it first. It is also the function that has
// to carry the cloud revision onto a local-wins copy.
async function signIn({ cloud = null } = {}) {
  const { hydrateFromFirestore } = await import('./db');
  loadUserData.mockResolvedValueOnce(cloud);
  const p = hydrateFromFirestore('u1');
  await vi.advanceTimersByTimeAsync(0);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  return p;
}

describe('a save that succeeds', () => {
  it('teaches the local copy the revision it committed', async () => {
    localStorage.setItem(LS_KEY, JSON.stringify(ownDb({ _rev: 4 })));
    await signIn({ cloud: { tools: [{ id: 't1' }], _rev: 4, _updatedAt: 1 } });

    saveUserData.mockResolvedValueOnce(5);
    saveDb(ownDb({ _rev: 4, tools: [{ id: 't1' }, { id: 't2' }] }));
    await flushSave();

    expect(getSyncSnapshot().status).toBe('saved');
    // Without this the next save declares 4 again, the store holds 5, and the
    // user gets a conflict banner caused entirely by our own bookkeeping.
    expect(localBlob()._rev).toBe(5);
  });
});

describe('a save refused because somebody else wrote first', () => {
  beforeEach(async () => {
    localStorage.setItem(LS_KEY, JSON.stringify(ownDb({ _rev: 3 })));
    await signIn({ cloud: { tools: [{ id: 't1' }], _rev: 3, _updatedAt: 1 } });
  });

  it('goes to the conflict state, not the failure state', async () => {
    saveUserData.mockRejectedValueOnce(new StaleWriteError(4));
    saveDb(ownDb({ _rev: 3 }));
    await flushSave();

    expect(getSyncSnapshot().status).toBe('conflict');
  });

  it('does not lose the local copy', async () => {
    saveUserData.mockRejectedValueOnce(new StaleWriteError(4));
    saveDb(ownDb({ _rev: 3, tools: [{ id: 't1' }, { id: 'mine' }] }));
    await flushSave();

    // The whole point: nothing was overwritten anywhere, including here.
    expect(localBlob().tools.map(t => t.id)).toContain('mine');
  });

  it('"keep mine" re-bases on the stored revision instead of resending', async () => {
    saveUserData.mockRejectedValueOnce(new StaleWriteError(4));
    saveDb(ownDb({ _rev: 3 }));
    await flushSave();
    expect(getSyncSnapshot().status).toBe('conflict');

    // The store has moved to 4. Resending with base 3 would be refused again
    // forever; the resolution has to read what is there now.
    loadUserData.mockResolvedValueOnce({ tools: [], _rev: 4 });
    saveUserData.mockResolvedValueOnce(5);
    const ok = await resolveConflict('mine');

    expect(ok).toBe(true);
    const lastCall = saveUserData.mock.calls.at(-1);
    expect(lastCall[1]._rev, 'the forced write must declare the stored revision')
      .toBe(4);
    expect(getSyncSnapshot().status).toBe('saved');
    expect(localBlob()._rev).toBe(5);
  });

  it('"keep theirs" writes nothing', async () => {
    saveUserData.mockRejectedValueOnce(new StaleWriteError(4));
    saveDb(ownDb({ _rev: 3 }));
    await flushSave();

    const writesBefore = saveUserData.mock.calls.length;
    loadUserData.mockResolvedValueOnce({ tools: [{ id: 'theirs' }], _rev: 4 });
    await resolveConflict('theirs');

    // Taking the other copy must not turn into a write of any kind — that
    // would be the overwrite wearing the opposite label.
    expect(saveUserData.mock.calls.length).toBe(writesBefore);
  });
});

describe('an ordinary failure is still an ordinary failure', () => {
  it('goes to the failure state and keeps the retry', async () => {
    localStorage.setItem(LS_KEY, JSON.stringify(ownDb({ _rev: 2 })));
    await signIn({ cloud: { tools: [{ id: 't1' }], _rev: 2, _updatedAt: 1 } });

    saveUserData.mockRejectedValueOnce(new Error('network down'));
    saveDb(ownDb({ _rev: 2 }));
    await flushSave();

    // Misclassifying this as a conflict would replace a working retry with a
    // question the user cannot answer.
    expect(getSyncSnapshot().status).toBe('error');
    expect(getSyncSnapshot().error).toMatch(/network down/);
  });

  it('a conflict offers no blind retry', async () => {
    localStorage.setItem(LS_KEY, JSON.stringify(ownDb({ _rev: 2 })));
    await signIn({ cloud: { tools: [{ id: 't1' }], _rev: 2, _updatedAt: 1 } });

    saveUserData.mockRejectedValueOnce(new StaleWriteError(3));
    saveDb(ownDb({ _rev: 2 }));
    await flushSave();

    const { retrySync } = await import('./syncStatus');
    const before = saveUserData.mock.calls.length;
    // retrySync re-sends the exact payload that was refused. On a conflict
    // that is the silent overwrite, so there must be nothing for it to send.
    expect(await retrySync()).toBe(false);
    expect(saveUserData.mock.calls.length).toBe(before);
  });
});

describe('a shared workspace: two people, one document', () => {
  it('a 409 from the endpoint becomes the conflict state', async () => {
    localStorage.setItem(LS_KEY, JSON.stringify(ownDb()));
    await signIn({ cloud: { tools: [], _rev: 1, _updatedAt: 1 } });

    enterSharedView({ tools: [], employees: [], access: [] }, {
      owner_uid: 'owner1', owner_email: 'owner@acme.com', role: 'editor',
    });

    const conflict = new Error('changed elsewhere');
    conflict.isConflict = true;
    conflict.rev = 9;
    workspaceWrite.mockRejectedValueOnce(conflict);

    const shared = JSON.parse(localStorage.getItem(LS_KEY));
    saveDb({ ...shared, _rev: 8, tools: [{ id: 'x' }] });
    await flushSave();

    expect(getSyncSnapshot().status).toBe('conflict');
  });

  it('"keep mine" uses the revision the 409 reported', async () => {
    localStorage.setItem(LS_KEY, JSON.stringify(ownDb()));
    await signIn({ cloud: { tools: [], _rev: 1, _updatedAt: 1 } });

    enterSharedView({ tools: [], employees: [], access: [] }, {
      owner_uid: 'owner1', owner_email: 'owner@acme.com', role: 'editor',
    });

    const conflict = new Error('changed elsewhere');
    conflict.isConflict = true;
    conflict.rev = 9;
    workspaceWrite.mockRejectedValueOnce(conflict);

    const shared = JSON.parse(localStorage.getItem(LS_KEY));
    saveDb({ ...shared, _rev: 8, tools: [{ id: 'x' }] });
    await flushSave();

    workspaceWrite.mockResolvedValueOnce({ ok: true, rev: 10 });
    await resolveConflict('mine');

    // The endpoint already told us what is stored, so re-basing costs no
    // extra read — but it has to actually be used.
    expect(workspaceWrite.mock.calls.at(-1)[1]._rev).toBe(9);
  });
});

// ── The check has to be inside the transaction ─────────────────────────────
//
// Everything above mocks saveUserData, so it proves how db.js reacts to a
// conflict — not that the conflict is ever detected. The detection lives in
// firebase-config.js, which boots the Firebase SDK and is mocked here, so it
// is checked against its own source with the comments stripped first.
//
// Comments stripped because the last source guard written in this repository
// was satisfied by the comment describing the code rather than the code, and
// passed with the fix deleted.
//
// The ordering matters as much as the presence. A revision compared before the
// transaction opens is a check with a race in it: two saves both read the same
// stored revision, both pass, and one of them still disappears — the original
// bug, with a guard in front of it and every test green.
describe('the owner write path checks the revision inside the transaction', () => {
  const bodyOf = (source, name) => {
    const start = source.indexOf(name);
    expect(start, `${name} not found`).toBeGreaterThan(-1);
    const next = source.indexOf('\nexport ', start + 1);
    return source.slice(start, next === -1 ? undefined : next)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
  };

  it('opens a transaction and compares inside it', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(resolve(process.cwd(), 'src/firebase-config.js'), 'utf8');
    const body = bodyOf(src, 'export async function saveUserData');

    const txAt = body.indexOf('runTransaction');
    expect(txAt, 'saveUserData must write inside a transaction: a revision '
      + 'compared before the write opens can be stale by the time it commits')
      .toBeGreaterThan(-1);

    const staleAt = body.indexOf('isStaleWrite');
    expect(staleAt, 'saveUserData must refuse a write whose base revision is '
      + 'no longer the stored one — without it every save is an unconditional '
      + 'overwrite of the whole workspace again').toBeGreaterThan(-1);
    expect(staleAt, 'the comparison must happen inside the transaction, not before it')
      .toBeGreaterThan(txAt);

    const bumpAt = body.indexOf('nextRev');
    expect(bumpAt, 'an accepted write must move the counter, or the next '
      + 'writer is checked against a revision that never changes')
      .toBeGreaterThan(txAt);
  });

  it('the shared-workspace endpoint does the same', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(resolve(process.cwd(), 'functions/index.js'), 'utf8');
    const start = src.indexOf("if (action === 'write')");
    expect(start, "the write action not found in functions/index.js").toBeGreaterThan(-1);
    const body = src.slice(start, src.indexOf("return res.status(400).json({ error: 'Unknown action' })", start))
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    const txAt = body.indexOf('runTransaction');
    expect(txAt, 'the endpoint must write inside a transaction').toBeGreaterThan(-1);
    expect(body.indexOf('isStaleWrite'), 'the endpoint must refuse a stale write')
      .toBeGreaterThan(txAt);
    expect(body, 'a refused write must answer 409 so the client can tell a '
      + 'conflict from a network failure — it must not retry the same payload')
      .toMatch(/status\(409\)/);
  });
});

// ── Signing in with a diverged local copy ──────────────────────────────────
//
// hydrateFromFirestore takes the newer of the two copies by timestamp. When
// local wins, the tempting tidy-up is to stamp the cloud's revision onto it so
// the next save "just works".
//
// That is a data-loss bug, and it was in this branch until a mutation test
// refused to fail for it. Local winning means the copies have diverged: this
// browser edited while another device carried the cloud forward. Stamping the
// cloud's revision makes the next save pass the staleness check and quietly
// replace the other device's work — the overwrite the check exists to stop,
// reintroduced one layer up, in the one code path nobody looks at.
//
// The correct answer to a genuine divergence is a conflict.
describe('hydration does not launder a diverged local copy', () => {
  it('keeps the local revision when local wins, so the next save is refused', async () => {
    localStorage.setItem(LS_KEY, JSON.stringify(ownDb({ _rev: 2, _saved_at: 9_999_999 })));
    // The cloud has moved on to 7 — another device has been working — but its
    // timestamp is older, so local wins on data.
    await signIn({ cloud: { tools: [{ id: 't1' }], _rev: 7, _updatedAt: 1_000 } });

    expect(localBlob()._rev,
      'adopting the cloud revision here lets the next save overwrite the other '
      + "device's work without asking").toBe(2);
  });

  it('takes the cloud revision along with the cloud copy when cloud wins', async () => {
    // The other half: when the cloud copy is the one adopted, its revision
    // comes with it, because that IS the state this browser now holds.
    localStorage.setItem(LS_KEY, JSON.stringify(ownDb({ _rev: 2, _saved_at: 1_000 })));
    await signIn({
      cloud: {
        tools: [{ id: 'cloud' }], employees: [], access: [],
        _rev: 7, _updatedAt: 9_999_999,
      },
    });

    expect(localBlob()._rev).toBe(7);
    expect(localBlob().tools[0].id).toBe('cloud');
  });
});

// ── The banner Roland saw with nothing touched ──────────────────────────────
//
// useAuth calls saveDb on EVERY auth event, so every page load sends a write
// carrying the same data with a freshly-patched user block. Open the app in a
// second tab — or wake a phone and a laptop together — and both fire seconds
// apart. One commits, the other's base revision is now behind, and the person
// is asked to choose between two copies that are the same copy.
//
// That is an alarm firing when nothing is wrong, on a page nobody typed into,
// and it is how people learn to dismiss the alarm that matters.
//
// These tests are about narrowing the banner to real divergence WITHOUT
// widening the silence: each "no banner" case is paired with the same setup
// plus one real difference, which must still raise it.
describe('a conflict where both copies hold the same data', () => {
  beforeEach(async () => {
    localStorage.setItem(LS_KEY, JSON.stringify(ownDb({ _rev: 3 })));
    await signIn({ cloud: { ...ownDb(), _rev: 3, _updatedAt: 1 } });
  });

  it('does not raise the banner', async () => {
    saveUserData.mockRejectedValueOnce(new StaleWriteError(4));
    // What the other tab committed: our data, one revision on.
    loadUserData.mockResolvedValueOnce({ ...ownDb(), _rev: 4, _updatedAt: 2, _uid: 'u1' });
    saveDb(ownDb({ _rev: 3 }));
    await flushSave();

    expect(getSyncSnapshot().status, 'nothing diverged, so there is nothing to ask')
      .toBe('saved');
  });

  it('adopts the revision the other tab committed, so the next edit works', async () => {
    // Without this the local copy keeps declaring 3 and every subsequent save
    // conflicts too — the banner would be suppressed and the sync silently
    // stuck, which is worse than the false alarm.
    saveUserData.mockRejectedValueOnce(new StaleWriteError(4));
    loadUserData.mockResolvedValueOnce({ ...ownDb(), _rev: 4 });
    saveDb(ownDb({ _rev: 3 }));
    await flushSave();

    expect(localBlob()._rev).toBe(4);
  });

  it('does not write anything', async () => {
    // The stored copy already holds this data. A write would be a second
    // pointless round trip and another chance to lose the same race.
    saveUserData.mockRejectedValueOnce(new StaleWriteError(4));
    loadUserData.mockResolvedValueOnce({ ...ownDb(), _rev: 4 });
    saveDb(ownDb({ _rev: 3 }));
    await flushSave();

    expect(saveUserData.mock.calls.length, 'one refused attempt and no more').toBe(1);
  });

  it('still raises the banner when the stored copy really differs', async () => {
    // Same race, one real edit on the other side. This is the case the whole
    // mechanism exists for and it must survive the fix above.
    saveUserData.mockRejectedValueOnce(new StaleWriteError(4));
    loadUserData.mockResolvedValueOnce({
      ...ownDb({ tools: [{ id: 't1', name: 'Figma' }, { id: 't2', name: 'Slack' }] }),
      _rev: 4,
    });
    saveDb(ownDb({ _rev: 3 }));
    await flushSave();

    expect(getSyncSnapshot().status).toBe('conflict');
  });

  it('still raises the banner when the local copy has the unsent edit', async () => {
    // The direction that actually loses work: this browser edited, somebody
    // else wrote first. Suppressing here would discard the local edit.
    saveUserData.mockRejectedValueOnce(new StaleWriteError(4));
    loadUserData.mockResolvedValueOnce({ ...ownDb(), _rev: 4 });
    saveDb(ownDb({ _rev: 3, tools: [{ id: 't1', name: 'Figma' }, { id: 'mine' }] }));
    await flushSave();

    expect(getSyncSnapshot().status).toBe('conflict');
    expect(localBlob().tools.map(t => t.id)).toContain('mine');
  });

  it('raises the banner when the stored copy cannot be read', async () => {
    // Unproven is not the same as identical. A failed read must leave the
    // conflict standing, never assume it away.
    saveUserData.mockRejectedValueOnce(new StaleWriteError(4));
    loadUserData.mockRejectedValueOnce(new Error('offline'));
    saveDb(ownDb({ _rev: 3 }));
    await flushSave();

    expect(getSyncSnapshot().status).toBe('conflict');
  });

  it('raises the banner when the stored copy is missing entirely', async () => {
    saveUserData.mockRejectedValueOnce(new StaleWriteError(4));
    loadUserData.mockResolvedValueOnce(null);
    saveDb(ownDb({ _rev: 3 }));
    await flushSave();

    expect(getSyncSnapshot().status).toBe('conflict');
  });
});

describe('the same no-op race in a shared workspace', () => {
  const sharedDb = (extra = {}) => ({
    ...ownDb(),
    _shared_view: { owner_uid: 'owner1', owner_email: 'o@b.com', role: 'editor' },
    ...extra,
  });

  it('does not raise the banner when the owner stored the same data', async () => {
    // Two people opening one workspace at the same time, neither of them
    // having typed anything yet.
    workspaceWrite.mockRejectedValueOnce(
      Object.assign(new Error('conflict'), { isConflict: true, rev: 6 }),
    );
    workspaceRead.mockResolvedValueOnce({ data: { ...ownDb(), _rev: 6 }, role: 'editor' });
    saveDb(sharedDb({ _rev: 5 }));
    await flushSave();

    expect(getSyncSnapshot().status).toBe('saved');
    expect(localBlob()._rev).toBe(6);
  });

  it('still raises the banner when the owner really changed something', async () => {
    workspaceWrite.mockRejectedValueOnce(
      Object.assign(new Error('conflict'), { isConflict: true, rev: 6 }),
    );
    workspaceRead.mockResolvedValueOnce({
      data: { ...ownDb({ tools: [] }), _rev: 6 }, role: 'editor',
    });
    saveDb(sharedDb({ _rev: 5 }));
    await flushSave();

    expect(getSyncSnapshot().status).toBe('conflict');
  });
});

// ── A page view should not cost a cloud write ───────────────────────────────
//
// useAuth calls saveDb on every onAuthStateChanged event, so every page load
// sent the whole blob to Firestore — and for a workspace of any size that is
// several chunk documents per page VIEW, for a save nobody asked for. Every
// field it patches comes from Firebase Auth or /users and is re-derived on the
// next load.
//
// It cannot just be deleted. It doubles as the only retry a failed save gets:
// markSyncFailed keeps a retry function, but that lives in module memory and a
// reload throws it away. So the rule is not "bookkeeping saves never sync", it
// is "bookkeeping saves may skip the cloud WHEN the cloud is provably current".
//
// Which means every test here comes in pairs: the write that should be skipped,
// and the one that must still happen.
describe('the save on every page load', () => {
  /** What useAuth does at mount: patch the user block, save, edit nothing. */
  const mountSave = (blob) => saveDb(blob, { cloudSync: false });

  it('sends nothing when this browser holds exactly the stored copy', async () => {
    // The fresh-browser case: nothing local, hydration adopts the cloud copy.
    // Sending it straight back would be a round trip to store what we just read.
    await signIn({ cloud: { ...ownDb(), _rev: 3, _updatedAt: 5 } });

    mountSave(ownDb({ _rev: 3 }));
    await flushSave();

    expect(saveUserData).not.toHaveBeenCalled();
  });

  it('still writes localStorage when it skips the cloud', async () => {
    // Skipping the backup must never mean skipping the save. The local copy is
    // the app's read path — every page derives its numbers from it.
    await signIn({ cloud: { ...ownDb(), _rev: 3, _updatedAt: 5 } });

    mountSave(ownDb({ _rev: 3, tools: [{ id: 't1', name: 'renamed' }] }));
    await flushSave();

    expect(localBlob().tools[0].name).toBe('renamed');
  });

  it('still sends when this browser holds an unsynced edit', async () => {
    // The safety net, and the reason the mount write cannot simply go. An edit
    // whose cloud write failed before the last reload only gets up here.
    localStorage.setItem(LS_KEY, JSON.stringify(ownDb({
      _rev: 3, _saved_at: 999, tools: [{ id: 't1', name: 'Figma' }, { id: 'unsynced' }],
    })));
    await signIn({ cloud: { ...ownDb(), _rev: 3, _updatedAt: 1 } });

    saveUserData.mockResolvedValueOnce(4);
    mountSave(ownDb({ _rev: 3, tools: [{ id: 't1', name: 'Figma' }, { id: 'unsynced' }] }));
    await flushSave();

    expect(saveUserData).toHaveBeenCalled();
    expect(saveUserData.mock.calls.at(-1)[1].tools.map(t => t.id)).toContain('unsynced');
  });

  it('still sends when the cloud copy could not be read', async () => {
    // Unproven is not the same as synced. A failed read must cost a write, not
    // somebody's unsynced afternoon.
    localStorage.setItem(LS_KEY, JSON.stringify(ownDb({ _rev: 3, _saved_at: 999 })));
    await signIn({ cloud: null });

    saveUserData.mockResolvedValueOnce(4);
    mountSave(ownDb({ _rev: 3 }));
    await flushSave();

    expect(saveUserData).toHaveBeenCalled();
  });

  it('still sends in a browser that has no mark at all', async () => {
    // Someone carrying unsynced work from before any of this existed, or a
    // browser whose storage was partly cleared. Absence means "not proven",
    // so it syncs once and marks itself afterwards.
    await signIn({ cloud: { ...ownDb(), _rev: 3, _updatedAt: 5 } });
    localStorage.removeItem('accessguard_synced_v1');

    saveUserData.mockResolvedValueOnce(4);
    mountSave(ownDb({ _rev: 3 }));
    await flushSave();

    expect(saveUserData).toHaveBeenCalled();
  });

  it('does not skip an ordinary save, however current the cloud is', async () => {
    // cloudSync is a permission to skip bookkeeping, not a general filter. A
    // real edit goes up whatever the mark says.
    await signIn({ cloud: { ...ownDb(), _rev: 3, _updatedAt: 5 } });

    saveUserData.mockResolvedValueOnce(4);
    saveDb(ownDb({ _rev: 3, tools: [{ id: 't1' }, { id: 't2' }] }));
    await flushSave();

    expect(saveUserData).toHaveBeenCalled();
  });
});

describe('what makes a browser count as behind', () => {
  it('a failed save does, so the next page load retries it', async () => {
    await signIn({ cloud: { ...ownDb(), _rev: 3, _updatedAt: 5 } });

    saveUserData.mockRejectedValueOnce(new Error('offline'));
    saveDb(ownDb({ _rev: 3, tools: [{ id: 't1' }, { id: 'new' }] }));
    await flushSave();
    expect(getSyncSnapshot().status).toBe('error');

    // Reload. The in-memory retry is gone; this write is all that is left.
    saveUserData.mockResolvedValueOnce(4);
    saveDb(ownDb({ _rev: 3, tools: [{ id: 't1' }, { id: 'new' }] }), { cloudSync: false });
    await flushSave();

    expect(saveUserData.mock.calls.length, 'the failed edit must still go up').toBe(2);
  });

  it('a successful save does not, so the next page load is free', async () => {
    await signIn({ cloud: { ...ownDb(), _rev: 3, _updatedAt: 5 } });

    saveUserData.mockResolvedValueOnce(4);
    saveDb(ownDb({ _rev: 3, tools: [{ id: 't1' }, { id: 'new' }] }));
    await flushSave();
    const after = saveUserData.mock.calls.length;

    saveDb(ownDb({ _rev: 4, tools: [{ id: 't1' }, { id: 'new' }] }), { cloudSync: false });
    await flushSave();

    expect(saveUserData.mock.calls.length).toBe(after);
  });

  it('a conflict recognised as a no-op does not either', async () => {
    // The other tab already stored this data, so there is nothing left to push.
    await signIn({ cloud: { ...ownDb(), _rev: 3, _updatedAt: 5 } });

    saveUserData.mockRejectedValueOnce(new StaleWriteError(4));
    loadUserData.mockResolvedValueOnce({ ...ownDb(), _rev: 4 });
    saveDb(ownDb({ _rev: 3 }));
    await flushSave();
    expect(getSyncSnapshot().status).toBe('saved');
    const after = saveUserData.mock.calls.length;

    saveDb(ownDb({ _rev: 4 }), { cloudSync: false });
    await flushSave();

    expect(saveUserData.mock.calls.length).toBe(after);
  });

  it('a real conflict does, until it is resolved', async () => {
    // Nothing reached the cloud, so the local copy is still ahead and the next
    // page load must keep trying.
    await signIn({ cloud: { ...ownDb(), _rev: 3, _updatedAt: 5 } });

    saveUserData.mockRejectedValueOnce(new StaleWriteError(4));
    loadUserData.mockResolvedValueOnce({ ...ownDb({ tools: [] }), _rev: 4 });
    saveDb(ownDb({ _rev: 3, tools: [{ id: 't1' }, { id: 'mine' }] }));
    await flushSave();
    expect(getSyncSnapshot().status).toBe('conflict');

    saveUserData.mockResolvedValueOnce(5);
    saveDb(ownDb({ _rev: 3, tools: [{ id: 't1' }, { id: 'mine' }] }), { cloudSync: false });
    await flushSave();

    expect(saveUserData.mock.calls.length).toBe(2);
  });

  it('taking the stored copy does not, because local becomes that copy', async () => {
    await signIn({ cloud: { ...ownDb(), _rev: 3, _updatedAt: 5 } });

    saveUserData.mockRejectedValueOnce(new StaleWriteError(4));
    loadUserData.mockResolvedValueOnce({ ...ownDb({ tools: [] }), _rev: 4 });
    saveDb(ownDb({ _rev: 3, tools: [{ id: 't1' }, { id: 'mine' }] }));
    await flushSave();

    loadUserData.mockResolvedValueOnce({ ...ownDb({ tools: [] }), _rev: 4 });
    await resolveConflict('theirs');
    const after = saveUserData.mock.calls.length;

    saveDb(ownDb({ _rev: 4, tools: [] }), { cloudSync: false });
    await flushSave();

    expect(saveUserData.mock.calls.length).toBe(after);
  });
});

// ── The call site has to actually opt in ───────────────────────────────────
//
// The whole saving is in one argument at one call site. Checked against the
// source with comments stripped, because a source check in this codebase was
// once satisfied by the comment describing the code.
describe('useAuth marks its mount save as bookkeeping', () => {
  const body = (() => {
    const src = readFileSync(resolve(process.cwd(), 'src/hooks/useAuth.js'), 'utf8');
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  })();

  it('passes cloudSync: false on the auth-event save', () => {
    expect(body, 'the save that runs on every page load must be able to skip '
      + 'the cloud write, or the cost is unchanged')
      .toMatch(/saveDb\(cur,\s*\{\s*cloudSync:\s*false\s*\}\)/);
  });

  it('does not mark the sign-in and sign-out saves as bookkeeping', () => {
    // Those happen once per session, carry a real state change, and the
    // signed-out one must reach the cloud on its own terms.
    const marked = body.match(/cloudSync:\s*false/g) || [];
    expect(marked.length, 'exactly one save on the page-load path').toBe(1);
  });
});

// ── The branch a real page load actually takes ──────────────────────────────
//
// The tests above reach hydration's "no local data" and "cloud is newer"
// branches. Neither is the ordinary case, and testing only those would have
// let the whole fix ship doing nothing.
//
// On a real second visit the local copy exists AND looks newer, because the
// timestamp hydration compares is _saved_at — bumped by every localStorage
// write, including the bookkeeping save on every page load. So local "wins"
// every time, even when the two copies are identical. That branch is where
// the mark has to be decided by content, and it is the one that decides
// whether a returning user's page views are free.
describe('the ordinary second visit', () => {
  const identical = () => ownDb();

  it('costs no cloud write when the copies match, despite local looking newer', async () => {
    // localTs 5000 beats cloudTs 10, so hydration keeps the local copy — and
    // the two hold the same data, so there is nothing to push.
    localStorage.setItem(LS_KEY, JSON.stringify({ ...identical(), _rev: 3, _saved_at: 5000 }));
    await signIn({ cloud: { ...identical(), _rev: 3, _updatedAt: 10 } });

    saveDb({ ...identical(), _rev: 3 }, { cloudSync: false });
    await flushSave();

    expect(saveUserData, 'this is the case that decides whether page views are free')
      .not.toHaveBeenCalled();
  });

  it('is not fooled by a difference in bookkeeping alone', async () => {
    // The stored copy carries _uid, _updatedAt and a revision of its own; the
    // local one carries _saved_at. Comparing raw blobs would call every
    // returning visit dirty.
    localStorage.setItem(LS_KEY, JSON.stringify({ ...identical(), _rev: 3, _saved_at: 5000 }));
    await signIn({ cloud: { ...identical(), _rev: 9, _updatedAt: 10, _uid: 'u1', _chunks: { employees: 1 } } });

    saveDb({ ...identical(), _rev: 3 }, { cloudSync: false });
    await flushSave();

    expect(saveUserData).not.toHaveBeenCalled();
  });

  it('costs a write when the copies really differ', async () => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      ...ownDb({ tools: [{ id: 't1', name: 'Figma' }, { id: 'local-only' }] }),
      _rev: 3, _saved_at: 5000,
    }));
    await signIn({ cloud: { ...identical(), _rev: 3, _updatedAt: 10 } });

    saveUserData.mockResolvedValueOnce(4);
    saveDb(ownDb({ _rev: 3, tools: [{ id: 't1', name: 'Figma' }, { id: 'local-only' }] }), { cloudSync: false });
    await flushSave();

    expect(saveUserData).toHaveBeenCalled();
  });

  it('costs no write when the cloud copy was the newer one', async () => {
    // hydration replaces the local copy wholesale here, so local is the stored
    // copy by definition.
    localStorage.setItem(LS_KEY, JSON.stringify({ ...identical(), _rev: 2, _saved_at: 10 }));
    await signIn({ cloud: { ...identical(), _rev: 3, _updatedAt: 5000 } });

    saveDb({ ...identical(), _rev: 3 }, { cloudSync: false });
    await flushSave();

    expect(saveUserData).not.toHaveBeenCalled();
  });
});

describe('a shared workspace pays the same page-load cost', () => {
  const sharedDb = (extra = {}) => ({
    ...ownDb(),
    _shared_view: { owner_uid: 'owner1', owner_email: 'o@b.com', role: 'editor' },
    ...extra,
  });

  it('sends nothing on a page load when nothing is behind', async () => {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...ownDb(), _rev: 3, _saved_at: 5000 }));
    await signIn({ cloud: { ...ownDb(), _rev: 3, _updatedAt: 10 } });

    saveDb(sharedDb({ _rev: 3 }), { cloudSync: false });
    await flushSave();

    expect(workspaceWrite).not.toHaveBeenCalled();
  });

  it('still sends an editor real work', async () => {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...ownDb(), _rev: 3, _saved_at: 5000 }));
    await signIn({ cloud: { ...ownDb(), _rev: 3, _updatedAt: 10 } });

    workspaceWrite.mockResolvedValueOnce({ rev: 4 });
    saveDb(sharedDb({ _rev: 3, tools: [{ id: 't1' }, { id: 't2' }] }));
    await flushSave();

    expect(workspaceWrite).toHaveBeenCalled();
  });
});
