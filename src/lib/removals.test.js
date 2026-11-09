import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  removalOf, approveRemoval, requestRemoval, completeRemoval, verifyRemoval, cancelRemoval,
  removalQueue, removalsCsv, isMicrosoftTool,
} from './removals';
import { computeAccessDerivedRiskFlag } from './dataUtils';
import { buildSeedDb } from './db';

// ── Access removal is said as it is (Priority 2) ───────────────────────────

const AT = new Date('2026-11-09T10:00:00Z');
const row = (over = {}) => ({ id: 'a1', tool_id: 't1', tool_name: 'Slack', employee_id: 'e1', employee_name: 'Noah', employee_email: 'noah@x.fr', status: 'active', ...over });

describe('the four steps', () => {
  it('approving records the decision and leaves the access held', () => {
    const a = approveRemoval(row(), { by: 'amina@x.fr', at: AT, source: 'offboarding' });
    expect(a.status).toBe('pending_revocation');
    expect(a.removal).toEqual({ stage: 'approved', approved: { by: 'amina@x.fr', at: AT.toISOString(), source: 'offboarding' } });
    // Approving again changes nothing: the first decision stands.
    expect(approveRemoval(a, { by: 'other@x.fr', at: AT })).toBe(a);
  });

  it('a leaver whose removal is approved but not done is still high risk', () => {
    const emp = { e1: { id: 'e1', status: 'offboarded' } };
    const a = approveRemoval(row(), { by: 'a', at: AT });
    expect(computeAccessDerivedRiskFlag(a, emp, {})).toBe('former_employee');
    const done = completeRemoval(a, { by: 'a', at: AT, evidence: 'deleted in Slack admin' });
    expect(computeAccessDerivedRiskFlag(done, emp, {})).toBe('none');
  });

  it('requested names whom and the ticket; completing needs evidence and sets revoked', () => {
    let a = approveRemoval(row(), { by: 'a', at: AT });
    a = requestRemoval(a, { by: 'a', at: AT, to: 'IT', reference: 'IT-1' });
    expect(a.removal.requested).toEqual({ by: 'a', at: AT.toISOString(), to: 'IT', reference: 'IT-1' });
    expect(a.status).toBe('pending_revocation');
    expect(() => completeRemoval(a, { by: 'b', at: AT, evidence: ' ' })).toThrow('evidence_required');
    a = completeRemoval(a, { by: 'b', at: AT, evidence: 'Deactivated in Slack admin' });
    expect(a).toMatchObject({ status: 'revoked', revoked_at: AT.toISOString(), removal: { stage: 'completed', completed: { by: 'b', method: 'manual', evidence: 'Deactivated in Slack admin' } } });
    expect(a.removal.approved.by).toBe('a');
  });

  it('a person verifies only what was marked done; a connector read can do both', () => {
    const open = approveRemoval(row(), { by: 'a', at: AT });
    expect(() => verifyRemoval(open, { by: 'c', at: AT, evidence: 'looked' })).toThrow('not_completed');
    expect(() => verifyRemoval(open, { by: 'c', at: AT, method: 'connector', evidence: '' })).toThrow('evidence_required');
    const seen = verifyRemoval(open, { by: 'c', at: AT, method: 'connector', evidence: 'Google licence read: none' });
    expect(seen).toMatchObject({ status: 'revoked', removal: { stage: 'verified', completed: { method: 'connector' }, verified: { method: 'connector', by: 'c' } } });
  });

  it('cancel takes back an approval that was not carried out, never a done removal', () => {
    const a = approveRemoval(row(), { by: 'a', at: AT });
    expect(cancelRemoval(a)).toEqual(row());
    expect(() => cancelRemoval(completeRemoval(a, { by: 'a', at: AT, evidence: 'done in tool' }))).toThrow('not_open');
  });

  it('a row revoked before this existed is read as done with no record of how, not as proven', () => {
    const old = row({ status: 'revoked' });
    expect(removalOf(old)).toMatchObject({ stage: 'completed', legacy: true, completed: { method: 'unrecorded' } });
    // Evidence can be added afterwards, and then it can be verified.
    const fixed = completeRemoval(old, { by: 'a', at: AT, evidence: 'Removed in 2025, ticket IT-12' });
    expect(fixed.removal).toMatchObject({ stage: 'completed', completed: { method: 'manual' } });
    expect(fixed.removal.legacy).toBeUndefined();
  });
});

