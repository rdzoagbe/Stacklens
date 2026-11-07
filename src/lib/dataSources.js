// ── Where the data came from, and how fresh it is ──────────────────────────
//
// A finding is only as good as the data under it. A connector that failed
// last night, a directory read three months ago, a people list typed by hand:
// each changes what "3 ex-employees still have access" means. Every source
// that feeds the workspace, a connector or a file, records its runs here:
//
//   db.data_sources[id] = { last_success_at, last_attempt_at, last_error,
//                           counts, runs }
//
// in the workspace itself, so the whole team and every device see the same
// record (it used to be one localStorage key per vendor in one browser). The
// record is written by the caller that did the work, through
// useDbMutations().recordSourceRun, so a run is never recorded that did not
// happen. SOURCE_FACTS is the static half: what each source reads, what it
// writes (one of them writes), and how it authenticates; the Integrations tab
// and the website's capability matrix read it, so they cannot disagree.

export const FRESH_DAYS = 7;   // read within a week: current
export const STALE_DAYS = 30;  // older than a month: old

export const AREAS = ['people', 'tools', 'access', 'devices', 'usage', 'invoices'];

/** Which workspace key each area lives in, for "records with no source". */
export const AREA_KEYS = { people: 'employees', tools: 'tools', access: 'access', devices: 'assets', invoices: 'invoice_records' };

export const SOURCE_FACTS = {
  'google-workspace': { feeds: ['people', 'tools', 'usage'], auth: 'oauth', writes: null, connector: true },
  'microsoft-365':    { feeds: ['people'], auth: 'oauth', writes: 'block_signin', connector: true },
  okta:               { feeds: ['people'], auth: 'token', writes: null, connector: true },
  slack:              { feeds: ['people'], auth: 'token', writes: null, connector: true },
  github:             { feeds: ['people'], auth: 'token', writes: null, connector: true },
  zoom:               { feeds: ['people'], auth: 'token', writes: null, connector: true },
  asana:              { feeds: ['people'], auth: 'token', writes: null, connector: true },
  salesforce:         { feeds: ['people'], auth: 'token', writes: null, connector: true },
  intune:             { feeds: ['devices'], auth: 'oauth', writes: null, connector: true },
  'google-licensing': { feeds: ['access'], auth: 'oauth', writes: null, connector: true },
  'csv:company':      { feeds: ['people', 'tools', 'access'], auth: 'file', writes: null, connector: false },
  'csv:tools':        { feeds: ['tools'], auth: 'file', writes: null, connector: false },
  'csv:employees':    { feeds: ['people'], auth: 'file', writes: null, connector: false },
  'csv:access':       { feeds: ['access'], auth: 'file', writes: null, connector: false },
  'csv:assets':       { feeds: ['devices'], auth: 'file', writes: null, connector: false },
  'invoice:invoice':  { feeds: ['invoices', 'tools'], auth: 'file', writes: null, connector: false },
  'invoice:inbox':    { feeds: ['invoices', 'tools'], auth: 'server', writes: null, connector: false },
  'invoice:bank':     { feeds: ['invoices', 'tools'], auth: 'oauth', writes: null, connector: true },
  audit:              { feeds: ['tools'], auth: 'file', writes: null, connector: false },
};
export const SOURCE_IDS = Object.keys(SOURCE_FACTS);

/** The translation key that names a source ('csv:company' → 'ds_src_csv_company'). */
export const sourceLabelKey = (id) => 'ds_src_' + String(id).replace(/[^a-z0-9]/gi, '_');

const iso = (d) => (d instanceof Date ? d : new Date(d)).toISOString();
const days = (from, now) => (now.getTime() - new Date(from).getTime()) / 86400000;

/** The workspace with one run recorded. Pure: returns a new object. */
export function recordSourceRun(db, id, { ok = true, error = '', counts = null, at = new Date() } = {}) {
  if (!SOURCE_FACTS[id]) throw new Error(`unknown data source ${id}`);
  const prev = db?.data_sources?.[id] || {};
  const when = iso(at);
  const entry = ok
    ? { ...prev, last_success_at: when, last_attempt_at: when, last_error: '', counts: counts || prev.counts || null, runs: (prev.runs || 0) + 1 }
    : { ...prev, last_attempt_at: when, last_error: String(error || 'failed').slice(0, 300), runs: (prev.runs || 0) + 1 };
  return { ...db, data_sources: { ...(db?.data_sources || {}), [id]: entry } };
}

/** never | failed | fresh | stale | old, for one source's record. */
export function sourceState(entry, now = new Date()) {
  if (!entry || (!entry.last_success_at && !entry.last_attempt_at)) return 'never';
  const failedSince = entry.last_error && (!entry.last_success_at || new Date(entry.last_attempt_at) > new Date(entry.last_success_at));
  if (failedSince) return 'failed';
  if (!entry.last_success_at) return 'never';
  const age = days(entry.last_success_at, now);
  return age <= FRESH_DAYS ? 'fresh' : age <= STALE_DAYS ? 'stale' : 'old';
}

/** Every source with a record, newest success first. */
export function sourcesOf(db, now = new Date()) {
  const rec = db?.data_sources || {};
  return Object.keys(rec)
    .filter((id) => SOURCE_FACTS[id])
    .map((id) => ({ id, ...rec[id], state: sourceState(rec[id], now), facts: SOURCE_FACTS[id] }))
    .sort((a, b) => String(b.last_success_at || b.last_attempt_at || '').localeCompare(String(a.last_success_at || a.last_attempt_at || '')));
}

/**
 * Per area: which sources fed it, the latest successful read, its state, and
 * whether the area holds records that no recorded source explains (typed by
 * hand, or imported before runs were recorded).
 */
export function coverage(db, now = new Date()) {
  const all = sourcesOf(db, now);
  return AREAS.map((area) => {
    const sources = all.filter((s) => s.facts.feeds.includes(area));
    const succeeded = sources.filter((s) => s.last_success_at);
    const latest = succeeded.length ? succeeded.map((s) => s.last_success_at).sort().slice(-1)[0] : null;
    const key = AREA_KEYS[area];
    const records = key ? (Array.isArray(db?.[key]) ? db[key].length : 0) : null;
    let state = 'none';
    if (latest) state = sourceState({ last_success_at: latest }, now);
    else if (records) state = 'manual';
    const failed = sources.filter((s) => s.state === 'failed').map((s) => s.id);
    return { area, sources: sources.map((s) => ({ id: s.id, last_success_at: s.last_success_at || null, state: s.state })), latest, state, records, failed };
  });
}

/** One line's worth: the newest read, the connectors that failed, the stale ones. */
export function freshnessSummary(db, now = new Date()) {
  const all = sourcesOf(db, now);
  const succeeded = all.filter((s) => s.last_success_at);
  return {
    hasSources: all.length > 0,
    latest: succeeded.length ? succeeded.map((s) => s.last_success_at).sort().slice(-1)[0] : null,
    failed: all.filter((s) => s.state === 'failed').map((s) => s.id),
    stale: all.filter((s) => s.state === 'stale' || s.state === 'old').map((s) => s.id),
  };
}

/**
 * "No usage data" is not "unused". A tool's last_used_date is confirmed only
 * when a source read it (usage_source); typed by hand it is a claim.
 */
export function usageKnowledge(tool) {
  if (!tool?.last_used_date) return { known: false, confirmed: false, source: null, read_at: null };
  return { known: true, confirmed: !!tool.usage_source, source: tool.usage_source || null, read_at: tool.usage_read_at || null };
}
