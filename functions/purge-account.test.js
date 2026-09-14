import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  PURGED, RETAINED, RATE_LIMIT_PREFIXES, purgeAccount, purgeWorkspace,
} from './purge-account.js';

// ── Deleting an account has to actually delete it ───────────────────────────
//
// The bug: Firestore does not cascade a document delete to its
// subcollections, so deleting /userdata/{uid} left /userdata/{uid}/chunks
// behind — employees, access and audit_log, which is the names and work
// emails of the customer's staff. Both deletion paths had it. Against a DPA
// that says "deleted within 30 days".
//
// It was not caught by anything because the code reads correctly. You have to
// know that one Firestore behaviour to see it, and the one path that did it
// right (purgeClientOrgs) was written by someone who did.
//
// So the tests here are about the two things a reader cannot verify by
// reading: that every collection is covered, and that the order is right.

// ── A Firestore stand-in that records what was done to it ──────────────────
//
// A fake rather than the emulator because what matters is the sequence — which
// deletes happen, and in what order relative to each other. The emulator would
// confirm the end state and tell us nothing about whether the subcollection
// was cleared before or after its parent, which is the entire defect.
function fakeDb(seed = {}) {
  const ops = [];
  const store = new Map();          // path -> { fields }
  for (const [path, fields] of Object.entries(seed)) store.set(path, fields || {});

  const docsUnder = (colPath) => [...store.keys()]
    .filter(p => p.startsWith(colPath + '/') && p.slice(colPath.length + 1).indexOf('/') === -1);

  const makeDoc = (path) => ({
    id: path.split('/').pop(),
    path,
    get ref() { return makeDoc(path); },
    data: () => store.get(path) || {},
    delete: async () => { ops.push(['delete', path]); store.delete(path); },
    collection: (name) => makeCol(`${path}/${name}`),
  });

  const snapshotOf = (paths) => ({
    docs: paths.map(p => ({ id: p.split('/').pop(), ref: makeDoc(p), data: () => store.get(p) || {} })),
    get size() { return paths.length; },
  });

  const makeCol = (colPath) => ({
    path: colPath,
    doc: (id) => makeDoc(`${colPath}/${id}`),
    get: async () => { ops.push(['read', colPath]); return snapshotOf(docsUnder(colPath)); },
    where: (field, op, value) => ({
      get: async () => {
        ops.push(['query', colPath, field, value]);
        return snapshotOf(docsUnder(colPath).filter(p => {
          const v = store.get(p)?.[field];
          return Array.isArray(v) ? v.includes(value) : v === value;
        }));
      },
    }),
  });

  return {
    ops,
    store,
    collection: makeCol,
    batch: () => {
      const pending = [];
      return {
        delete: (ref) => pending.push(ref.path),
        commit: async () => {
          for (const p of pending) { ops.push(['delete', p]); store.delete(p); }
          pending.length = 0;
        },
      };
    },
  };
}

/** A workspace with chunks, a backup, and a scatter of per-user rows. */
const seedAccount = (uid = 'u1', email = 'a@b.com') => ({
  [`userdata/${uid}`]: { tools: [] },
  [`userdata/${uid}/chunks/employees_0`]: { items: [{ full_name: 'Amina Dupont' }] },
  [`userdata/${uid}/chunks/access_0`]: { items: [] },
  [`userdata/${uid}/chunks/audit_log_0`]: { items: [] },
  [`backups/${uid}__2026-09-01`]: { uid },
  [`backups/${uid}__2026-09-01/chunks/employees_0`]: { items: [{ full_name: 'Amina Dupont' }] },
  [`users/${uid}`]: { plan: 'pro' },
  [`integration_credentials/${uid}`]: { zoom: 'secret' },
  [`bank_requisitions/${uid}`]: {},
  [`alert_state/${uid}`]: {},
  [`inbox_invoices/${uid}`]: {},
  [`inbox_invoices/${uid}/items/i1`]: { vendor: 'Figma' },
  'api_keys/hash1': { uid },
  'inbox_tokens/tok1': { uid },
  'workspace_members/m1': { owner_uid: uid },
  'workspace_members/m2': { member_uid: uid },
  'workspace_members/m3': { member_email: email },
  // Deliberately left alone.
  'consent_logs/c1': { choice: 'accepted' },
  'legal_acceptances/u1_123': { uid },
  'app_config/flags': {},
});

