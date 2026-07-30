import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart3, TrendingDown, Zap, Target, Download, Boxes, Users, Shield, Award } from 'lucide-react';
import { formatMoney, getCurrency, convertCurrency } from '../lib/dataUtils';
import { useDbQuery } from '../hooks/useDbQuery';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Card, CardBody } from '../components/ui';
import { PlanGate } from '../components/gates';
import { AppShell } from '../components/AppShell';

export function CostManagementPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db } = useDbQuery();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState('cost');
  const [filter, setFilter] = useState('all');

  const tools = db?.tools || [];
  const access = db?.access || [];

  const enriched = tools
    .filter(t => t.status === 'active')
    .map(tool => {
      const activeUsers = access.filter(a => a.tool_id === tool.id && a.status === 'active').length;
      const cost = Number(tool.cost_per_month || 0);
      const costPerUser = activeUsers > 0 ? cost / activeUsers : cost;
      const wasteFlag = activeUsers === 0 || costPerUser > 200;
      return { ...tool, activeUsers, cost, costPerUser, wasteFlag };
    })
    .filter(t => filter === 'all' ? true : filter === 'waste' ? t.wasteFlag : !t.wasteFlag)
    .sort((a, b) => sortBy === 'cost' ? b.cost - a.cost : b.costPerUser - a.costPerUser);

  const totalSpend = tools.filter(t => t.status === 'active').reduce((s, t) => s + Number(t.cost_per_month || 0), 0);
  const wasteTools = enriched.filter(t => t.wasteFlag);
  const wasteAmount = wasteTools.reduce((s, t) => s + t.cost, 0);
  const unusedTools = enriched.filter(t => t.activeUsers === 0);

  return (
    <PlanGate requires="growth" feature={t('feat_cost_management')}><AppShell title={t("cost_mgmt_title")}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 data-tour="tour-cost-header" className="text-2xl md:text-3xl font-black text-white mb-1">{t("cost_mgmt_title") || "Cost Management"}</h1>
            <p className="text-slate-400">{t('an_find_waste')}</p>
          </div>
          <button onClick={() => navigate('/licenses')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold transition-colors text-sm">
            {t('reclaim_licenses') || 'Manage Licenses'} →
          </button>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Monthly Spend', value: formatMoney(totalSpend, null, language), sub: tools.filter(t=>t.status==='active').length + ' active tools', color: 'text-white', Icon: BarChart3 },
            { label: 'Estimated Waste', value: formatMoney(wasteAmount, null, language), sub: wasteTools.length + ' flagged tools', color: 'text-rose-400', Icon: TrendingDown },
            { label: 'Unused Tools', value: unusedTools.length, sub: 'no active users assigned', color: 'text-amber-400', Icon: Zap },
            { label: 'Potential Savings', value: getCurrency(language) + Math.round(wasteAmount * 0.7).toLocaleString(), sub: 'if waste reclaimed', color: 'text-emerald-400', Icon: Target },
          ].map(({ label, value, sub, color, Icon }) => (
            <Card key={label}><CardBody>
              <div className="flex items-start justify-between gap-2">
                <div><div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</div>
                  <div className={"text-2xl font-black " + color}>{value}</div>
                  <div className="text-xs text-slate-500 mt-1">{sub}</div>
                </div>
                <div className="h-9 w-9 rounded-xl bg-slate-800/80 flex items-center justify-center flex-shrink-0">
                  <Icon className={"h-4 w-4 " + color} />
                </div>
              </div>
            </CardBody></Card>
          ))}
        </div>

        {/* Waste Alert */}
        {wasteTools.length > 0 && (
          <Card className="p-5 bg-amber-500/5 border-amber-500/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-white mb-1">⚠️ {wasteTools.length} tools flagged as potential waste</div>
                <p className="text-sm text-slate-400">Tools with no active users or very high cost-per-user. Review and consider cancelling or renegotiating.</p>
              </div>
              <button onClick={() => setFilter('waste')} className="text-sm text-amber-400 font-semibold hover:text-amber-300 whitespace-nowrap">{t('filter')}</button>
            </div>
          </Card>
        )}

        {/* Tools Table */}
        <Card className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-xl font-bold">{t("tool_cost_breakdown")}</h2>
            <div className="flex gap-2 flex-wrap">
              {[['all','All Tools'],['waste','Waste Only'],['ok','Healthy']].map(([v,l]) => (
                <button key={v} onClick={() => setFilter(v)}
                  className={"px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors " + (filter === v ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white')}>
                  {l}
                </button>
              ))}
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 text-slate-300 border-0 outline-none">
                <option value="cost">{t('total_cost')}</option>
                <option value="peruser">{t('cost_per_user')}</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto w-full">
          <div className="overflow-x-auto w-full"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Tool','Category','Monthly Cost','Active Users','Cost / User','Status'].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enriched.map((tool, i) => (
                  <tr key={tool.id || i} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-white">{tool.name}</div>
                      <div className="text-xs text-slate-500">{tool.owner || 'No owner'}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-sm">{tool.category || '—'}</td>
                    <td className="py-3 px-3 font-mono font-bold text-white">{getCurrency(language)}{convertCurrency(tool.cost||0, language).toLocaleString()}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={"font-bold " + (tool.activeUsers === 0 ? 'text-rose-400' : 'text-slate-300')}>{tool.activeUsers}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-sm text-slate-300">${tool.costPerUser.toFixed(0)}</td>
                    <td className="py-3 px-3">
                      {tool.wasteFlag
                        ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">⚠ Review</span>
                        : <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">✓ OK</span>
                      }
                    </td>
                  </tr>
                ))}
                {enriched.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-slate-500 py-12">{t("hc_no_tools_match_this_filter")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          </div>
        </Card>
      </div>
    </AppShell></PlanGate>
  );
}

