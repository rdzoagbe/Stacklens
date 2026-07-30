import React, { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import { todayISO } from '../lib/db';
import { ACCESS_LEVEL, ACCESS_STATUS, RISK_FLAG } from '../lib/constants';
import { computeAccessDerivedRiskFlag } from '../lib/dataUtils';
import { useDbQuery, useDbMutations } from '../hooks/useDbQuery';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Button, Input, Select, useEnumLabel } from '../components/ui';
import { AppShell } from '../components/AppShell';
import { AlertTriangle, Check } from 'lucide-react';

export function AccessForm({ initial, tools, employees, onSubmit, onClose }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const [form, setForm] = useState(
    initial || {
      tool_id: tools[0]?.id || "",
      employee_id: employees[0]?.id || "",
      access_level: "viewer",
      granted_date: todayISO(),
      last_accessed_date: todayISO(),
      last_reviewed_date: todayISO(),
      status: "active",
      risk_flag: "none",
    }
  );

  useEffect(() => {
    const tool = tools.find((t) => t.id === form.tool_id);
    const emp = employees.find((e) => e.id === form.employee_id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((f) => ({
      ...f,
      tool_name: tool?.name || "",
      employee_name: emp?.full_name || "",
      employee_email: emp?.email || "",
    }));
  }, [form.tool_id, form.employee_id, tools, employees]);

  const canSubmit = form.tool_id && form.employee_id;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        const tool = tools.find((t) => t.id === form.tool_id);
        const emp = employees.find((e) => e.id === form.employee_id);
        onSubmit({
          ...form,
          tool_name: tool?.name || form.tool_name || "",
          employee_name: emp?.full_name || form.employee_name || "",
          employee_email: emp?.email || form.employee_email || "",
        });
        onClose();
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('col_tool')}</div>
          <Select value={form.tool_id} onChange={(e) => setForm((f) => ({ ...f, tool_id: e.target.value }))}>
            {tools.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('col_employee')}</div>
          <Select value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name} ({e.email})
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('access_level')}</div>
          <Select value={form.access_level} onChange={(e) => setForm((f) => ({ ...f, access_level: e.target.value }))}>
            {ACCESS_LEVEL.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('col_status')}</div>
          <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            {ACCESS_STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('risk_flag')}</div>
          <Select value={form.risk_flag} onChange={(e) => setForm((f) => ({ ...f, risk_flag: e.target.value }))}>
            {RISK_FLAG.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('col_granted')}</div>
          <Input type="date" value={form.granted_date} onChange={(e) => setForm((f) => ({ ...f, granted_date: e.target.value }))} />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('last_accessed')}</div>
          <Input type="date" value={form.last_accessed_date} onChange={(e) => setForm((f) => ({ ...f, last_accessed_date: e.target.value }))} />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('last_reviewed')}</div>
          <Input type="date" value={form.last_reviewed_date} onChange={(e) => setForm((f) => ({ ...f, last_reviewed_date: e.target.value }))} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t('act_cancel')}
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          <Check className="h-4 w-4" />
          {t('act_save')}
        </Button>
      </div>
    </form>
  );
}

