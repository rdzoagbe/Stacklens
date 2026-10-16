// ── Deleting the workspace's tools, people and access ──────────────────────
//
// One definition for the two places that offer it: Settings → Data (tools,
// people and access, or people and access) and the dashboard's "Clear data".
// It records the deletion in the audit log (which promises every change to
// tools, people and access), saves locally, then waits for the cloud copy: if
// that fails while the local wipe succeeded, the next sign-in would bring the
// deleted data back, so the caller must not report success.

import { loadDb, saveDb, seedDbIfEmpty, saveOwnWorkspaceNow } from './db';
import { appendAudit, auditActor } from './audit';

/** What `scope` deletes: 'all' = tools, people and access; 'people' = people and access. */
export const CLEAR_SCOPES = {
  all: ['tools', 'employees', 'access'],
  people: ['employees', 'access'],
};

/** How many of each the scope would delete, for the confirmation. */
export function clearCounts(db, scope = 'all') {
  return Object.fromEntries(CLEAR_SCOPES[scope].map((k) => [k, (db?.[k] || []).length]));
}

/**
 * Deletes, saves, and waits for the cloud. Returns { ok, cloudFailed, counts }.
 * `uid` is the signed-in account; without one (no cloud) the local wipe is all.
 */
export async function clearWorkspaceData({ uid, scope = 'all' }) {
  const cur = loadDb() || seedDbIfEmpty();
  const counts = clearCounts(cur, scope);
  for (const k of CLEAR_SCOPES[scope]) cur[k] = [];
  const details = scope === 'all'
    ? `All tools (${counts.tools}), employees (${counts.employees}) and access (${counts.access}) deleted`
    : `All employees (${counts.employees}) and access (${counts.access}) deleted`;
  cur.audit_log = appendAudit(cur, { action: 'data.deleted', details, user: auditActor(cur) });
  saveDb(cur);
  if (uid) {
    try { await saveOwnWorkspaceNow(uid, cur); }
    catch { return { ok: false, cloudFailed: true, counts }; }
  }
  return { ok: true, cloudFailed: false, counts };
}