export function AnalyticsReportsPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db } = useDbQuery();
  const navigate = useNavigate();

  const tools = db?.tools || [];
  const employees = db?.employees || [];
  const activeTools = tools.filter(t => t.status === 'active');
  const totalSpend = activeTools.reduce((s, t) => s + Number(t.cost_per_month || 0), 0);
  const inactiveUsers = employees.filter(e => e.status === 'inactive' || e.status === 'former').length;

  const categorySpend = Object.values(
    activeTools.reduce((acc, t) => {
      const cat = t.category || 'Other';
      if (!acc[cat]) acc[cat] = { name: cat, spend: 0, count: 0 };
      acc[cat].spend += Number(t.cost_per_month || 0);
      acc[cat].count++;
      return acc;
    }, {})
  ).sort((a, b) => b.spend - a.spend).slice(0, 6);

  const topTools = [...activeTools]
    .sort((a, b) => Number(b.cost_per_month || 0) - Number(a.cost_per_month || 0))
    .slice(0, 8);

  const deptBreakdown = Object.entries(
    employees.reduce((acc, e) => {
      const dept = e.department || 'Other';
      if (!acc[dept]) acc[dept] = { active: 0, inactive: 0 };
      if (e.status === 'active') acc[dept].active++;
      else acc[dept].inactive++;
      return acc;
    }, {})
  ).map(([name, v]) => ({ name, ...v, total: v.active + v.inactive }))
   .sort((a, b) => b.total - a.total).slice(0, 6);

  const exportCSV = () => {
    const rows = [
      ['Category','Monthly Spend','Tool Count'],
      ...categorySpend.map(c => [c.name, c.spend, c.count]),
    ].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv,' + encodeURIComponent(rows);
    a.download = 'stacklens-analytics.csv';
    a.click();
  };

  const kpis = [
    { label: 'Total Active Tools', value: activeTools.length, sub: tools.length + ' total tracked', color: 'text-white', Icon: Boxes },
    { label: 'Monthly SaaS Spend', value: formatMoney(totalSpend, null, language), sub: 'across ' + activeTools.length + ' tools', color: 'text-emerald-400', Icon: BarChart3 },
    { label: 'Avg Cost Per Tool', value: getCurrency(language) + (activeTools.length ? Math.round(totalSpend / activeTools.length).toLocaleString() : 0), sub: 'per month', color: 'text-teal-400', Icon: TrendingDown },
    { label: 'Inactive Employees', value: inactiveUsers, sub: 'may retain access', color: 'text-amber-400', Icon: Users },
  ];

  return (
    <PlanGate requires="scale" feature={t('feat_analytics_reports')}><AppShell title={t('analytics_title')}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">{t('an_live_insights')}</p>
          </div>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold transition-colors text-sm">
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>

        {/* KPI Strip */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map(({ label, value, sub, color, Icon }) => (
            <Card key={label}><CardBody>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</div>
                  <div className={"text-2xl font-black " + color}>{value}</div>
                  <div className="text-xs text-slate-500 mt-1">{sub}</div>
                </div>
                <div className="h-9 w-9 rounded-xl bg-slate-800/80 flex items-center justify-center flex-shrink-0">
                  <Icon className={"h-4 w-4 " + color} />
                </div>
              </div>
            </CardBody></Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* {t("spend_by_category_title")} Chart */}
          <Card className="p-4 md:p-6">
            <h2 className="text-xl font-bold mb-4">💰 {t("spend_by_category_title")}</h2>
            <div className="space-y-3">
              {categorySpend.map((cat, i) => {
                const pct = totalSpend > 0 ? (cat.spend / totalSpend * 100) : 0;
                const colors = ['bg-emerald-500','bg-teal-500','bg-blue-500','bg-violet-500','bg-amber-500','bg-rose-500'];
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-slate-200">{cat.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">{cat.count} tools</span>
                        <span className="text-sm font-bold text-white">{getCurrency(language)}{cat.spend.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2.5">
                      <div className={"h-2.5 rounded-full transition-all duration-700 " + colors[i % colors.length]} style={{width: pct + '%'}} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Top Tools by Cost */}
          <Card className="p-4 md:p-6">
            <h2 className="text-xl font-bold mb-4">🏆 Top Tools by Cost</h2>
            <div className="space-y-2">
              {topTools.map((tool, i) => (
                <div key={tool.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/60 transition-colors">
                  <div className="flex-shrink-0 h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-xs font-bold text-emerald-400">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-white truncate">{tool.name}</div>
                    <div className="text-xs text-slate-500">{tool.category || 'General'}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-white">${Number(tool.cost_per_month || 0).toLocaleString()}</div>
                    <div className="text-xs text-slate-500">/mo</div>
                  </div>
                </div>
              ))}
              {topTools.length === 0 && <div className="text-center text-slate-500 py-8">{t('no_tools_yet')}</div>}
            </div>
          </Card>
        </div>

        {/* Department Breakdown */}
        <Card className="p-4 md:p-6">
          <h2 className="text-xl font-bold mb-4">🏢 Department Breakdown</h2>
          {deptBreakdown.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {deptBreakdown.map(dept => (
                <div key={dept.name} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="font-semibold text-white mb-2">{dept.name}</div>
                  <div className="flex gap-4 text-sm">
                    <div><span className="text-emerald-400 font-bold">{dept.active}</span><span className="text-slate-500 ml-1">active</span></div>
                    <div><span className="text-amber-400 font-bold">{dept.inactive}</span><span className="text-slate-500 ml-1">inactive</span></div>
                  </div>
                  <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5">
                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{width: dept.total > 0 ? (dept.active/dept.total*100)+'%' : '0%'}} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-slate-500 py-12">{t('add_employees_to_see')}</div>
          )}
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'View Finance', to: '/finance', icon: BarChart3, color: 'emerald' },
            { label: 'Manage Licenses', to: '/licenses', icon: Award, color: 'teal' },
            { label: 'Audit Export', to: '/audit', icon: Download, color: 'blue' },
            { label: 'Security Report', to: '/security', icon: Shield, color: 'violet' },
          ].map(({ label, to, icon: Icon, color }) => (
            <button key={to} onClick={() => navigate(to)}
              className={"flex items-center gap-2 p-3 rounded-xl border transition-colors text-sm font-semibold border-slate-800 hover:border-" + color + "-500/40 hover:bg-" + color + "-500/5 text-slate-300 hover:text-white"}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>
      </div>
    </AppShell></PlanGate>
  );
}
