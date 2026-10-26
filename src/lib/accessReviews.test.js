import { describe, it, expect } from 'vitest';
import {
  rowsInScope, startReview, decide, decideRemaining, summary, canSignOff, signOff, reviewCsv, sortReviews, scopeLabel,
} from './accessReviews';

// ── An access review: snapshot, decisions, sign-off, evidence ──────────────

const NOW = new Date('2026-10-26T09:00:00Z');
const emp = (id, department, status = 'active') => ({ id, full_name: `Person ${id}`, email: `${id}@acme.fr`, department, status });
const row = (id, employee_id, tool_id, extra = {}) => ({ id, employee_id, tool_id, access_level: 'viewer', status: 'active', granted_date: '2025-01-10', ...extra });
const db = () => ({
  user: { email: 'claire@acme.fr' },
  employees: [emp('ana', 'sales'), emp('ben', 'Engineering'), emp('cle', 'engineering'), emp('dan', 'sales', 'offboarded')],
  tools: [{ id: 'slack', name: 'Slack', owner_email: 'it@acme.fr' }, { id: 'gh', name: 'GitHub', owner_email: 'it@acme.fr' }],
  access: [
    row('a1', 'ana', 'slack'),
    row('a2', 'ben', 'gh', { access_level: 'admin', last_reviewed_date: '2025-02-01' }),
    row('a3', 'cle', 'gh'),
    row('a4', 'dan', 'slack'),
    row('a5', 'ana', 'gh', { status: 'revoked' }),
  ],
  access_reviews: [],
});

describe('the scope', () => {
  it('everyone takes every held access, never a revoked one', () => {
    expect(rowsInScope(db(), 'all').map((r) => r.access_id)).toEqual(['a1', 'a2', 'a3', 'a4']);
  });
  it('one tool, or one department whatever its case', () => {
    expect(rowsInScope(db(), 'tool', 'gh').map((r) => r.access_id)).toEqual(['a2', 'a3']);
    expect(rowsInScope(db(), 'department', 'engineering').map((r) => r.access_id)).toEqual(['a2', 'a3']);
    expect(rowsInScope(db(), 'department', 'Sales').map((r) => r.access_id)).toEqual(['a1', 'a4']);
  });
  it('each row carries the person, the tool, the level, the last review and the risk', () => {
    const [r] = rowsInScope(db(), 'tool', 'slack').filter((x) => x.access_id === 'a4');
    expect(r).toMatchObject({ employee_name: 'Person dan', employee_email: 'dan@acme.fr', tool_name: 'Slack', access_level: 'viewer', risk: 'former_employee', employee_status: 'offboarded', decision: null });
    expect(rowsInScope(db(), 'tool', 'gh').find((x) => x.access_id === 'a2').risk).toBe('needs_review');
  });
  it('labels the scope for the report', () => {
    expect(scopeLabel(db(), 'tool', 'gh')).toBe('GitHub');
    expect(scopeLabel(db(), 'department', 'sales')).toBe('sales');
    expect(scopeLabel(db(), 'all')).toBe('');
  });
});