const deletedPaths = (db) => db.ops.filter(([op]) => op === 'delete').map(([, p]) => p);

describe('the chunks subcollection is deleted, and before its parent', () => {
  it('clears every chunk under the workspace', async () => {
    const db = fakeDb(seedAccount());
    await purgeWorkspace(db, 'u1');
    const gone = deletedPaths(db);

    // The defect, stated as a test: these three survived account deletion.
    expect(gone).toContain('userdata/u1/chunks/employees_0');
    expect(gone).toContain('userdata/u1/chunks/access_0');
    expect(gone).toContain('userdata/u1/chunks/audit_log_0');
    expect(gone).toContain('userdata/u1');
  });

  it('deletes the subcollection BEFORE the parent document', async () => {
    // Ordering is not cosmetic. Once the parent is gone the subcollection is
    // unreachable by path: nothing enumerates it, no rule grants it, and it
    // stays in Firestore permanently. Deleting the parent first is how you get
    // data that cannot be deleted even once you know it is there.
    const db = fakeDb(seedAccount());
    await purgeWorkspace(db, 'u1');
    const gone = deletedPaths(db);
    expect(gone.indexOf('userdata/u1/chunks/employees_0'))
      .toBeLessThan(gone.indexOf('userdata/u1'));
  });

  it('clears the chunks under each backup snapshot too', async () => {
    const db = fakeDb(seedAccount());
    await purgeWorkspace(db, 'u1');
    const gone = deletedPaths(db);
    expect(gone).toContain('backups/u1__2026-09-01/chunks/employees_0');
    expect(gone).toContain('backups/u1__2026-09-01');
    expect(gone.indexOf('backups/u1__2026-09-01/chunks/employees_0'))
      .toBeLessThan(gone.indexOf('backups/u1__2026-09-01'));
  });
});

