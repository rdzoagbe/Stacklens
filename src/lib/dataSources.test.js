import { describe, it, expect } from 'vitest';
import {
  SOURCE_FACTS, SOURCE_IDS, AREAS, recordSourceRun, sourceState, sourcesOf, coverage, freshnessSummary, usageKnowledge, FRESH_DAYS, STALE_DAYS,
} from './dataSources';

// ── Where the data came from, and how fresh it is ──────────────────────────

const NOW = new Date('2026-11-07T12:00:00Z');
const ago = (d) => new Date(NOW.getTime() - d * 86400000);

describe('the facts', () => {
  it('name every connector and import the app has, with what each feeds, and only one that writes', () => {
    for (const id of ['google-workspace', 'microsoft-365', 'okta', 'slack', 'github', 'zoom', 'asana', 'salesforce', 'intune', 'google-licensing', 'csv:company', 'csv:assets', 'invoice:inbox', 'invoice:bank', 'audit']) {
      expect(SOURCE_IDS, id).toContain(id);
      expect(SOURCE_FACTS[id].feeds.every((a) => AREAS.includes(a)), id).toBe(true);
    }
    expect(SOURCE_IDS.filter((id) => SOURCE_FACTS[id].writes)).toEqual(['microsoft-365']);
  });
});

describe('recordSourceRun', () => {
  it('records a success with its counts, a failure with its error, and counts the runs', () => {
    let db = { tools: [] };
    db = recordSourceRun(db, 'microsoft-365', { ok: true, counts: { total: 120, added: 3 }, at: ago(2) });
    expect(db.data_sources['microsoft-365']).toMatchObject({ last_success_at: ago(2).toISOString(), last_error: '', counts: { total: 120, added: 3 }, runs: 1 });
    db = recordSourceRun(db, 'microsoft-365', { ok: false, error: 'AADSTS7000215 invalid client secret', at: ago(1) });
    const e = db.data_sources['microsoft-365'];
    expect(e.last_success_at).toBe(ago(2).toISOString());
    expect(e.last_attempt_at).toBe(ago(1).toISOString());
    expect(e.last_error).toMatch(/AADSTS7000215/);
    expect(e.counts).toEqual({ total: 120, added: 3 });
    expect(e.runs).toBe(2);
    expect(() => recordSourceRun(db, 'fax', {})).toThrow(/unknown data source/);
  });
  it('does not mutate its input', () => {
    const db = { tools: [], data_sources: { okta: { runs: 1 } } };
    recordSourceRun(db, 'okta', { ok: true, at: NOW });
    expect(db.data_sources.okta).toEqual({ runs: 1 });
  });
});

describe('sourceState', () => {
  it('is never, fresh, stale, old or failed', () => {
    expect(sourceState(undefined, NOW)).toBe('never');
    expect(sourceState({ last_success_at: ago(FRESH_DAYS - 1).toISOString() }, NOW)).toBe('fresh');
    expect(sourceState({ last_success_at: ago(FRESH_DAYS + 1).toISOString() }, NOW)).toBe('stale');
    expect(sourceState({ last_success_at: ago(STALE_DAYS + 1).toISOString() }, NOW)).toBe('old');
    expect(sourceState({ last_success_at: ago(1).toISOString(), last_attempt_at: ago(0).toISOString(), last_error: 'x' }, NOW)).toBe('failed');
    // A failure before the last success is history, not the state.
    expect(sourceState({ last_success_at: ago(0).toISOString(), last_attempt_at: ago(0).toISOString(), last_error: '' }, NOW)).toBe('fresh');
    expect(sourceState({ last_attempt_at: ago(0).toISOString(), last_error: 'denied' }, NOW)).toBe('failed');
  });
});