export function AccessPage() {
  const { data: db, isLoading } = useDbQuery();
  const muts = useDbMutations();
  const { language } = useLang();
  const t = useTranslation(language);
  const enumLabel = useEnumLabel();
  const [viewMode, setViewMode] = useState('map');
  const [filterRisk, setFilterRisk] = useState('all');
  const [search, setSearch] = useState('');

  const derived = useMemo(() => {
    if (!db) return null;
    const employeesById = Object.fromEntries(db.employees.map(e => [e.id, e]));
    const toolsById = Object.fromEntries(db.tools.map(t => [t.id, t]));
    const access = db.access.map(a => ({
      ...a,
      employee: employeesById[a.employee_id],
      tool: toolsById[a.tool_id],
      risk: computeAccessDerivedRiskFlag(a, employeesById, toolsById)
    }));
    const highRisk = access.filter(a => a.risk === 'former_employee' || a.risk === 'excessive_admin');
    const needsReview = access.filter(a => a.risk === 'needs_review');

    const matrix = {};
    const allTools = new Set();
    access.filter(a => a.status === 'active').forEach(a => {
      const empName = a.employee?.full_name || a.employee_name || 'Unknown';
      const toolName = a.tool?.name || a.tool_name || 'Unknown';
      if (!matrix[empName]) matrix[empName] = { employee: a.employee, tools: {} };
      matrix[empName].tools[toolName] = { level: a.access_level, risk: a.risk, id: a.id };
      allTools.add(toolName);
    });

    const toolMatrix = {};
    access.filter(a => a.status === 'active').forEach(a => {
      const toolName = a.tool?.name || a.tool_name || 'Unknown';
      if (!toolMatrix[toolName]) toolMatrix[toolName] = { tool: a.tool, employees: [] };
      toolMatrix[toolName].employees.push({ name: a.employee?.full_name || a.employee_name, level: a.access_level, risk: a.risk, dept: a.employee?.department, id: a.id });
    });

    return { access, highRisk, needsReview, matrix, toolMatrix, allTools: [...allTools].sort() };
  }, [db]);

  if (isLoading || !derived) return <div className="flex items-center justify-center h-screen"><div className="text-white">{t('loading')}</div></div>;

  const filteredAccess = derived.access.filter(a => {
    if (filterRisk === 'high' && a.risk !== 'former_employee' && a.risk !== 'excessive_admin') return false;
    if (filterRisk === 'review' && a.risk !== 'needs_review') return false;
    if (filterRisk === 'clean' && a.risk !== 'none') return false;
    if (search) {
      const s = search.toLowerCase();
      return (a.employee?.full_name || '').toLowerCase().includes(s) ||
             (a.tool?.name || a.tool_name || '').toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <AppShell title={t('access_map_title')}>
      <div className="space-y-6 w-full min-w-0">

        {/* ── Row 1: KPI Strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-blue-500">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_total_access")}</div>
            <div className="text-3xl font-black text-white">{derived.access.filter(a => a.status === 'active').length}</div>
            <div className="text-sm text-slate-500">{t("sub_active_permissions")}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-red-500 cursor-pointer hover:border-slate-700 transition-colors" onClick={() => setFilterRisk('high')}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_high_risk")}</div>
            <div className="text-3xl font-black text-red-400">{derived.highRisk.length}</div>
            <div className="text-sm text-slate-500">{t("sub_click_to_filter")}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-amber-500 cursor-pointer hover:border-slate-700 transition-colors" onClick={() => setFilterRisk('review')}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_needs_review")}</div>
            <div className="text-3xl font-black text-amber-400">{derived.needsReview.length}</div>
            <div className="text-sm text-slate-500">{t("sub_click_to_filter")}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-emerald-500 cursor-pointer hover:border-slate-700 transition-colors" onClick={() => setFilterRisk('clean')}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_clean")}</div>
            <div className="text-3xl font-black text-emerald-400">{derived.access.filter(a => a.status === 'active').length - derived.highRisk.length - derived.needsReview.length}</div>
            <div className="text-sm text-slate-500">{t("sub_click_to_filter")}</div>
          </div>
        </div>

        {/* ── Row 2: Urgent Issues (only if they exist) ── */}
        {derived.highRisk.length > 0 && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 lg:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <span className="text-base font-semibold text-white">Urgent: {derived.highRisk.length} high-risk access records</span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => {
                if(window.confirm('Revoke all ' + derived.highRisk.length + ' high-risk access records?')) {
                  derived.highRisk.forEach(a => muts.updateAccess.mutate({ id: a.id, patch: { status: 'revoked' } }));
                  toast.success(t('all_high_risk_revoked'));
                }
              }}>
                {t("access_revoke_all_high")}
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {derived.highRisk.slice(0, 6).map((a, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-red-500/20 bg-slate-900/50">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 font-bold text-sm flex-shrink-0">
                    {(a.employee?.full_name || '?').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{a.employee?.full_name || 'Unknown'}</div>
                    <div className="text-xs text-slate-500 truncate">{a.tool?.name || a.tool_name} · {a.access_level}</div>
                  </div>
                  <button onClick={() => {
                    muts.updateAccess.mutate({ id: a.id, patch: { status: 'revoked' } }, { onSuccess: () => toast.success(t('revoked')) });
                  }} className="px-2.5 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-400 rounded-lg text-xs font-semibold transition-colors flex-shrink-0">
                    {t('revoke')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Row 3: View Switcher + Search + Filter ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
            {[
              { id: 'map', label: t('access_map_label') },
              { id: 'table', label: t('access_table_view') },
              { id: 'by-tool', label: t('access_by_tool') },
            ].map(v => (
              <button key={v.id} onClick={() => setViewMode(v.id)}
                className={"px-3 py-1.5 rounded-lg text-sm font-semibold transition-all " + (viewMode === v.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}>
                {v.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("search_placeholder_access")}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500 transition-colors" />
          </div>
          <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none">
            <option value="all">{t('filter_all_risk')}</option>
            <option value="high">{t("high_risk_only")}</option>
            <option value="review">{t("needs_review_filter")}</option>
            <option value="clean">{t("clean_only")}</option>
          </select>
        </div>

        {/* ── View: Access Map (Employee → Tools grid) ── */}
        {viewMode === 'map' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-white">{t("access_map_label")}</h2>
                <p className="text-sm text-slate-500">{t("access_map_sub")}</p>
              </div>
              <span className="text-xs text-slate-500">{Object.keys(derived.matrix).length} employees · {derived.allTools.length} tools</span>
            </div>

            {/* Legend */}
            <div className="flex gap-4 mb-4 text-xs text-slate-500">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-purple-500" /> {t("access_legend_admin")}</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500" /> {t("access_legend_editor")}</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-slate-600" /> {t("access_legend_viewer")}</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded ring-2 ring-red-500 bg-red-500/30" /> {t("access_legend_risk")}</div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Header: tool names */}
                <div className="flex items-end gap-0 mb-1 pl-36">
                  {derived.allTools.slice(0, 12).map(tool => (
                    <div key={tool} className="w-10 flex-shrink-0 text-center">
                      <div className="text-[9px] text-slate-600 truncate transform -rotate-45 origin-bottom-left w-16">{tool}</div>
                    </div>
                  ))}
                </div>

                {/* Rows: employees */}
                <div className="space-y-1">
                  {Object.entries(derived.matrix)
                    .filter(([name]) => !search || name.toLowerCase().includes(search.toLowerCase()))
                    .slice(0, 20)
                    .map(([empName, { employee, tools }]) => {
                    const hasRisk = Object.values(tools).some(t => t.risk === 'former_employee' || t.risk === 'excessive_admin');
                    return (
                      <div key={empName} className={"flex items-center gap-0 py-1.5 px-2 rounded-lg " + (hasRisk ? 'bg-red-500/5 border border-red-500/10' : 'hover:bg-slate-800/30')}>
                        <div className="w-32 flex-shrink-0 flex items-center gap-2">
                          <div className={"w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0 " + (hasRisk ? 'bg-red-500/30' : 'bg-gradient-to-br from-blue-500 to-purple-500')}>
                            {empName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-300 truncate">{empName}</div>
                            <div className="text-[10px] text-slate-600 truncate">{employee?.department || ''}</div>
                          </div>
                        </div>
                        <div className="flex gap-0">
                          {derived.allTools.slice(0, 12).map(toolName => {
                            const access = tools[toolName];
                            if (!access) return <div key={toolName} className="w-10 h-8 flex items-center justify-center flex-shrink-0"><div className="w-2 h-2 rounded-full bg-slate-800/50" /></div>;
                            const isRisk = access.risk === 'former_employee' || access.risk === 'excessive_admin';
                            const color = access.level === 'admin' ? 'bg-purple-500' : access.level === 'viewer' ? 'bg-slate-500' : 'bg-blue-500';
                            return (
                              <div key={toolName} className="w-10 h-8 flex items-center justify-center flex-shrink-0">
                                <div className={"w-4 h-4 rounded-full transition-all cursor-pointer hover:scale-125 " + color + (isRisk ? ' ring-2 ring-red-500 ring-offset-1 ring-offset-slate-950' : '')}
                                  title={empName + ' → ' + toolName + ' (' + access.level + ')' + (isRisk ? ' ⚠️ RISK' : '')}
                                  onClick={() => {
                                    const action = window.prompt(empName + ' → ' + toolName + ' (' + access.level + ')\n\n1 = Change to Viewer\n2 = Change to Admin\n3 = Revoke\n\nEnter 1, 2, or 3:');
                                    if (action === '1') muts.updateAccess.mutate({ id: access.id, patch: { access_level: 'viewer' } }, { onSuccess: () => toast.success(t('changed_to_viewer')) });
                                    else if (action === '2') muts.updateAccess.mutate({ id: access.id, patch: { access_level: 'admin' } }, { onSuccess: () => toast.success(t('changed_to_admin')) });
                                    else if (action === '3') muts.updateAccess.mutate({ id: access.id, patch: { status: 'revoked' } }, { onSuccess: () => toast.success(t('revoked')) });
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Insights row (only in map view) ── */}
        {viewMode === 'map' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">

            {/* Most Privileged Employees */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">{t("access_most_privileged")}</h3>
                <span className="text-xs text-slate-500">{t("access_top_admins")}</span>
              </div>
              <div className="space-y-2.5">
                {(() => {
                  const privCount = {};
                  derived.access.filter(a => a.status === 'active' && a.access_level === 'admin').forEach(a => {
                    const name = a.employee?.full_name || 'Unknown';
                    if (!privCount[name]) privCount[name] = { count: 0, dept: a.employee?.department, employee: a.employee };
                    privCount[name].count++;
                  });
                  const sorted = Object.entries(privCount).sort((a,b) => b[1].count - a[1].count).slice(0,5);
                  if (sorted.length === 0) return <div className="text-sm text-slate-500 text-center py-4">{t('empty_no_admin_access')}</div>;
                  return sorted.map(([name, data]) => (
                    <div key={name} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/40 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{name}</div>
                        <div className="text-xs text-slate-500 truncate">{data.dept || 'No department'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-purple-400">{data.count}</div>
                        <div className="text-[10px] text-slate-500">admin</div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Most Shared Tools */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">{t("access_most_shared")}</h3>
                <span className="text-xs text-slate-500">{t("access_by_user_count")}</span>
              </div>
              <div className="space-y-2.5">
                {(() => {
                  const toolCount = {};
                  derived.access.filter(a => a.status === 'active').forEach(a => {
                    const name = a.tool?.name || a.tool_name || 'Unknown';
                    if (!toolCount[name]) toolCount[name] = { count: 0, category: a.tool?.category };
                    toolCount[name].count++;
                  });
                  const sorted = Object.entries(toolCount).sort((a,b) => b[1].count - a[1].count).slice(0,5);
                  const maxCount = sorted[0]?.[1].count || 1;
                  if (sorted.length === 0) return <div className="text-sm text-slate-500 text-center py-4">{t('empty_no_access')}</div>;
                  return sorted.map(([name, data]) => (
                    <div key={name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
                            {name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-slate-200 truncate">{name}</span>
                        </div>
                        <span className="text-sm font-bold text-blue-400 flex-shrink-0 ml-2">{data.count}</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden ml-8">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{width: `${(data.count/maxCount)*100}%`}} />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Access by Department */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">{t("access_by_dept")}</h3>
                <span className="text-xs text-slate-500">{t("access_distribution")}</span>
              </div>
              <div className="space-y-2.5">
                {(() => {
                  const deptCount = {};
                  derived.access.filter(a => a.status === 'active').forEach(a => {
                    const dept = a.employee?.department || 'Unassigned';
                    if (!deptCount[dept]) deptCount[dept] = 0;
                    deptCount[dept]++;
                  });
                  const sorted = Object.entries(deptCount).sort((a,b) => b[1] - a[1]).slice(0,6);
                  const total = sorted.reduce((s, [,c]) => s + c, 0) || 1;
                  const colors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4'];
                  if (sorted.length === 0) return <div className="text-sm text-slate-500 text-center py-4">{t('empty_no_departments')}</div>;
                  return sorted.map(([dept, count], idx) => {
                    const pct = Math.round((count/total)*100);
                    return (
                      <div key={dept}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background: colors[idx % colors.length]}} />
                            <span className="text-sm text-slate-300 capitalize">{dept}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{count}</span>
                            <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{width: `${pct}%`, background: colors[idx % colors.length]}} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ── View: By Tool ── */}
        {viewMode === 'by-tool' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(derived.toolMatrix)
              .filter(([name]) => !search || name.toLowerCase().includes(search.toLowerCase()))
              .sort((a, b) => b[1].employees.length - a[1].employees.length)
              .map(([toolName, { tool, employees }]) => {
              const hasRisk = employees.some(e => e.risk === 'former_employee' || e.risk === 'excessive_admin');
              const adminCount = employees.filter(e => e.level === 'admin').length;
              return (
                <div key={toolName} className={"rounded-2xl border p-5 " + (hasRisk ? 'border-red-500/20 bg-red-500/5' : 'border-slate-800 bg-slate-900/60')}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{toolName}</h3>
                      <div className="text-xs text-slate-500">{tool?.category || 'Uncategorized'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {adminCount > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-semibold">{adminCount} admin</span>}
                      <span className="text-xs text-slate-500">{employees.length} users</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {employees.slice(0, 5).map((emp, idx) => {
                      const isRisk = emp.risk === 'former_employee' || emp.risk === 'excessive_admin';
                      return (
                        <div key={idx} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <div className={"w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold " + (isRisk ? 'bg-red-500/30 text-red-400' : 'bg-slate-800 text-slate-400')}>
                              {emp.name?.charAt(0) || '?'}
                            </div>
                            <span className={"text-xs " + (isRisk ? 'text-red-300' : 'text-slate-300')}>{emp.name}</span>
                          </div>
                          <span className={"text-[10px] font-semibold " + (emp.level === 'admin' ? 'text-purple-400' : 'text-slate-500')}>{emp.level}</span>
                        </div>
                      );
                    })}
                    {employees.length > 5 && <div className="text-[10px] text-slate-600">+ {employees.length - 5} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── View: Table ── */}
        {viewMode === 'table' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="overflow-x-auto w-full">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400">{t('col_employee')}</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400">{t('col_tool')}</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400">{t('col_level')}</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400">{t('col_status')}</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400">{t('col_risk')}</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400">{t('col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccess.slice(0, 25).map((a, idx) => (
                  <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                          {(a.employee?.full_name || '?').charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{a.employee?.full_name || 'Unknown'}</div>
                          <div className="text-[10px] text-slate-500">{a.employee?.department}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-white">{a.tool?.name || a.tool_name}</td>
                    <td className="py-3 px-4">
                      <span className={"px-2 py-0.5 rounded-full text-[10px] font-semibold " + (a.access_level === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400')}>{enumLabel(a.access_level)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={"px-2 py-0.5 rounded-full text-[10px] font-semibold " + (a.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400')}>{enumLabel(a.status)}</span>
                    </td>
                    <td className="py-3 px-4">
                      {a.risk !== 'none' ? (
                        <span className={"px-2 py-0.5 rounded-full text-[10px] font-semibold " + (a.risk === 'former_employee' || a.risk === 'excessive_admin' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400')}>{enumLabel(a.risk)}</span>
                      ) : <span className="text-[10px] text-slate-600">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => {
                          const action = window.prompt(`${t('act_manage')}: ${a.employee?.full_name || ''} → ${a.tool?.name || a.tool_name}\n\n1=${t('badge_viewer')}  2=${t('badge_admin')}  3=${t('dash_revoke')}`);
                          if (action === '1') muts.updateAccess.mutate({ id: a.id, patch: { access_level: 'viewer' } }, { onSuccess: () => toast.success(t('changed_to_viewer')) });
                          else if (action === '2') muts.updateAccess.mutate({ id: a.id, patch: { access_level: 'admin' } }, { onSuccess: () => toast.success(t('changed_to_admin')) });
                          else if (action === '3') muts.updateAccess.mutate({ id: a.id, patch: { status: 'revoked' } }, { onSuccess: () => toast.success(t('revoked')) });
                        }} className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold">{t('act_manage')}</button>
                        <button onClick={() => {
                          if(window.confirm(t('confirm_revoke_one'))) muts.updateAccess.mutate({ id: a.id, patch: { status: 'revoked' } }, { onSuccess: () => toast.success(t('revoked')) });
                        }} className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-xs font-semibold">×</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {filteredAccess.length > 25 && <div className="text-center py-3 text-xs text-slate-500">Showing 25 of {filteredAccess.length} records</div>}
          </div>
        )}

      </div>
    </AppShell>
  );
}
