import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildWorkspaceExport, exportFilename, exportSlug, EXPORT_COLLECTIONS,
} from './workspace-export';

// ── The file an agency keeps when a client leaves ──────────────────────────
//
// "Can we have our inventory back?" arrives months after the workspace was
// deleted. The export is the only thing standing between that question and
// an apology, so what it contains is worth pinning: every collection, empty
// ones included, and enough context to know whose data it is a year later.

describe('the client export', () => {
  const data = {
    tools: [{ id: 't1', name: 'Slack' }, { id: 't2', name: 'Figma' }],
    employees: [{ id: 'e1', name: 'Alice' }],
    access: [],
    audit_log: [{ id: 'a1' }],
    user: { plan: 'pro', stripe_customer_id: 'cus_123' },
  };

  it('carries every collection, including the empty ones', () => {
    const out = buildWorkspaceExport({ name: 'Acme', orgId: 'org_abc', data });
    for (const key of EXPORT_COLLECTIONS) {
      expect(Array.isArray(out[key]), `${key} missing from the export`).toBe(true);
    }
    // "No invoices" has to be recorded, not absent: a reader cannot tell an
    // empty collection from one the export forgot.
    expect(out.invoices).toEqual([]);
    expect(out.access).toEqual([]);
  });

  it('says whose data it is and when it was taken', () => {
    const at = new Date('2026-03-04T10:00:00Z');
    const out = buildWorkspaceExport({ name: 'Acme', orgId: 'org_abc', data, exportedAt: at });
    expect(out.client_name).toBe('Acme');
    expect(out.client_workspace_id).toBe('org_abc');
    expect(out.exported_at).toBe('2026-03-04T10:00:00.000Z');
    expect(out.stacklens_export).toBe(1);
  });

  it('counts what it contains, so a truncated file is obvious', () => {
    const out = buildWorkspaceExport({ name: 'Acme', data });
    expect(out.counts.tools).toBe(2);
    expect(out.counts.employees).toBe(1);
    expect(out.counts.access).toBe(0);
    expect(out.counts.invoices).toBe(0);
  });

  it('does not carry the agency billing record into a client file', () => {
    // The server does not send billing internals for a client workspace, but
    // this file is handed to a third party — it should not depend on that.
    const out = buildWorkspaceExport({ name: 'Acme', data });
    expect(out.user).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('cus_123');
  });

  it('survives a workspace with nothing in it', () => {
    for (const empty of [undefined, {}, { tools: null }]) {
      const out = buildWorkspaceExport({ name: 'Acme', data: empty });
      expect(out.tools).toEqual([]);
      expect(out.counts.tools).toBe(0);
    }
  });
});

describe('the export filename', () => {
  it('names the client and the date', () => {
    expect(exportFilename('Acme', new Date('2026-03-04T10:00:00Z')))
      .toBe('stacklens-acme-2026-03-04.json');
  });

  it('survives a client name that is not filename-safe', () => {
    // Client names are free text: accents, slashes, quotes, emoji.
    expect(exportSlug('Société Générale / Paris')).toBe('societe-generale-paris');
    expect(exportSlug('  ')).toBe('client');
    expect(exportSlug(undefined)).toBe('client');
    expect(exportSlug('../../etc/passwd')).toBe('etc-passwd');
    expect(exportFilename('A/B', new Date('2026-03-04T10:00:00Z'))).not.toContain('/');
  });
});

describe('downloading it', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('writes one JSON file and hands back what it wrote', async () => {
    const utils = await import('./dataUtils');
    const spy = vi.spyOn(utils, 'downloadText').mockImplementation(() => {});
    const { downloadWorkspaceExport } = await import('./workspace-export');
    const payload = downloadWorkspaceExport({
      name: 'Acme', orgId: 'org_abc', data: { tools: [{ id: 't1' }] },
    });
    expect(payload.counts.tools).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
    const [filename, text] = spy.mock.calls[0];
    expect(filename).toMatch(/^stacklens-acme-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(text).client_name).toBe('Acme');
  });
});
