import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GENESIS, MAX_EVENTS_PER_CALL, MAX_DETAILS,
  cleanEvents, chainRows, hashRow, verifyChain, appendToChain, readChain, SHOWN_ROWS,
} from './audit-chain.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── The server's audit trail shows any change made after the fact ──────────

const AT = '2026-10-27T10:00:00.000Z';
const build = (n, actor = 'alice@acme.example') => chainRows(null,
  Array.from({ length: n }, (_, i) => ({ action: 'tool.updated', details: `Tool ${i + 1}` })),
  { actor, at: AT });

describe('a chain', () => {
  it('links every row to the one before, from a fixed starting hash', () => {
    const { rows, head } = build(3);
    expect(rows.map(r => r.seq)).toEqual([1, 2, 3]);
    expect(rows[0].prev_hash).toBe(GENESIS);
    expect(rows[1].prev_hash).toBe(rows[0].hash);
    expect(rows[2].prev_hash).toBe(rows[1].hash);
    expect(head).toEqual({ count: 3, head_hash: rows[2].hash });
    expect(rows[0].hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('continues from an existing head', () => {
    const first = build(2);
    const more = chainRows(first.head, [{ action: 'tool.created', details: 'X' }], { actor: 'a', at: AT });
    expect(more.rows[0].seq).toBe(3);
    expect(more.rows[0].prev_hash).toBe(first.head.head_hash);
    expect(verifyChain([...first.rows, ...more.rows], more.head).ok).toBe(true);
  });

  it('verifies when untouched', () => {
    const { rows, head } = build(5);
    expect(verifyChain(rows, head)).toEqual({ ok: true, count: 5, broken_at: null });
  });

  it('shows an edited detail, actor, time or action', () => {
    for (const field of ['details', 'actor', 'at', 'action']) {
      const { rows, head } = build(5);
      rows[2] = { ...rows[2], [field]: 'changed' };
      expect(verifyChain(rows, head), field).toMatchObject({ ok: false, broken_at: 3 });
    }
  });

  it('shows an edit even when the edited row’s own hash was recomputed', () => {
    const { rows, head } = build(5);
    rows[1] = { ...rows[1], details: 'rewritten' };
    rows[1].hash = hashRow(rows[1]);
    expect(verifyChain(rows, head)).toMatchObject({ ok: false, broken_at: 3 });
  });

  it('shows a row removed from the middle, rows reordered, and a row removed from the end', () => {
    const a = build(5);
    expect(verifyChain([...a.rows.slice(0, 2), ...a.rows.slice(3)], a.head)).toMatchObject({ ok: false, broken_at: 3 });
    const b = build(5);
    expect(verifyChain([b.rows[0], b.rows[2], b.rows[1], b.rows[3], b.rows[4]], b.head)).toMatchObject({ ok: false, broken_at: 2 });
    const c = build(5);
    expect(verifyChain(c.rows.slice(0, 4), c.head)).toMatchObject({ ok: false, broken_at: 5 });
  });
});

describe('what a browser may send', () => {
  it('only an action name and a detail, and no more than a batch', () => {
    const out = cleanEvents([
      { action: 'tool.created', details: 'Slack', actor: 'forged@evil.example', at: '1999-01-01', seq: 1, hash: 'x' },
      { action: 'DROP TABLE', details: 'x' },
      { action: '', details: 'x' },
      null,
      { action: 'access.revoked', details: 'y'.repeat(MAX_DETAILS + 50) },
    ]);
    expect(out).toEqual([
      { action: 'tool.created', details: 'Slack' },
      { action: 'access.revoked', details: 'y'.repeat(MAX_DETAILS) },
    ]);
    expect(cleanEvents(Array.from({ length: 80 }, () => ({ action: 'a' })))).toHaveLength(MAX_EVENTS_PER_CALL);
    expect(cleanEvents('nope')).toEqual([]);
  });

  it('never a name the server keeps for what it does itself', () => {
    const forged = [{ action: 'team.invited', details: 'x' }, { action: 'client_workspace.deleted', details: 'y' }, { action: 'tool.created', details: 'z' }];
    expect(cleanEvents(forged).map((e) => e.action)).toEqual(['tool.created']);
    expect(cleanEvents(forged, { server: true })).toHaveLength(3);
  });
});

// A transaction-shaped stand-in for Firestore, enough to run the real append.
function fakeDb() {
  const store = new Map();
  const ref = (path) => ({
    path,
    collection: (name) => ({
      doc: (id) => ref(`${path}/${name}/${id}`),
      orderBy: (_f, dir) => ({ limit: (n) => ({ get: async () => ({
        docs: [...store.entries()].filter(([k]) => k.startsWith(`${path}/${name}/`))
          .sort(([a], [b]) => (dir === 'desc' ? b.localeCompare(a) : a.localeCompare(b))).slice(0, n).map(([, v]) => ({ data: () => v })),
      }) }) }),
    }),
    get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
  });
  return {
    store,
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
    runTransaction: async (fn) => fn({
      get: (r) => r.get(),
      set: (r, v) => { store.set(r.path, v); },
    }),
  };
}

describe('appending and reading back', () => {
  it('stores rows under the workspace, with the server’s actor and time, and reads them back intact', async () => {
    const db = fakeDb();
    const now = new Date('2026-10-27T09:00:00Z');
    await appendToChain(db, 'ws1', [{ action: 'tool.created', details: 'Slack', actor: 'forged' }], 'alice@acme.example', now);
    const out = await appendToChain(db, 'ws1', [{ action: 'tool.deleted', details: 'Loom' }], 'bob@acme.example', now);
    expect(out).toMatchObject({ appended: 1, count: 2 });
    const { rows, check } = await readChain(db, 'ws1');
    expect(check).toEqual({ ok: true, count: 2, broken_at: null });
    expect(rows.map(r => [r.seq, r.actor, r.action, r.at])).toEqual([
      [1, 'alice@acme.example', 'tool.created', now.toISOString()],
      [2, 'bob@acme.example', 'tool.deleted', now.toISOString()],
    ]);
    // Someone with database access edits a row: the read says so.
    const key = 'audit_chains/ws1/events/000000000001';
    db.store.set(key, { ...db.store.get(key), details: 'Zoom' });
    expect((await readChain(db, 'ws1')).check).toMatchObject({ ok: false, broken_at: 1 });
  });

  it('shows the newest rows first, also past the read limit', async () => {
    const db = fakeDb();
    await appendToChain(db, 'ws1', Array.from({ length: 30 }, (_, i) => ({ action: 'tool.updated', details: `T${i + 1}` })), 'a');
    const all = await readChain(db, 'ws1');
    expect(all.newest[0].seq).toBe(30);
    const cut = await readChain(db, 'ws1', 10);
    expect(cut.truncated).toBe(true);
    expect(cut.newest[0].seq).toBe(30);
    expect(SHOWN_ROWS).toBe(500);
  });

  it('refuses a server name from a browser, takes it from the server', async () => {
    const db = fakeDb();
    expect(await appendToChain(db, 'ws1', [{ action: 'team.removed' }], 'a')).toEqual({ appended: 0 });
    expect(await appendToChain(db, 'ws1', [{ action: 'team.removed' }], 'a', new Date(), { server: true })).toMatchObject({ appended: 1 });
  });

  it('appends nothing when nothing valid was sent', async () => {
    const db = fakeDb();
    expect(await appendToChain(db, 'ws1', [{ action: '!!' }], 'a')).toEqual({ appended: 0 });
    expect(db.store.size).toBe(0);
  });
});

describe('the workspace function', () => {
  const src = readFileSync(resolve(__dirname, 'index.js'), 'utf8');
  const fn = src.slice(src.indexOf('exports.workspace = onRequest'), src.indexOf('\nexports.', src.indexOf('exports.workspace = onRequest') + 10));

  it('names the actor from the verified token, never from the request', () => {
    expect(fn).toMatch(/const actor = callerEmail \|\| \(decoded\.email \? `\$\{decoded\.email\} \(unverified\)` : `uid:\$\{decoded\.uid\}`\);/);
    const audit = fn.slice(fn.indexOf("if (action === 'audit')"), fn.indexOf("if (action === 'auditchain')"));
    expect(audit).toMatch(/appendToChain\(db, target, req\.body\?\.events, actor\)/);
    expect(audit).not.toMatch(/req\.body\?\.actor|body\.actor/);
  });

  it('checks access before touching another workspace’s trail', () => {
    const audit = fn.slice(fn.indexOf("if (action === 'audit')"), fn.indexOf("if (action === 'auditchain')"));
    expect(audit).toMatch(/assertCanWrite\(access/);
    const read = fn.slice(fn.indexOf("if (action === 'auditchain')"));
    expect(read.slice(0, 600)).toMatch(/if \(!access\) return res\.status\(403\)/);
  });

  it('records the actions the server performs itself', () => {
    for (const a of ['team.invited', 'team.removed', 'team.role_changed', 'client_workspace.created', 'client_workspace.deleted', 'client_workspace.restored']) {
      expect(fn, a).toContain(`'${a}'`);
    }
    // ...under the names a browser may not send.
    expect(fn).toMatch(/appendToChain\(db, workspaceId, \[\{ action: auditAction, details \}\], actor, new Date\(\), \{ server: true \}\)/);
  });

  it('purges a client workspace’s trail with it', () => {
    const purge = src.slice(src.indexOf('exports.purgeClientOrgs'));
    expect(purge.slice(0, 2000)).toMatch(/collection\('audit_chains'\)\.doc\(orgSnap\.id\)/);
  });

  it('is closed to every browser in firestore.rules', () => {
    const rules = readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8');
    expect(rules).toMatch(/match \/audit_chains\/\{workspaceId\}\/\{document=\*\*\} \{\s*allow read, write: if false;/);
  });
});
