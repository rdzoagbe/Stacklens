import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { todayISO } from '../lib/db';
import { CATEGORIES, TOOL_STATUS, CRITICALITY, RISK_SCORE } from '../lib/constants';
import { computeToolDerivedStatus, computeToolDerivedRisk, getRiskEvidence, getCurrency, convertCurrency } from '../lib/dataUtils';
import { useDbQuery, useDbMutations } from '../hooks/useDbQuery';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Button, Input, Select, Textarea, Modal, SkeletonRow, EmptyState, CategoryIcon, RiskBadge, StatusBadge } from '../components/ui';
import { RoleGate, PlanLimitBanner } from '../components/gates';
import { AppShell } from '../components/AppShell';
import { Search, Plus, Pencil, Trash2, ChevronDown, AlertTriangle, Check, X, Boxes } from 'lucide-react';

export function ToolForm({ initial, employees, onSubmit, onClose }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const [form, setForm] = useState(
    initial || {
      name: "",
      category: "engineering",
      owner_email: "",
      owner_name: "",
      criticality: "medium",
      url: "",
      description: "",
      status: "active",
      last_used_date: todayISO(),
      cost_per_month: 0,
      risk_score: "low",
      notes: "",
    }
  );

  useEffect(() => {
    const email = (form.owner_email || "").toLowerCase();
    const match = employees.find((e) => (e.email || "").toLowerCase() === email);
    if (match && form.owner_name !== match.full_name) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((f) => ({ ...f, owner_name: match.full_name }));
    }
  }, [form.owner_email, form.owner_name, employees]);

  const canSubmit = form.name.trim().length > 0;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({
          ...form,
          cost_per_month: Number(form.cost_per_month || 0),
        });
        onClose();
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('tool_name')}</div>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('category')}</div>
          <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('owner_email')}</div>
          <Input value={form.owner_email} onChange={(e) => setForm((f) => ({ ...f, owner_email: e.target.value }))} />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('owner_name')}</div>
          <Input value={form.owner_name} onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('criticality')}</div>
          <Select value={form.criticality} onChange={(e) => setForm((f) => ({ ...f, criticality: e.target.value }))}>
            {CRITICALITY.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">Status</div>
          <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            {TOOL_STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('risk_score')}</div>
          <Select value={form.risk_score} onChange={(e) => setForm((f) => ({ ...f, risk_score: e.target.value }))}>
            {RISK_SCORE.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <div className="mb-1 text-xs font-semibold text-slate-400">URL</div>
          <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('last_used')}</div>
          <Input type="date" value={form.last_used_date} onChange={(e) => setForm((f) => ({ ...f, last_used_date: e.target.value }))} />
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs font-semibold text-slate-400">{t('description')}</div>
        <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">Cost / month</div>
          <Input
            type="number"
            value={form.cost_per_month}
            onChange={(e) => setForm((f) => ({ ...f, cost_per_month: e.target.value }))}
          />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">Notes</div>
          <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          <Check className="h-4 w-4" />
          Save
        </Button>
      </div>
    </form>
  );
}

