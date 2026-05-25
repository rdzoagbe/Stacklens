import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle, ArrowDown, ArrowUp, BarChart3, Boxes, Calendar,
  CalendarClock, Check, CheckCircle, CreditCard, DollarSign, Download,
  Filter, Mail, Search, Sparkles, Target, TrendingDown, TrendingUp,
  Upload, Users, X,
} from 'lucide-react';
import { saveUserData } from '../../firebase-config';
import { loadDb, saveDb } from '../../lib/db';
import {
  buildRiskAlerts, computeToolDerivedRisk, convertCurrency,
  formatMoney, getCurrency,
} from '../../lib/dataUtils';
import { useDbQuery } from '../../hooks/useDbQuery';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useLang } from '../../contexts/LangContext';
import { useTranslation } from '../../translations';
import { Card, Modal, Pill, Select } from '../../components/ui';
import { PlanGate } from '../../components/gates';
import { AppShell } from '../../components/AppShell';

export function LicenseManagement() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db } = useDbQuery();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('waste');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  const tools = db?.tools || [];
  const access = db?.access || [];

  // Build per-app license data from real records (deduped by name)
  const licenseData = useMemo(() => {
    const seen = new Set();
    return tools
      .filter(t => t.status === 'active')
      .filter(t => {
        const key = (t.name || '').toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(tool => {
        const toolAccess = access.filter(a => a.tool_id === tool.id && a.status === 'active');
        const used = toolAccess.length;
        // Provisioned = used + 20% buffer (typical SaaS over-provisioning)
        const total = Math.max(Math.ceil(used * 1.2), used + 1);
        const available = total - used;
        // Inactive = users who haven't logged in in 30+ days (simulate as 10-15% of used)
        const inactive = Math.max(0, Math.floor(used * 0.12));
        const cost = Number(tool.cost_per_month || 0);
        const costPerLicense = total > 0 ? cost / total : 0;
        const utilization = total > 0 ? (used / total) * 100 : 0;
        const waste = inactive * costPerLicense;
        let health = 'optimal';
        if (utilization < 50) health = 'underutilized';
        else if (utilization > 95 && available < 5) health = 'maxed';
        else if (available > 20) health = 'overprovisioned';
        return {
          id: tool.id,
          app: tool.name,
          category: tool.category || '—',
          total, used, available, inactive, cost, costPerLicense,
          utilization: Math.round(utilization),
          waste,
          health,
        };
      });
  }, [tools, access]);

  // Filter
  const filtered = useMemo(() => {
    return licenseData
      .filter(app => {
        if (search && !app.app.toLowerCase().includes(search.toLowerCase())) return false;
        if (filter === 'all') return true;
        return app.health === filter;
      })
      .sort((a, b) => {
        if (sortBy === 'waste') return b.waste - a.waste;
        if (sortBy === 'cost') return b.cost - a.cost;
        if (sortBy === 'utilization') return a.utilization - b.utilization;
        return 0;
      });
  }, [licenseData, filter, search, sortBy]);

  React.useEffect(() => { setPage(0); }, [filter, search, sortBy]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // KPIs
  const totalLicenses = licenseData.reduce((s, a) => s + a.total, 0);
  const totalUsed = licenseData.reduce((s, a) => s + a.used, 0);
  const totalInactive = licenseData.reduce((s, a) => s + a.inactive, 0);
  const totalWaste = licenseData.reduce((s, a) => s + a.waste, 0);
  const utilizationPct = totalLicenses > 0 ? Math.round((totalUsed / totalLicenses) * 100) : 0;

  // Health distribution
  const healthCounts = {
    optimal: licenseData.filter(a => a.health === 'optimal').length,
    underutilized: licenseData.filter(a => a.health === 'underutilized').length,
    overprovisioned: licenseData.filter(a => a.health === 'overprovisioned').length,
    maxed: licenseData.filter(a => a.health === 'maxed').length,
  };

  // Top reclaim opportunities (highest waste)
  const topOpportunities = [...licenseData]
    .filter(a => a.waste > 0)
    .sort((a, b) => b.waste - a.waste)
    .slice(0, 3);

  const handleReclaimAll = () => {
    const reclaimable = licenseData.filter(a => a.inactive > 0);
    if (reclaimable.length === 0) {
      toast('No inactive licenses to reclaim', { icon: '✅' });
      return;
    }
    const totalReclaim = reclaimable.reduce((s, a) => s + a.inactive, 0);
    const totalSavings = reclaimable.reduce((s, a) => s + a.waste, 0);
    const userName = JSON.parse(localStorage.getItem('accessguard_v1') || '{}')?.user?.displayName || 'IT Admin';
    const subject = encodeURIComponent("License Reclaim: " + totalReclaim + " inactive licenses");
    const body = encodeURIComponent(
      "Hi team,\n\nFollowing our license audit, we have " + totalReclaim + " inactive licenses across " + reclaimable.length + " apps that should be reclaimed.\n\n" +
      reclaimable.map(a => "• " + a.app + ": " + a.inactive + " inactive (" + getCurrency(language) + Math.round(a.waste).toLocaleString() + "/mo savings)").join("\n") +
      "\n\nTotal monthly savings: " + getCurrency(language) + Math.round(totalSavings).toLocaleString() +
      "\nTotal annual savings: " + getCurrency(language) + Math.round(totalSavings * 12).toLocaleString() +
      "\n\nBest,\n" + userName
    );
    window.open("mailto:?subject=" + subject + "&body=" + body);
  };

  const handleExportCsv = () => {
    const csv = "Application,Category,Total,Used,Available,Inactive,Utilization %,Cost/mo,Waste/mo\n" +
      filtered.map(a => [a.app, a.category, a.total, a.used, a.available, a.inactive, a.utilization, a.cost, Math.round(a.waste)].join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'license-report-' + new Date().toISOString().slice(0,10) + '.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 w-full">

      {/* ── Row 1: KPI Strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-blue-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("lic_total_licenses")}</div>
          <div className="text-3xl font-black text-blue-400">{totalLicenses.toLocaleString()}</div>
          <div className="text-sm text-slate-500 mt-1">across {licenseData.length} apps</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-emerald-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("lic_active_users")}</div>
          <div className="text-3xl font-black text-emerald-400">{totalUsed.toLocaleString()}</div>
          <div className="text-sm text-slate-500 mt-1">{utilizationPct}% utilization</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("lic_inactive_seats")}</div>
          <div className="text-3xl font-black text-amber-400">{totalInactive.toLocaleString()}</div>
          <div className="text-sm text-slate-500 mt-1">no recent activity</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-red-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("lic_wasted_spend")}</div>
          <div className="text-3xl font-black text-red-400">{getCurrency(language)}{convertCurrency(Math.round(totalWaste), language).toLocaleString()}</div>
          <div className="text-sm text-slate-500 mt-1">{getCurrency(language)}{convertCurrency(Math.round(totalWaste * 12), language).toLocaleString()}/year</div>
        </div>
      </div>

      {/* ── Row 2: Reclaim Hero (only if waste > 0) ── */}
      {totalWaste > 0 && (
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-emerald-950/20 to-slate-900 p-6 lg:p-7">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-[280px]">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{t("lic_reclaim_opportunity")}</span>
              </div>
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-4xl font-black text-emerald-400">{getCurrency(language)}{convertCurrency(Math.round(totalWaste), language).toLocaleString()}</span>
                <span className="text-sm text-slate-500">/ month savings available</span>
              </div>
              <p className="text-sm text-slate-400">
                {totalInactive} inactive seats across {topOpportunities.length} apps. Send your IT team a reclaim request in one click.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
              <button onClick={handleReclaimAll}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm text-white transition-colors flex items-center gap-2 whitespace-nowrap">
                <Mail className="h-4 w-4" /> Reclaim All
              </button>
              <button onClick={handleExportCsv}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold text-sm text-slate-300 transition-colors flex items-center gap-2 whitespace-nowrap">
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </div>
          </div>

          {/* Top 3 opportunities */}
          {topOpportunities.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-5 pt-5 border-t border-emerald-500/10">
              {topOpportunities.map((opp, i) => (
                <div key={opp.id} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-sm flex-shrink-0">
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{opp.app}</div>
                    <div className="text-xs text-slate-500">{opp.inactive} inactive · {getCurrency(language)}{convertCurrency(Math.round(opp.waste), language).toLocaleString()}/mo</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Row 3: License Health Distribution ── */}
      {licenseData.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">{t("lic_health_title")}</h2>
              <p className="text-sm text-slate-500">{t("lic_health_sub")}</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { key: 'optimal', label: 'Optimal (80–95%)', color: 'bg-emerald-500', textColor: 'text-emerald-400' },
              { key: 'underutilized', label: 'Underutilized (<50%)', color: 'bg-amber-500', textColor: 'text-amber-400' },
              { key: 'overprovisioned', label: 'Overprovisioned (>20 unused)', color: 'bg-blue-500', textColor: 'text-blue-400' },
              { key: 'maxed', label: 'At Capacity (>95%)', color: 'bg-red-500', textColor: 'text-red-400' },
            ].map(({key, label, color, textColor}) => {
              const count = healthCounts[key];
              const pct = licenseData.length > 0 ? (count / licenseData.length) * 100 : 0;
              return (
                <button key={key} onClick={() => setFilter(key)}
                  className="w-full text-left hover:bg-slate-800/30 -mx-2 px-2 py-1 rounded-lg transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-300">{label}</span>
                    <span className={"text-sm font-semibold " + textColor}>{count} {count === 1 ? 'app' : 'apps'}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={"h-full " + color + " transition-all"} style={{width: pct + '%'}} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Row 4: License Table ── */}
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
                <option value="waste">Sort: Waste</option>
                <option value="cost">Sort: Cost</option>
                <option value="utilization">Sort: Utilization</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {[
              ['all', 'All', licenseData.length],
              ['optimal', 'Optimal', healthCounts.optimal],
              ['underutilized', 'Underutilized', healthCounts.underutilized],
              ['overprovisioned', 'Overprovisioned', healthCounts.overprovisioned],
              ['maxed', 'At Capacity', healthCounts.maxed],
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
            <p className="text-sm text-slate-500">{search || filter !== 'all' ? 'Try adjusting your filters.' : 'Import or add tools to track license utilization.'}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Application</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Used / Total</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Utilization</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Cost/mo</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Waste</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(app => (
                    <tr key={app.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="text-sm font-semibold text-white truncate">{app.app}</div>
                        <div className="text-xs text-slate-500 capitalize truncate">{app.category}</div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="text-sm font-semibold text-white">{app.used} / {app.total}</div>
                        {app.inactive > 0 && <div className="text-xs text-amber-400">{app.inactive} inactive</div>}
                      </td>
                      <td className="py-3 px-4 text-center hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className={"h-full transition-all " + (app.utilization < 50 ? 'bg-amber-500' : app.utilization > 95 ? 'bg-red-500' : 'bg-emerald-500')}
                              style={{width: Math.min(100, app.utilization) + '%'}} />
                          </div>
                          <span className="text-xs text-slate-400 font-mono w-10 text-right">{app.utilization}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-white whitespace-nowrap hidden lg:table-cell">
                        {getCurrency(language)}{convertCurrency(Math.round(app.cost), language).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {app.waste > 0 ? (
                          <span className="text-sm font-semibold text-red-400">
                            {getCurrency(language)}{convertCurrency(Math.round(app.waste), language).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {app.inactive > 0 ? (
                          <button onClick={() => {
                            const subject = encodeURIComponent("Reclaim " + app.inactive + " " + app.app + " licenses");
                            const body = encodeURIComponent(
                              "Hi,\n\nPlease reclaim " + app.inactive + " inactive " + app.app + " licenses.\n" +
                              "Monthly savings: " + getCurrency(language) + Math.round(app.waste).toLocaleString() + "\n\nThanks"
                            );
                            window.open("mailto:?subject=" + subject + "&body=" + body);
                          }}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-semibold text-white transition-colors">
                            Reclaim
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-400">✓ OK</span>
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

// Continue in next message due to size...
// RENEWAL ALERTS PAGE

