import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { todayISO } from '../lib/db';
import { EMP_DEPARTMENTS } from '../lib/constants';
import { computeToolDerivedRisk, getRiskEvidence } from '../lib/dataUtils';
import { useDbQuery, useDbMutations } from '../hooks/useDbQuery';
import { useCurrency } from '../contexts/CurrencyContext';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Button, Input, Select, Modal, SkeletonRow, EmptyState } from '../components/ui';
import { RoleGate } from '../components/gates';
import { AppShell } from '../components/AppShell';
import { Search, Plus, Pencil, Trash2, ChevronDown, Check, X, Users, UserMinus } from 'lucide-react';

export function EmployeeForm({ initial, onSubmit, onClose }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const [form, setForm] = useState(
    initial || {
      full_name: "",
      email: "",
      department: "engineering",
      role: "",
      status: "active",
      start_date: todayISO(),
      end_date: "",
    }
  );

  const canSubmit = form.full_name.trim() && form.email.trim();

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({ ...form });
        onClose();
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('full_name')}</div>
          <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">Email</div>
          <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('department')}</div>
          <Select value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}>
            {EMP_DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">Role</div>
          <Input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">Status</div>
          <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            {['active','offboarding','offboarded'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('start_date')}</div>
          <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t("hc_end_date")}</div>
          <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
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

export function EmployeesPage() {
  const { ready: ratesReady } = useCurrency();
  const { data: db, isLoading } = useDbQuery();
  const { language, setLanguage } = useLang();
  const t = useTranslation(language);
  const muts = useDbMutations();

  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expandedEmployee, setExpandedEmployee] = useState(null);

  const toolCounts = useMemo(() => {
    const m = new Map();
    (db?.access || []).forEach((a) => {
      if (a.status !== "active") return;
      m.set(a.employee_id, (m.get(a.employee_id) || 0) + 1);
    });
    return m;
  }, [db]);

  const getEmployeeTools = (employeeId) => {
    const accessRecords = (db?.access || []).filter(a => a.employee_id === employeeId && a.status === 'active');
    return accessRecords.map(a => {
      const tool = (db?.tools || []).find(t => t.id === a.tool_id || t.name === a.tool_name);
      return {
        ...a,
        tool_name: a.tool_name || tool?.name || 'Unknown',
        cost: tool?.cost_per_month || 0,
        risk: tool?.derived_risk || computeToolDerivedRisk(tool || {}),
        last_used: tool?.last_used_date || a.last_used_date || null,
        status: tool?.status || a.status || 'active',
        mfa: tool?.mfa_required || tool?.mfa_enabled || false,
      };
    });
  };

  const employees = useMemo(() => {
    return (db?.employees || []).slice().sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [db]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return employees.filter((e) => {
      if (s && !`${e.full_name} ${e.email} ${e.role}`.toLowerCase().includes(s)) return false;
      if (dept && e.department !== dept) return false;
      if (status && e.status !== status) return false;
      return true;
    });
  }, [employees, q, dept, status]);

  React.useEffect(() => { setPage(0); }, [q, dept, status]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const deptStats = useMemo(() => {
    const m = {};
    employees.forEach(e => {
      const d = e.department || 'other';
      if (!m[d]) m[d] = { active: 0, total: 0 };
      m[d].total++;
      if (e.status === 'active') m[d].active++;
    });
    return Object.entries(m).sort((a,b) => b[1].total - a[1].total);
  }, [employees]);

  const activeCount = employees.filter(e => e.status === 'active').length;
  const offboardingCount = employees.filter(e => e.status === 'offboarding').length;

  return (
    <AppShell
      title={t('nav_employees')}
      right={
        <div className="flex gap-2">
          <RoleGate requires="editor"><Button variant="secondary" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4" />
            {t("add_employee") || "Add Employee"}
          </Button></RoleGate>
        </div>
      }
    >
      <div className="space-y-6">

        {/* ── Row 1: Compact KPI strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-blue-500">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_total")}</div>
            <div className="text-3xl font-black text-white">{employees.length}</div>
            <div className="text-sm text-slate-500">{t("sub_all_employees")}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-emerald-500">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_active")}</div>
            <div className="text-3xl font-black text-emerald-400">{activeCount}</div>
            <div className="text-sm text-slate-500">{t("sub_currently_working")}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-amber-500">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_offboarding")}</div>
            <div className="text-3xl font-black text-amber-400">{offboardingCount}</div>
            <div className="text-sm text-slate-500">{t("sub_in_transition")}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-purple-500">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_departments")}</div>
            <div className="text-3xl font-black text-purple-400">{deptStats.length}</div>
            <div className="text-sm text-slate-500">{t("sub_distinct_teams")}</div>
          </div>
        </div>

        {/* ── Row 2: Department chips (clickable filters) ── */}
        {deptStats.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">{t("filter_by_department")}</h3>
              {dept && <button onClick={() => setDept('')} className="text-xs text-blue-400 hover:text-blue-300">{t("clear_filter")}</button>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setDept('')}
                className={"px-3 py-1.5 rounded-full text-xs font-semibold transition-all " + (!dept ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}>
                All ({employees.length})
              </button>
              {deptStats.map(([name, stats]) => (
                <button key={name} onClick={() => setDept(name)}
                  className={"px-3 py-1.5 rounded-full text-xs font-semibold transition-all capitalize " + (dept === name ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}>
                  {name} ({stats.active})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Row 3: Search bar + filters ── */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"
                placeholder={t("search_placeholder_employees")} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none">
              <option value="">{t("all_status")}</option>
              <option value="active">Active</option>
              <option value="offboarding">Offboarding</option>
              <option value="offboarded">Offboarded</option>
            </select>
            <span className="text-xs text-slate-500 whitespace-nowrap">{filtered.length} found</span>
          </div>

          {/* ── Compact table ── */}
          {isLoading ? (
            <div className="p-6 space-y-2">
              <SkeletonRow cols={6} /><SkeletonRow cols={6} /><SkeletonRow cols={6} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12">
              <EmptyState icon={Users} title="No employees found" body="Try adjusting your filters or add new employees." />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Employee</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Department</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Role</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Tools</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((e) => (
                      <React.Fragment key={e.id}>
                      <tr className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                          onClick={() => setExpandedEmployee(expandedEmployee === e.id ? null : e.id)}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                              {(e.full_name || '?').charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white truncate">{e.full_name}</div>
                              <div className="text-xs text-slate-500 truncate">{e.email}</div>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform flex-shrink-0 ${expandedEmployee === e.id ? 'rotate-180' : ''}`} />
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-300 capitalize hidden md:table-cell">{e.department || '—'}</td>
                        <td className="py-3 px-4 text-sm text-slate-400 hidden lg:table-cell">{e.role || '—'}</td>
                        <td className="py-3 px-4 text-center hidden sm:table-cell">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold">
                            {toolCounts.get(e.id) || 0}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={"px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase " + (
                            e.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                            e.status === 'offboarding' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-slate-700 text-slate-400'
                          )}>{e.status}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex gap-1 justify-end" onClick={(ev) => ev.stopPropagation()}>
                            <button onClick={() => { setEditing(e); setOpen(true); }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <Link to={`/offboarding?employee=${encodeURIComponent(e.id)}`}>
                              <button className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors" title="Offboard">
                                <UserMinus className="h-3.5 w-3.5" />
                              </button>
                            </Link>
                            <button onClick={() => { if (window.confirm(`Delete ${e.full_name}?`)) muts.deleteEmployee.mutate(e.id); }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-400 transition-colors" title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* ── Expanded tools drill-down ── */}
                      {expandedEmployee === e.id && (
                        <tr>
                          <td colSpan="6" className="p-0">
                            <div className="bg-slate-950/80 border-y border-blue-500/20 px-6 py-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold text-blue-400">{e.full_name}'s tools ({toolCounts.get(e.id) || 0})</h4>
                                <Link to={`/tools`} className="text-xs text-slate-500 hover:text-blue-400 transition-colors">{t("drill_view_all_tools") || "View all tools"} →</Link>
                              </div>
                              {(() => {
                                const empTools = getEmployeeTools(e.id);
                                if (empTools.length === 0) return (
                                  <div className="text-center py-4 text-sm text-slate-500">'{t("drill_no_active_tools") || "No active tools assigned to this employee"}'</div>
                                );
                                return (
                                  <div className="grid gap-2">
                                    {empTools.map((t, i) => {
                                      const toolObj = (db?.tools || []).find(x => x.id === t.tool_id || x.name === t.tool_name);
                                      const evidence = toolObj ? getRiskEvidence(toolObj) : [];
                                      return (
                                      <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition-colors">
                                        <div className="flex items-center gap-3 p-3">
                                          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-300 flex-shrink-0">
                                            {(t.tool_name || '?')[0]}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-slate-200 truncate">{t.tool_name}</div>
                                            <div className="text-xs text-slate-500">
                                              {t.last_used ? `Last used ${t.last_used}` : 'No usage data'}
                                              {t.cost > 0 && ` · €${t.cost}/mo`}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 flex-shrink-0">
                                            {t.mfa && <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold">MFA</span>}
                                            <span className={"px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase " + (
                                              t.risk === 'high' ? 'bg-red-500/20 text-red-400' :
                                              t.risk === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                              'bg-emerald-500/20 text-emerald-400'
                                            )}>{t.risk || 'low'}</span>
                                            <button onClick={(ev) => { ev.stopPropagation(); if(window.confirm(`Revoke ${e.full_name}'s access to ${t.tool_name}?`)) muts.deleteAccess.mutate(t.id); }}
                                              className="p-1 rounded-lg bg-slate-800 hover:bg-red-600/20 text-slate-500 hover:text-red-400 transition-colors" title="Revoke access">
                                              <X className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                        </div>
                                        {evidence.length > 0 && (t.risk === 'high' || t.risk === 'medium') && (
                                          <div className="px-3 pb-3 pt-0">
                                            <div className="flex flex-wrap gap-1.5">
                                              {evidence.map((r, j) => (
                                                <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 border border-slate-700">
                                                  {t(r.key) || r.fallback}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      );
                                    })}
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

      <Modal open={open} title={editing ? "Edit employee" : "Add employee"} subtitle={t('employee_directory_sub')} onClose={() => setOpen(false)}>
        <EmployeeForm
          initial={editing}
          onClose={() => setOpen(false)}
          onSubmit={(emp) => {
            if (editing) muts.updateEmployee.mutate({ id: editing.id, patch: emp });
            else muts.createEmployee.mutate(emp);
          }}
        />
      </Modal>
    </AppShell>
  );
}
