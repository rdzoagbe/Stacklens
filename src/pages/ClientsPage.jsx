import React, { useMemo, useState } from 'react';
import { Building2, Download, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useClientWorkspaces } from '../hooks/useClientWorkspaces';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { AppShell } from '../components/AppShell';

// ── Clients ────────────────────────────────────────────────────────────────
//
// Managing client workspaces used to live in a modal reached from a bar that
// sat on every page. Two jobs were tangled there: saying whose data you are
// looking at and letting you switch — which belongs in navigation — and
// creating, exporting, deleting and restoring, which needs room a modal does
// not have and which a paid plan allows fifty of.
//
// So switching stayed in the bar and management moved here. The bar no longer
// advertises the feature to every customer on every page.
//
// Not shown per client: tool count and monthly spend. Those live in each
// client's own userdata document, so a list of fifty would be fifty server
// reads to render one page. Storing a small summary on the client_orgs record
// at write time would fix it, and is real work rather than a tweak.

const SEARCH_FROM = 8;

export function ClientsPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const {
    orgs, deletedOrgs, retentionDays, busy, loaded, canManageClients,
    openClient, addClient, exportClient, deleteClient, restoreClient,
  } = useClientWorkspaces();
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(o => (o.name || '').toLowerCase().includes(q));
  }, [orgs, query]);

  const fmtDate = (v) => {
    if (!v) return '';
    const ms = typeof v === 'number' ? v : Date.parse(v);
    if (!Number.isFinite(ms)) return '';
    return new Date(ms).toLocaleDateString(language === 'en' ? 'en-GB' : language);
  };

  return (
    <AppShell title={t('nav_clients')}>
      <div className="space-y-6">

        {/* No page heading here: AppShell's top bar already says "Clients",
            and no other page in the app repeats its own title underneath it. */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="text-slate-400 text-sm max-w-xl">
            {t('ws_manage_sub').replace('{days}', String(retentionDays))}
            {/* Each client workspace has its own currency and amounts are
                never converted, so these figures cannot be added together.
                Saying so is cheaper than someone summing them by hand and
                trusting the answer. */}
            {orgs.some(o => o.summary) && (
              <> {t('ws_own_currency')}</>
            )}
          </p>
          {canManageClients && (
            <button onClick={addClient} disabled={busy}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-sm text-white transition-colors flex items-center gap-2 disabled:opacity-50">
              <Plus className="h-4 w-4" /> {t('ws_add_client')}
            </button>
          )}
        </div>

        {/* ── Active ── */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('ws_active_clients')} ({orgs.length})
            </h2>
            {orgs.length >= SEARCH_FROM && (
              <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder={t('ws_search_clients')}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 outline-none focus:border-indigo-500 transition-colors w-48" />
            )}
          </div>

          {!loaded ? (
            <p className="px-5 py-8 text-sm text-slate-500">{t('ws_loading')}</p>
          ) : shown.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-slate-800 mb-3">
                <Building2 className="h-6 w-6 text-slate-500" />
              </div>
              <p className="text-sm text-slate-400">
                {orgs.length === 0 ? t('ws_none_live') : t('ws_no_match')}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/70">
              {shown.map(o => (
                <li key={o.org_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0 w-full sm:w-auto sm:flex-1">
                    <span className="block text-sm font-semibold text-white truncate">{o.name}</span>
                    {/* What is actually inside this workspace. Without it the
                        page was a list of names, and the only way to see a
                        client's spend was to open their workspace — which
                        swaps the whole app into their data and back. */}
                    <span className="block text-xs text-slate-500">
                      {o.summary ? (
                        <>
                          <span className="text-slate-300 font-semibold">
                            {o.summary.currency}{Math.round(o.summary.monthly_spend).toLocaleString()}
                          </span>
                          {t('ws_per_month')}
                          <span className="mx-1.5 text-slate-500">·</span>
                          {o.summary.tools} {t('ws_tools_tracked')}
                          {o.summary.updated_at && (
                            <>
                              <span className="mx-1.5 text-slate-500">·</span>
                              {t('ws_updated')} {fmtDate(o.summary.updated_at)}
                            </>
                          )}
                        </>
                      ) : o.created_at ? (
                        <>{t('ws_created_on')} {fmtDate(o.created_at)}</>
                      ) : null}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <button onClick={() => openClient(o)} disabled={busy}
                      className="px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 text-xs font-semibold transition-colors disabled:opacity-50">
                      {t('ws_open')}
                    </button>
                    <button onClick={() => exportClient(o)} disabled={busy}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5">
                      <Download className="h-3.5 w-3.5" /> {t('ws_export')}
                    </button>
                    {/* Delete used to sit behind a ⋯ dropdown, to keep it from
                        carrying the same visual weight as Open. The dropdown
                        was absolutely positioned inside a section with
                        overflow-hidden (it rounds the card's corners), so on
                        the last row of the list — which with one client is the
                        only row, the commonest case of all — the menu was
                        clipped and the Delete button was invisible.

                        It is a quiet text button instead. Lighter than either
                        filled button beside it, so the weight is still right,
                        and there is no positioned layer left to be clipped by
                        anything. The confirmation dialog, which names the
                        client and the retention window, is what actually
                        guards the action. */}
                    <button onClick={() => deleteClient(o)} disabled={busy}
                      className="px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5">
                      <Trash2 className="h-3.5 w-3.5" /> {t('ws_delete')}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Deleted, with the countdown that decides whether there is still
             time to get a customer's records back ── */}
        {deletedOrgs.length > 0 && (
          <section className="rounded-2xl border border-amber-500/25 bg-amber-500/5 overflow-hidden">
            <div className="border-b border-amber-500/20 px-5 py-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                {t('ws_deleted')} ({deletedOrgs.length})
              </h2>
            </div>
            <ul className="divide-y divide-amber-500/10">
              {deletedOrgs.map(o => (
                <li key={o.org_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white truncate">{o.name}</span>
                    <span className="block text-xs text-amber-300/90">
                      {o.days_left > 0
                        ? t('ws_days_left').replace('{n}', String(o.days_left))
                        : t('ws_purging')}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <button onClick={() => exportClient(o)} disabled={busy}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5">
                      <Download className="h-3.5 w-3.5" /> {t('ws_export')}
                    </button>
                    <button onClick={() => restoreClient(o)} disabled={busy || o.days_left <= 0}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold transition-colors disabled:opacity-40 flex items-center gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" /> {t('ws_restore')}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}
