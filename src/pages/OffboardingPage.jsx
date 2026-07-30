import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, BadgeX, CheckCircle, ChevronLeft, UserMinus, Users } from 'lucide-react';
import { todayISO } from '../lib/db';
import { useDbQuery, useDbMutations } from '../hooks/useDbQuery';
import { useCurrency } from '../contexts/CurrencyContext';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Button, SkeletonRow } from '../components/ui';
import { AppShell } from '../components/AppShell';

function ChecklistItems() {
  const [checked, setChecked] = React.useState({});
  const items = [
    "Revoke all SaaS tool access",
    "Remove from SSO / identity provider",
    "Transfer ownership of shared docs",
    "Recover company devices",
    "Archive or reassign email",
    "Remove from Slack / Teams",
    "Cancel user-specific subscriptions",
  ];
  const doneCount = Object.values(checked).filter(Boolean).length;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500">{doneCount}/{items.length} completed</span>
        {doneCount === items.length && <span className="text-xs text-emerald-400 font-semibold">All done!</span>}
      </div>
      <div className="space-y-2 text-sm text-slate-400">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 cursor-pointer group"
            onClick={() => setChecked(prev => ({...prev, [item]: !prev[item]}))}>
            <div className={"mt-0.5 h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center transition-all " + (checked[item] ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 group-hover:border-emerald-500/50')}>
              {checked[item] && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
            </div>
            <span className={checked[item] ? 'line-through text-slate-600' : 'group-hover:text-slate-300 transition-colors'}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OffboardingPage() {
  const { language } = useLang();
  useCurrency();
  const t = useTranslation(language);
  const { data: db, isLoading } = useDbQuery();
  const muts = useDbMutations();
  const nav = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const pre = params.get("employee") || "";

  const employees = useMemo(() => db?.employees || [], [db]);
  const access = useMemo(() => db?.access || [], [db]);

  const [tab, setTab] = useState("queue"); // "queue" | "history"
  const [employeeId, setEmployeeId] = useState(pre || "");
  const [checked, setChecked] = useState({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pre) setEmployeeId(pre);
  }, [pre]);

  const employee = employees.find((e) => e.id === employeeId);
  const activeRecords = access.filter((a) => a.employee_id === employeeId && a.status === "active");

  const revokeOne = (id) => {
    muts.updateAccess.mutate({ id, patch: { status: "revoked" } }, { onSuccess: () => toast.success(t('revoked')) });
  };
  const revokeAll = () => {
    if (!employee) return;
    if (!window.confirm(`Revoke all ${activeRecords.length} access records for ${employee.full_name}?`)) return;
    activeRecords.forEach((r) => muts.updateAccess.mutate({ id: r.id, patch: { status: "revoked" } }));
    muts.updateEmployee.mutate({
      id: employeeId,
      patch: { status: "offboarded", end_date: employee?.end_date || todayISO() },
    });
    toast.success(`${employee.full_name} offboarded — ${activeRecords.length} access records revoked`);
    setEmployeeId("");
  };

  // Pipeline buckets
  const upcoming = useMemo(() => {
    if (!db) return [];
    return db.employees
      .filter((e) => e.status === "offboarding" || (e.end_date && e.end_date >= todayISO() && e.status !== "offboarded"))
      .sort((a, b) => (a.end_date || "9999") > (b.end_date || "9999") ? 1 : -1);
  }, [db]);

  const offboarded = useMemo(() => {
    if (!db) return [];
    return db.employees
      .filter((e) => e.status === "offboarded")
      .sort((a, b) => (a.end_date || "") < (b.end_date || "") ? 1 : -1);
  }, [db]);

  // Risk: ex-employees still with access
  const riskRecords = useMemo(() => {
    return access.filter(a => {
      const emp = employees.find(e => e.id === a.employee_id);
      return emp?.status === "offboarded" && a.status === "active";
    });
  }, [access, employees]);

  const daysUntil = (dateStr) => {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  };

  const inProgressCount = employees.filter(e => e.status === 'offboarding').length;

  return (
    <AppShell
      title={t('nav_offboarding')}
      right={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => nav("/employees")}>
            <Users className="h-4 w-4" /> {t("nav_employees") || "Employees"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">

        {/* ── Row 1: Pipeline KPI Strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-blue-500">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_pending")}</div>
            <div className="text-3xl font-black text-blue-400">{upcoming.length}</div>
            <div className="text-sm text-slate-500">{t("sub_in_queue")}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-amber-500">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_in_progress")}</div>
            <div className="text-3xl font-black text-amber-400">{inProgressCount}</div>
            <div className="text-sm text-slate-500">{t("sub_being_processed")}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-emerald-500">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_completed")}</div>
            <div className="text-3xl font-black text-emerald-400">{offboarded.length}</div>
            <div className="text-sm text-slate-500">{t("sub_total_offboarded")}</div>
          </div>
          <div className={"rounded-2xl border bg-slate-900/60 p-5 border-l-4 " + (riskRecords.length > 0 ? "border-slate-800 border-l-red-500 ring-2 ring-red-500/20" : "border-slate-800 border-l-slate-700")}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_at_risk")}</div>
            <div className={"text-3xl font-black " + (riskRecords.length > 0 ? "text-red-400" : "text-slate-500")}>{riskRecords.length}</div>
            <div className="text-sm text-slate-500">{t("sub_ex_emp_still_has_access")}</div>
          </div>
        </div>

        {/* ── Row 2: Risk Alert (only if risks exist) ── */}
        {riskRecords.length > 0 && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 lg:p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-red-500/10 flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div className="flex-1">
                <div className="text-base font-semibold text-red-400 mb-1">Security Risk: {riskRecords.length} active access records belong to offboarded employees</div>
                <p className="text-sm text-slate-400 mb-4">These users have been offboarded but their access was never revoked. This is a major security and compliance issue.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                  {riskRecords.slice(0, 6).map((a, idx) => {
                    const emp = employees.find(e => e.id === a.employee_id);
                    return (
                      <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/50 border border-red-500/20">
                        <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 font-bold text-xs flex-shrink-0">
                          {(emp?.full_name || '?').charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white truncate">{emp?.full_name || 'Unknown'}</div>
                          <div className="text-[10px] text-slate-500 truncate">{a.tool_name}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => {
                  if (window.confirm(`Revoke all ${riskRecords.length} risky access records?`)) {
                    riskRecords.forEach(a => muts.updateAccess.mutate({ id: a.id, patch: { status: "revoked" } }));
                    toast.success(`Revoked ${riskRecords.length} access records`);
                  }
                }} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-xl font-semibold text-sm text-white transition-colors">
                  {t('off_revoke_all_risky')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Row 3: 2-column layout — Queue/History on left (8 col), Active workflow on right (4 col) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">

          {/* LEFT: Queue / History tabs */}
          <div className="lg:col-span-7 space-y-5">

            {/* Tab bar */}
            <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1 w-fit">
              {[
                { id: "queue",   label: `Queue (${upcoming.length})` },
                { id: "history", label: `History (${offboarded.length})` },
              ].map(({ id, label }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={"px-4 py-2 rounded-lg text-sm font-semibold transition-colors " + (tab === id ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200")}>
                  {label}
                </button>
              ))}
            </div>

            {tab === "queue" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800">
                  <h2 className="text-base font-semibold text-white">{t("offboarding_queue_title")}</h2>
                  <p className="text-sm text-slate-500">{t("offboarding_queue_sub")}</p>
                </div>
                {isLoading || !db ? (
                  <div className="p-6"><SkeletonRow cols={5} /></div>
                ) : upcoming.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 mb-3">
                      <CheckCircle className="h-6 w-6 text-emerald-400" />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-1">{t("offboarding_queue_empty")}</h3>
                    <p className="text-sm text-slate-500">{t("offboarding_queue_empty_sub")}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800 max-h-[560px] overflow-y-auto">
                    {upcoming.map((e) => {
                      const days = daysUntil(e.end_date);
                      const urgent = days !== null && days <= 3;
                      const empAccess = access.filter(a => a.employee_id === e.id && a.status === "active");
                      const isSelected = employeeId === e.id;
                      return (
                        <div key={e.id}
                          onClick={() => setEmployeeId(e.id)}
                          className={"flex items-center gap-3 p-4 cursor-pointer transition-colors " + (isSelected ? "bg-blue-500/10 border-l-4 border-l-blue-500" : "hover:bg-slate-800/30")}>
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {(e.full_name || '?').charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-white truncate">{e.full_name}</div>
                            <div className="text-xs text-slate-500 truncate">{e.department || '—'} · {empAccess.length} active access</div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {days !== null && (
                              <span className={"text-[10px] font-semibold px-2 py-0.5 rounded-full " + (
                                urgent ? "bg-red-500/20 text-red-400" :
                                days <= 7 ? "bg-amber-500/20 text-amber-400" :
                                "bg-slate-700 text-slate-400"
                              )}>
                                {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `${days}d`}
                              </span>
                            )}
                            <span className={"text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase " + (
                              e.status === "offboarding" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"
                            )}>
                              {e.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === "history" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800">
                  <h2 className="text-base font-semibold text-white">{t("offboarding_history_title")}</h2>
                  <p className="text-sm text-slate-500">{t("offboarding_history_sub")}</p>
                </div>
                {isLoading || !db ? (
                  <div className="p-6"><SkeletonRow cols={5} /></div>
                ) : offboarded.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="inline-flex p-3 rounded-2xl bg-slate-800 mb-3">
                      <UserMinus className="h-6 w-6 text-slate-500" />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-1">{t("offboarding_history_empty")}</h3>
                    <p className="text-sm text-slate-500">{t("offboarding_history_empty_sub")}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800 max-h-[560px] overflow-y-auto">
                    {offboarded.map((e) => {
                      const revokedCount = access.filter(a => a.employee_id === e.id && a.status === "revoked").length;
                      const remainingCount = access.filter(a => a.employee_id === e.id && a.status === "active").length;
                      return (
                        <div key={e.id} className="flex items-center gap-3 p-4 hover:bg-slate-800/30 transition-colors">
                          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 font-bold text-sm flex-shrink-0">
                            {(e.full_name || '?').charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-white truncate">{e.full_name}</div>
                            <div className="text-xs text-slate-500 truncate">
                              {e.department || '—'} · Offboarded {e.end_date || 'recently'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {revokedCount > 0 && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">{revokedCount} revoked</span>
                            )}
                            {remainingCount > 0 && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">{remainingCount} risk</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Active workflow / revocation panel (5 col) */}
          <div className="lg:col-span-5 lg:sticky lg:top-6 lg:self-start">
            {/* Spacer to align with the Queue/History tab bar on the left */}
            <div className="hidden lg:block h-[52px] mb-5" aria-hidden="true" />
            {!employeeId || !employee ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 flex flex-col items-center justify-center text-center min-h-[560px]">
                <div className="inline-flex p-4 rounded-2xl bg-slate-800 mb-4">
                  <UserMinus className="h-8 w-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{t("offboarding_no_emp_selected")}</h3>
                <p className="text-sm text-slate-500 mb-6 max-w-xs">{t("offboarding_no_emp_selected_sub")}</p>
                {employees.length > 0 && (
                  <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full max-w-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500 transition-colors">
                    <option value="">{t("offboarding_or_pick")}</option>
                    {employees.filter(e => e.status !== 'offboarded').map(e => (
                      <option key={e.id} value={e.id}>{e.full_name} ({e.status})</option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                {/* Employee header */}
                <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-blue-950/20">
                  <button onClick={() => setEmployeeId("")}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-3">
                    <ChevronLeft className="h-3.5 w-3.5" />
                    {t("offboarding_back_to_queue")}
                  </button>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
                      {(employee.full_name || '?').charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-semibold text-white truncate">{employee.full_name}</div>
                      <div className="text-xs text-slate-500 truncate">{employee.email}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-slate-800/50 p-2">
                      <div className="text-[10px] text-slate-500 uppercase">{t("offboarding_dept")}</div>
                      <div className="text-xs font-semibold text-white capitalize truncate">{employee.department || '—'}</div>
                    </div>
                    <div className="rounded-lg bg-slate-800/50 p-2">
                      <div className="text-[10px] text-slate-500 uppercase">{t("offboarding_access_label")}</div>
                      <div className="text-xs font-semibold text-white">{activeRecords.length} active</div>
                    </div>
                    <div className="rounded-lg bg-slate-800/50 p-2">
                      <div className="text-[10px] text-slate-500 uppercase">{t("offboarding_end_date")}</div>
                      <div className="text-xs font-semibold text-white">{employee.end_date || 'TBD'}</div>
                    </div>
                  </div>
                </div>

                {/* Step-by-step checklist */}
                <div className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">{t("offboarding_workflow")}</div>

                  {activeRecords.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="inline-flex p-2 rounded-lg bg-emerald-500/10 mb-2">
                        <CheckCircle className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div className="text-sm font-semibold text-emerald-400 mb-1">{t("offboarding_all_revoked")}</div>
                      <div className="text-xs text-slate-500">{t("offboarding_all_revoked_sub")}</div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 mb-4 max-h-[280px] overflow-y-auto pr-1">
                        {activeRecords.map((r) => (
                          <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950/40">
                            <div className="flex-shrink-0">
                              <input type="checkbox" checked={Boolean(checked[r.id])}
                                onChange={(e) => setChecked((m) => ({ ...m, [r.id]: e.target.checked }))}
                                className="w-4 h-4 rounded accent-emerald-500 cursor-pointer" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-white truncate">{r.tool_name}</div>
                              <div className="text-[10px] text-slate-500">
                                <span className="capitalize">{r.access_level}</span> · Granted {r.granted_date || '—'}
                              </div>
                            </div>
                            <button onClick={() => revokeOne(r.id)}
                              className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-xs font-semibold transition-colors flex-shrink-0">
                              {t('act_revoke')}
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* One-click button */}
                      <button onClick={revokeAll}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold text-sm text-white transition-all shadow-lg shadow-red-500/20">
                        <BadgeX className="h-4 w-4" />
                        One-Click Offboard ({activeRecords.length} access)
                      </button>
                      <p className="text-[10px] text-slate-600 text-center mt-2">
                        {t("offboarding_one_click_sub")}
                      </p>
                    </>
                  )}
                </div>

                {/* Best practices checklist */}
                <div className="p-5 border-t border-slate-800 bg-slate-950/30">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">{t("offboarding_best_practices")}</div>
                  <ChecklistItems />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
