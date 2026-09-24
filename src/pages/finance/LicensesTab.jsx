import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  CreditCard, Download,
  Mail, Sparkles,
} from 'lucide-react';
import {
  displayAmount,
  getCurrency,
  downloadText,
  toCsv,
} from '../../lib/dataUtils';
import { computeWaste, EXPENSIVE_PER_USER } from '../../lib/waste';
import { useDbQuery } from '../../hooks/useDbQuery';
import { useLang } from '../../contexts/LangContext';
import { useTranslation } from '../../translations';

// ── Only what the data actually says ───────────────────────────────────────
//
// This screen used to report provisioned seats, available seats, inactive
// seats, utilization and per-tool waste. None of those existed in the data
// model. They were computed from two constants:
//
//   const total    = Math.max(Math.ceil(used * 1.2), used + 1);
//   const inactive = Math.max(0, Math.floor(used * 0.12));
//
// So "11 licenses, 2 available, 1 inactive, 91% utilization, €41/mo waste"
// was arithmetic on 1.2 and 0.12, presented as measured inventory — and
// handleReclaimAll then emailed those invented savings to the customer's own
// colleagues. A prospect who asks "where does 11 come from?" gets no answer,
// and a product sold on accurate SaaS spend cannot afford that question.
//
// What the data does support, per tool: how many people hold active access,
// what it costs, and therefore what it costs per person. From that, two
// honest findings — tools nobody can log into, and tools that cost more per
// person than EXPENSIVE_PER_USER. Seat counts return when something actually
// records them.

