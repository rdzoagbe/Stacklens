import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, BadgeCheck, Upload } from 'lucide-react';
import { computeWaste, monthlySpend } from '../lib/waste';
import { noteFirstInsight, noteVisit, noteRecommendationActed, noteRecommendationsShown } from '../lib/activation';
import {
  computeToolDerivedStatus, computeToolDerivedRisk,
  computeAccessDerivedRiskFlag, buildRiskAlerts, riskSeverityCounts,
  formatMoney,
  countOrphanedTools, computeMfaCoverage, computeSecurityScore,
} from '../lib/dataUtils';
import { useDbQuery, useDbMutations } from '../hooks/useDbQuery';
import { workspaceMembers } from '../firebase-config';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Button, useCategoryLabel } from '../components/ui';
import { RoleGate } from '../components/gates';
import { AppShell } from '../components/AppShell';
import { ImportWizard } from '../components/ImportWizard';
import { ClearDataButton } from '../components/ClearDataButton';
import { invoiceCheckSummary } from '../lib/invoiceCheck';
import { openPeopleChanges } from '../lib/peopleChanges';
import { coverageEnding, devicesToReturn, COVERAGE_SOON_DAYS } from '../lib/assets';
import { canInviteTeam } from '../lib/plan';
import { previousMonthSpend } from '../lib/budget';

// Re-export for lazy-loading in App.jsx
export { ImportWizard } from '../components/ImportWizard';
export { SlackNotifications } from '../components/SlackNotifications';

// Action-inbox sort order. Lower ranks surface first; anything unknown sorts last.
const SEVERITY_RANK = { critical: 0, high: 1, medium: 2 };

// How many to-do lines show before "Show all"; and the pill each level wears.
const TODO_VISIBLE = 6;
const LEVEL_TONE = {
  critical: 'bg-danger-soft text-danger',
  high: 'bg-warning-soft text-warning',
  medium: 'bg-surface-hover text-ink-muted',
};
const TODO_ACTION = 'flex-none text-sm font-medium text-brand-text hover:text-ink transition-colors';

