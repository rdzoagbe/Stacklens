import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Activity, AlertTriangle, BadgeCheck, Boxes, Check,
  ChevronRight, Download, GitMerge, RefreshCw, Sparkles,
  Upload, UserMinus,
} from 'lucide-react';
import { callAI } from '../firebase-config';
import { todayISO, resetDb } from '../lib/db';
import {
  computeToolDerivedStatus, computeToolDerivedRisk,
  computeAccessDerivedRiskFlag, buildRiskAlerts, riskSeverityCounts,
  getCurrency, convertCurrency, downloadText, parseCsv,
} from '../lib/dataUtils';
import { useDbQuery, useDbMutations } from '../hooks/useDbQuery';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Button, Card, CardHeader, CardBody, Pill } from '../components/ui';
import { RoleGate } from '../components/gates';
import { AppShell, LangSelectorCompact } from '../components/AppShell';

// ── Directory Sync Widget ────────────────────────────────────────────────────

function WorkspaceConnector() {
  const navigate = useNavigate();
  const { language } = useLang();
  const t = useTranslation(language);

  const connected = (() => {
    try { return JSON.parse(localStorage.getItem('sg_connected_integrations') || '[]'); }
    catch { return []; }
  })();

  const providers = [
    {
      id: 'google-workspace',
      name: 'Google Workspace',
      desc: 'Import employees, departments & org structure',
      syncKey: 'sg_gws_last_sync',
      logo: (
        <svg viewBox="0 0 48 48" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          <path fill="none" d="M0 0h48v48H0z"/>
        </svg>
      ),
    },
    {
      id: 'microsoft-365',
      name: 'Microsoft 365',
      desc: 'Sync from Azure AD / Entra ID',
      syncKey: 'sg_m365_last_sync',
      logo: (
        <svg viewBox="0 0 23 23" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
          <rect x="12" y="1" width="10" height="10" fill="#7FBA00"/>
          <rect x="1" y="12" width="10" height="10" fill="#00A4EF"/>
          <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
        </svg>
      ),
    },
    {
      id: 'okta',
      name: 'Okta',
      desc: 'Import users from Okta directory',
      syncKey: 'sg_okta_last_sync',
      logo: (
        <svg viewBox="0 0 64 64" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="32" fill="#007DC1"/>
          <circle cx="32" cy="32" r="16" fill="white"/>
        </svg>
      ),
    },
  ];

  const goToIntegrations = () => {
    navigate('/import?tab=integrations');
  };

  return (
    <div className="space-y-2">
      {providers.map(p => {
        const isConnected = connected.includes(p.id);
        const lastSync = p.syncKey ? localStorage.getItem(p.syncKey) : null;
        return (
          <button key={p.id}
            onClick={goToIntegrations}
            className="group flex items-center gap-4 p-3 rounded-xl border border-slate-800 hover:border-slate-600 hover:bg-slate-800/50 transition-all text-left w-full"
          >
            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${isConnected ? 'bg-slate-700' : 'bg-slate-800'} border border-slate-700`}>
              {p.logo}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-white">{p.name}</span>
                {isConnected && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">Connected</span>
                )}
              </div>
              <div className="text-xs text-slate-500">
                {isConnected && lastSync
                  ? `Last synced ${new Date(lastSync).toLocaleDateString()}`
                  : p.desc}
              </div>
            </div>
            <div className="flex-shrink-0">
              {isConnected
                ? <svg className="h-4 w-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                : <svg className="h-4 w-4 text-slate-600 group-hover:text-slate-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              }
            </div>
          </button>
        );
      })}
      <button
        onClick={goToIntegrations}
        className="w-full mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors text-center py-1"
      >
        {t('manage_all_integrations')}
      </button>
    </div>
  );
}


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
  }, [allDone]);

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
  const { user } = useAuth();

  const { language, setLanguage } = useLang();
  const t = useTranslation(language);
  const [showImport, setShowImport] = useState(false);
  const [importKind, setImportKind] = useState(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAssignOwner, setShowAssignOwner] = useState(false);
  const [assignToolId, setAssignToolId] = useState(null);
  const [assignToolName, setAssignToolName] = useState('');
  const [orphanedTools] = useState(['GitHub', 'Figma', 'Notion']);
  const [selectedOwners, setSelectedOwners] = useState({});
  const [spendView, setSpendView] = useState('tool');
  const { data: db, isLoading } = useDbQuery();
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

  const markReviewed = (accId) => {
    muts.updateAccess.mutate(
      { id: accId, patch: { last_reviewed_date: todayISO(), risk_flag: "none" } },
      { onSuccess: () => toast.success(t('marked_reviewed')) }
    );
  };

  const revokeAccess = (accId) => {
    muts.updateAccess.mutate(
      { id: accId, patch: { status: "revoked" } },
      { onSuccess: () => toast.success(t('revoked')) }
    );
  };

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
              <Upload className="h-3.5 w-3.5" />Import Data
            </Button>
          </RoleGate>
          <RoleGate requires="admin">
            <Button variant="secondary" size="sm" onClick={() => { if(window.confirm('This will clear ALL your data (tools, employees, access). Are you sure?')) { resetDb(); } }} title="Reset all data">
              <RefreshCw className="h-3.5 w-3.5" /> Reset Data
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
                <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400">Priority · Act now</span>
                <h2 className="text-xl lg:text-2xl font-bold text-white mb-1">
                  {derived.formerAccess} ex-{derived.formerAccess === 1 ? 'employee' : 'employees'} can still access your tools
                </h2>
                <p className="text-sm text-slate-400">Security risk and wasted licence spend. Fix it in one click.</p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <Button onClick={() => navigate('/offboarding')}
                className="w-full lg:w-auto !bg-rose-500 hover:!bg-rose-400 !text-white !px-6 !py-3 !font-bold shadow-lg shadow-rose-900/30">
                Remove their access →
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
                <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1">Get started · Step 1 of 3</div>
                <h2 className="text-xl lg:text-2xl font-bold text-white mb-1">Import your team and tools</h2>
                <p className="text-sm text-slate-400">Upload a CSV or Excel file with your employees and SaaS tools. Stacklens maps everything in seconds.</p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <Button onClick={() => { setImportKind('company'); setShowImport(true); }}
                className="w-full lg:w-auto !bg-blue-500 hover:!bg-blue-400 !text-white !px-6 !py-3 !font-bold">
                Upload my data →
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
        const scoreLabel = score === null ? 'No data' : score >= 80 ? 'Good' : score >= 60 ? 'Needs Work' : 'Critical';
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
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">{t('monthly_spend') || 'Monthly Spend'}</div>
                <div className="text-4xl lg:text-5xl font-black text-emerald-400 mb-1">
                  {getCurrency(language)}{convertCurrency(derived.spend || 0, language).toLocaleString()}
                </div>
                <div className="text-sm text-slate-500 mb-4">
                  {getCurrency(language)}{convertCurrency(annualSpend, language).toLocaleString()}/yr
                </div>
                <div className="flex gap-6">
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">Tools tracked</div>
                    <div className="text-lg font-black text-white">{totalTools}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">Avg / employee</div>
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
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('security_score') || 'Security Score'}</span>
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
                  <div className="flex justify-between"><span className="text-slate-400">MFA coverage</span><span className={mfaCoverage === null ? 'text-slate-500' : mfaCoverage >= 80 ? 'text-emerald-400' : 'text-amber-400'} >{mfaCoverage === null ? '—' : `${mfaCoverage}%`}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Ex-emp access</span><span className={formerAccess > 0 ? 'text-red-400' : 'text-emerald-400'}>{formerAccess} active</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Overdue reviews</span><span className={overdueReviews > 0 ? 'text-amber-400' : 'text-emerald-400'}>{overdueReviews}</span></div>
                </div>
              </div>
              <Link to="/security" className="mt-3 block">
                <Button variant="secondary" className="w-full text-xs">Review score →</Button>
              </Link>
            </div>

            {/* Alerts + Wasted stacked */}
            <div className="flex flex-col gap-3">
              <Link to="/security" className="flex-1">
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 h-full hover:border-red-500/40 transition-all">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{t('security_alerts') || 'Security Alerts'}</div>
                  <div className="text-3xl font-black text-red-400">{derived.alerts.length || 0}</div>
                  <div className="text-xs text-slate-500">{derived.counts.critical||0} critical · {derived.counts.high||0} high</div>
                </div>
              </Link>
              <Link to="/tools" className="flex-1">
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 h-full hover:border-amber-500/40 transition-all">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Wasted Spend</div>
                  <div className="text-3xl font-black text-amber-400">{getCurrency(language)}{convertCurrency(wastedSpend, language).toLocaleString()}</div>
                  <div className="text-xs text-slate-500">Idle / unused licenses</div>
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
              <h3 className="text-base font-semibold text-white">Spend Breakdown</h3>
              <p className="text-xs text-slate-500 mt-0.5">Top items by monthly cost</p>
            </div>
            <div className="flex gap-1.5">
              {[['tool','By Tool'],['category','By Category'],['dept','By Dept']].map(([v,l]) => (
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
              <div className="text-sm text-slate-400 mb-1">No spend data yet</div>
              <div className="text-xs text-slate-600">Import your tools to see spending</div>
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
                <Link to="/finance" className="text-xs text-blue-400 hover:text-blue-300 font-semibold">Full breakdown →</Link>
              </div>
            </div>
          )}
        </div>

        {/* Security Overview */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-white">{t('critical_alerts') || 'Security Overview'}</h3>
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
                <Link to={a.action.to} className="text-xs text-blue-400 hover:text-blue-300 flex-shrink-0 font-semibold">Fix →</Link>
              </div>
            )) : (
              <div className="flex items-center gap-3 rounded-xl p-4 bg-emerald-500/5 border border-emerald-500/20">
                <BadgeCheck className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                <div className="text-sm text-emerald-400 font-semibold">All clear — no critical issues</div>
              </div>
            )}
          </div>

          {derived.alerts.length > 4 && (
            <Link to="/security" className="mt-3 block">
              <Button variant="secondary" className="w-full text-xs">See all {derived.alerts.length} alerts →</Button>
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
            reason: 'Left the company but access was not revoked.',
            action: 'Revoke',
            onAction: () => muts.updateAccess.mutate({ id: a.id, patch: { status: 'revoked' } }, { onSuccess: () => toast.success(t('revoked')) }),
          });
        });

        (derived.tools || []).filter(tool => !tool.owner_email).slice(0, 4).forEach(tool => {
          actions.push({
            id: 'noowner-' + tool.id, severity: 'high', icon: '🟡',
            title: `${tool.name} has no assigned owner`,
            reason: `${getCurrency(language)}${convertCurrency(tool.cost_per_month||0,language).toLocaleString()}/mo — nobody responsible`,
            action: 'Assign',
            toolId: tool.id, toolName: tool.name, needsOwner: true,
          });
        });

        (derived.tools || []).filter(tool => tool.derived_risk === 'high' && !tool.mfa_required && !tool.mfa_enabled).slice(0, 3).forEach(tool => {
          actions.push({
            id: 'mfa-' + tool.id, severity: 'high', icon: '🛡️',
            title: `${tool.name} is high risk with no MFA`,
            reason: `Owner: ${tool.owner_email || 'none'} · Last used: ${tool.last_used_date || 'unknown'}`,
            action: 'Review', link: '/security',
          });
        });

        const _budgetCap = db?.user?.budget_cap || parseInt(localStorage.getItem('sg_budget_cap') || '0') || 0;
        const _notifBudget = (() => { try { return JSON.parse(localStorage.getItem('sg_notifications') || '{}'); } catch { return {}; } })().budget ?? true;
        if (_budgetCap > 0 && _notifBudget && (derived.spend || 0) > _budgetCap) {
          const pct = Math.round((derived.spend / _budgetCap) * 100);
          actions.push({
            id: 'budget-exceeded', severity: 'high', icon: '💰',
            title: `Monthly spend is ${pct}% of your budget cap`,
            reason: `Cap: ${getCurrency(language)}${convertCurrency(_budgetCap,language).toLocaleString()}/mo · Current: ${getCurrency(language)}${convertCurrency(derived.spend,language).toLocaleString()}`,
            action: 'Finance', link: '/finance',
          });
        }

        // eslint-disable-next-line react-hooks/purity
        const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
        (derived.tools || []).filter(tool => tool.cost_per_month > 0 && (!tool.last_used_date || new Date(tool.last_used_date).getTime() < sixtyDaysAgo)).slice(0, 3).forEach(tool => {
          actions.push({
            id: 'idle-' + tool.id, severity: 'medium', icon: '💸',
            title: `${tool.name} — ${getCurrency(language)}${convertCurrency(tool.cost_per_month||0,language).toLocaleString()}/mo possibly wasted`,
            reason: `Last used: ${tool.last_used_date || 'never'}`,
            action: 'Review', link: '/tools',
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
                <span className="text-base font-semibold text-slate-100">{t('action_inbox') || 'Action Inbox'}</span>
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
        <h3 className="text-sm font-semibold text-white mb-4">{t('quick_actions') || 'Quick Actions'}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Link to="/offboarding">
            <button className="flex items-center gap-3 p-4 rounded-xl border border-slate-700 bg-slate-950/40 hover:bg-slate-900/80 hover:border-slate-600 transition-all text-left w-full">
              <UserMinus className="h-5 w-5 text-slate-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-white">{t('revoke_departing_access') || 'Offboard Employee'}</div>
                <div className="text-xs text-slate-500">Revoke all access at once</div>
              </div>
            </button>
          </Link>
          <Link to="/access">
            <button className="flex items-center gap-3 p-4 rounded-xl border border-slate-700 bg-slate-950/40 hover:bg-slate-900/80 hover:border-slate-600 transition-all text-left w-full">
              <GitMerge className="h-5 w-5 text-slate-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-white">{t('review_admin_access') || 'Review Admin Access'}</div>
                <div className="text-xs text-slate-500">{(derived.access||[]).filter(a=>a.status==='active').length} pending reviews</div>
              </div>
            </button>
          </Link>
          <Link to="/tools">
            <button className="flex items-center gap-3 p-4 rounded-xl border border-slate-700 bg-slate-950/40 hover:bg-slate-900/80 hover:border-slate-600 transition-all text-left w-full">
              <Boxes className="h-5 w-5 text-slate-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-white">{t('assign_owners') || 'Assign Tool Owners'}</div>
                <div className="text-xs text-slate-500">{derived.tools.filter(t=>!t.owner_email).length} tools unassigned</div>
              </div>
            </button>
          </Link>
          <Link to="/licenses">
            <button className="flex items-center gap-3 p-4 rounded-xl border border-slate-700 bg-slate-950/40 hover:bg-slate-900/80 hover:border-slate-600 transition-all text-left w-full">
              <Activity className="h-5 w-5 text-slate-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-white">{t('reclaim_licenses') || 'Reclaim Idle Licenses'}</div>
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
            <h3 className="text-lg font-bold text-white mb-1">Assign tool owner</h3>
            <p className="text-sm text-slate-400 mb-4">Who should own {assignToolName}?</p>
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
                    <div className="text-xs text-slate-500 truncate">{emp.email} · {emp.department || 'No dept'}</div>
                  </div>
                </button>
              ))}
              {(db?.employees || []).filter(e => e.status === 'active').length === 0 && (
                <div className="text-center py-6 text-sm text-slate-500">{t('assign_no_active_employees') || 'No active employees. Import your team first.'}</div>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={() => setShowAssignOwner(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  );
}

// ── AI Recommendations ────────────────────────────────────────────────────────

const AI_RECS_CACHE_KEY = 'ag_ai_recs_cache';
const AI_RECS_CACHE_TTL = 30 * 60 * 1000;

function getCachedAIRecs() {
  try {
    const cached = JSON.parse(localStorage.getItem(AI_RECS_CACHE_KEY) || '{}');
    if (cached.data && Date.now() - cached.ts < AI_RECS_CACHE_TTL) return cached.data;
  } catch { /* noop */ }
  return null;
}
function setCachedAIRecs(data) {
  try { localStorage.setItem(AI_RECS_CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch { /* noop */ }
}

function AIRecommendations({ tools, employees, access }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db } = useDbQuery();
  const [loading, setLoading] = React.useState(false);
  const [recs, setRecs] = React.useState(null);
  const [expanded, setExpanded] = React.useState(false);

  const generateRecs = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const offboarded = (employees || []).filter(e => e.status === 'offboarded' || e.status === 'offboarding');
      const orphaned = (tools || []).filter(tool => !tool.owner_email);
      const unused = (tools || []).filter(tool => {
        if (!tool.last_used_date) return false;
        const days = Math.floor((today - new Date(tool.last_used_date)) / 86400000);
        return days > 90;
      });
      const formerWithAccess = offboarded.filter(e =>
        (access || []).some(a => a.employee_email === e.email && a.status === 'active')
      );

      const prompt = `You are an IT security analyst. Analyze this SaaS data and give 3-5 specific, actionable recommendations.

Company data:
- Total tools: ${(tools || []).length}
- Total employees: ${(employees || []).length}
- Former employees with active access: ${formerWithAccess.map(e => e.full_name).join(', ') || 'None'}
- Tools without owners (no owner): ${orphaned.map(tool => tool.name).join(', ') || 'None'}
- Unused 90+ days: ${unused.map(tool => tool.name).join(', ') || 'None'}
- Monthly spend: ${getCurrency(language)}${(tools || []).reduce((s, tool) => s + (tool.cost_per_month || 0), 0).toLocaleString()}

Return JSON array of recommendations:
[{"priority": "high|medium|low", "title": "...", "description": "...", "action": "...", "savings": "optional $X/mo"}]
Return ONLY the JSON array, no markdown.`;

      const aiData = await callAI({ messages: [{ role: 'user', content: prompt }], max_tokens: 1000 });
      const rawText = aiData?.content?.[0]?.text || aiData?.text || '';
      const text = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      setRecs(JSON.parse(text));
    } catch(e) {
      console.error('AI recs failed:', e);
      setRecs([
        { priority: 'high', title: 'Former employees with active access', description: `${(employees||[]).filter(e=>e.status==='offboarded').length} offboarded employees may still have tool access`, action: 'Review Offboarding', savings: null },
        { priority: 'medium', title: 'Tools without owners detected', description: `${(tools||[]).filter(t=>!t.owner_email).length} tools have no owner assigned`, action: 'Assign Owners', savings: null },
        { priority: 'low', title: 'Unused tool licenses', description: `${(tools||[]).filter(t=>t.last_used_date && Math.floor((new Date()-new Date(t.last_used_date))/86400000)>90).length} tools unused for 90+ days`, action: 'Review Tools', savings: null },
      ]);
    } finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => { if (tools?.length > 0) generateRecs(); }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-xl">
            <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">AI Access Recommendations</h3>
            <p className="text-xs text-slate-400">Powered by Claude AI</p>
          </div>
        </div>
        <button onClick={generateRecs} disabled={loading}
          className="text-xs px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-lg border border-purple-500/20 transition-colors">
          {loading ? 'Analysing...' : 'Refresh'}
        </button>
      </div>
      {loading && <div className="flex items-center gap-2 text-slate-400 text-sm"><div className="h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"/><span>Analysing your access data...</span></div>}
      {recs && (
        <div className="space-y-3">
          {(expanded ? recs : recs.slice(0,3)).map((rec, i) => (
            <div key={i} className={"flex items-start gap-3 p-3 rounded-xl border " + (rec.priority === 'high' ? 'bg-red-500/5 border-red-500/20' : rec.priority === 'medium' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-blue-500/5 border-blue-500/20')}>
              <div className={"w-2 h-2 rounded-full mt-1.5 flex-shrink-0 " + (rec.priority === 'high' ? 'bg-red-400' : rec.priority === 'medium' ? 'bg-amber-400' : 'bg-blue-400')} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white">{rec.title}</span>
                  {rec.savings && <span className="text-xs text-emerald-400 font-semibold">{rec.savings}</span>}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{rec.description}</p>
              </div>
              <span className={"text-xs px-2 py-0.5 rounded-full flex-shrink-0 " + (rec.priority === 'high' ? 'bg-red-500/20 text-red-400' : rec.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400')}>{rec.priority}</span>
            </div>
          ))}
          {recs.length > 3 && (
            <button onClick={() => setExpanded(e => !e)} className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
              {expanded ? 'Show less' : `Show ${recs.length - 3} more recommendations`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Slack Notifications ───────────────────────────────────────────────────────

export function SlackNotifications() {
  const [webhook, setWebhook] = React.useState(localStorage.getItem('slack_webhook') || '');
  const [saved, setSaved] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  const save = () => {
    localStorage.setItem('slack_webhook', webhook);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const test = async () => {
    if (!webhook) return;
    setTesting(true);
    try {
      await fetch(webhook, {
        method: 'POST',
        body: JSON.stringify({ text: '✅ Stacklens connected! You will receive alerts for security risks, renewals and offboarding.' })
      });
      toast.success('Test message sent to Slack!');
    } catch(e) {
      toast.error('Failed to send. Check your webhook URL.');
    } finally { setTesting(false); }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-emerald-500/20 rounded-xl text-xl">💬</div>
        <div>
          <h3 className="text-base font-bold text-white">Slack Notifications</h3>
          <p className="text-xs text-slate-400">Get alerts for risks, renewals & offboarding</p>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Slack Webhook URL</label>
          <input
            value={webhook}
            onChange={e => setWebhook(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 transition-colors"
          />
          <p className="text-xs text-slate-500 mt-1">
            <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Create a Slack App</a> → Incoming Webhooks → Add New Webhook
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={save} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors">
            {saved ? '✓ Saved!' : 'Save'}
          </button>
          {webhook && (
            <button onClick={test} disabled={testing} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-xl transition-colors">
              {testing ? 'Sending...' : 'Test Connection'}
            </button>
          )}
        </div>
        <div className="pt-2 border-t border-slate-800">
          <p className="text-xs text-slate-500 mb-2">You will receive alerts for:</p>
          <div className="grid grid-cols-2 gap-1">
            {['🚨 High risk tools', '👤 Former employee access', '🔔 Renewals in 30 days', '⚡ Offboarding needed'].map(a => (
              <div key={a} className="text-xs text-slate-400 flex items-center gap-1">{a}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── License Benchmarking ──────────────────────────────────────────────────────

function LicenseBenchmark({ tools }) {
  const { language } = useLang();
  const BENCHMARKS = {
    'slack': { avg: 8.75, name: 'Slack' },
    'github': { avg: 21, name: 'GitHub' },
    'figma': { avg: 45, name: 'Figma' },
    'notion': { avg: 16, name: 'Notion' },
    'salesforce': { avg: 150, name: 'Salesforce' },
    'hubspot': { avg: 45, name: 'HubSpot' },
    'zoom': { avg: 15, name: 'Zoom' },
    'jira': { avg: 10, name: 'Jira' },
    'datadog': { avg: 35, name: 'Datadog' },
    'adobe': { avg: 80, name: 'Adobe CC' },
  };

  const comparisons = (tools || []).map(tool => {
    const key = tool.name.toLowerCase().replace(/[^a-z]/g, '');
    const bench = Object.entries(BENCHMARKS).find(([k]) => key.includes(k));
    if (!bench || !tool.cost_per_month) return null;
    const perUser = tool.cost_per_month;
    const diff = ((perUser - bench[1].avg) / bench[1].avg * 100).toFixed(0);
    return { name: tool.name, yourCost: perUser, avgCost: bench[1].avg, diff: Number(diff) };
  }).filter(Boolean);

  if (!comparisons.length) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-500/20 rounded-xl">
          <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-white">License Benchmarking</h3>
          <p className="text-xs text-slate-400">Your costs vs industry average</p>
        </div>
      </div>
      <div className="space-y-2">
        {comparisons.slice(0,5).map((c, i) => (
          <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/50">
            <span className="text-sm text-white w-24 truncate">{c.name}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">You: {getCurrency(language)}{convertCurrency(c.yourCost, language)}</span>
                <span className="text-slate-600">vs</span>
                <span className="text-slate-400">Avg: {getCurrency(language)}{convertCurrency(c.avgCost, language)}</span>
              </div>
            </div>
            <span className={"text-xs font-bold px-2 py-0.5 rounded-full " + (c.diff > 20 ? 'bg-red-500/20 text-red-400' : c.diff < -10 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400')}>
              {c.diff > 0 ? '+' : ''}{c.diff}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Import Wizard ─────────────────────────────────────────────────────────────

export function ImportWizard({ defaultKind = null, onDone = null }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const muts = useDbMutations();
  const [step, setStep] = useState(defaultKind ? 2 : 0);
  const [kind, setKind] = useState(defaultKind);
  const [text, setText] = useState('');
  const [imported, setImported] = useState(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [animDir, setAnimDir] = useState('forward');

  const goTo = (n) => { setAnimDir(n > step ? 'forward' : 'back'); setStep(n); };

  const KINDS = {
    company:   { icon: '🏢', label: t('company_data_label'),           desc: t('import_kinds_company_desc'),   example: t('import_kinds_company_example'),   color: 'blue' },
    tools:     { icon: '🛠️', label: t('import_kinds_tools_label'),     desc: t('import_kinds_tools_desc'),     example: t('import_kinds_tools_example'),     color: 'emerald' },
    employees: { icon: '👥', label: t('employees_import'),             desc: t('import_kinds_employees_desc'), example: t('import_kinds_employees_example'), color: 'blue' },
    access:    { icon: '🔑', label: t('import_kinds_access_label'),    desc: t('import_kinds_access_desc'),    example: t('import_kinds_access_example'),    color: 'violet' },
  };

  const TEMPLATES = {
    company:   'employee_name,employee_email,department,role,employee_status,start_date,tool_name,tool_category,tool_cost_monthly,tool_url,tool_status,tool_criticality,renewal_date,access_level\nAlice Martin,alice@co.com,engineering,Engineer,active,2023-01-15,GitHub,engineering,320,https://github.com,active,high,2026-11-15,admin\nAlice Martin,alice@co.com,engineering,Engineer,active,2023-01-15,Slack,communication,240,https://slack.com,active,high,2026-12-01,member\nBob Johnson,bob@co.com,sales,Manager,active,2022-06-01,Salesforce,sales,1200,https://salesforce.com,active,high,2027-01-01,admin',
    tools:     'name,category,owner_email,owner_name,criticality,url,status,cost_per_month\nSlack,communication,jane@co.com,Jane Smith,high,https://slack.com,active,299\nNotion,productivity,tom@co.com,Tom Brown,medium,https://notion.so,active,120\nFigma,design,amy@co.com,Amy Lee,high,https://figma.com,active,75',
    employees: 'full_name,email,department,role,status,start_date\nJane Smith,jane@co.com,Engineering,Engineer,active,2025-01-01\nTom Brown,tom@co.com,Marketing,Manager,active,2024-06-15\nAmy Lee,amy@co.com,Design,Designer,active,2025-03-01',
    access:    'tool_name,employee_email,access_level,granted_date,status\nSlack,jane@co.com,admin,2025-01-01,active\nNotion,tom@co.com,editor,2025-02-01,active\nFigma,amy@co.com,owner,2025-03-01,active',
  };

  const COLS     = { company: ['employee_name','employee_email','department','tool_name','tool_category','access_level'], tools: ['name','category','status','criticality','cost_per_month','owner_name'], employees: ['full_name','email','department','role','status'], access: ['tool_name','employee_email','access_level','status'] };
  const REQUIRED = { company: ['employee_name','employee_email','tool_name'], tools: ['name'], employees: ['full_name','email'], access: ['tool_name','employee_email'] };

  const liveRows = React.useMemo(() => { if (!text.trim()) return []; try { return parseCsv(text); } catch { return []; } }, [text]);
  const cols = kind ? COLS[kind] : [];
  const isRowValid = (row) => kind ? REQUIRED[kind].every(k => row[k]?.trim()) : false;
  const validCount   = liveRows.filter(isRowValid).length;
  const invalidCount = liveRows.length - validCount;

  const handleFileUpload = async (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    let csv;
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      if (!window.XLSX) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const ab = await file.arrayBuffer();
      const wb = window.XLSX.read(ab, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      csv = window.XLSX.utils.sheet_to_csv(ws);
    } else {
      csv = await new Promise((res) => {
        const reader = new FileReader();
        reader.onload = (e) => res(e.target.result);
        reader.readAsText(file);
      });
    }
    setText(csv);
    const detected = detectKind(csv);
    if (detected) {
      setKind(detected);
      toast.success('Detected: ' + (KINDS[detected]?.label || detected));
    }
    goTo(2);
  };

  const handleImport = async () => {
    if (!liveRows.length || !kind) return;
    setImporting(true);
    try {
      await muts.bulkImport.mutateAsync({ kind, records: liveRows });
      await new Promise(r => setTimeout(r, 1500));
      setImported({ count: liveRows.length, kind });
      if (onDone) setTimeout(onDone, 2000);
      goTo(3);
    } finally { setImporting(false); }
  };

  const reset = () => { setStep(0); setKind(null); setText(''); setImported(null); };

  const STEP_LABELS = [t('import_step1'), t('import_step2') || 'Get template', t('import_step3'), t('import_step4') || t('done')];

  const detectKind = (csvText) => {
    const firstLine = csvText.split('\n')[0].toLowerCase();
    const scores = { company: 0, tools: 0, employees: 0, access: 0 };

    const hasEmployeeFields = firstLine.includes('employee_name') || firstLine.includes('employee_email');
    const hasToolFields = firstLine.includes('tool_name') || firstLine.includes('tool_category') || firstLine.includes('tool_cost');
    const hasAccessLevel = firstLine.includes('access_level');

    if (hasEmployeeFields && hasToolFields) {
      scores.company += 10;
      if (hasAccessLevel) scores.company += 3;
    }

    if (firstLine.includes('cost_per_month') || (firstLine.match(/(^|,)name(,|$)/) && !hasEmployeeFields && !hasToolFields)) {
      scores.tools += 5;
    }

    if ((firstLine.includes('full_name') || firstLine.includes('department')) && !hasToolFields) {
      scores.employees += 5;
    }

    if (firstLine.includes('tool_name') && firstLine.includes('access_level') && !firstLine.includes('tool_category') && !firstLine.includes('tool_cost')) {
      scores.access += 5;
    }

    const best = Object.entries(scores).sort((a,b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : null;
  };

  const handlePaste = (val) => {
    setText(val);
    const detected = detectKind(val);
    if (detected && detected !== kind) {
      setKind(detected);
      toast.success('Detected type: ' + KINDS[detected].label + ' — smart detection! ✨');
    }
  };

  return (
    <div className="space-y-6">
      {/* Animated step progress */}
      <div className="flex items-center mb-8 pr-10">
        {STEP_LABELS.map((label, i) => {
          const done = step > i;
          const active = step === i;
          return (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center">
                <div className={
                  "h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 " +
                  (done ? 'bg-emerald-500 text-white scale-90' : active ? 'bg-blue-600 text-white ring-4 ring-blue-600/25 scale-110' : 'bg-slate-800 text-slate-500')
                }>
                  {done ? '✓' : i + 1}
                </div>
                <div className={"text-[10px] mt-1.5 font-semibold whitespace-nowrap transition-colors " + (active ? 'text-white' : done ? 'text-emerald-400' : 'text-slate-600')}>{label}</div>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={"flex-1 h-0.5 mx-3 mb-5 transition-all duration-500 " + (step > i ? 'bg-emerald-500' : 'bg-slate-800')} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* STEP 0 — Choose what to import */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-r from-blue-500/10 to-emerald-500/5 border border-blue-500/20 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">💡</span>
              <div>
                <div className="font-bold text-white mb-1">{t("hc_fastest_way_to_get_started")}</div>
                <p className="text-sm text-slate-400">{t('import_wizard_info')}</p>
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-1">{t('what_importing')}</h2>
            <p className="text-slate-400 text-sm mb-4">{t('import_each_type_info')}</p>
            <div className="grid gap-3">
              {Object.entries(KINDS).map(([id, meta]) => (
                <button key={id} onClick={() => { setKind(id); goTo(1); }}
                  className={"flex items-center gap-4 p-5 rounded-2xl border transition-all text-left hover:scale-[1.01] active:scale-[0.99] " + (kind === id ? 'border-' + meta.color + '-500/40 bg-' + meta.color + '-500/5' : 'border-slate-800 bg-slate-900/40 hover:border-slate-700')}>
                  <div className="text-4xl flex-shrink-0">{meta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white text-lg">{meta.label}</div>
                    <div className="text-sm text-slate-400">{meta.desc}</div>
                    <div className="text-xs text-slate-600 mt-0.5">e.g. {meta.example}</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-600 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 1 — Template */}
      {step === 1 && kind && (
        <div className="space-y-5">
          <button onClick={() => goTo(0)} className="text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1">← {t('back')}</button>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{KINDS[kind].icon}</span>
            <div>
              <h2 className="text-xl font-bold text-white">{t('import_heading')} {KINDS[kind].label}</h2>
              <p className="text-slate-400 text-sm">{KINDS[kind].desc}</p>
            </div>
          </div>

          <Card className="p-5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">{t('template_columns')}</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {TEMPLATES[kind].split('\n')[0].split(',').map(col => (
                <span key={col} className={"text-xs px-2.5 py-1 rounded-full font-mono " + (REQUIRED[kind].includes(col) ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400')}>
                  {col}{REQUIRED[kind].includes(col) ? ' *' : ''}
                </span>
              ))}
            </div>
            <div className="text-xs text-slate-600">{t('import_required_note')}</div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="text-sm font-bold text-white">{t('preview_title')}</div>
              <span className="text-xs text-slate-500">{t("hc_this_is_what_your_csv_should_look_l")}</span>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60">
                    {TEMPLATES[kind].split('\n')[0].split(',').map(col => (
                      <th key={col} className="text-left py-2.5 px-4 text-slate-500 font-semibold whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TEMPLATES[kind].split('\n').slice(1).map((row, i) => (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      {row.split(',').map((cell, j) => (
                        <td key={j} className="py-2.5 px-4 text-slate-300 whitespace-nowrap">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid sm:grid-cols-2 gap-3">
            <button onClick={() => downloadText(kind + '_template.csv', TEMPLATES[kind])}
              className="flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition-all active:scale-[0.98]">
              <Download className="h-4 w-4" /> {t('download_template')}
            </button>
            <button onClick={() => { setText(TEMPLATES[kind]); goTo(2); }}
              className="flex items-center justify-center gap-2 py-3.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-all text-slate-300">
              {t('import_use_sample')}
            </button>
          </div>
          <div className="text-center">
            <button onClick={() => goTo(2)} className="text-sm text-emerald-400 hover:underline">{t('skip_to_upload')}</button>
          </div>
        </div>
      )}

      {/* STEP 2 — Upload */}
      {step === 2 && (
        <div className="space-y-4">
          <button onClick={() => goTo(kind ? 1 : 0)} className="text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1">← {t('back')}</button>

          {kind && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5">
              <span className="text-lg">{KINDS[kind].icon}</span>
              <span>{t('import_as_label')} <span className="text-white font-semibold">{KINDS[kind].label}</span></span>
              <button onClick={() => goTo(0)} className="ml-auto text-blue-400 hover:text-blue-300 font-semibold">{t('back')}</button>
            </div>
          )}

          <Card className="p-4 md:p-6">
            <h2 className="text-xl font-bold text-white mb-1">{t('upload')}</h2>
            <p className="text-slate-400 text-sm mb-5">{t('import_drag_and_drop_desc')}</p>

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files[0]); }}
              onClick={() => document.getElementById('csv-import-input').click()}
              className={"relative rounded-2xl border-2 border-dashed flex flex-col items-center justify-center py-14 mb-5 cursor-pointer transition-all duration-200 " + (dragOver ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]' : 'border-slate-700 hover:border-slate-500 bg-slate-900/40')}
            >
              <input id="csv-import-input" type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={e => handleFileUpload(e.target.files[0])} />
              <div className={"text-2xl md:text-5xl mb-3 transition-all " + (dragOver ? 'scale-125' : '')}>{dragOver ? '📂' : '📁'}</div>
              <div className={"font-bold text-lg transition-colors " + (dragOver ? 'text-emerald-400' : 'text-slate-300')}>
                {dragOver ? t('import_drag_release') : t('import_drag_drop')}
              </div>
              <div className="text-sm text-slate-500 mt-1">{t('import_click_browse')}</div>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-700">
                <span className="px-2 py-0.5 bg-slate-800 rounded font-mono">CSV</span>
                <span className="px-2 py-0.5 bg-slate-800 rounded font-mono">TXT</span>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-x-0 -top-2.5 flex justify-center">
                <span className="text-xs text-slate-600 bg-slate-950 px-3">{t('import_paste_or_csv')}</span>
              </div>
              <textarea rows={4}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 font-mono text-xs text-slate-300 outline-none focus:border-emerald-500 transition-colors resize-none"
                value={text} onChange={e => handlePaste(e.target.value)}
                placeholder={t('import_paste_placeholder')} />
            </div>

            {liveRows.length > 0 && (
              <div className="flex items-center gap-3 mt-3 text-sm flex-wrap">
                <span className="text-slate-500">{liveRows.length} {t('rows_detected')}</span>
                {validCount > 0 && <span className="text-emerald-400 font-semibold">✓ {validCount} {t('valid')}</span>}
                {invalidCount > 0 && <span className="text-rose-400 font-semibold">✗ {invalidCount} {t('import_errors_label')}</span>}
              </div>
            )}
          </Card>

          {liveRows.length > 0 && kind && (
            <Card>
              <CardHeader title={t('preview_title')} subtitle={liveRows.length + " " + t('import_review_before')}
                right={<div className="flex gap-2">{validCount > 0 && <Pill tone="green">✓ {validCount} valid</Pill>}{invalidCount > 0 && <Pill tone="rose">✗ {invalidCount} errors</Pill>}</div>}
              />
              <CardBody>
                <div className="overflow-x-auto w-full">
                <div className="overflow-x-auto w-full"><table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60">
                        <th className="px-3 py-2 text-left text-slate-500 font-semibold w-8">#</th>
                        {cols.map(c => <th key={c} className="px-3 py-2 text-left text-slate-400 font-semibold capitalize">{c.replace(/_/g,' ')}</th>)}
                        <th className="px-3 py-2 text-left text-slate-500">{t('status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveRows.slice(0, 10).map((row, i) => {
                        const valid = isRowValid(row);
                        return (
                          <tr key={i} className={"border-b border-slate-800/60 " + (valid ? '' : 'bg-rose-500/5')}>
                            <td className="px-3 py-2 text-slate-500">{i+1}</td>
                            {cols.map(c => (
                              <td key={c} className={"px-3 py-2 " + (!row[c]?.trim() && REQUIRED[kind].includes(c) ? 'text-rose-400' : 'text-slate-300')}>
                                {row[c] || <span className="text-slate-700 italic">—</span>}
                              </td>
                            ))}
                            <td className="px-3 py-2">
                              {valid
                                ? <span className="text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" /> OK</span>
                                : <span className="text-rose-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Missing</span>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                  {liveRows.length > 10 && <div className="text-center text-xs text-slate-600 py-2">{t('import_showing_of')} {liveRows.length} {t('rows')}</div>}
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="text-xs text-slate-500">{t('import_not_duplicated')}</div>
                  <button disabled={validCount === 0 || importing} onClick={handleImport}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-xl font-bold text-sm transition-all active:scale-[0.98]">
                    {importing
                      ? <><RefreshCw className="h-4 w-4 animate-spin" /> {t('importing')}</>
                      : <><Upload className="h-4 w-4" /> {t('import_heading')} {validCount} record{validCount !== 1 ? 's' : ''}</>
                    }
                  </button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* STEP 3 — Success */}
      {step === 3 && imported && (
        <Card className="p-10 text-center">
          <div className="text-3xl md:text-6xl mb-4 animate-bounce">🎉</div>
          <h2 className="text-2xl font-black text-white mb-2">{t("import_complete")}</h2>
          <p className="text-slate-400 mb-2">
            <span className="text-emerald-400 font-bold">{imported.count} {KINDS[imported.kind]?.label}</span> {t('import_records_added')}
          </p>
          <p className="text-sm text-slate-600 mb-8">{t('import_risk_insights')}</p>
          <div className="grid sm:grid-cols-2 gap-3 max-w-sm mx-auto">
            <button onClick={reset} className="py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold text-sm transition-all">
              {t('import_more')}
            </button>
            <button onClick={() => window.location.href = '/' + (imported.kind === 'employees' ? 'employees' : imported.kind === 'access' ? 'access' : 'tools')}
              className="py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-sm transition-all">
              {t('view')} {KINDS[imported.kind]?.label} →
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