export function ToolsPage() {
  const { data: db, isLoading } = useDbQuery();
  const { language } = useLang();
  const t = useTranslation(language);
  // Alias for use inside the tools table, where the map's item is named `t`
  // and shadows the translation function.
  const tr = t;
  const muts = useDbMutations();

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [risk, setRisk] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expandedTool, setExpandedTool] = useState(null);
  const [showToolOwnerModal, setShowToolOwnerModal] = useState(false);
  const [ownerToolId, setOwnerToolId] = useState(null);
  const [ownerToolName, setOwnerToolName] = useState('');

  const getToolEmployees = (toolId, toolName) => {
    const accessRecords = (db?.access || []).filter(a => (a.tool_id === toolId || a.tool_name === toolName) && a.status === 'active');
    return accessRecords.map(a => {
      const emp = (db?.employees || []).find(e => e.id === a.employee_id || e.email === a.employee_email);
      return {
        ...a,
        employee_name: a.employee_name || emp?.full_name || 'Unknown',
        employee_email: a.employee_email || emp?.email || '',
        department: emp?.department || '',
        employee_status: emp?.status || 'active',
      };
    });
  };

  const tools = useMemo(() => {
    if (!db) return [];
    return db.tools.map((t) => ({
      ...t,
      derived_status: computeToolDerivedStatus(t),
      derived_risk: computeToolDerivedRisk(t),
    }));
  }, [db]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tools
      .filter((t) => {
        if (s && !`${t.name} ${t.owner_name || ''} ${t.owner_email || ''}`.toLowerCase().includes(s)) return false;
        if (cat && t.category !== cat) return false;
        if (status && t.derived_status !== status) return false;
        if (risk && t.derived_risk !== risk) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tools, q, cat, status, risk]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => { setPage(0); }, [q, cat, status, risk]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const catStats = useMemo(() => {
    const m = {};
    tools.forEach(t => {
      const c = t.category || 'other';
      if (!m[c]) m[c] = { count: 0, cost: 0 };
      m[c].count++;
      m[c].cost += Number(t.cost_per_month || 0);
    });
    return Object.entries(m).sort((a,b) => b[1].cost - a[1].cost);
  }, [tools]);

  const totalCost = tools.reduce((s, t) => s + (Number(t.cost_per_month) || 0), 0);
  const highRiskCount = tools.filter(t => t.derived_risk === 'high').length;
  const unassignedCount = tools.filter(t => !t.owner_email).length;
  const employees = db?.employees || [];

  return (
    <AppShell
      title={t("nav_tools")}
      right={
        <div className="flex gap-2">
          <RoleGate requires="editor">
            <Button variant="secondary" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-4 w-4" />
              {t('add_tool_btn')}
            </Button>
          </RoleGate>
        </div>
      }
    >
      <div className="space-y-6">

        <PlanLimitBanner resource="tools" />

        {/* ── Row 1: KPI strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-blue-500">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_total_tools")}</div>
            <div className="text-3xl font-black text-white">{tools.length}</div>
            <div className="text-sm text-slate-500">{tools.filter(t => t.derived_status === 'active').length} active</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-emerald-500">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_monthly_spend")}</div>
            <div className="text-3xl font-black text-emerald-400">{getCurrency(language)}{convertCurrency(Math.round(totalCost), language).toLocaleString()}</div>
            <div className="text-sm text-slate-500">{getCurrency(language)}{convertCurrency(Math.round(totalCost*12), language).toLocaleString()}/yr</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-red-500 cursor-pointer hover:border-slate-700 transition-colors" onClick={() => setRisk('high')}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_high_risk")}</div>
            <div className="text-3xl font-black text-red-400">{highRiskCount}</div>
            <div className="text-sm text-slate-500">{t("sub_click_to_filter")}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-amber-500">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_unassigned")}</div>
            <div className="text-3xl font-black text-amber-400">{unassignedCount}</div>
            <div className="text-sm text-slate-500">{t("sub_no_owner")}</div>
          </div>
        </div>

        {/* ── Row 2: Category chips ── */}
        {catStats.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">{t("filter_by_category")}</h3>
              {cat && <button onClick={() => setCat('')} className="text-xs text-blue-400 hover:text-blue-300">{t("clear_filter")}</button>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setCat('')}
                className={"px-3 py-1.5 rounded-full text-xs font-semibold transition-all " + (!cat ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}>
                All ({tools.length})
              </button>
              {catStats.map(([name, stats]) => (
                <button key={name} onClick={() => setCat(name)}
                  className={"px-3 py-1.5 rounded-full text-xs font-semibold transition-all capitalize " + (cat === name ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}>
                  {name} ({stats.count})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Row 3: Tool inventory table ── */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"
                placeholder={t("search_placeholder_tools")} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none">
              <option value="">{t("all_status")}</option>
              {TOOL_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={risk} onChange={(e) => setRisk(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none">
              <option value="">{t("all_risk")}</option>
              {RISK_SCORE.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <span className="text-xs text-slate-500 whitespace-nowrap">{filtered.length} found</span>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-2"><SkeletonRow cols={6} /><SkeletonRow cols={6} /><SkeletonRow cols={6} /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12">
              <EmptyState icon={Boxes} title="No tools found" body="Try adjusting your filters or add new tools." />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tool</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Owner</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Last Used</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Risk</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Status</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost/mo</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((t) => (
                      <React.Fragment key={t.id}>
                      <tr className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                          onClick={() => setExpandedTool(expandedTool === t.id ? null : t.id)}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <CategoryIcon category={t.category} />
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white truncate">{t.name}</div>
                              <div className="text-xs text-slate-500 truncate capitalize">{t.category || '—'}</div>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform flex-shrink-0 ${expandedTool === t.id ? 'rotate-180' : ''}`} />
                          </div>
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          {t.owner_email ? (
                            <div className="min-w-0">
                              <div className="text-sm text-slate-300 truncate">{t.owner_name || '—'}</div>
                              <div className="text-xs text-slate-500 truncate">{t.owner_email}</div>
                            </div>
                          ) : <button onClick={(ev) => { ev.stopPropagation(); setOwnerToolId(t.id); setOwnerToolName(t.name); setShowToolOwnerModal(true); }} className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors">Assign owner</button>}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-400 hidden lg:table-cell">{t.last_used_date || '—'}</td>
                        <td className="py-3 px-4 text-center"><RiskBadge risk={t.derived_risk} /></td>
                        <td className="py-3 px-4 text-center hidden sm:table-cell"><StatusBadge status={t.derived_status} /></td>
                        <td className="py-3 px-4 text-right text-sm font-semibold text-white whitespace-nowrap">
                          {getCurrency(language)}{convertCurrency(t.cost_per_month || 0, language).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex gap-1 justify-end" onClick={(ev) => ev.stopPropagation()}>
                            <button onClick={() => { setEditing(t); setOpen(true); }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => { if (window.confirm(`Delete ${t.name}?`)) { muts.deleteTool.mutate(t.id); toast.success(`${t.name} deleted!`); } }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-400 transition-colors" title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* ── Expanded employees drill-down ── */}
                      {expandedTool === t.id && (
                        <tr>
                          <td colSpan="7" className="p-0">
                            <div className="bg-slate-950/80 border-y border-purple-500/20 px-6 py-4">
                              {/* Risk evidence card */}
                              {(t.derived_risk === 'high' || t.derived_risk === 'medium') && (() => {
                                const evidence = getRiskEvidence(t);
                                if (evidence.length === 0) return null;
                                return (
                                  <div className={`rounded-xl p-3 mb-3 border ${t.derived_risk === 'high' ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                      <AlertTriangle className={`h-3.5 w-3.5 ${t.derived_risk === 'high' ? 'text-red-400' : 'text-amber-400'}`} />
                                      <span className={`text-xs font-semibold ${t.derived_risk === 'high' ? 'text-red-400' : 'text-amber-400'}`}>
                                        Why this tool is {t.derived_risk} risk
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {evidence.map((r, j) => (
                                        <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 border border-slate-700">
                                          {tr(r.key) || r.fallback}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold text-purple-400">Employees using {t.name} ({getToolEmployees(t.id, t.name).length})</h4>
                                <Link to="/employees" className="text-xs text-slate-500 hover:text-purple-400 transition-colors">{tr("drill_view_all_employees") || "View all employees"} →</Link>
                              </div>
                              {(() => {
                                const toolEmps = getToolEmployees(t.id, t.name);
                                if (toolEmps.length === 0) return (
                                  <div className="text-center py-4 text-sm text-slate-500">{tr("drill_no_employees") || "No employees currently assigned to this tool"}</div>
                                );
                                return (
                                  <div className="grid gap-2">
                                    {toolEmps.map((emp, i) => (
                                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                          {(emp.employee_name || '?')[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-semibold text-slate-200 truncate">{emp.employee_name}</div>
                                          <div className="text-xs text-slate-500 truncate">
                                            {emp.employee_email}
                                            {emp.department && ` · ${emp.department}`}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          <span className={"px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase " + (
                                            emp.employee_status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                                            emp.employee_status === 'offboarding' ? 'bg-amber-500/20 text-amber-400' :
                                            'bg-slate-700 text-slate-400'
                                          )}>{emp.employee_status}</span>
                                          <button onClick={(ev) => { ev.stopPropagation(); if(window.confirm(`Revoke ${emp.employee_name}'s access to ${t.name}?`)) muts.deleteAccess.mutate(emp.id); }}
                                            className="p-1 rounded-lg bg-slate-800 hover:bg-red-600/20 text-slate-500 hover:text-red-400 transition-colors" title="Revoke access">
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-800 bg-slate-950/30">
                  <span className="text-xs text-slate-500">
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(0)} disabled={page === 0}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      « {t("page_first").replace("« ", "")}
                    </button>
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      {t("page_prev")}
                    </button>
                    <span className="px-3 py-1 text-xs text-slate-300 font-semibold">
                      Page {page + 1} / {totalPages}
                    </span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      {t("page_next")}
                    </button>
                    <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      {t("page_last")}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal open={open} title={editing ? "Edit tool" : t('add_tool_btn')} subtitle={t('tool_inventory_sub')} onClose={() => setOpen(false)}>
        <ToolForm
          initial={editing}
          employees={employees}
          onClose={() => setOpen(false)}
          onSubmit={(tool) => {
            if (editing) muts.updateTool.mutate({ id: editing.id, patch: tool });
            else muts.createTool.mutate(tool);
          }}
        />
      </Modal>

      {/* ── Assign Owner Modal (Tools page) ── */}
      <Modal
        open={showToolOwnerModal}
        title="Assign tool owner"
        subtitle={`Who should own ${ownerToolName}?`}
        onClose={() => setShowToolOwnerModal(false)}
        footer={
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setShowToolOwnerModal(false)}>Cancel</Button>
          </div>
        }
      >
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {employees.filter(e => e.status === 'active').map(emp => (
            <button key={emp.id}
              onClick={() => {
                if (ownerToolId) {
                  muts.updateTool.mutate(
                    { id: ownerToolId, patch: { owner_email: emp.email, owner_name: emp.full_name } },
                    { onSuccess: () => { toast.success(`${emp.full_name} is now the owner of ${ownerToolName}`); setShowToolOwnerModal(false); } }
                  );
                }
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950/30 hover:bg-slate-900/60 hover:border-slate-700 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                {(emp.full_name || '?')[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-200 truncate">{emp.full_name}</div>
                <div className="text-xs text-slate-500 truncate">{emp.email} · {emp.department || 'No dept'}</div>
              </div>
            </button>
          ))}
          {employees.filter(e => e.status === 'active').length === 0 && (
            <div className="text-center py-6 text-sm text-slate-500">No active employees. Import your team first.</div>
          )}
        </div>
      </Modal>

    </AppShell>
  );
}
