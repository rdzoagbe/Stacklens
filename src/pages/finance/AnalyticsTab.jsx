import React, { useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  BarChart3, Boxes, Download,
} from 'lucide-react';
import {
  convertCurrency,
  getCurrency,
} from '../../lib/dataUtils';
import { useDbQuery } from '../../hooks/useDbQuery';
import { useLang } from '../../contexts/LangContext';
import { useTranslation } from '../../translations';

export function AnalyticsTabContent() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db } = useDbQuery();
  const tools = db?.tools || [];
  const employees = db?.employees || [];
  const access = db?.access || [];

  // Dedupe tools by name (in case there are still legacy duplicates)
  const uniqueTools = useMemo(() => {
    const seen = new Set();
    return tools.filter(t => {
      const key = (t.name || '').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [tools]);

  const activeTools = uniqueTools.filter(t => t.status === 'active');
  const totalSpend = activeTools.reduce((s, t) => s + Number(t.cost_per_month || 0), 0);
  const avgCostPerTool = activeTools.length > 0 ? totalSpend / activeTools.length : 0;
  const inactiveUsers = employees.filter(e => e.status === 'inactive' || e.status === 'former' || e.status === 'offboarded').length;
  const totalActiveAccess = access.filter(a => a.status === 'active').length;
  const avgAccessPerEmployee = employees.length > 0 ? totalActiveAccess / employees.length : 0;

  // Spend by category (top 6)
  const categorySpend = useMemo(() => {
    return Object.values(activeTools.reduce((acc, t) => {
      const cat = t.category || 'Other';
      if (!acc[cat]) acc[cat] = { name: cat, spend: 0, count: 0 };
      acc[cat].spend += Number(t.cost_per_month || 0);
      acc[cat].count++;
      return acc;
    }, {}))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 6);
  }, [activeTools]);

  // Top tools by cost (top 8)
  const topTools = useMemo(() => {
    return [...activeTools].sort((a, b) => Number(b.cost_per_month || 0) - Number(a.cost_per_month || 0)).slice(0, 8);
  }, [activeTools]);

  // Department breakdown (top 6)
  const deptBreakdown = useMemo(() => {
    return Object.entries(employees.reduce((acc, e) => {
      const dept = e.department || 'Other';
      if (!acc[dept]) acc[dept] = { active: 0, inactive: 0 };
      if (e.status === 'active') acc[dept].active++;
      else acc[dept].inactive++;
      return acc;
    }, {}))
    .map(([name, v]) => ({ name, ...v, total: v.active + v.inactive }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
  }, [employees]);

  const exportCSV = () => {
    const sections = [];
    sections.push('SAASGUARD ANALYTICS REPORT');
    sections.push('Generated: ' + new Date().toLocaleString());
    sections.push('');
    sections.push('SUMMARY');
    sections.push('Active Tools,' + activeTools.length);
    sections.push('Monthly Spend,' + Math.round(totalSpend));
    sections.push('Avg Cost Per Tool,' + Math.round(avgCostPerTool));
    sections.push('Inactive Employees,' + inactiveUsers);
    sections.push('');
    sections.push('SPEND BY CATEGORY');
    sections.push('Category,Monthly Spend,Tool Count');
    categorySpend.forEach(c => sections.push(c.name + ',' + c.spend + ',' + c.count));
    sections.push('');
    sections.push('TOP TOOLS BY COST');
    sections.push('Tool,Category,Monthly Cost');
    topTools.forEach(t => sections.push(t.name + ',' + (t.category || '—') + ',' + (t.cost_per_month || 0)));
    sections.push('');
    sections.push('DEPARTMENT BREAKDOWN');
    sections.push('Department,Active,Inactive,Total');
    deptBreakdown.forEach(d => sections.push(d.name + ',' + d.active + ',' + d.inactive + ',' + d.total));

    const blob = new Blob([sections.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'saasguard-analytics-' + new Date().toISOString().slice(0,10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Analytics report exported');
  };

  return (
    <div className="space-y-6">

      {/* ── Row 1: Header strip with export ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-slate-500">{t("an_subtitle")}</p>
        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold transition-colors text-sm text-white">
          <Download className="h-4 w-4" /> {t("an_export_report")}
        </button>
      </div>

      {/* ── Row 2: KPI Strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-blue-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("an_active_tools")}</div>
          <div className="text-3xl font-black text-blue-400">{activeTools.length}</div>
          <div className="text-sm text-slate-500 mt-1">{uniqueTools.length} total tracked</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-emerald-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("an_monthly_spend")}</div>
          <div className="text-3xl font-black text-emerald-400">{getCurrency(language)}{convertCurrency(Math.round(totalSpend), language).toLocaleString()}</div>
          <div className="text-sm text-slate-500 mt-1">{getCurrency(language)}{convertCurrency(Math.round(totalSpend * 12), language).toLocaleString()}/year</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-teal-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("an_avg_cost_tool")}</div>
          <div className="text-3xl font-black text-teal-400">{getCurrency(language)}{convertCurrency(Math.round(avgCostPerTool), language).toLocaleString()}</div>
          <div className="text-sm text-slate-500 mt-1">per month</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("an_inactive_emps")}</div>
          <div className="text-3xl font-black text-amber-400">{inactiveUsers}</div>
          <div className="text-sm text-slate-500 mt-1">{t("an_may_retain")}</div>
        </div>
      </div>

      {/* ── Row 3: Two-column — Spend by Category + Top Tools ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">

        {/* Spend by Category */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-white">{t("an_spend_by_cat")}</h3>
            <p className="text-xs text-slate-500">Top {categorySpend.length} categories by monthly cost</p>
          </div>
          {categorySpend.length === 0 ? (
            <div className="py-12 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-slate-800 mb-3">
                <BarChart3 className="h-6 w-6 text-slate-500" />
              </div>
              <p className="text-sm text-slate-500">{t("an_no_categories")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {categorySpend.map((cat, i) => {
                const pct = totalSpend > 0 ? (cat.spend / totalSpend * 100) : 0;
                const colors = ['bg-emerald-500', 'bg-teal-500', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500'];
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-slate-200 capitalize truncate">{cat.name}</span>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-slate-500">{cat.count} {cat.count === 1 ? 'tool' : 'tools'}</span>
                        <span className="text-sm font-semibold text-white">{getCurrency(language)}{convertCurrency(Math.round(cat.spend), language).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className={"h-full rounded-full transition-all duration-700 " + colors[i % colors.length]} style={{width: pct + '%'}} />
                    </div>
                    <div className="flex justify-end mt-0.5">
                      <span className="text-[10px] text-slate-600">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Tools by Cost */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-white">{t("an_top_tools")}</h3>
            <p className="text-xs text-slate-500">{t("an_top_tools_sub")}</p>
          </div>
          {topTools.length === 0 ? (
            <div className="py-12 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-slate-800 mb-3">
                <Boxes className="h-6 w-6 text-slate-500" />
              </div>
              <p className="text-sm text-slate-500">{t("an_no_tools")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topTools.map((tool, i) => (
                <div key={tool.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/40 transition-colors">
                  <div className="flex-shrink-0 h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-xs font-bold text-emerald-400">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white truncate">{tool.name}</div>
                    <div className="text-xs text-slate-500 capitalize truncate">{tool.category || '—'}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-white">{getCurrency(language)}{convertCurrency(Math.round(tool.cost_per_month || 0), language).toLocaleString()}</div>
                    <div className="text-xs text-slate-500">/mo</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 4: Department Breakdown (only if data exists) ── */}
      {deptBreakdown.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-white">{t("an_dept_breakdown")}</h3>
            <p className="text-xs text-slate-500">{t("an_dept_sub")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {deptBreakdown.map(dept => {
              const activePct = dept.total > 0 ? (dept.active / dept.total * 100) : 0;
              return (
                <div key={dept.name} className="p-4 rounded-xl bg-slate-900/40 border border-slate-800">
                  <div className="font-semibold text-white text-sm mb-2 capitalize truncate">{dept.name}</div>
                  <div className="flex items-baseline gap-3 mb-2">
                    <div>
                      <span className="text-lg font-bold text-emerald-400">{dept.active}</span>
                      <span className="text-xs text-slate-500 ml-1">active</span>
                    </div>
                    {dept.inactive > 0 && (
                      <div>
                        <span className="text-lg font-bold text-amber-400">{dept.inactive}</span>
                        <span className="text-xs text-slate-500 ml-1">inactive</span>
                      </div>
                    )}
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{width: activePct + '%'}} />
                  </div>
                  <div className="flex justify-end mt-1">
                    <span className="text-[10px] text-slate-600">{activePct.toFixed(0)}% active</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Row 5: Quick Stats footer ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">{t("an_total_employees")}</div>
            <div className="text-xl font-bold text-white">{employees.length}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">{t("an_active_access")}</div>
            <div className="text-xl font-bold text-white">{totalActiveAccess.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">{t("an_avg_tools_emp")}</div>
            <div className="text-xl font-bold text-white">{avgAccessPerEmployee.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">{t("an_departments")}</div>
            <div className="text-xl font-bold text-white">{deptBreakdown.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
}




// ============================================================================
// EXECUTIVE DASHBOARD — inlined from ExecutiveDashboard.jsx
// ============================================================================
