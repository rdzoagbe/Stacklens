// ── The audit trail that did not exist ─────────────────────────────────────
//
// `audit_log` was declared as a chunked Firestore key, initialised to [] on
// sign-in, included in the workspace export, offered as a CSV download in
// Settings → Data, and purged on account deletion.
//
// Nothing ever wrote to it. There was no append helper anywhere in the
// repository. So "Export audit log" downloaded an empty file, and the README
// claimed that revoking access "updates Stacklens's records and audit trail".
//
// That is the wrong kind of gap for this product. Stacklens is sold on access
// governance to European SMBs, and the audit trail is precisely what an
// auditor or a DPO asks to see. An empty CSV is worse than no button, because
// the button is a promise.
//
// The entry shape is not a free choice. Settings → Data already exports
// `["action","user","timestamp","details"]`, so entries use those field names
// exactly — anything else and the download stays blank while looking wired up.
// audit-log.test.js pins that agreement down.

/**
 * How many entries to keep.
 *
 * The log is chunked on the way to Firestore, so the 1MB document limit is not
 * the binding constraint — localStorage is. The whole workspace shares a 4.5MB
 * ceiling in lib/db, and _trimDbForStorage only knows how to trim `access`, so
 * an unbounded log would eventually start costing people their saves. Newest
 * first and capped: the recent history is the part anyone reads, and a cap that
 * loses the oldest rows is better than a blob that loses the next write.
 */
export const AUDIT_MAX = 2000;

/** The columns Settings → Data exports. Entries must carry exactly these. */
export const AUDIT_COLUMNS = ['action', 'user', 'timestamp', 'details'];

/**
 * Who did it.
 *
 * Email first because that is what identifies a person across devices; the
 * display name is a fallback for accounts that arrived without one. Never
 * empty: a trail row that cannot say who acted is close to useless, and
 * "unknown" at least records that the actor was not established.
 */
export function auditActor(db) {
  const user = (db && typeof db === 'object' && db.user) || {};
  return user.email || user.displayName || 'unknown';
}

let _seq = 0;

/** One normalised row. */
export function auditEntry({ action, details = '', user = 'unknown' } = {}, now = Date.now()) {
  _seq = (_seq + 1) % 1e6;
  return {
    // Only for React keys and de-duplication; the export ignores it.
    id: `aud_${now.toString(36)}_${_seq.toString(36)}`,
    action: String(action || 'unknown'),
    user: String(user || 'unknown'),
    timestamp: new Date(now).toISOString(),
    details: String(details == null ? '' : details),
  };
}

/**
 * The log with this entry on the front, capped.
 *
 * Pure: returns a new array and never touches `db`. The caller assigns it,
 * which keeps the one funnel in useDbMutations the only place that decides
 * whether an action is worth recording.
 */
export function appendAudit(db, entry, now = Date.now()) {
  const existing = Array.isArray(db && db.audit_log) ? db.audit_log : [];
  return [auditEntry(entry, now), ...existing].slice(0, AUDIT_MAX);
}

/**
 * Which fields a patch actually changed.
 *
 * A patch usually carries more keys than it changes — forms submit whole
 * objects — and "updated the tool" with no detail is not a trail. Field NAMES
 * only, not values: the names are what an auditor follows, and the values are
 * already in the record the row points at.
 */
export function changedKeys(before, patch) {
  if (!patch || typeof patch !== 'object') return [];
  const prev = (before && typeof before === 'object') ? before : {};
  return Object.keys(patch).filter((key) => {
    const a = prev[key];
    const b = patch[key];
    if (a === b) return false;
    // Forms hand back '' where the record held undefined; that is not a change.
    if ((a == null || a === '') && (b == null || b === '')) return false;
    if (typeof a === 'object' || typeof b === 'object') {
      try { return JSON.stringify(a) !== JSON.stringify(b); } catch { return true; }
    }
    return true;
  });
}

/** "name (a, b)" — a label plus what changed, for an update row. */
export function describeChange(label, keys) {
  const name = String(label || '').trim();
  if (!keys || !keys.length) return name;
  return name ? `${name} (${keys.join(', ')})` : keys.join(', ');
}