// Dates follow the app's language, not the browser's.
const LOCALE_TAG = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES', pt: 'pt-PT' };

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
  // A department budget (new Budget tab) OR the legacy global cap counts as "set".
  const hasBudget = (db?.budgets || []).length > 0 || budgetCap > 0;
  // Real server-backed team members (workspace_members), replacing the old
  // localStorage placeholder that this checklist used to read.
  const [teamCount, setTeamCount] = useState(0);
  React.useEffect(() => {
    let alive = true;
    workspaceMembers().then(r => { if (alive) setTeamCount((r.members || []).length); }).catch(() => {});
    return () => { alive = false; };
  }, []);

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
      done: hasBudget,
      action: () => navigate('/finance?tab=budget'),
      cta: t('gs_step3_cta'),
    },
    // Only where the server accepts an invite: free and trial accounts got
    // an English "Team sharing requires a paid plan" after following it.
    ...(canInviteTeam(db?.user) ? [{
      id: 'invite_team',
      icon: '✉️',
      title: t('gs_step4_title'),
      desc: t('gs_step4_desc'),
      done: teamCount > 0,
      action: () => navigate('/settings?tab=team'),
      cta: t('gs_step4_cta'),
    }] : []),
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
    <div className="rounded-xl border border-line bg-surface-raised p-5 lg:p-6 mb-6">
      {celebrating ? (
        <div className="text-center py-4">
          <div className="text-3xl mb-2">🎉</div>
          <div className="text-lg font-semibold text-ink mb-1">{t('gs_done_title')}</div>
          <div className="text-sm text-ink-muted">{t('gs_done_sub')}</div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-base font-semibold text-ink">{t('gs_title')}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-brand-soft text-brand-text font-medium">{doneCount}/{steps.length}</span>
              </div>
              <div className="text-sm text-ink-muted">{t('gs_sub')}</div>
            </div>
            <button type="button" onClick={dismiss} className="text-ink-subtle hover:text-ink transition-colors text-lg leading-none flex-shrink-0" title={t('close')} aria-label={t('close')}>✕</button>
          </div>

          <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden mb-5">
            <div className="h-full bg-brand rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {steps.map((step) => (
              <div key={step.id} className={`relative flex flex-col gap-2 p-4 rounded-lg border transition-colors ${
                step.done
                  ? 'border-line bg-success-soft'
                  : 'border-line hover:border-line-control'
              }`}>
                {step.done && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-success flex items-center justify-center">
                    <svg className="w-3 h-3 text-surface" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                <div className="text-xl">{step.icon}</div>
                <div className={`text-sm font-semibold ${step.done ? 'text-success line-through' : 'text-ink'}`}>
                  {step.title}
                </div>
                <div className="text-xs text-ink-muted flex-1">{step.desc}</div>
                {!step.done && (
                  <button type="button" onClick={step.action}
                    className="mt-1 text-sm text-brand-text hover:text-ink font-medium transition-colors text-left">
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
  const { firebaseUser } = useAuth();

  const { language } = useLang();
  const t = useTranslation(language);
  const [showImport, setShowImport] = useState(false);
  const [importKind, setImportKind] = useState(null);
  const [showAssignOwner, setShowAssignOwner] = useState(false);
  const [assignToolId, setAssignToolId] = useState(null);
  const [assignToolName, setAssignToolName] = useState('');
  const [spendView, setSpendView] = useState('tool');
  const [showAllTodo, setShowAllTodo] = useState(false);
  const categoryLabel = useCategoryLabel();
  const { data: db } = useDbQuery();
  const muts = useDbMutations();

  const money = (n) => formatMoney(Number(n) || 0, language);

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
    const alerts = buildRiskAlerts({ ...db, tools, access }, t);
    const counts = riskSeverityCounts(alerts);
    const spend = monthlySpend({ tools });
    const highRiskTools = tools.filter((tool) => tool.derived_risk === "high").length;
    const formerAccess = access.filter((a) => a.derived_risk_flag === "former_employee").length;
    return { tools, access, alerts, counts, spend, highRiskTools, formerAccess };
  }, [db, t]);

  // ── Derived spend-breakdown rows ──────────────────────────────────────────
  const spendRows = useMemo(() => {
    const tools = derived.tools || [];
    if (spendView === 'tool') {
      return tools
        .filter(tool => tool.cost_per_month > 0)
        .sort((a, b) => b.cost_per_month - a.cost_per_month)
        .slice(0, 6)
        // Seat counts are optional — CSV import and directory sync do not
        // supply them. Showing "? seats" under every row made a populated
        // dashboard look like it was missing data.
        .map(tool => ({
          label: tool.name,
          value: tool.cost_per_month,
          sub: tool.seats ? `${tool.seats} ${t('lbl_seats')}` : '',
        }));
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

  // ── TO-DO: ranked ─────────────────────────────────────────────────────────
  // One list, most urgent first. The dashboard used to show two panels, a
  // "critical alerts" panel and an "action inbox", that said the same things
  // twice (former employees, tools without an owner) and disagreed on the
  // rest. Access reviews, which only the alerts panel carried, are a line of
  // their own here. Each line opens the screen that settles it.
  const todo = useMemo(() => {
    if (!db) return [];
    const money = (n) => formatMoney(Number(n) || 0, language);
    const fmtDate = (d) => new Date(d).toLocaleDateString(LOCALE_TAG[language] || 'en-GB');
    const actions = [];

    (derived.access || []).filter(a => a.derived_risk_flag === 'former_employee' && a.status === 'active').forEach(a => {
      actions.push({
        id: 'former-' + a.id, kind: 'former_access', severity: 'critical',
        title: `${a.employee_name || t('dash_ex_employee')} ${t('dash_still_has_access')} ${a.tool_name || t('dash_a_tool')}`,
        reason: t('dash_left_not_revoked'),
        action: t('dash_revoke'),
        revokeId: a.id,
      });
    });

    // Supplier invoices above the agreed price, billed twice, or billed
    // after cancellation (lib/invoiceCheck.js): money leaving now, so it
    // ranks first among the high-severity items.
    const _invoiceCheck = invoiceCheckSummary(db);
    if (_invoiceCheck.count > 0) {
      actions.push({
        id: 'invoice-check', kind: 'invoice_check', severity: 'high',
        title: t('inv_check_dash_title').replace('{n}', _invoiceCheck.count),
        reason: t('inv_check_dash_reason').replace('{amount}', money(_invoiceCheck.annualAtStake)),
        action: t('review'), link: '/finance?tab=budget',
      });
    }

    // Joiners and movers whose licences the eligibility rules say to sort
    // out (lib/peopleChanges.js). One line for all of them.
    const _people = openPeopleChanges(db).filter((c) => c.pending > 0);
    if (_people.length > 0) {
      actions.push({
        id: 'people-changes', kind: 'people_changes', severity: 'high',
        title: t('jm_dash_title').replace('{n}', _people.length),
        reason: t('jm_dash_reason')
          .replace('{grant}', _people.reduce((s, c) => s + c.grants.length, 0))
          .replace('{remove}', _people.reduce((s, c) => s + c.removals.length, 0)),
        action: t('review'), link: '/access?view=eligibility',
      });
    }

    // Devices still with people who are leaving or have left
    // (lib/assets.js). One line for all of them.
    const _toReturn = devicesToReturn(db);
    if (_toReturn.length > 0) {
      const _who = [...new Set(_toReturn.map((r) => r.employee.full_name || r.employee.email))];
      actions.push({
        id: 'device-return', kind: 'device_return', severity: 'high',
        title: t('dev_dash_return_title').replace('{n}', _toReturn.length),
        reason: _who.slice(0, 3).join(', ') + (_who.length > 3 ? ` +${_who.length - 3}` : ''),
        action: t('review'), link: '/devices',
      });
    }

    (derived.tools || []).filter(tool => !tool.owner_email).slice(0, 4).forEach(tool => {
      actions.push({
        id: 'noowner-' + tool.id, kind: 'no_owner', severity: 'high',
        title: `${tool.name} ${t('dash_no_owner')}`,
        reason: `${money(tool.cost_per_month)}${t('per_mo_short')} — ${t('dash_nobody_responsible')}`,
        action: t('dash_assign'),
        toolId: tool.id, toolName: tool.name, needsOwner: true,
      });
    });

    (derived.tools || []).filter(tool => tool.derived_risk === 'high' && !tool.mfa_required && !tool.mfa_enabled).slice(0, 3).forEach(tool => {
      actions.push({
        id: 'mfa-' + tool.id, kind: 'no_mfa', severity: 'high',
        title: `${tool.name} ${t('dash_high_risk_no_mfa')}`,
        reason: `${t('owner')}: ${tool.owner_email || t('lbl_none')} · ${t('col_last_used')}: ${tool.last_used_date ? fmtDate(tool.last_used_date) : t('lbl_unknown')}`,
        action: t('review'), link: '/security',
      });
    });

    const _budgetCap = db?.user?.budget_cap || parseInt(localStorage.getItem('sg_budget_cap') || '0') || 0;
    const _notifBudget = (() => { try { return JSON.parse(localStorage.getItem('sg_notifications') || '{}'); } catch { return {}; } })().budget ?? true;
    if (_budgetCap > 0 && _notifBudget && (derived.spend || 0) > _budgetCap) {
      const pct = Math.round((derived.spend / _budgetCap) * 100);
      actions.push({
        id: 'budget-exceeded', kind: 'budget', severity: 'high',
        title: `${pct}% ${t('dash_budget_exceeded')}`,
        reason: `${t('lbl_cap')}: ${money(_budgetCap)}${t('per_mo_short')} · ${t('lbl_current')}: ${money(derived.spend)}`,
        action: t('nav_finance'), link: '/finance',
      });
    }

    // Warranties and leases ending within the month (lib/assets.js).
    const _ending = coverageEnding(db);
    if (_ending.length > 0) {
      actions.push({
        id: 'device-coverage', kind: 'device_coverage', severity: 'medium',
        title: t('dev_dash_coverage_title').replace('{n}', _ending.length).replace('{days}', COVERAGE_SOON_DAYS),
        reason: `${_ending[0].name || _ending[0].serial} · ${fmtDate(_ending[0].coverage_end)}`,
        action: t('review'), link: '/devices',
      });
    }

    // The same rule as the Access page (needs_review): an admin right
    // unreviewed or reviewed over six months ago, any right over a year.
    const overdueReviews = derived.access.filter(a => a.derived_risk_flag === 'needs_review').length;
    if (overdueReviews > 0) {
      actions.push({
        id: 'access-review', kind: 'access_review', severity: 'medium',
        title: overdueReviews === 1 ? t('dash_reviews_todo_one') : t('dash_reviews_todo').replace('{n}', overdueReviews),
        reason: t('dash_reviews_todo_reason'),
        action: t('review'), link: '/access',
      });
    }

    // eslint-disable-next-line react-hooks/purity
    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
    (derived.tools || []).filter(tool => tool.cost_per_month > 0 && (!tool.last_used_date || new Date(tool.last_used_date).getTime() < sixtyDaysAgo)).slice(0, 3).forEach(tool => {
      actions.push({
        id: 'idle-' + tool.id, kind: 'idle_spend', severity: 'medium',
        title: `${tool.name} — ${money(tool.cost_per_month)}${t('per_mo_short')} ${t('dash_possibly_wasted')}`,
        reason: `${t('col_last_used')}: ${tool.last_used_date ? fmtDate(tool.last_used_date) : t('never')}`,
        action: t('review'), link: '/tools',
      });
    });

    // `??`, not `||` — critical ranks 0, which is falsy, so `|| 3` used to
    // demote it below every other severity and the visible slice could drop it.
    const rank = (severity) => SEVERITY_RANK[severity] ?? 3;
    return actions.sort((a, b) => rank(a.severity) - rank(b.severity));
  }, [db, derived, t, language]);
  // ── end of TO-DO ──

  // Activation evidence: the first time this dashboard has an alert to show
  // is the workspace's first insight, and any later-day visit after that is a
  // return. Demo data proves nothing about activation, so it is skipped.
  // "Shown" is the to-do lines on screen, named by the same kinds as
  // recommendation_acted, so the two can be compared.
  useEffect(() => {
    if (!db?.user || db.user.is_demo) return;
    const scope = db.user.uid;
    const signupAt = Date.parse(firebaseUser?.metadata?.creationTime || '') || 0;
    noteFirstInsight({ alerts: derived.alerts.length, critical: derived.counts.critical }, { scope, signupAt });
    noteVisit({ scope });
    noteRecommendationsShown(todo.slice(0, TODO_VISIBLE).map(a => a.kind), { scope });
  }, [db, derived, todo, firebaseUser]);


  return (
    <AppShell title={t('dashboard')} right={
        <div className="flex flex-wrap items-center gap-2">
          {/* Opens on "what are you importing?". It used to open pre-set to
              "SaaS tools" two steps in, so the company file took two clicks
              back. Clear data sits beside it only for an owner or admin, in
              their own workspace, when there is data (ClearDataButton). */}
          <RoleGate requires="editor">
            <Button variant="secondary" size="sm" onClick={() => { setImportKind(null); setShowImport(true); }}>
              <Upload className="h-3.5 w-3.5" />{t('dash_import_data')}
            </Button>
          </RoleGate>
          {db && <ClearDataButton db={db} uid={firebaseUser?.uid} t={t} />}
        </div>
      }>

      {/* ── GETTING STARTED — shown to new real users only ── */}
      {db && !db.user?.is_demo && db.user?.is_authenticated && derived.tools.length > 0 && (
        <GettingStartedChecklist db={db} />
      )}

      {/* ── PRIORITY ── people who left and can still sign in: the one item
          that is a security risk today, so it gets its own band. */}
      {derived.formerAccess > 0 && (
        <section aria-label={t('dash_priority')} data-testid="dash-priority"
          className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface-raised p-5">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-danger-soft text-danger">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-[1_1_320px]">
            <p className="text-xs font-semibold uppercase tracking-wider text-danger">{t('dash_priority')}</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">
              {derived.formerAccess} {t(derived.formerAccess === 1 ? 'dash_former_access_title_one' : 'dash_former_access_title')}
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">{t('dash_former_access_desc')}</p>
          </div>
          <Button onClick={() => navigate('/offboarding')}>{t('dash_remove_access')} →</Button>
        </section>
      )}

      {derived.formerAccess === 0 && derived.tools.length === 0 && (
        <section aria-label={t('dash_get_started')}
          className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface-raised p-5">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-brand-soft text-brand-text">
            <Upload className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-[1_1_320px]">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-text">{t('dash_get_started')}</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{t('dash_import_team')}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">{t('dash_import_team_desc')}</p>
          </div>
          <Button onClick={() => { setImportKind('company'); setShowImport(true); }}>{t('dash_upload_data')} →</Button>
        </section>
      )}

      {/* ── KEY FIGURES ── what is paid, what could be recovered, how exposed. */}
      {(() => {
        const totalTools = derived.tools.length;
        const totalEmployees = new Set((derived.access).map(a => a.employee_id)).size;
        const hasData = totalTools > 0 || totalEmployees > 0;
        const orphanedToolsCount = countOrphanedTools(derived.tools);
        const formerAccess = derived.formerAccess || 0;
        const highRiskTools = derived.tools.filter(tool => tool.derived_risk === 'high').length;
        const score = hasData
          ? computeSecurityScore({ orphanedTools: orphanedToolsCount, highRiskTools, formerAccess })
          : null;
        const scoreLabel = score === null ? t('dash_no_data') : score >= 80 ? t('dash_score_good') : score >= 60 ? t('dash_score_needs_work') : t('dash_score_critical');
        const scoreTone = score === null ? 'bg-surface-hover text-ink-muted' : score >= 80 ? 'bg-success-soft text-success' : score >= 60 ? 'bg-warning-soft text-warning' : 'bg-danger-soft text-danger';
        const mfa = computeMfaCoverage(derived.tools);
        const mfaCoverage = mfa ? mfa.percent : null;
        // The real cost of tools that nobody holds active access to
        // (lib/waste.js), never a percentage of spend.
        const waste = computeWaste(db);
        const wastedSpend = Math.round(waste.recoverable);
        const wastedCount = waste.unusedTools.length;
        const annualSpend = (derived.spend || 0) * 12;
        const avgPerEmployee = totalEmployees > 0 ? Math.round((derived.spend || 0) / totalEmployees) : 0;
        // Only a month that was recorded (spend_history): a comparison we
        // cannot make is not shown at all (lib/budget.js).
        const previous = previousMonthSpend(db);
        const change = previous ? ((derived.spend || 0) - previous) / previous * 100 : null;
        const changeText = change === null ? null
          : `${change > 0 ? '+' : ''}${change.toLocaleString(LOCALE_TAG[language] || 'en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;
        const card = 'block h-full rounded-xl border border-line bg-surface-raised p-5 transition-colors hover:border-line-control';
        const label = 'text-xs font-semibold uppercase tracking-wider text-ink-subtle';
        const figure = 'mt-2 text-3xl font-bold text-ink tabular-nums';

        return (
          <section aria-label={t('dash_key_figures')} className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-6">
            <Link to="/finance" className={card}>
              <p className={label}>{t('monthly_spend')}</p>
              <p className={figure}>{money(derived.spend)}</p>
              <p className="mt-1 text-sm text-ink-muted tabular-nums">
                {money(annualSpend)}{t('lbl_per_year_short')}
                {changeText && (() => {
                  const [before, after] = t('dash_vs_last_month').replace('{amount}', money(previous)).split('{pct}');
                  return <> · {before}<span className={change > 0 ? 'text-warning' : 'text-success'}>{changeText}</span>{after}</>;
                })()}
              </p>
              <p className="mt-3 text-xs text-ink-subtle">
                {t('dash_tools_tracked')} {totalTools} · {t('dash_avg_per_employee')} {totalEmployees > 0 ? money(avgPerEmployee) : '—'}
              </p>
            </Link>

            <Link to="/finance?tab=licenses" className={card}>
              <p className={label}>{t('dash_savings_label')}</p>
              <p className={figure}>{money(wastedSpend)}</p>
              <p className="mt-1 text-sm text-ink-muted">
                {wastedCount === 0 ? t('dash_savings_zero')
                  : wastedCount === 1 ? t('dash_savings_note_one')
                  : t('dash_savings_note').replace('{n}', wastedCount)}
              </p>
            </Link>

            <Link to="/security" className={card}>
              <p className={label}>{t('security_score')}</p>
              <p className={figure}>
                {score === null ? '—' : score}
                <span className="ml-1 text-base font-medium text-ink-subtle">/100</span>
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${scoreTone}`}>{scoreLabel}</span>
                <span>{t('dash_mfa_coverage')} {mfaCoverage === null ? '—' : `${mfaCoverage} %`}</span>
              </p>
            </Link>
          </section>
        );
      })()}

      {/* ── TO-DO + SPEND ── */}
      <div className="mb-6 flex flex-wrap items-start gap-4 lg:gap-6">
        <section aria-label={t('dash_todo_title')} data-testid="dash-todo"
          className="min-w-0 flex-[3_1_480px] rounded-xl border border-line bg-surface-raised">
          <div className="px-5 pt-5 pb-4">
            <h2 className="text-base font-semibold text-ink">{t('dash_todo_title')}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">{t('dash_todo_sub')}</p>
          </div>
          {todo.length === 0 ? (
            <div className="flex items-center gap-3 border-t border-line px-5 py-4">
              <BadgeCheck className="h-5 w-5 flex-none text-success" aria-hidden="true" />
              <p className="text-sm font-medium text-success">{t('dash_all_clear')}</p>
            </div>
          ) : (
            <ul className="border-t border-line">
              {(showAllTodo ? todo : todo.slice(0, TODO_VISIBLE)).map((item) => (
                <li key={item.id} className="flex flex-col items-start gap-2 border-b border-line px-5 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-3">
                  <span className={`flex-none rounded-full px-2.5 py-0.5 text-xs font-medium ${LEVEL_TONE[item.severity] || LEVEL_TONE.medium}`}>
                    {t(`dash_level_${item.severity}`)}
                  </span>
                  <div className="min-w-0 sm:flex-1">
                    <p className="text-sm font-medium text-ink">{item.title}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{item.reason}</p>
                  </div>
                  {item.needsOwner ? (
                    <button type="button" className={TODO_ACTION}
                      onClick={() => { noteRecommendationActed(item.kind, item.severity); setAssignToolId(item.toolId); setAssignToolName(item.toolName); setShowAssignOwner(true); }}>
                      {item.action} →
                    </button>
                  ) : item.revokeId ? (
                    <button type="button" className={TODO_ACTION}
                      onClick={() => { noteRecommendationActed(item.kind, item.severity); muts.updateAccess.mutate({ id: item.revokeId, patch: { status: 'revoked' } }, { onSuccess: () => toast.success(t('revoked')) }); }}>
                      {item.action}
                    </button>
                  ) : (
                    <Link to={item.link} className={TODO_ACTION} onClick={() => noteRecommendationActed(item.kind, item.severity)}>
                      {item.action} →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          {todo.length > TODO_VISIBLE && (
            <div className="border-t border-line px-5 py-3">
              <button type="button" className={TODO_ACTION} aria-expanded={showAllTodo} onClick={() => setShowAllTodo(v => !v)}>
                {showAllTodo ? t('dash_todo_show_less') : t('dash_todo_show_all').replace('{n}', todo.length)}
              </button>
            </div>
          )}
        </section>
        {/* ── end of TO-DO list ── */}

        <section aria-label={t('dash_spend_breakdown')}
          className="min-w-0 flex-[2_1_320px] rounded-xl border border-line bg-surface-raised p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">{t('dash_spend_breakdown')}</h2>
              <p className="mt-0.5 text-sm text-ink-muted">{t('dash_top_items')}</p>
            </div>
            <div className="flex gap-1" role="group" aria-label={t('dash_spend_breakdown')}>
              {[['tool',t('dash_by_tool')],['category',t('dash_by_category')],['dept',t('dash_by_dept')]].map(([v,l]) => (
                <button key={v} type="button" onClick={() => setSpendView(v)} aria-pressed={spendView === v}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${spendView === v ? 'bg-brand-soft text-brand-text' : 'text-ink-muted hover:bg-surface-hover hover:text-ink'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {spendRows.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-ink-muted">{t('dash_no_spend')}</p>
              <p className="mt-1 text-xs text-ink-subtle">{t('dash_import_to_see')}</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {spendRows.map((row, i) => (
                <div key={i}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate text-ink capitalize">{spendView === 'category' ? categoryLabel(row.label) : row.label}</span>
                    <span className="flex-none text-ink-muted tabular-nums">{money(row.value)}{t('per_mo_short')}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-surface-hover">
                    <div className="h-1.5 rounded-full bg-brand" style={{ width: `${Math.min(100, Math.round((row.value / spendMax) * 100))}%` }} />
                  </div>
                  {row.sub && <p className="mt-1 text-xs text-ink-subtle">{row.sub}</p>}
                </div>
              ))}
              <div className="flex justify-end border-t border-line pt-3">
                <Link to="/finance" className="text-sm font-medium text-brand-text hover:text-ink">{t('dash_full_breakdown')} →</Link>
              </div>
            </div>
          )}
        </section>
      </div>

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur p-4" onClick={() => setShowImport(false)}>
          <div className="bg-surface border border-line rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setShowImport(false)} aria-label={t('close')} className="absolute top-4 right-4 z-10 w-8 h-8 bg-surface-raised border border-line rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors">✕</button>
            <ImportWizard defaultKind={importKind} onDone={() => { setShowImport(false); setImportKind(null); }} />
          </div>
        </div>
      )}

      {showAssignOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur p-4" onClick={() => setShowAssignOwner(false)}>
          <div className="bg-surface-raised border border-line rounded-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink mb-1">{t('dash_assign_owner')}</h3>
            <p className="text-sm text-ink-muted mb-4">{t('dash_who_should_own')} {assignToolName}?</p>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {(db?.employees || []).filter(e => e.status === 'active').map(emp => (
                <button key={emp.id}
                  onClick={() => {
                    if (assignToolId) muts.updateTool.mutate(
                      { id: assignToolId, patch: { owner_email: emp.email, owner_name: emp.full_name } },
                      { onSuccess: () => { toast.success(`${emp.full_name} ${t('assign_is_now_owner')} ${assignToolName}`); setShowAssignOwner(false); } }
                    );
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-line hover:bg-surface-hover hover:border-line-control transition-colors text-left">
                  <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center text-ink-muted font-semibold text-xs flex-shrink-0">
                    {(emp.full_name || '?')[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink truncate">{emp.full_name}</div>
                    <div className="text-xs text-ink-muted truncate">{emp.email} · {emp.department || t('dash_no_dept')}</div>
                  </div>
                </button>
              ))}
              {(db?.employees || []).filter(e => e.status === 'active').length === 0 && (
                <div className="text-center py-6 text-sm text-ink-muted">{t('assign_no_active_employees')}</div>
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