export function LicenseManagement() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db } = useDbQuery();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('cost');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  const waste = useMemo(() => computeWaste(db), [db]);

  // Deduped by name, as before — an import can produce the same tool twice.
  const apps = useMemo(() => {
    const seen = new Set();
    return waste.tools.filter(tool => {
      const key = (tool.name || '').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [waste]);

  const filtered = useMemo(() => {
    return apps
      .filter(app => {
        if (search && !(app.name || '').toLowerCase().includes(search.toLowerCase())) return false;
        if (filter === 'all') return true;
        if (filter === 'no-users') return app.wasteReason === 'no-users';
        if (filter === 'expensive') return app.wasteReason === 'expensive';
        return app.wasteReason === null;
      })
      .sort((a, b) => {
        if (sortBy === 'cost') return b.cost - a.cost;
        if (sortBy === 'per_user') return b.costPerUser - a.costPerUser;
        if (sortBy === 'users') return a.activeUsers - b.activeUsers;
        return 0;
      });
  }, [apps, filter, search, sortBy]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => { setPage(0); }, [filter, search, sortBy]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const totalGrants = apps.reduce((s, a) => s + a.activeUsers, 0);
  const unused = apps.filter(a => a.wasteReason === 'no-users');
  const expensive = apps.filter(a => a.wasteReason === 'expensive');
  const recoverable = unused.reduce((s, a) => s + a.cost, 0);
  const counts = {
    all: apps.length,
    'no-users': unused.length,
    expensive: expensive.length,
    ok: apps.filter(a => a.wasteReason === null).length,
  };

  const topOpportunities = [...unused].sort((a, b) => b.cost - a.cost).slice(0, 3);

  const money = (n) => getCurrency(language) + displayAmount(Math.round(n)).toLocaleString();

  const handleReclaimAll = () => {
    if (unused.length === 0) {
      toast(t('lic_nothing_to_reclaim'), { icon: '✅' });
      return;
    }
    const userName = JSON.parse(localStorage.getItem('accessguard_v1') || '{}')?.user?.displayName || 'IT Admin';
    const subject = encodeURIComponent('Review: ' + unused.length + ' tools with no active users');
    const body = encodeURIComponent(
      'Hi team,\n\nThese tools are being paid for and no one currently holds active access:\n\n' +
      unused.map(a => '• ' + a.name + ': ' + money(a.cost) + '/mo').join('\n') +
      '\n\nCombined: ' + money(recoverable) + '/mo (' + money(recoverable * 12) + '/year).\n' +
      'Worth confirming whether each is still needed before the next renewal.\n\nBest,\n' + userName
    );
    window.open('mailto:?subject=' + subject + '&body=' + body);
  };

  const handleExportCsv = () => {
    const headers = ['Application', 'Category', 'Active users', 'Cost/mo', 'Cost per user', 'Finding'];
    const rows = filtered.map(a => ({
      Application: a.name || '',
      Category: a.category || '',
      'Active users': a.activeUsers,
      'Cost/mo': Math.round(a.cost),
      'Cost per user': a.activeUsers > 0 ? Math.round(a.costPerUser) : '',
      Finding: a.wasteReason === 'no-users' ? 'No active users'
             : a.wasteReason === 'expensive' ? 'High cost per user' : '',
    }));
    downloadText('license-report-' + new Date().toISOString().slice(0, 10) + '.csv', toCsv(rows, headers));
  };

  return (
    <div className="space-y-6 w-full">

      {/* ── Row 1: KPI Strip — every figure here is counted, not estimated ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-blue-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('lic_tools_tracked')}</div>
          <div className="text-3xl font-black text-blue-400">{apps.length.toLocaleString()}</div>
          <div className="text-sm text-slate-500 mt-1">{t('lic_active_tools')}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-emerald-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("lic_active_users")}</div>
          <div className="text-3xl font-black text-emerald-400">{totalGrants.toLocaleString()}</div>
          <div className="text-sm text-slate-500 mt-1">{t('lic_access_grants')}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('lic_no_active_users')}</div>
          <div className="text-3xl font-black text-amber-400">{unused.length.toLocaleString()}</div>
          <div className="text-sm text-slate-500 mt-1">{t('lic_paid_nobody')}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-red-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('lic_recoverable')}</div>
          <div className="text-3xl font-black text-red-400">{money(recoverable)}</div>
          <div className="text-sm text-slate-500 mt-1">{money(recoverable * 12)}/year</div>
        </div>
      </div>

      {/* ── Row 2: Reclaim hero — only when there is something real to act on ── */}
      {unused.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-emerald-950/20 to-slate-900 p-6 lg:p-7">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-[280px]">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{t("lic_reclaim_opportunity")}</span>
              </div>
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-4xl font-black text-emerald-400">{money(recoverable)}</span>
                <span className="text-sm text-slate-500">/ {t('lic_per_month_at_stake')}</span>
              </div>
              <p className="text-sm text-slate-400">
                {unused.length} {unused.length === 1 ? (t('lic_tool_singular')) : (t('lic_tool_plural'))} {t('lic_no_one_access')}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
              <button onClick={handleReclaimAll}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm text-white transition-colors flex items-center gap-2 whitespace-nowrap">
                <Mail className="h-4 w-4" /> {t('act_reclaim_all')}
              </button>
              <button onClick={handleExportCsv}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold text-sm text-slate-300 transition-colors flex items-center gap-2 whitespace-nowrap">
                <Download className="h-4 w-4" /> {t('act_export_csv')}
              </button>
            </div>
          </div>

          {topOpportunities.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-5 pt-5 border-t border-emerald-500/10">
              {topOpportunities.map((opp, i) => (
                <div key={opp.id} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-sm flex-shrink-0">
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{opp.name}</div>
                    <div className="text-xs text-slate-500">{money(opp.cost)}/mo · {t('lic_zero_users')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Row 3: Findings ── */}
      {apps.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">{t("lic_health_title")}</h2>
              <p className="text-sm text-slate-500">{t('lic_findings_sub')}</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { key: 'ok', label: t('lic_f_ok'), color: 'bg-emerald-500', textColor: 'text-emerald-400' },
              { key: 'no-users', label: t('lic_f_no_users'), color: 'bg-amber-500', textColor: 'text-amber-400' },
              { key: 'expensive', label: (t('lic_f_expensive')) + ' ' + getCurrency(language) + EXPENSIVE_PER_USER + ' ' + (t('lic_per_user')), color: 'bg-blue-500', textColor: 'text-blue-400' },
            ].map(({ key, label, color, textColor }) => {
              const count = counts[key];
              const pct = apps.length > 0 ? (count / apps.length) * 100 : 0;
              return (
                <button key={key} onClick={() => setFilter(key)}
                  className="w-full text-left hover:bg-slate-800/30 -mx-2 px-2 py-1 rounded-lg transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-300">{label}</span>
                    <span className={"text-sm font-semibold " + textColor}>{count} {count === 1 ? 'app' : 'apps'}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={"h-full " + color + " transition-all"} style={{ width: pct + '%' }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Row 4: Table ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-white">{t("lic_all_licenses")}</h3>
              <p className="text-xs text-slate-500">{filtered.length} {filtered.length === 1 ? 'app' : 'apps'} shown</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t("lic_search_placeholder")}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 outline-none focus:border-blue-500 transition-colors w-40" />
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 outline-none">
                <option value="cost">Sort: Cost</option>
                <option value="per_user">Sort: Cost per user</option>
                <option value="users">Sort: Active users</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {[
              ['all', t('lic_f_all'), counts.all],
              ['ok', t('lic_f_ok'), counts.ok],
              ['no-users', t('lic_f_no_users'), counts['no-users']],
              ['expensive', t('lic_f_expensive_short'), counts.expensive],
            ].map(([val, label, count]) => (
              <button key={val} onClick={() => setFilter(val)}
                className={"px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap " + (filter === val ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white')}>
                {label} ({count})
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex p-3 rounded-2xl bg-slate-800 mb-3">
              <CreditCard className="h-6 w-6 text-slate-500" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">{t("lic_no_licenses")}</h3>
            <p className="text-sm text-slate-500">{search || filter !== 'all' ? 'Try adjusting your filters.' : 'Import or add tools to see cost per tool.'}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('col_application')}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('col_active_users') || 'Active users'}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">{t('col_cost_mo')}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">{t('col_cost_per_user')}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('col_finding')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(app => (
                    <tr key={app.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="text-sm font-semibold text-white truncate">{app.name}</div>
                        <div className="text-xs text-slate-500 capitalize truncate">{app.category || '—'}</div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className={"text-sm font-semibold " + (app.activeUsers === 0 ? 'text-amber-400' : 'text-white')}>
                          {app.activeUsers}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-white whitespace-nowrap hidden lg:table-cell">
                        {money(app.cost)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap hidden md:table-cell">
                        {app.activeUsers > 0 ? (
                          <span className={"text-sm " + (app.wasteReason === 'expensive' ? 'font-semibold text-blue-400' : 'text-slate-300')}>
                            {money(app.costPerUser)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {app.wasteReason === 'no-users' ? (
                          <span className="text-xs font-semibold text-amber-400">{t('lic_f_no_users')}</span>
                        ) : app.wasteReason === 'expensive' ? (
                          <span className="text-xs font-semibold text-blue-400">{t('lic_f_expensive_short')}</span>
                        ) : (
                          <span className="text-xs text-emerald-400">✓ {t('lic_f_ok')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-800 bg-slate-950/30">
                <span className="text-xs text-slate-500">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    ‹ Prev
                  </button>
                  <span className="px-3 py-1 text-xs text-slate-300 font-semibold">
                    Page {page + 1} / {totalPages}
                  </span>
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    Next ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