describe('coverage', () => {
  it('says which sources fed each area, how fresh, and where records have no source', () => {
    let db = { employees: [{ id: 'e1' }], tools: [{ id: 't1' }], access: [{ id: 'a1' }], assets: [], invoice_records: [] };
    db = recordSourceRun(db, 'microsoft-365', { ok: true, at: ago(3) });
    db = recordSourceRun(db, 'okta', { ok: false, error: 'token expired', at: ago(1) });
    db = recordSourceRun(db, 'csv:tools', { ok: true, at: ago(40) });
    const c = Object.fromEntries(coverage(db, NOW).map((x) => [x.area, x]));
    expect(c.people).toMatchObject({ latest: ago(3).toISOString(), state: 'fresh', records: 1, failed: ['okta'] });
    // Newest attempt first: the failed Okta run is the latest thing that happened.
    expect(c.people.sources.map((s) => s.id)).toEqual(['okta', 'microsoft-365']);
    expect(c.tools).toMatchObject({ state: 'old', records: 1 });
    expect(c.access).toMatchObject({ state: 'manual', latest: null, records: 1 });
    expect(c.devices).toMatchObject({ state: 'none', records: 0 });
    expect(c.usage).toMatchObject({ state: 'none', records: null });
  });
  it('lists sources newest first', () => {
    let db = {};
    db = recordSourceRun(db, 'slack', { ok: true, at: ago(5) });
    db = recordSourceRun(db, 'github', { ok: true, at: ago(1) });
    expect(sourcesOf(db, NOW).map((s) => s.id)).toEqual(['github', 'slack']);
  });
});

describe('freshnessSummary and usage', () => {
  it('gives the newest read and the failed and stale connectors', () => {
    let db = {};
    expect(freshnessSummary(db, NOW)).toEqual({ hasSources: false, latest: null, failed: [], stale: [] });
    db = recordSourceRun(db, 'microsoft-365', { ok: true, at: ago(2) });
    db = recordSourceRun(db, 'intune', { ok: true, at: ago(12) });
    db = recordSourceRun(db, 'zoom', { ok: false, error: 'x', at: ago(0) });
    expect(freshnessSummary(db, NOW)).toEqual({ hasSources: true, latest: ago(2).toISOString(), failed: ['zoom'], stale: ['intune'] });
  });
  it('tells a usage date a source confirmed from one typed by hand, and both from none', () => {
    expect(usageKnowledge({})).toEqual({ known: false, confirmed: false, source: null, read_at: null });
    expect(usageKnowledge({ last_used_date: '2026-10-01' })).toMatchObject({ known: true, confirmed: false });
    expect(usageKnowledge({ last_used_date: '2026-10-01', usage_source: 'google-workspace', usage_read_at: '2026-11-01' })).toMatchObject({ known: true, confirmed: true, source: 'google-workspace', read_at: '2026-11-01' });
  });
});

describe('every source, area, state and count is named in five languages', () => {
  it('has the keys', async () => {
    const { translations } = await import('../translations');
    const { sourceLabelKey, AREAS: areas } = await import('./dataSources');
    const keys = [
      ...SOURCE_IDS.map(sourceLabelKey),
      ...areas.map((a) => `ds_area_${a}`),
      ...['fresh', 'stale', 'old', 'failed', 'manual', 'none', 'never'].map((s) => `ds_state_${s}`),
      ...['total', 'added', 'updated', 'rows', 'lines', 'skus', 'assignments', 'usage_matched', 'discovered'].map((c) => `ds_count_${c}`),
    ];
    for (const lang of ['en', 'fr', 'de', 'es', 'pt']) {
      for (const k of keys) expect(translations[lang][k], `${lang}.${k}`).toBeTruthy();
    }
  });
  it('every count a caller records has a label', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const files = ['src/pages/settings/IntegrationsTab.jsx', 'src/components/ImportWizard.jsx', 'src/pages/DevicesPage.jsx', 'src/components/IntuneDevicesCard.jsx', 'src/components/GoogleLicencesCard.jsx', 'src/pages/ToolsPage.jsx', 'src/hooks/useDbQuery.js'];
    const { translations } = await import('../translations');
    const found = new Set();
    for (const f of files) {
      const src = readFileSync(resolve(process.cwd(), f), 'utf8');
      for (const m of src.matchAll(/counts: \{([^}]*)\}/g)) for (const k of m[1].matchAll(/([a-z_]+):/g)) found.add(k[1]);
      // and every recorded source id is a known one
      for (const m of src.matchAll(/recordSourceRun(?:Pure)?\.?(?:mutate)?\((?:db, )?\{?\s*(?:id: )?'([a-z0-9:-]+)'/g)) expect(SOURCE_IDS, `${f}: ${m[1]}`).toContain(m[1]);
    }
    expect(found.size).toBeGreaterThan(4);
    for (const k of found) expect(translations.en[`ds_count_${k}`], k).toBeTruthy();
  });
});
