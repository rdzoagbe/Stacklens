import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { noteAuditLog, flushAudit, setAuditSender, _resetAuditSync } from './auditSync';
import { appendAudit } from './audit';

// ── Every audit row made here reaches the server's tamper-evident copy ─────

const signedIn = (extra = {}) => ({ user: { is_authenticated: true, email: 'alice@acme.example' }, audit_log: [], ...extra });
const add = (db, action, details) => ({ ...db, audit_log: appendAudit(db, { action, details, user: 'x' }) });

describe('lib/auditSync', () => {
  let sent;
  beforeEach(() => {
    _resetAuditSync();
    sent = [];
    setAuditSender(async (target, events) => { sent.push({ target, events }); });
  });

  it('sends the rows made since the page loaded, oldest first, once each', async () => {
    let db = signedIn();
    db = add(db, 'tool.created', 'Slack');
    noteAuditLog(db);
    db = add(db, 'tool.updated', 'Slack (cost)');
    db = add(db, 'tool.deleted', 'Loom');
    noteAuditLog(db);
    noteAuditLog(db); // saved again: nothing new
    await flushAudit();
    expect(sent).toEqual([{ target: null, events: [
      { action: 'tool.created', details: 'Slack' },
      { action: 'tool.updated', details: 'Slack (cost)' },
      { action: 'tool.deleted', details: 'Loom' },
    ] }]);
  });

  it('never sends the browser’s actor or clock, and never history that came from the cloud', async () => {
    const old = { id: 'aud_old', action: 'tool.created', user: 'someone', timestamp: '2020-01-01T00:00:00.000Z', details: 'Old' };
    let db = signedIn({ audit_log: [old] });
    db = add(db, 'tool.updated', 'New');
    noteAuditLog(db);
    await flushAudit();
    expect(sent[0].events).toEqual([{ action: 'tool.updated', details: 'New' }]);
    expect(JSON.stringify(sent)).not.toMatch(/someone|timestamp|"user"/);
  });

  it('reports to the owner’s workspace when editing someone else’s, and not at all as a viewer or in the demo', async () => {
    noteAuditLog(add(signedIn({ _shared_view: { owner_uid: 'owner1', role: 'editor' } }), 'tool.created', 'A'));
    noteAuditLog(add(signedIn({ _shared_view: { owner_uid: 'owner2', role: 'viewer' } }), 'tool.created', 'B'));
    noteAuditLog(add({ user: { is_authenticated: true, is_demo: true }, audit_log: [] }, 'tool.created', 'C'));
    noteAuditLog(add({ user: {}, audit_log: [] }, 'tool.created', 'D'));
    await flushAudit();
    expect(sent).toEqual([{ target: 'owner1', events: [{ action: 'tool.created', details: 'A' }] }]);
  });

  it('a failed send costs the batch, never the save', async () => {
    setAuditSender(vi.fn(async () => { throw new Error('offline'); }));
    expect(() => noteAuditLog(add(signedIn(), 'tool.created', 'A'))).not.toThrow();
    await expect(flushAudit()).resolves.toBe(0);
  });

  it('is called from saveDb, the funnel every local save goes through', () => {
    const db = readFileSync(resolve(process.cwd(), 'src/lib/db.js'), 'utf8');
    const save = db.slice(db.indexOf('export function saveDb('), db.indexOf('export function saveDb(') + 300);
    expect(save).toMatch(/noteAuditLog\(db\);/);
    const cfg = readFileSync(resolve(process.cwd(), 'src/firebase-config.js'), 'utf8');
    expect(cfg).toMatch(/setAuditSender\(workspaceAudit\);/);
  });
});