describe('a full account purge', () => {
  it('removes every per-user row', async () => {
    const db = fakeDb(seedAccount());
    await purgeAccount(db, 'u1', { email: 'a@b.com' });
    const gone = new Set(deletedPaths(db));

    for (const path of [
      'userdata/u1', 'userdata/u1/chunks/employees_0',
      'backups/u1__2026-09-01', 'backups/u1__2026-09-01/chunks/employees_0',
      'users/u1',
      'integration_credentials/u1',   // stored vendor secrets
      'bank_requisitions/u1', 'alert_state/u1',
      'inbox_invoices/u1', 'inbox_invoices/u1/items/i1',
      'api_keys/hash1', 'inbox_tokens/tok1',
      'workspace_members/m1', 'workspace_members/m2', 'workspace_members/m3',
    ]) {
      expect(gone.has(path), `${path} was not deleted`).toBe(true);
    }
  });

  it('leaves the records there is a legal reason to keep', async () => {
    // "Delete everything" is the wrong instinct: the DPA separately commits to
    // keeping consent logs for three years, and contract evidence has to
    // survive the contract it evidences.
    const db = fakeDb(seedAccount());
    await purgeAccount(db, 'u1', { email: 'a@b.com' });
    const gone = new Set(deletedPaths(db));
    for (const path of ['consent_logs/c1', 'legal_acceptances/u1_123', 'app_config/flags']) {
      expect(gone.has(path), `${path} must be retained`).toBe(false);
    }
  });

  it('deletes the Auth account last of all', async () => {
    // Everything before it is retryable while the account still exists. Remove
    // the Auth user first and a later failure leaves orphaned data with no
    // session to retry from and no user left to ask — which is exactly what
    // the old client-side version did.
    const db = fakeDb(seedAccount());
    // Recorded into the same log as the Firestore operations, so "last" is a
    // comparison rather than an assumption.
    await purgeAccount(db, 'u1', {
      email: 'a@b.com',
      deleteAuthUser: async (u) => { db.ops.push(['auth-delete', u]); },
    });

    const authAt = db.ops.findIndex(([op]) => op === 'auth-delete');
    expect(authAt, 'the Auth user was never deleted').toBeGreaterThan(-1);
    const lastDeleteAt = db.ops.reduce(
      (last, [op], i) => (op === 'delete' ? i : last), -1,
    );
    expect(lastDeleteAt, 'nothing was deleted at all').toBeGreaterThan(-1);
    expect(authAt, 'the Auth user must be removed after every Firestore delete')
      .toBeGreaterThan(lastDeleteAt);
    expect(db.ops.at(-1)[0]).toBe('auth-delete');
  });

  it('takes an agency\'s client workspaces with it, chunks and all', async () => {
    // A client workspace is not a row, it is a whole workspace. Deleting only
    // the client_orgs record would orphan its userdata and its chunks the same
    // way deleting /userdata orphaned its chunks.
    const db = fakeDb({
      ...seedAccount(),
      'client_orgs/org_aaaaaaaaaaaaaaaaaaaa': { owner_uid: 'u1', name: 'Boulangerie' },
      'userdata/org_aaaaaaaaaaaaaaaaaaaa': {},
      'userdata/org_aaaaaaaaaaaaaaaaaaaa/chunks/employees_0': { items: [{ full_name: 'Someone' }] },
      'backups/org_aaaaaaaaaaaaaaaaaaaa__2026-09-01': { uid: 'org_aaaaaaaaaaaaaaaaaaaa' },
    });
    await purgeAccount(db, 'u1', { email: 'a@b.com' });
    const gone = new Set(deletedPaths(db));
    expect(gone.has('userdata/org_aaaaaaaaaaaaaaaaaaaa/chunks/employees_0')).toBe(true);
    expect(gone.has('userdata/org_aaaaaaaaaaaaaaaaaaaa')).toBe(true);
    expect(gone.has('backups/org_aaaaaaaaaaaaaaaaaaaa__2026-09-01')).toBe(true);
    expect(gone.has('client_orgs/org_aaaaaaaaaaaaaaaaaaaa')).toBe(true);
  });

  it('clears the rate-limit rows for every prefix', async () => {
    const db = fakeDb(seedAccount());
    await purgeAccount(db, 'u1', { email: 'a@b.com' });
    const gone = new Set(deletedPaths(db));
    for (const p of RATE_LIMIT_PREFIXES) {
      expect(gone.has(`rate_limits/${p}_u1`), `rate_limits/${p}_u1`).toBe(true);
    }
  });

  it('does not query memberships by an empty email', async () => {
    // member_email is absent on plenty of rows, and `where('member_email','==','')`
    // would match none in Firestore but every row in a store that defaults it
    // to ''. Skipping the query is the safe shape either way: a deletion that
    // reaches other people's memberships is worse than one that misses.
    const db = fakeDb(seedAccount());
    await purgeAccount(db, 'u1', { email: '' });
    const emailQueries = db.ops.filter(
      ([op, , field]) => op === 'query' && field === 'member_email',
    );
    expect(emailQueries).toEqual([]);
  });

  it('refuses to run without a uid', async () => {
    // A purge with a falsy uid would build paths like `userdata/undefined` and
    // report success having deleted nothing.
    const db = fakeDb(seedAccount());
    await expect(purgeAccount(db, '')).rejects.toThrow(/uid required/);
    await expect(purgeAccount(db, undefined)).rejects.toThrow(/uid required/);
  });
});

// ── The guard for next year ─────────────────────────────────────────────────
//
// The bug above was one forgotten subcollection. The same bug arrives again
// the first time somebody adds a per-user collection and does not think about
// deletion — and it will be just as invisible, because the code will read
// correctly then too.
//
// So every collection the codebase touches has to be classified: purged, or
// retained with a reason. A new one is a test failure until someone decides.

function sourceFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', 'dist', '.git'].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.jsx?$/.test(entry) && !/\.test\.jsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