describe('the lists and the evidence file', () => {
  const db = {
    employees: [{ id: 'e1', full_name: 'Noah Petit', email: 'noah@x.fr' }],
    tools: [{ id: 't1', name: 'Slack' }],
    access: [
      approveRemoval(row({ id: 'open' }), { by: 'a', at: '2026-11-01T00:00:00Z' }),
      completeRemoval(row({ id: 'done' }), { by: 'b', at: '2026-11-02T00:00:00Z', evidence: '=HYPERLINK("x")' }),
      row({ id: 'legacy', status: 'revoked' }),
      verifyRemoval(completeRemoval(row({ id: 'ok' }), { by: 'b', at: AT, evidence: 'gone' }), { by: 'c', at: AT, evidence: 'checked list' }),
      row({ id: 'kept' }),
    ],
  };

  it('still to do, removed but not verified (older rows included), verified', () => {
    const q = removalQueue(db, Date.parse('2026-11-09T00:00:00Z'));
    expect(q.open.map((r) => r.id)).toEqual(['open']);
    expect(q.open[0]).toMatchObject({ person: 'Noah Petit', tool: 'Slack', age_days: 8 });
    expect(q.unverified.map((r) => r.id).sort()).toEqual(['done', 'legacy']);
    expect(q.verified.map((r) => r.id)).toEqual(['ok']);
  });

  it('the CSV carries who, when, how and the evidence, and a spreadsheet cannot run it', () => {
    const csv = removalsCsv(db);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('person,email,tool,stage,approved_by,approved_at,approved_from,requested_by,requested_at,requested_to,reference,removed_by,removed_at,removed_how,removal_evidence,verified_by,verified_at,verified_how,verification_evidence');
    expect(lines).toHaveLength(5);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(removalsCsv(db, { sep: ';' }).split('\n')[0]).toContain('person;email;tool');
  });

  it('only Microsoft’s own tools are closed by a Microsoft 365 sign-in block', () => {
    for (const n of ['Microsoft 365', 'Office 365', 'Teams', 'Outlook', 'SharePoint']) expect(isMicrosoftTool(n), n).toBe(true);
    for (const n of ['Slack', 'Notion', 'Salesforce']) expect(isMicrosoftTool(n), n).toBe(false);
  });

  it('the demo company has one removal at each step', () => {
    const q = removalQueue(buildSeedDb());
    expect(q.open.map((r) => [r.person, r.tool, r.stage])).toEqual([['Antoine Rey', 'Pennylane', 'requested']]);
    expect(q.unverified.length).toBeGreaterThanOrEqual(3);
    expect(q.verified.map((r) => r.tool)).toEqual(['Figma', 'Slack']); // newest first: Zoé's Figma (lib/lifecycle.js demo), Noah's Slack
  });
});

describe('no screen marks access gone without the steps', () => {
  it('nothing outside lib/removals.js writes status revoked on an access row', () => {
    const files = ['src/pages/AccessPage.jsx', 'src/pages/OffboardingPage.jsx', 'src/pages/DashboardPage.jsx',
      'src/components/EligibilityView.jsx', 'src/components/GoogleLicencesCard.jsx', 'src/components/RemovalsView.jsx', 'src/lib/accessReviews.js'];
    for (const f of files) {
      const src = readFileSync(resolve(process.cwd(), f), 'utf8');
      expect(src, f).not.toMatch(/status:\s*["']revoked["']/);
      expect(src, f).not.toMatch(/updateAccess\.mutate\([^)]*revoked/);
    }
  });
});
