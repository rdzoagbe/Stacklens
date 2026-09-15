import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AUDIT_MAX, AUDIT_COLUMNS,
  auditActor, auditEntry, appendAudit, changedKeys, describeChange,
} from './audit';

// ── An empty audit log is worse than no audit log ───────────────────────────
//
// `audit_log` was chunked to Firestore, initialised on sign-in, exported to
// CSV from Settings → Data, exported again by the workspace export, and purged
// on account deletion. Nothing ever appended to it — there was no append
// helper in the repository at all. So the download produced a header row and
// nothing else, and the README told customers that revoking access "updates
// Stacklens's records and audit trail".
//
// For a product sold on access governance, the audit trail is the artefact an
// auditor or a DPO asks for by name. A button that promises one and delivers
// an empty file is the failure mode these tests exist to prevent recurring.

describe('an entry matches the columns the export already writes', () => {
  it('carries exactly the fields Settings → Data selects', () => {
    // THE constraint on this module. The CSV export was written first and
    // selects ["action","user","timestamp","details"] — entries under any
    // other spelling leave the download blank while looking wired up.
    const entry = auditEntry({ action: 'tool.created', details: 'Figma', user: 'a@b.com' });
    for (const column of AUDIT_COLUMNS) {
      expect(entry, `export column "${column}" missing from the entry`).toHaveProperty(column);
      expect(String(entry[column]).length, `export column "${column}" is empty`).toBeGreaterThan(0);
    }
  });

  it('agrees with the column list the export actually uses', () => {
    // Read from DataTab rather than trusted from memory: if someone renames a
    // column there, this fails instead of the download quietly emptying.
    const tab = readFileSync(resolve(process.cwd(), 'src/pages/settings/DataTab.jsx'), 'utf8');
    const m = /toCsv\(db\?\.audit_log \|\| \[\],\s*\[([^\]]*)\]/.exec(tab);
    expect(m, 'the audit CSV export was not found in DataTab').toBeTruthy();
    const columns = m[1].split(',').map(s => s.trim().replace(/["']/g, '')).filter(Boolean);
    expect(columns.sort()).toEqual([...AUDIT_COLUMNS].sort());
  });

  it('stamps an ISO timestamp', () => {
    const at = Date.UTC(2026, 8, 15, 12, 30, 0);
    expect(auditEntry({ action: 'x' }, at).timestamp).toBe('2026-09-15T12:30:00.000Z');
  });

  it('never leaves the actor blank', () => {
    // A row that cannot say who acted is close to useless; "unknown" at least
    // records that the actor was not established.
    expect(auditEntry({ action: 'x' }).user).toBe('unknown');
    expect(auditEntry({ action: 'x', user: '' }).user).toBe('unknown');
    expect(auditEntry({ action: 'x', user: null }).user).toBe('unknown');
  });

  it('survives being called with nothing', () => {
    expect(() => auditEntry()).not.toThrow();
    expect(auditEntry().action).toBe('unknown');
  });

  it('gives every entry a distinct id', () => {
    // Two actions inside the same millisecond are ordinary — a bulk import
    // writes several — and duplicate React keys or de-duplication collapsing
    // real events would both be silent.
    const at = 1_700_000_000_000;
    const ids = new Set(Array.from({ length: 50 }, () => auditEntry({ action: 'x' }, at).id));
    expect(ids.size).toBe(50);
  });
});

describe('who the actor is', () => {
  it('prefers the email, since that identifies a person across devices', () => {
    expect(auditActor({ user: { email: 'a@b.com', displayName: 'Amina' } })).toBe('a@b.com');
  });

  it('falls back to the display name', () => {
    expect(auditActor({ user: { displayName: 'Amina' } })).toBe('Amina');
  });

  it('says unknown rather than throwing on a malformed blob', () => {
    for (const bad of [null, undefined, {}, { user: null }, 'nope', 42]) {
      expect(auditActor(bad), JSON.stringify(bad)).toBe('unknown');
    }
  });
});

describe('the log grows at the front and is capped', () => {
  it('puts the newest entry first', () => {
    // Newest first is what the export and any future UI both want, and it is
    // what makes the cap lose the least useful rows.
    const db = { audit_log: [{ action: 'older' }] };
    expect(appendAudit(db, { action: 'newer' })[0].action).toBe('newer');
    expect(appendAudit(db, { action: 'newer' })[1].action).toBe('older');
  });

  it('never mutates the db it is given', () => {
    // The one funnel in useDbMutations assigns the result; a helper that also
    // mutated would make the order of those two steps matter.
    const log = [{ action: 'older' }];
    const db = { audit_log: log };
    appendAudit(db, { action: 'newer' });
    expect(db.audit_log).toBe(log);
    expect(db.audit_log.length).toBe(1);
  });

  it('caps the log, dropping the oldest', () => {
    // Not a tidiness concern: the whole workspace shares a 4.5MB localStorage
    // ceiling and _trimDbForStorage only knows how to trim `access`, so an
    // unbounded log would eventually cost people their saves.
    const db = { audit_log: Array.from({ length: AUDIT_MAX }, (_, i) => ({ action: `old_${i}` })) };
    const next = appendAudit(db, { action: 'newest' });
    expect(next.length).toBe(AUDIT_MAX);
    expect(next[0].action).toBe('newest');
    expect(next.at(-1).action).toBe(`old_${AUDIT_MAX - 2}`);
  });

  it('starts a log that does not exist yet, or is the wrong type', () => {
    // Blobs predate this field, and Firestore round-trips are not always the
    // type you wrote.
    for (const db of [{}, { audit_log: null }, { audit_log: 'nope' }, null, undefined]) {
      expect(appendAudit(db, { action: 'first' }).length, JSON.stringify(db)).toBe(1);
    }
  });
});

describe('what an update actually changed', () => {
  it('lists only the fields whose value moved', () => {
    // "updated the tool" with no detail is not a trail. Forms submit whole
    // objects, so most keys in a patch are unchanged.
    const before = { name: 'Figma', cost: 12, owner_email: 'a@b.com' };
    expect(changedKeys(before, { name: 'Figma', cost: 40 })).toEqual(['cost']);
  });

  it('treats empty-string and absent as the same', () => {
    // A form hands back '' where the record held undefined. Reporting that as
    // a change would fill the log with edits nobody made.
    expect(changedKeys({ note: undefined }, { note: '' })).toEqual([]);
    expect(changedKeys({}, { note: null })).toEqual([]);
  });

  it('compares nested values rather than object identity', () => {
    expect(changedKeys({ tags: ['a'] }, { tags: ['a'] })).toEqual([]);
    expect(changedKeys({ tags: ['a'] }, { tags: ['a', 'b'] })).toEqual(['tags']);
  });

  it('survives rubbish', () => {
    for (const bad of [null, undefined, 'nope', 42]) {
      expect(changedKeys({ a: 1 }, bad), String(bad)).toEqual([]);
      expect(() => changedKeys(bad, { a: 1 })).not.toThrow();
    }
  });

  it('reads as a sentence fragment when described', () => {
    expect(describeChange('Figma', ['cost'])).toBe('Figma (cost)');
    expect(describeChange('Figma', [])).toBe('Figma');
    expect(describeChange('', ['cost'])).toBe('cost');
  });
});

// ── Every governance action has to actually record one ─────────────────────
//
// The module above being right is necessary and not sufficient: this
// repository has shipped a correct helper wired up wrongly more than once, and
// an audit log is the specific case where "wired up wrongly" means an empty
// file that looks fine.
//
// Checked against the source of useDbQuery, with comments stripped, because a
// source check here was once satisfied by the comment describing the code.
// There is no behavioural test of the descriptor bodies: driving
// useDbMutations needs @testing-library/react, which this project does not
// have, and adding a dependency for it was not part of the ask. So this guard
// is deliberately specific — it names the action string each mutation must
// produce, so a mutation that records the wrong KIND of event fails too.
describe('the mutation funnel records what it changes', () => {
  const src = (() => {
    const raw = readFileSync(resolve(process.cwd(), 'src/hooks/useDbQuery.js'), 'utf8');
    return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  })();

  /** The body of one `const <name> = useMutation({ ... })` block. */
  const mutation = (name) => {
    const start = src.indexOf(`const ${name} = useMutation(`);
    expect(start, `mutation ${name} not found`).toBeGreaterThan(-1);
    const next = src.indexOf('\n  const ', start + 10);
    return src.slice(start, next === -1 ? undefined : next);
  };

  it('the funnel appends to audit_log and stamps the actor', () => {
    const fn = src.slice(src.indexOf('const setDb ='), src.indexOf('const invalidate ='));
    expect(fn).toMatch(/appendAudit\(/);
    expect(fn, 'a trail that cannot say who acted is close to useless')
      .toMatch(/auditActor\(/);
    expect(fn).toMatch(/audit_log\s*=/);
  });

  it('a failed descriptor costs the trail entry, never the edit', () => {
    // The caller is somebody saving work. A bug in an audit descriptor must
    // not lose it.
    const fn = src.slice(src.indexOf('const setDb ='), src.indexOf('const invalidate ='));
    expect(fn).toMatch(/try\s*\{[\s\S]*appendAudit[\s\S]*\}\s*catch/);
    expect(fn.indexOf('saveDb(next)')).toBeGreaterThan(fn.indexOf('appendAudit'));
  });

  // Each of these changes data a customer would be asked about in a review.
  it.each([
    ['createTool', 'tool.created'],
    ['updateTool', 'tool.updated'],
    ['deleteTool', 'tool.deleted'],
    ['createEmployee', 'employee.created'],
    ['updateEmployee', 'employee.updated'],
    ['deleteEmployee', 'employee.deleted'],
    ['createAccess', 'access.granted'],
    ['updateAccess', 'access.updated'],
    ['deleteAccess', 'access.removed'],
    ['bulkImport', 'import.'],
  ])('%s records %s', (name, action) => {
    const body = mutation(name);
    expect(body, `${name} passes no descriptor to setDb, so it records nothing`)
      .toMatch(/setDb\([\s\S]*\},\s*(\(|function)/);
    expect(body, `${name} does not produce a "${action}" action`)
      .toContain(action);
  });

  it('revoking access is recorded as a revocation, not as an edit', () => {
    // The event an auditor looks for by name, and the one the README promises.
    // Logging it as "access.updated" would technically be a trail and
    // practically useless.
    const body = mutation('updateAccess');
    expect(body).toMatch(/access\.revoked/);
    expect(body).toMatch(/pending_revocation/);
  });

  it('records the cascades, not just the row that was touched', () => {
    // Deleting a tool silently removes every grant to it; deleting an employee
    // removes their grants AND orphans the tools they owned. Those are exactly
    // the changes somebody queries months later.
    // Matched against the literal that reaches `details`, not the variable
    // name. A first version asserted /orphaned/, which the identifier
    // `orphaned` satisfied on its own — so deleting the line that actually
    // records it still passed. The test agreed with the bug.
    expect(mutation('deleteTool')).toMatch(/access grant\(s\) removed/);
    const emp = mutation('deleteEmployee');
    expect(emp).toMatch(/access grant\(s\) removed/);
    expect(emp).toMatch(/tool\(s\) orphaned/);
  });

  it('does not log an update that changed nothing', () => {
    // Forms submit whole objects, so "saved" with no change is common. A log
    // full of no-op edits is a log nobody reads.
    for (const name of ['updateTool', 'updateEmployee', 'updateAccess']) {
      expect(mutation(name), `${name} should return null when no key changed`)
        .toMatch(/if \(!keys\.length\) return null;/);
    }
  });

  it('does not log the bookkeeping save that runs on every page load', () => {
    // setAuth is patched from Firebase Auth on every auth event. Logging it
    // would write an entry per page view and bury everything real.
    expect(mutation('setAuth'), 'setAuth must not carry an audit descriptor')
      .not.toMatch(/setDb\([\s\S]*\},\s*\(/);
  });
});

// ── A switch that enforces nothing must not come back ──────────────────────
//
// Settings → Security showed four of them — Require MFA, IP restriction, Audit
// logging, and a session timeout — all writing a localStorage key called
// `sg_security` that nothing else in the codebase read. A customer's IT
// reviewer could enable "Enforce multi-factor authentication", watch it save,
// and have enforced nothing.
//
// The tab now lists only what is enforced. This guard is about the pattern
// rather than those four strings: a control is either read by something, or it
// is a claim.
describe('the security tab does not offer controls that do nothing', () => {
  // Comments stripped: the file explains this history in a comment that names
  // sg_security, and a first version of the assertion below matched that
  // comment instead of the code — the same trap this repo has hit before.
  const tab = readFileSync(resolve(process.cwd(), 'src/pages/settings/SecurityTab.jsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('no longer writes the key nothing read', () => {
    expect(tab, 'sg_security was written by this tab and read by nothing else')
      .not.toContain('sg_security');
  });

  it('offers no toggle or setting at all', () => {
    // If a control returns here it must be enforced somewhere, and this test
    // is the place to record where. Until then, no switches.
    expect(tab).not.toMatch(/<Toggle/);
    expect(tab).not.toMatch(/<select/);
    expect(tab).not.toMatch(/useState/);
  });

  it('says plainly what is not available, rather than leaving it to inference', () => {
    // An absent feature is a gap; an absent feature nobody mentions reads as
    // an oversight. The roadmap card names the three that do not exist.
    expect(tab).toMatch(/sec_roadmap_body/);
  });

  it('the README known-gaps list records the same thing', () => {
    // That section is headed "please keep this list honest".
    const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');
    const gaps = readme.slice(readme.indexOf('### Known gaps'));
    expect(gaps).toMatch(/MFA, IP restrictions or session timeout/);
  });
});