describe('every collection is classified as purged or deliberately retained', () => {
  const root = resolve(process.cwd());
  const files = [
    ...sourceFiles(join(root, 'functions')).filter(f => !f.includes('node_modules')),
    ...sourceFiles(join(root, 'src')),
  ];

  const found = new Set();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/collection\(\s*['"]([a-z_]+)['"]/g)) found.add(m[1]);
    // The client uses the modular form: collection(firestoreDb, 'name')
    for (const m of text.matchAll(/collection\(\s*\w+\s*,\s*['"]([a-z_]+)['"]/g)) found.add(m[1]);
  }

  it('found the collections to classify', () => {
    expect(found.size).toBeGreaterThan(10);
    expect(found.has('userdata')).toBe(true);
  });

  it.each([...found])('%s is classified', (name) => {
    const classified = name in PURGED || name in RETAINED;
    expect(classified, `The collection "${name}" appears in the source but is in `
      + 'neither PURGED nor RETAINED in functions/purge-account.js. Decide which: '
      + 'if it holds per-user data it must be deleted when the account is, and if '
      + 'it must survive deletion write down why. Leaving it unclassified is how '
      + 'the chunks subcollection came to outlive every account that was deleted.')
      .toBe(true);
  });

  it('nothing is in both lists', () => {
    const both = Object.keys(PURGED).filter(k => k in RETAINED);
    expect(both, 'a collection cannot be both purged and retained').toEqual([]);
  });

  it('every retained collection states a reason', () => {
    for (const [name, reason] of Object.entries(RETAINED)) {
      expect(String(reason).length, `${name} is retained with no reason given`)
        .toBeGreaterThan(10);
    }
  });
});

describe('the rate-limit prefix list matches the code that writes them', () => {
  it('covers every checkRateLimit caller', () => {
    // rate_limits rows are keyed `${prefix}_${uid}`, so they can only be
    // deleted by constructing the ids. A prefix added to a new endpoint and
    // not added here leaves a row behind per user, forever.
    const index = readFileSync(resolve(process.cwd(), 'functions/index.js'), 'utf8');
    const used = new Set(
      [...index.matchAll(/checkRateLimit\([^)]*?['"]([a-zA-Z_]+)['"]\s*\)/g)].map(m => m[1]),
    );
    expect(used.size, 'no checkRateLimit calls found — has it been renamed?')
      .toBeGreaterThan(3);
    const missing = [...used].filter(p => !RATE_LIMIT_PREFIXES.includes(p));
    expect(missing, 'rate-limit prefixes used by an endpoint but absent from '
      + 'RATE_LIMIT_PREFIXES in purge-account.js, so their rows survive account '
      + 'deletion').toEqual([]);
  });
});

// ── The browser must not try to do this itself ─────────────────────────────
//
// The old client-side deleteAccount removed the Auth user and then issued
// Firestore deletes, which the rules (isOwner(uid)) denied because there was
// no longer a signed-in user. The account went; the data stayed. It also could
// never have reached the chunks, the backups or the server-only collections.
//
// That is an easy thing to reintroduce — deleting two documents from the
// client looks simpler than calling an endpoint — and it fails silently, which
// is why it survived so long. So it is asserted against.
describe('the client delegates account deletion to the server', () => {
  const client = readFileSync(
    resolve(process.cwd(), 'src/firebase-config.js'), 'utf8',
  );
  const body = (() => {
    const start = client.indexOf('export async function deleteAccount');
    expect(start, 'deleteAccount not found in src/firebase-config.js')
      .toBeGreaterThan(-1);
    const next = client.indexOf('\nexport ', start + 1);
    return client.slice(start, next === -1 ? undefined : next)
      // Comments stripped first: a previous source guard in this repository
      // was satisfied by the comment describing the code instead of the code.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
  })();

  it('calls the workspace endpoint', () => {
    expect(body).toMatch(/action:\s*'deleteaccount'/);
  });

  it('does not delete Firestore documents from the browser', () => {
    // Rules are isOwner(uid) and most of the data is server-only, so a
    // client-side delete either fails silently or reaches a fraction of it.
    expect(body, 'deleteAccount must not issue its own Firestore deletes')
      .not.toMatch(/deleteDoc\s*\(/);
  });

  it('does not remove the Auth user from the browser', () => {
    // Doing this first is what denied the deletes that followed it.
    expect(body, 'deleteAccount must not call deleteUser — the server removes '
      + 'the Auth account last, after the data is gone')
      .not.toMatch(/\bdeleteUser\s*\(/);
  });
});
