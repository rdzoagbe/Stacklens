import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Activity, AlertTriangle, BadgeCheck, Boxes,
  GitMerge, RefreshCw, Sparkles, Upload, UserMinus,
} from 'lucide-react';
import { resetDb } from '../lib/db';
import {
  computeToolDerivedStatus, computeToolDerivedRisk,
  computeAccessDerivedRiskFlag, buildRiskAlerts, riskSeverityCounts,
  getCurrency, convertCurrency,
} from '../lib/dataUtils';
import { useDbQuery, useDbMutations } from '../hooks/useDbQuery';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Button, Pill } from '../components/ui';
import { RoleGate } from '../components/gates';
import { AppShell, LangSelectorCompact } from '../components/AppShell';
import { ImportWizard } from '../components/ImportWizard';

// Re-export for lazy-loading in App.jsx
export { ImportWizard } from '../components/ImportWizard';
export { SlackNotifications } from '../components/SlackNotifications';

// ── Getting Started Checklist ─────────────────────────────────────────────────

function GettingStartedChecklist({ db }) {
  const navigate = useNavigate();
  const { language } = useLang();
  const t = useTranslation(language);
  const [dismissed, setDismissed] = useState(
    localStorage.getItem('sg_checklist_dismissed') === 'true'
  );
  const [celebrating, setCelebrating] = useState(false);

  const budgetCap = db?.user?.budget_cap || parseInt(localStorage.getItem('sg_budget_cap') || '0') || 0;
  const teamMembers = (() => { try { return JSON.parse(localStorage.getItem('sg_team_members') || '[]'); } catch { return []; } })();

  const steps = [
    {
      id: 'first_tool',
      icon: '🛠️',
      title: t('gs_step1_title'),
      desc: t('gs_step1_desc'),
      done: (db?.tools || []).filter(tool => tool.status !== 'archived').length > 0,
      action: () => navigate('/tools'),
      cta: t('gs_step1_cta'),
    },
    {
      id: 'add_employee',
      icon: '👥',
      title: t('gs_step2_title'),
      desc: t('gs_step2_desc'),
      done: (db?.employees || []).length > 0,
      action: () => navigate('/employees'),
      cta: t('gs_step2_cta'),
    },
    {
      id: 'budget_cap',
      icon: '💰',
      title: t('gs_step3_title'),
      desc: t('gs_step3_desc'),
      done: budgetCap > 0,
      action: () => navigate('/finance'),
      cta: t('gs_step3_cta'),
    },
    {
      id: 'invite_team',
      icon: '✉️',
      title: t('gs_step4_title'),
      desc: t('gs_step4_desc'),
      done: teamMembers.length > 0,
      action: () => { navigate('/settings'); setTimeout(() => { const el = document.querySelector('[data-tab="team"]'); if (el) el.click(); }, 100); },
      cta: t('gs_step4_cta'),
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;

  const dismiss = () => {
    localStorage.setItem('sg_checklist_dismissed', 'true');
    setDismissed(true);
  };

  React.useEffect(() => {
    if (allDone && !dismissed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCelebrating(true);
      const t = setTimeout(() => dismiss(), 4000);
      return () => clearTimeout(t);
    }
  }, [allDone, dismissed]);

  if (dismissed) return null;

  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-900 to-blue-950/20 p-5 lg:p-6 mb-6">
      {celebrating ? (
        <div className="text-center py-4">
          <div className="text-3xl mb-2">🎉</div>
          <div className="text-lg font-bold text-white mb-1">{t('gs_done_title')}</div>
          <div className="text-sm text-slate-400">{t('gs_done_sub')}</div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-base font-bold text-white">{t('gs_title')}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold">{doneCount}/{steps.length}</span>
              </div>
              <div className="text-xs text-slate-500">{t('gs_sub')}</div>
            </div>
            <button onClick={dismiss} className="text-slate-600 hover:text-slate-400 transition-colors text-lg leading-none flex-shrink-0" title={t('close')}>✕</button>
          </div>

          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-5">
            <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {steps.map((step) => (
              <div key={step.id} className={`relative flex flex-col gap-2 p-4 rounded-xl border transition-all ${
                step.done
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-slate-700 bg-slate-950/40 hover:border-slate-600'
              }`}>
                {step.done && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                <div className="text-xl">{step.icon}</div>
                <div className={`text-sm font-semibold ${step.done ? 'text-emerald-300 line-through decoration-emerald-500/50' : 'text-white'}`}>
                  {step.title}
                </div>
                <div className="text-xs text-slate-500 flex-1">{step.desc}</div>
                {!step.done && (
                  <button onClick={step.action}
                    className="mt-1 text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors text-left">
                    {step.cta}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Dashboard Page ────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  useAuth();

  const { language } = useLang();
  const t = useTranslation(language);
  const [showImport, setShowImport] = useState(false);
  const [importKind, setImportKind] = useState(null);
  const [showAssignOwner, setShowAssignOwner] = useState(false);
  const [assignToolId, setAssignToolId] = useState(null);
  const [assignToolName, setAssignToolName] = useState('');
  const [spendView, setSpendView] = useState('tool');
  const { data: db } = useDbQuery();
  const muts = useDbMutations();

  const derived = useMemo(() => {
    if (!db) return { tools: [], access: [], alerts: [], counts: { critical:0, high:0, medium:0, low:0 }, spend: 0, highRiskTools: 0, formerAccess: 0, activeTools: 0 };
    const tools = db.tools.map((t) => ({
      ...t,
      derived_status: computeToolDerivedStatus(t),
      derived_risk: computeToolDerivedRisk(t),
    }));
    const employeesById = Object.fromEntries(db.employees.map((e) => [e.id, e]));
    const toolsById = Object.fromEntries(tools.map((t) => [t.id, t]));
    const access = db.access.map((a) => ({
      ...a,
      derived_risk_flag: computeAccessDerivedRiskFlag(a, employeesById, toolsById),
    }));
    const alerts = buildRiskAlerts({ ...db, tools, access });
    const counts = riskSeverityCounts(alerts);
    const spend = tools.reduce((sum, tool) => sum + Number(tool.cost_per_month || 0), 0);
    const highRiskTools = tools.filter((tool) => tool.derived_risk === "high").length;
    const formerAccess = access.filter((a) => a.derived_risk_flag === "former_employee").length;
    return { tools, access, alerts, counts, spend, highRiskTools, formerAccess };
  }, [db]);

  // ── Derived spend-breakdown rows ──────────────────────────────────────────
  const spendRows = useMemo(() => {
    const tools = derived.tools || [];
    if (spendView === 'tool') {
      return tools
        .filter(tool => tool.cost_per_month > 0)
        .sort((a, b) => b.cost_per_month - a.cost_per_month)
        .slice(0, 6)
        .map(tool => ({ label: tool.name, value: tool.cost_per_month, sub: `${tool.seats || '?'} seats` }));
    }
    if (spendView === 'category') {
      const cat = {};
      tools.forEach(tool => { const c = tool.category || 'other'; cat[c] = (cat[c] || 0) + (tool.cost_per_month || 0); });
      return Object.entries(cat).sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([label, value]) => ({ label, value, sub: '' }));
    }
    // dept
    const deptAcc = {};
    tools.forEach(tool => {
      const emp = (db?.employees || []).find(e => e.email === tool.owner_email);
      const d = emp?.department || 'unassigned';
      deptAcc[d] = (deptAcc[d] || 0) + (tool.cost_per_month || 0);
    });
    return Object.entries(deptAcc).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([label, value]) => ({ label, value, sub: '' }));
  }, [derived.tools, spendView, db]);

  const spendMax = spendRows.length ? spendRows[0].value : 1;

  return (
    <AppShell title={t('dashboard')} right={
        <div className="flex items-center gap-2">
          <RoleGate requires="editor">
            <Button variant="secondary" size="sm" onClick={() => { setImportKind('tools'); setShowImport(true); }}>
              <Upload className="h-3.5 w-3.5" />{t('dash_import_data')}
            </Button>
          </RoleGate>
          <RoleGate requires="admin">
            <Button variant="secondary" size="sm" onClick={() => { if(window.confirm(t('dash_reset_confirm'))) { resetDb(); } }} title={t('dash_reset_title')}>
              <RefreshCw className="h-3.5 w-3.5" /> {t('dash_reset_data')}
            </Button>
          </RoleGate>
          <LangSelectorCompact />
        </div>
      }>

      {/* ── GETTING STARTED — shown to new real users only ── */}
      {db && !db.user?.is_demo && db.user?.is_authenticated && (
        <GettingStartedChecklist db={db} />
      )}

      {/* ── PRIORITY ACTION BANNER ── */}
      {derived.formerAccess > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-orange-500/5 to-transparent p-5 lg:p-6 mb-6">
          <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-rose-500/5 to-transparent pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-rose-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400">{t('dash_priority')}</span>
                <h2 className="text-xl lg:text-2xl font-bold text-white mb-1">
                  {derived.formerAccess} {t('dash_former_access_title')}
                </h2>
                <p className="text-sm text-slate-400">{t('dash_former_access_desc')}</p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <Button onClick={() => navigate('/offboarding')}
                className="w-full lg:w-auto !bg-rose-500 hover:!bg-rose-400 !text-white !px-6 !py-3 !font-bold shadow-lg shadow-rose-900/30">
                {t('dash_remove_access')} →
              </Button>
            </div>
          </div>
        </div>
      )}

      {derived.formerAccess === 0 && derived.tools.length === 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent p-5 lg:p-6 mb-6">
          <div className="relative flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                <Upload className="h-7 w-7 text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1">{t('dash_get_started')}</div>
                <h2 className="text-xl lg:text-2xl font-bold text-white mb-1">{t('dash_import_team')}</h2>
                <p className="text-sm text-slate-400">{t('dash_import_team_desc')}</p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <Button onClick={() => { setImportKind('company'); setShowImport(true); }}
                className="w-full lg:w-auto !bg-blue-500 hover:!bg-blue-400 !text-white !px-6 !py-3 !font-bold">
                {t('dash_upload_data')} →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── ROW 1: Hero KPI Strip ── */}
      {(() => {
        const totalTools = derived.tools.length;
        const totalEmployees = new Set((derived.access).map(a => a.employee_id)).size;
        const hasData = totalTools > 0 || totalEmployees > 0;
        const orphanedToolsCount = derived.tools.filter(tool => !tool.owner_email).length;
        const formerAccess = derived.formerAccess || 0;
        const highRiskTools = derived.tools.filter(tool => tool.derived_risk === 'high').length;
        const score = hasData ? Math.max(0, Math.min(100, 100 - (orphanedToolsCount * 10) - (highRiskTools * 5) - (formerAccess * 8))) : null;
        const scoreColor = score === null ? '#475569' : score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
        const scoreLabel = score === null ? t('dash_no_data') : score >= 80 ? t('dash_score_good') : score >= 60 ? t('dash_score_needs_work') : t('dash_score_critical');
        const labelBg = score === null ? 'bg-slate-700/40 text-slate-400' : score >= 80 ? 'bg-emerald-500/20 text-emerald-400' : score >= 60 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400';
        const toolsWithMfa = derived.tools.filter(tool => tool.mfa_required || tool.mfa_enabled).length;
        const mfaCoverage = totalTools > 0 ? Math.round((toolsWithMfa / totalTools) * 100) : null;
        // eslint-disable-next-line react-hooks/purity
        const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
        const overdueReviews = derived.access.filter(a => !a.last_reviewed_date || new Date(a.last_reviewed_date).getTime() < ninetyDaysAgo).length;
        const wastedSpend = Math.round((derived.spend || 0) * 0.14);
        const annualSpend = (derived.spend || 0) * 12;
        const avgPerEmployee = totalEmployees > 0 ? Math.round((derived.spend || 0) / totalEmployees) : 0;

        return (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-5 mb-6">
            {/* Monthly Spend — hero */}
            <Link to="/finance" className="lg:col-span-2">
              <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-slate-900 to-emerald-950/20 p-5 lg:p-6 h-full hover:border-emerald-500/40 transition-all group">
                <div className="absolute top-0 right-0 w-40 h-full bg-gradient-to-l from-emerald-500/5 to-transparent pointer-events-none" />
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">{t('monthly_spend')}</div>
                <div className="text-4xl lg:text-5xl font-black text-emerald-400 mb-1">
                  {getCurrency(language)}{convertCurrency(derived.spend || 0, language).toLocaleString()}
                </div>
                <div className="text-sm text-slate-500 mb-4">
                  {getCurrency(language)}{convertCurrency(annualSpend, language).toLocaleString()}/yr
                </div>
                <div className="flex gap-6">
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">{t('dash_tools_tracked')}</div>
                    <div className="text-lg font-black text-white">{totalTools}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">{t('dash_avg_per_employee')}</div>
                    <div className="text-lg font-black text-white">
                      {totalEmployees > 0 ? `${getCurrency(language)}${convertCurrency(avgPerEmployee, language).toLocaleString()}` : '—'}
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            {/* Security Score */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('security_score')}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${labelBg}`}>{scoreLabel}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="10"/>
                    <circle cx="50" cy="50" r="40" fill="none" stroke={scoreColor} strokeWidth="10"
                      strokeDasharray={`${2*Math.PI*40}`}
                      strokeDashoffset={`${2*Math.PI*40*(1-(score||0)/100)}`}
                      strokeLinecap="round"/>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-white">{score === null ? '—' : score}</span>
                    <span className="text-[10px] text-slate-500">/100</span>
                  </div>
                </div>
                <div className="space-y-1.5 flex-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">{t('dash_mfa_coverage')}</span><span className={mfaCoverage === null ? 'text-slate-500' : mfaCoverage >= 80 ? 'text-emerald-400' : 'text-amber-400'} >{mfaCoverage === null ? '—' : `${mfaCoverage}%`}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">{t('dash_ex_emp_access')}</span><span className={formerAccess > 0 ? 'text-red-400' : 'text-emerald-400'}>{formerAccess} active</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">{t('dash_overdue_reviews')}</span><span className={overdueReviews > 0 ? 'text-amber-400' : 'text-emerald-400'}>{overdueReviews}</span></div>
                </div>
              </div>
              <Link to="/security" className="mt-3 block">
                <Button variant="secondary" className="w-full text-xs">{t('dash_review_score')} →</Button>
              </Link>
            </div>

            {/* Alerts + Wasted stacked */}
            <div className="flex flex-col gap-3">
              <Link to="/security" className="flex-1">
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 h-full hover:border-red-500/40 transition-all">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{t('security_alerts')}</div>
                  <div className="text-3xl font-black text-red-400">{derived.alerts.length || 0}</div>
                  <div className="text-xs text-slate-500">{derived.counts.critical||0} critical · {derived.counts.high||0} high</div>
                </div>
              </Link>
              <Link to="/tools" className="flex-1">
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 h-full hover:border-amber-500/40 transition-all">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{t('dash_wasted_spend')}</div>
                  <div className="text-3xl font-black text-amber-400">{getCurrency(language)}{convertCurrency(wastedSpend, language).toLocaleString()}</div>
                  <div className="text-xs text-slate-500">{t('dash_idle_licenses')}</div>
                </div>
              </Link>
            </div>
          </div>
        );
      })()}

      {/* ── ROW 2: Spend Breakdown + Security Overview ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-5 mb-6">

        {/* Spend Breakdown */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white">{t('dash_spend_breakdown')}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{t('dash_top_items')}</p>
            </div>
            <div className="flex gap-1.5">
              {[['tool',t('dash_by_tool')],['category',t('dash_by_category')],['dept',t('dash_by_dept')]].map(([v,l]) => (
                <button key={v} onClick={() => setSpendView(v)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${spendView === v ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {spendRows.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2 opacity-40">💸</div>
              <div className="text-sm text-slate-400 mb-1">{t('dash_no_spend')}</div>
              <div className="text-xs text-slate-600">{t('dash_import_to_see')}</div>
            </div>
          ) : (
            <div className="space-y-3">
              {spendRows.map((row, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-300 flex-shrink-0">
                    {(row.label || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-white font-medium capitalize truncate">{row.label}</span>
                      <span className="text-slate-200 font-semibold flex-shrink-0 ml-2">{getCurrency(language)}{convertCurrency(row.value||0,language).toLocaleString()}/mo</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all"
                        style={{width:`${Math.min(100,Math.round((row.value/spendMax)*100))}%`}} />
                    </div>
                    {row.sub && <div className="text-[10px] text-slate-500 mt-0.5">{row.sub}</div>}
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-800 flex justify-end">
                <Link to="/finance" className="text-xs text-blue-400 hover:text-blue-300 font-semibold">{t('dash_full_breakdown')} →</Link>
              </div>
            </div>
          )}
        </div>

        {/* Security Overview */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-white">{t('critical_alerts')}</h3>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <Pill tone="blue" icon={Sparkles}>{t('live')}</Pill>
            </div>
          </div>

          <div className="space-y-2.5">
            {derived.alerts.length > 0 ? derived.alerts.slice(0, 4).map((a) => (
              <div key={a.id} className={`flex items-start gap-3 rounded-xl p-3.5 border transition-colors hover:border-slate-700 ${a.severity === 'critical' ? 'bg-red-500/5 border-red-500/20' : 'bg-slate-950/40 border-slate-800'}`}>
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.severity === 'critical' ? 'bg-red-400' : 'bg-amber-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-100">{a.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{a.body}</div>
                </div>
                <Link to={a.action.to} className="text-xs text-blue-400 hover:text-blue-300 flex-shrink-0 font-semibold">{t('dash_fix')} →</Link>
              </div>
            )) : (
              <div className="flex items-center gap-3 rounded-xl p-4 bg-emerald-500/5 border border-emerald-500/20">
                <BadgeCheck className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                <div className="text-sm text-emerald-400 font-semibold">{t('dash_all_clear')}</div>
              </div>
            )}
          </div>

          {derived.alerts.length > 4 && (
            <Link to="/security" className="mt-3 block">
              <Button variant="secondary" className="w-full text-xs">{t('dash_see_all_alerts')} ({derived.alerts.length}) →</Button>
            </Link>
          )}
        </div>
      </div>

      {/* ── ROW 3: Action Inbox ── */}
      {(() => {
        const actions = [];

        (derived.access || []).filter(a => a.derived_risk_flag === 'former_employee' && a.status === 'active').forEach(a => {
          actions.push({
            id: 'former-' + a.id, severity: 'critical', icon: '🔴',
            title: `${a.employee_name || 'Ex-employee'} still has access to ${a.tool_name || 'a tool'}`,
            reason: t('dash_left_not_revoked'),
            action: t('dash_revoke'),
            onAction: () => muts.updateAccess.mutate({ id: a.id, patch: { status: 'revoked' } }, { onSuccess: () => toast.success(t('revoked')) }),
          });
        });

        (derived.tools || []).filter(tool => !tool.owner_email).slice(0, 4).forEach(tool => {
          actions.push({
            id: 'noowner-' + tool.id, severity: 'high', icon: '🟡',
            title: `${tool.name} ${t('dash_no_owner')}`,
            reason: `${getCurrency(language)}${convertCurrency(tool.cost_per_month||0,language).toLocaleString()}/mo — ${t('dash_nobody_responsible')}`,
            action: t('dash_assign'),
            toolId: tool.id, toolName: tool.name, needsOwner: true,
          });
        });

        (derived.tools || []).filter(tool => tool.derived_risk === 'high' && !tool.mfa_required && !tool.mfa_enabled).slice(0, 3).forEach(tool => {
          actions.push({
            id: 'mfa-' + tool.id, severity: 'high', icon: '🛡️',
            title: `${tool.name} ${t('dash_high_risk_no_mfa')}`,
            reason: `Owner: ${tool.owner_email || 'none'} · Last used: ${tool.last_used_date || 'unknown'}`,
            action: t('review'), link: '/security',
          });
        });

        const _budgetCap = db?.user?.budget_cap || parseInt(localStorage.getItem('sg_budget_cap') || '0') || 0;
        const _notifBudget = (() => { try { return JSON.parse(localStorage.getItem('sg_notifications') || '{}'); } catch { return {}; } })().budget ?? true;
        if (_budgetCap > 0 && _notifBudget && (derived.spend || 0) > _budgetCap) {
          const pct = Math.round((derived.spend / _budgetCap) * 100);
          actions.push({
            id: 'budget-exceeded', severity: 'high', icon: '💰',
            title: `${pct}% ${t('dash_budget_exceeded')}`,
            reason: `Cap: ${getCurrency(language)}${convertCurrency(_budgetCap,language).toLocaleString()}/mo · Current: ${getCurrency(language)}${convertCurrency(derived.spend,language).toLocaleString()}`,
            action: t('nav_finance'), link: '/finance',
          });
        }

        // eslint-disable-next-line react-hooks/purity
        const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
        (derived.tools || []).filter(tool => tool.cost_per_month > 0 && (!tool.last_used_date || new Date(tool.last_used_date).getTime() < sixtyDaysAgo)).slice(0, 3).forEach(tool => {
          actions.push({
            id: 'idle-' + tool.id, severity: 'medium', icon: '💸',
            title: `${tool.name} — ${getCurrency(language)}${convertCurrency(tool.cost_per_month||0,language).toLocaleString()}/mo ${t('dash_possibly_wasted')}`,
            reason: `Last used: ${tool.last_used_date || 'never'}`,
            action: t('review'), link: '/tools',
          });
        });

        if (actions.length === 0) return null;
        actions.sort((a, b) => ({ critical:0, high:1, medium:2 }[a.severity]||3) - ({ critical:0, high:1, medium:2 }[b.severity]||3));

        return (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-red-500/20 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                </div>
                <span className="text-base font-semibold text-slate-100">{t('action_inbox')}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-semibold border border-red-500/30">{actions.length}</span>
              </div>
              {actions.length > 6 && (
                <Link to="/security" className="text-xs text-slate-500 hover:text-blue-400">View all {actions.length} →</Link>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              {actions.slice(0, 6).map((item) => (
                <div key={item.id} className={`flex items-start gap-3 rounded-xl p-3.5 border transition-colors ${
                  item.severity === 'critical' ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40' :
                  item.severity === 'high' ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40' :
                  'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}>
                  <span className="text-sm mt-0.5 flex-shrink-0">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-100">{item.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{item.reason}</div>
                  </div>
                  <div className="flex-shrink-0">
                    {item.needsOwner ? (
                      <button onClick={() => { setAssignToolId(item.toolId); setAssignToolName(item.toolName); setShowAssignOwner(true); }}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-xs font-semibold transition-colors">
                        {item.action}
                      </button>
                    ) : item.onAction ? (
                      <button onClick={item.onAction}
                        className="px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-semibold transition-colors">
                        {item.action}
                      </button>
                    ) : (
                      <Link to={item.link}>
                        <span className="px-2.5 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-xs font-semibold transition-colors inline-block">
                          {item.action}
                        </span>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── ROW 4: Quick Actions ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
        <h3 className="text-sm font-semibold text-white mb-4">{t('quick_actions')}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Link to="/offboarding">
            <button className="flex items-center gap-3 p-4 rounded-xl border border-slate-700 bg-slate-950/40 hover:bg-slate-900/80 hover:border-slate-600 transition-all text-left w-full">
              <UserMinus className="h-5 w-5 text-slate-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-white">{t('revoke_departing_access')}</div>
                <div className="text-xs text-slate-500">{t('dash_revoke_all')}</div>
              </div>
            </button>
          </Link>
          <Link to="/access">
            <button className="flex items-center gap-3 p-4 rounded-xl border border-slate-700 bg-slate-950/40 hover:bg-slate-900/80 hover:border-slate-600 transition-all text-left w-full">
              <GitMerge className="h-5 w-5 text-slate-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-white">{t('review_admin_access')}</div>
                <div className="text-xs text-slate-500">{(derived.access||[]).filter(a=>a.status==='active').length} {t('dash_pending_reviews')}</div>
              </div>
            </button>
          </Link>
          <Link to="/tools">
            <button className="flex items-center gap-3 p-4 rounded-xl border border-slate-700 bg-slate-950/40 hover:bg-slate-900/80 hover:border-slate-600 transition-all text-left w-full">
              <Boxes className="h-5 w-5 text-slate-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-white">{t('assign_owners')}</div>
                <div className="text-xs text-slate-500">{derived.tools.filter(t=>!t.owner_email).length} {t('dash_tools_unassigned')}</div>
              </div>
            </button>
          </Link>
          <Link to="/licenses">
            <button className="flex items-center gap-3 p-4 rounded-xl border border-slate-700 bg-slate-950/40 hover:bg-slate-900/80 hover:border-slate-600 transition-all text-left w-full">
              <Activity className="h-5 w-5 text-slate-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-white">{t('reclaim_licenses')}</div>
                <div className="text-xs text-slate-500">Save ~{getCurrency(language)}{convertCurrency(Math.round((derived.spend||0)*0.14),language).toLocaleString()}/mo</div>
              </div>
            </button>
          </Link>
        </div>
      </div>

      {showImport && importKind && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowImport(false)}>
          <div className="bg-slate-950 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowImport(false)} className="absolute top-4 right-4 z-10 w-8 h-8 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">✕</button>
            <ImportWizard defaultKind={importKind} onDone={() => { setShowImport(false); setImportKind(null); }} />
          </div>
        </div>
      )}

      {showAssignOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowAssignOwner(false)}>
          <div className="bg-slate-950 border border-slate-700 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-1">{t('dash_assign_owner')}</h3>
            <p className="text-sm text-slate-400 mb-4">{t('dash_who_should_own')} {assignToolName}?</p>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {(db?.employees || []).filter(e => e.status === 'active').map(emp => (
                <button key={emp.id}
                  onClick={() => {
                    if (assignToolId) muts.updateTool.mutate(
                      { id: assignToolId, patch: { owner_email: emp.email, owner_name: emp.full_name } },
                      { onSuccess: () => { toast.success(`${emp.full_name} is now the owner of ${assignToolName}`); setShowAssignOwner(false); } }
                    );
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950/30 hover:bg-slate-900/60 hover:border-slate-700 transition-colors text-left">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    {(emp.full_name || '?')[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-200 truncate">{emp.full_name}</div>
                    <div className="text-xs text-slate-500 truncate">{emp.email} · {emp.department || t('dash_no_dept')}</div>
                  </div>
                </button>
              ))}
              {(db?.employees || []).filter(e => e.status === 'active').length === 0 && (
                <div className="text-center py-6 text-sm text-slate-500">{t('assign_no_active_employees')}</div>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={() => setShowAssignOwner(false)}>{t('cancel')}</Button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  );
}
