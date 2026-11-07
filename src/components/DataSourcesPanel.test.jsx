import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { translations } from '../translations';
import { recordSourceRun } from '../lib/dataSources';
import { DataSourcesPanel, FreshnessLine } from './DataSourcesPanel';

// ── Settings → Integrations: where the data came from; the dashboard line ──

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const t = (k) => translations.en[k] || k;
const NOW = new Date('2026-11-07T12:00:00Z');
const ago = (d) => new Date(NOW.getTime() - d * 86400000);
let root;
const mount = async (el) => {
  const host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  await act(async () => { root.render(<MemoryRouter>{el}</MemoryRouter>); });
};
const box = (id) => document.querySelector(`[data-testid="${id}"]`);
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; document.body.innerHTML = ''; });

const workspace = () => {
  let db = { employees: [{ id: 'e1' }, { id: 'e2' }], tools: [{ id: 't1' }], access: [{ id: 'a1' }], assets: [], invoice_records: [] };
  db = recordSourceRun(db, 'microsoft-365', { ok: true, counts: { total: 2, added: 2, updated: 0 }, at: ago(1) });
  db = recordSourceRun(db, 'okta', { ok: false, error: 'token expired', at: ago(0) });
  db = recordSourceRun(db, 'intune', { ok: true, at: ago(12) });
  return db;
};

describe('DataSourcesPanel', () => {
  it('shows each area with its freshness, failures and records with no source', async () => {
    await mount(<DataSourcesPanel db={workspace()} t={t} now={NOW} />);
    expect(box('ds-area-people').textContent).toContain('Current');
    expect(box('ds-area-people').textContent).toContain('from Microsoft 365');
    // Only the source behind the newest read is named on the area; Okta's old
    // success is in the table, not presented as today's data.
    expect(box('ds-area-people').textContent).not.toMatch(/from Microsoft 365, Okta/);
    expect(box('ds-area-people').textContent).toContain('Failed: Okta');
    expect(box('ds-area-access').textContent).toContain('Typed or imported earlier');
    expect(box('ds-area-access').textContent).toContain('1 record(s) with no recorded source');
    expect(box('ds-area-devices').textContent).toContain('Over a week old');
    expect(box('ds-area-usage').textContent).toContain('No data');
  });
  it('lists each source with its last success, its error, its counts, and whether it writes', async () => {
    await mount(<DataSourcesPanel db={workspace()} t={t} now={NOW} />);
    const rows = [...box('ds-sources').querySelectorAll('tbody tr')].map((r) => r.textContent);
    expect(rows[0]).toContain('Okta');
    expect(rows[0]).toContain('Last run failed');
    expect(rows[0]).toContain('token expired');
    expect(rows[1]).toContain('Microsoft 365');
    expect(rows[1]).toContain('read 2 · added 2 · updated 0');
    expect(rows[1]).toContain("blocks a leaver's sign-in");
    expect(rows[2]).toContain('Microsoft Intune');
    expect(rows[2]).toContain('Reads only');
  });
  it('says so when nothing has run', async () => {
    await mount(<DataSourcesPanel db={{ employees: [{ id: 'e' }] }} t={t} now={NOW} />);
    expect(box('data-sources').textContent).toContain('No connector or import has run');
  });
});

describe('FreshnessLine', () => {
  it('names the newest read, the failed connectors and the stale ones, and links to the details', async () => {
    await mount(<FreshnessLine db={workspace()} t={t} now={NOW} />);
    const line = box('dash-freshness');
    expect(line.textContent).toContain('Data last read');
    expect(line.textContent).toContain('Failed: Okta');
    expect(line.textContent).toContain('Not read for over a week: Microsoft Intune');
    expect(line.querySelector('a').getAttribute('href')).toBe('/settings?tab=integrations');
  });
  it('says the data was typed when no connector read it, and shows nothing for an empty workspace', async () => {
    await mount(<FreshnessLine db={{ tools: [{ id: 't' }] }} t={t} now={NOW} />);
    expect(box('dash-freshness').textContent).toContain('No connector has read this data');
    await act(async () => root.unmount()); root = null; document.body.innerHTML = '';
    await mount(<FreshnessLine db={{ tools: [] }} t={t} now={NOW} />);
    expect(box('dash-freshness')).toBeNull();
  });
});
