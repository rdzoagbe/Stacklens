import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Clock, Database } from 'lucide-react';
import { coverage, sourcesOf, freshnessSummary, SOURCE_FACTS, sourceLabelKey } from '../lib/dataSources';

// ── Where the data came from, and how fresh it is ──────────────────────────
//
// Settings → Integrations, first card: per area (people, tools, access,
// devices, usage, invoices), the newest successful read, which source gave it,
// any connector whose last run failed, and records that no recorded source
// explains. Then every source with its last success, last attempt, error,
// counts, and whether it only reads or also writes. lib/dataSources.js.

const fill = (s, vars) => Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), s);
const day = (iso, language) => (iso ? new Date(iso).toLocaleDateString(language === 'en' ? 'en-GB' : language, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const TONE = {
  fresh: 'text-emerald-300', stale: 'text-amber-300', old: 'text-red-300', failed: 'text-red-300',
  manual: 'text-amber-300', none: 'text-slate-500', never: 'text-slate-500',
};

export function DataSourcesPanel({ db, t, language = 'en', now = new Date() }) {
  const areas = coverage(db, now);
  const sources = sourcesOf(db, now);
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5" data-testid="data-sources">
      <div className="flex items-start gap-3">
        <Database className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-base font-semibold text-white">{t('ds_title')}</h3>
          <p className="mt-1 text-sm text-slate-400">{t('ds_sub')}</p>
        </div>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="ds-areas">
        {areas.map((a) => (
          <li key={a.area} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3" data-testid={`ds-area-${a.area}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-white">{t(`ds_area_${a.area}`)}</span>
              <span className={'text-xs font-semibold ' + TONE[a.state]}>{t(`ds_state_${a.state}`)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {a.latest
                ? fill(t('ds_area_latest'), { date: day(a.latest, language), sources: a.sources.filter((s) => s.last_success_at && s.last_success_at.slice(0, 10) === a.latest.slice(0, 10)).map((s) => t(sourceLabelKey(s.id))).join(', ') })
                : a.records ? fill(t('ds_area_manual'), { n: a.records }) : t('ds_area_empty')}
            </p>
            {a.failed.length > 0 && (
              <p className="mt-1 text-xs text-red-300 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {fill(t('ds_area_failed'), { sources: a.failed.map((id) => t(sourceLabelKey(id))).join(', ') })}
              </p>
            )}
          </li>
        ))}
      </ul>

      {sources.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm" data-testid="ds-sources">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="py-1 pr-3">{t('ds_col_source')}</th><th className="py-1 pr-3">{t('ds_col_last_ok')}</th><th className="py-1 pr-3">{t('ds_col_status')}</th><th className="py-1">{t('ds_col_does')}</th>
            </tr></thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-t border-slate-800 align-top">
                  <td className="py-1.5 pr-3 text-slate-200">{t(sourceLabelKey(s.id))}</td>
                  <td className="py-1.5 pr-3 text-slate-300 whitespace-nowrap">{day(s.last_success_at, language) || '—'}</td>
                  <td className={'py-1.5 pr-3 text-xs ' + TONE[s.state]}>
                    <span className="inline-flex items-center gap-1">{s.state === 'fresh' ? <CheckCircle className="h-3 w-3" /> : s.state === 'failed' ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}{t(`ds_state_${s.state}`)}</span>
                    {s.state === 'failed' && <div className="text-red-300/80 mt-0.5 break-words">{fill(t('ds_failed_at'), { date: day(s.last_attempt_at, language) })} {s.last_error}</div>}
                    {s.counts && <div className="text-slate-500 mt-0.5">{Object.entries(s.counts).map(([k, v]) => `${t(`ds_count_${k}`)} ${v}`).join(' · ')}</div>}
                  </td>
                  <td className="py-1.5 text-xs text-slate-400">
                    {t(SOURCE_FACTS[s.id].writes ? 'ds_reads_and_blocks' : 'ds_reads_only')} · {SOURCE_FACTS[s.id].feeds.map((f) => t(`ds_area_${f}`)).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">{t('ds_none_yet')}</p>
      )}
    </section>
  );
}

/** One line for the dashboard: how fresh the data under these figures is. */
export function FreshnessLine({ db, t, language = 'en', now = new Date() }) {
  const f = freshnessSummary(db, now);
  const hasData = (db?.tools?.length || 0) + (db?.employees?.length || 0) > 0;
  if (!hasData) return null;
  const parts = [];
  if (f.latest) parts.push(fill(t('ds_line_latest'), { date: day(f.latest, language) }));
  else parts.push(t('ds_line_manual'));
  if (f.failed.length) parts.push(fill(t('ds_line_failed'), { sources: f.failed.map((id) => t(sourceLabelKey(id))).join(', ') }));
  if (f.stale.length) parts.push(fill(t('ds_line_stale'), { sources: f.stale.map((id) => t(sourceLabelKey(id))).join(', ') }));
  const warn = f.failed.length > 0 || !f.latest;
  return (
    <p className={'mb-4 text-xs flex flex-wrap items-center gap-x-2 ' + (warn ? 'text-amber-300' : 'text-ink-muted')} data-testid="dash-freshness">
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{parts.join(' · ')}</span>
      <Link to="/settings?tab=integrations" className="underline underline-offset-2 hover:text-ink">{t('ds_line_details')}</Link>
    </p>
  );
}