describe('a review', () => {
  it('starts as a snapshot with nothing decided, by whoever started it', () => {
    const r = startReview(db(), { scope: 'tool', target: 'gh', by: 'claire@acme.fr', now: NOW });
    expect(r).toMatchObject({ scope: 'tool', target: 'gh', label: 'GitHub', started_by: 'claire@acme.fr', started_at: NOW.toISOString(), signed_off: null });
    expect(r.rows).toHaveLength(2);
    expect(summary(r)).toEqual({ total: 2, keep: 0, revoke: 0, undecided: 2 });
    expect(canSignOff(r)).toBe(false);
    expect(() => startReview(db(), { scope: 'nope' })).toThrow();
  });

  it('takes one decision at a time, can undo it, and can decide the rest in one go', () => {
    let r = startReview(db(), { scope: 'all', now: NOW });
    r = decide(r, 'a4', 'revoke', NOW);
    expect(r.rows.find((x) => x.access_id === 'a4')).toMatchObject({ decision: 'revoke', decided_at: NOW.toISOString() });
    r = decide(r, 'a4', null);
    expect(r.rows.find((x) => x.access_id === 'a4').decision).toBeNull();
    r = decide(r, 'a4', 'revoke', NOW);
    r = decideRemaining(r, 'keep', NOW);
    expect(summary(r)).toEqual({ total: 4, keep: 3, revoke: 1, undecided: 0 });
    expect(canSignOff(r)).toBe(true);
    expect(() => decide(r, 'a1', 'maybe')).toThrow();
  });

  it('cannot be signed with a row undecided, or an empty scope, or twice', () => {
    const d = db();
    let r = startReview(d, { scope: 'all', now: NOW });
    expect(signOff(d, r, { name: 'Claire', now: NOW }).applied).toBe(false);
    r = decideRemaining(r, 'keep', NOW);
    const signed = signOff({ ...d, access_reviews: [r] }, r, { name: 'Claire', now: NOW });
    expect(signed.applied).toBe(true);
    expect(signOff(signed.db, signed.review, { name: 'Again', now: NOW }).applied).toBe(false);
    expect(canSignOff(startReview({ ...d, access: [] }, { scope: 'all' }))).toBe(false);
  });

  it('signing stamps the kept rows reviewed today, revokes the others, and leaves the rest alone', () => {
    const d = db();
    let r = startReview(d, { scope: 'all', now: NOW });
    r = decide(decideRemaining(r, 'keep', NOW), 'a4', 'revoke', NOW);
    const { db: next, review } = signOff({ ...d, access_reviews: [r] }, r, { name: 'Claire Martin', by: 'claire@acme.fr', now: NOW });
    const by = Object.fromEntries(next.access.map((a) => [a.id, a]));
    expect(by.a1.last_reviewed_date).toBe('2026-10-26');
    expect(by.a2).toMatchObject({ last_reviewed_date: '2026-10-26', status: 'active' });
    expect(by.a4).toMatchObject({ status: 'revoked', last_reviewed_date: '2026-10-26' });
    expect(by.a5).toEqual(d.access[4]);                         // outside the review: untouched
    expect(review.signed_off).toEqual({ name: 'Claire Martin', by: 'claire@acme.fr', at: NOW.toISOString() });
    expect(next.access_reviews[0].signed_off.name).toBe('Claire Martin');
    expect(d.access[0].last_reviewed_date).toBeUndefined();   // the input is not mutated
  });

  it('falls back to the account for the signer’s name', () => {
    const d = db();
    const r = decideRemaining(startReview(d, { scope: 'all', now: NOW }), 'keep', NOW);
    expect(signOff({ ...d, access_reviews: [r] }, r, { name: '  ', by: 'claire@acme.fr', now: NOW }).review.signed_off.name).toBe('claire@acme.fr');
  });
});

describe('the evidence', () => {
  it('a CSV with one line per access, the decision, who signed and when', () => {
    const d = db();
    let r = decideRemaining(startReview(d, { scope: 'tool', target: 'gh', now: NOW }), 'keep', NOW);
    r = decide(r, 'a3', 'revoke', NOW);
    const { review } = signOff({ ...d, access_reviews: [r] }, r, { name: 'Claire', now: NOW });
    const lines = reviewCsv(review).trim().split('\n');
    expect(lines[0]).toBe('person,email,department,tool,level,granted,previously_reviewed,risk,decision,decided_at,signed_by,signed_at');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('Person ben,ben@acme.fr,Engineering,GitHub,admin,2025-01-10,2025-02-01,needs_review,keep,2026-10-26,Claire,2026-10-26');
    expect(lines[2]).toMatch(/^Person cle,.*,revoke,2026-10-26,Claire,2026-10-26$/);
    expect(reviewCsv(review, { sep: ';' }).split('\n')[1].split(';')).toHaveLength(12);
  });

  it('lists open reviews first, newest first', () => {
    const open = { id: 'o', started_at: '2026-01-01T00:00:00Z', signed_off: null };
    const older = { id: 's1', started_at: '2026-02-01T00:00:00Z', signed_off: { at: 'x' } };
    const newer = { id: 's2', started_at: '2026-03-01T00:00:00Z', signed_off: { at: 'x' } };
    expect(sortReviews([older, newer, open]).map((r) => r.id)).toEqual(['o', 's2', 's1']);
  });
});
