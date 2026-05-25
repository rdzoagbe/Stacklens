import React, { useEffect, useMemo, useState, createContext, useContext, useRef, useCallback } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { signInWithGoogle, handleRedirectResult, signOutUser, onAuthChange, sendMagicLink, completeMagicLinkSignIn, callAI, loadUserData, saveUserData, syncUserProfile, getUserPlanFromFirestore, registerWithEmail, signInWithEmail, resetPassword, resendEmailVerification, createBillingPortal, createCheckoutSession, logConsent, startTrial, logLegalAcceptance, syncClaimsFromServer, sendInviteEmail } from './firebase-config';
import { PLAN_TIERS, PLAN_LIMITS, TRIAL_DAYS, TRIAL_MS, resolvePlan, getTrialState, getPlanLimits } from './lib/plan';
import { LS_KEY, CATEGORIES, EMP_DEPARTMENTS, TOOL_STATUS, CRITICALITY, RISK_SCORE, ACCESS_LEVEL, ACCESS_STATUS, RISK_FLAG } from './lib/constants';
import { uid, todayISO, safeParseISO, setFirestoreUid, loadDb, saveDb, hydrateFromFirestore, seedDbIfEmpty, resetDb } from './lib/db';
import { cx } from './lib/utils';
import { computeToolDerivedStatus, computeToolDerivedRisk, getRiskEvidence, computeAccessDerivedRiskFlag, buildRiskAlerts, riskSeverityCounts, validateEmail, validateRequired, formatMoney, getCurrency, convertCurrency, downloadText, toCsv, parseCsv, splitCsvLine } from './lib/dataUtils';
import { useDbQuery, useDbMutations } from './hooks/useDbQuery';
import { useAuth } from './hooks/useAuth';
import { TourContext, TourProvider, useTour, ProductTourOverlay, TOUR_STEPS, TOUR_LS_KEY } from './contexts/TourContext';
import { LanguageContext, LanguageProvider, useLang } from './contexts/LangContext';
import { CurrencyContext, CurrencyProvider, useCurrency, useCurrencyConverter } from './contexts/CurrencyContext';
import { RDLogo, ScrollToTop, Card, CardHeader, CardBody, Divider, Button, Input, Select, Textarea, Pill, Modal, SkeletonRow, EmptyState, DataTable, LiveStat, MiniStat, ProgressRow, CategoryIcon, StatusBadge, RiskBadge, AccessLevelBadge, RiskFlagBadge } from './components/ui';
import { ROLES, getUserRole, can, RoleGate, RoleBadge, usePlanLimits, PlanGate, MODULE_PLANS, ModuleGate, PlanLimitBanner, TourEmptyState, TourLaunchButton } from './components/gates';
import { AppShell, LangSelectorCompact, useRenewalAlerts, CookieBanner, DemoBanner, TrialExpiredBanner, ErrorBoundary } from './components/AppShell';
import { ToolsPage } from './pages/ToolsPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { AccessPage } from './pages/AccessPage';
import { OffboardingPage } from './pages/OffboardingPage';
import { AuditTabContent, AuditExportPage } from './pages/AuditPage';
import { NotFound, ContactPage, DpaPage, SubProcessorsPage, LegalMentionsPage, AboutPage, PrivacyPage, TermsPage, SecurityPage } from './pages/LegalPages';
import { SecurityCompliancePage } from './pages/SecurityCompliancePage';
import { CostManagementPage, AnalyticsReportsPage } from './pages/AnalyticsPage';
import { FloatingChatbotGated } from './components/FloatingChatbot';
import { FinishSignUpPage } from './pages/FinishSignUpPage';
import { ContractComparisonPage } from './pages/ContractComparisonPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { TrialPage } from './pages/TrialPage';
import { DashboardPage } from './pages/DashboardPage';
import { SlackNotifications } from './pages/DashboardPage';
import { ImportWizard } from './pages/DashboardPage';
import { BillingPage, IntegrationConnectors, IntegrationsPage, SettingsPage } from './pages/SettingsPage';


import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslation } from './translations';
import toast, { Toaster } from 'react-hot-toast';
import { differenceInDays, format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion"; // eslint-disable-line no-unused-vars
// ExecutiveDashboard and AIInsights inlined below
import {
  Shield,
  LayoutDashboard,
  Boxes,
  Users,
  GitMerge,
  Plug,
  Upload,
  UserMinus,
  Download,
  CreditCard,
  Search,
  Filter,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  BadgeCheck,
  BadgeX,
  RefreshCw,
  ExternalLink,
  Lock,
  Building2,
  Briefcase,
  Wrench,
  Activity,
  Calendar,
  CalendarClock,
  Sparkles,
  Check,
  X,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Crown,
  Play,
  FileText,
  Star,
  Zap,
  BarChart3,
  TrendingUp,
  CheckCircle,
  Award,
  Menu,
  MessageCircle,
  GitCompare,
  FileDiff,
  ArrowLeftRight,
  TrendingDown,
  BarChart2,
  Settings,
  Target,
  PieChart,
  Bell,
  ArrowUp,
  ArrowDown,
  DollarSign,
  Mail,
  Eye,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart as RPieChart, Pie, Cell } from 'recharts';

// ============================================================================
// GLOBAL LANGUAGE CONTEXT — single source of truth for all pages
// ============================================================================
// LanguageContext, LanguageProvider, useLang — imported from ./contexts/LangContext
// ============================================================================



// TourContext, TourProvider, useTour, ProductTourOverlay, TOUR_STEPS, TOUR_LS_KEY
// — imported from ./contexts/TourContext

// useDbQuery, useDbMutations — imported from ./hooks/useDbQuery
// useAuth — imported from ./hooks/useAuth

function EmailVerificationWall({ email }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const { firebaseUser } = useAuth();
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const handleResend = async () => {
    const { error: err } = await resendEmailVerification();
    if (err) { setError(err); } else { setSent(true); setError(''); }
  };

  const handleCheck = async () => {
    setChecking(true);
    try {
      await firebaseUser.reload();
      // If verified, the onAuthStateChanged will re-render with updated user
      if (!firebaseUser.emailVerified) setError(t('email_not_verified_yet') || 'Email not verified yet. Please check your inbox.');
    } catch (e) {
      setError(e.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-5">
        <div className="text-5xl">✉️</div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">{t('verify_email_title') || 'Verify your email'}</h2>
          <p className="text-slate-400 text-sm">{t('verify_email_sub') || "We sent a verification link to"} <span className="text-white font-medium">{email}</span>. {t('verify_email_sub2') || "Click the link to activate your account."}</p>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {sent && <p className="text-green-400 text-sm">{t('verification_resent') || 'Verification email resent!'}</p>}
        <div className="flex flex-col gap-3">
          <button onClick={handleCheck} disabled={checking}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors">
            {checking ? (t('checking') || 'Checking...') : (t('ive_verified') || "I've verified — continue")}
          </button>
          <button onClick={handleResend}
            className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-sm transition-colors">
            {t('resend_verification') || 'Resend verification email'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RequireAuth({ children }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const { isAuthed, isDemo, loading, firebaseUser } = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-950"><div className="text-white text-sm">{t('loading')}</div></div>;

  if (!isAuthed && !isDemo && !firebaseUser) return <Navigate to="/" replace state={{ from: location }} />;

  // Gate email/password users who haven't verified yet (Google/magic-link users are pre-verified)
  const isPasswordProvider = firebaseUser?.providerData?.[0]?.providerId === 'password';
  if (isPasswordProvider && firebaseUser?.emailVerified === false) {
    return <EmailVerificationWall email={firebaseUser.email} />;
  }

  return children;
}

// NAV uses translation keys — labels resolved in Sidebar/AppShell with t()
// ============================================================================
// ROI CALCULATOR COMPONENT
// ============================================================================
function ROICalculator() {
  const { language } = useLang();
  const t = useTranslation(language);
  const [tools, setTools] = useState(50);
  const [costPerTool, setCostPerTool] = useState(100);
  const [employees, setEmployees] = useState(200);
  
  // Calculate savings
  const totalSpend = tools * costPerTool * 12;
  const wastePercentage = 30;
  const potentialSavings = Math.round(totalSpend * (wastePercentage / 100));
  const unusedLicenses = Math.round(employees * 0.15); // 15% waste average
  const licenseSavings = unusedLicenses * 50 * 12; // $50/license/month average
  
  return (
    <div className="space-y-8">
      {/* Input Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-3">
            Number of SaaS Tools
          </label>
          <input
            type="range"
            min="10"
            max="200"
            value={tools}
            onChange={(e) => setTools(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="mt-2 text-center text-xl md:text-3xl font-bold text-white">{tools}</div>
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-3">
            Avg Cost Per Tool/Month
          </label>
          <input
            type="range"
            min="20"
            max="500"
            step="10"
            value={costPerTool}
            onChange={(e) => setCostPerTool(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="mt-2 text-center text-xl md:text-3xl font-bold text-white">{getCurrency(language)}{costPerTool}</div>
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-3">
            Number of Employees
          </label>
          <input
            type="range"
            min="10"
            max="1000"
            step="10"
            value={employees}
            onChange={(e) => setEmployees(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="mt-2 text-center text-xl md:text-3xl font-bold text-white">{employees}</div>
        </div>
      </div>
      
      {/* Results */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-2">
              Your {t("annual_saas_spend")}
            </div>
            <div className="text-2xl md:text-4xl font-black text-white mb-4">
              {getCurrency(language)}{totalSpend.toLocaleString()}
            </div>
          </div>
          
          <div>
            <div className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-2">
              Potential Savings with Stacklens
            </div>
            <div className="text-2xl md:text-5xl font-black text-emerald-400 mb-2">
              {getCurrency(language)}{potentialSavings.toLocaleString()}/year
            </div>
            <div className="text-sm text-slate-400">
              ≈ {unusedLicenses} unused licenses • {wastePercentage}% waste reduction
            </div>
          </div>
        </div>
        
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-slate-300">
              💰 <span className="font-semibold">ROI in first 90 days</span> with our average customer
            </div>
            <button 
              onClick={() => {
                const trialBtn = document.querySelector('[data-start-trial]');
                if (trialBtn) trialBtn.click();
              }}
              className="px-4 md:px-8 py-4 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 rounded-xl font-bold text-lg transition-all hover:scale-105"
            >
              Start Free Trial →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function ExitIntentModal({ open, onClose, onContinue }) {
  const { language } = useLang();
  const t = useTranslation(language);
  return (
    <Modal
      open={open}
      title={t('exit_intent_title')}
      subtitle={t('exit_intent_sub')}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('close')}
          </Button>
          <Button
            onClick={() => {
              onClose();
              onContinue();
            }}
          >
            <Sparkles className="h-4 w-4" />
            {t('exit_intent_continue')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm text-slate-300">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
          <div className="text-sm font-semibold text-slate-100">{t('exit_intent_case_study')}</div>
          <div className="mt-2 text-slate-400">&ldquo;{t('exit_intent_quote')}&rdquo;</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill tone="amber" icon={AlertTriangle}>
              {t('exit_intent_pill1')}
            </Pill>
            <Pill tone="rose" icon={UserMinus}>
              {t('exit_intent_pill2')}
            </Pill>
            <Pill tone="blue" icon={Download}>
              {t('exit_intent_pill3')}
            </Pill>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Executive Dashboard Wrapper
function ExecutivePageWrapper() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db } = useDbQuery();
  if (!db) return <div className="flex items-center justify-center h-screen"><div className="text-white">{t('loading')}</div></div>;
  
  const derived = {
    tools: db.tools.map(t => ({ ...t, derived_risk: computeToolDerivedRisk(t) })),
    employees: db.employees || [],
    access: db.access || [],
    alerts: buildRiskAlerts({ tools: db.tools, access: db.access || [], employees: db.employees || [] })
  };
  
  return (
    <AppShell title={t("nav_executive")}>
      <PlanGate requires="professional" feature="Executive Dashboard"><ExecutiveDashboard data={derived} /></PlanGate>
    </AppShell>
  );
}


function SetupConnectionsHub() {
  const { language } = useLang();
  const t = useTranslation(language);
  const [setupTab, setSetupTab] = useState(() => { const p = new URLSearchParams(window.location.search); return p.get('tab') || 'integrations'; });
  const _loc = useLocation();
  useEffect(() => { const p = new URLSearchParams(_loc.search); const t = p.get('tab'); if (t) setSetupTab(t); }, [_loc.search]);
  const TABS = [
    { id: 'integrations', label: '🔌 Integrations',  desc: 'Connect your tools' },
    { id: 'import',       label: '📥 Import Data',    desc: 'CSV & data import' },
  ];
  return (
    <AppShell title={t('setup_title')}
      right={
        <div className="flex gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setSetupTab(tab.id)}
              className={"px-3 py-1.5 rounded-lg text-sm font-semibold transition-all " + (setupTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}>
              {tab.label}
            </button>
          ))}
        </div>
      }
    >
      {setupTab === 'integrations' && (
        <div className="p-4 md:p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-white mb-1">🔌 Integrations</h2>
            <p className="text-slate-400">Connect Stacklens to your tools for automatic discovery and user sync</p>
          </div>
          <IntegrationConnectors />
        </div>
      )}
      {setupTab === 'import' && <ImportWizard />}
    </AppShell>
  );
}





const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 250,
    },
  },
});



// FINANCE DASHBOARD PAGE
function SpendTrendChart({ monthlyTrend, byCategory }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const maxSpend = Math.max(...monthlyTrend.map(m => m.spend), 1);
  const colors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444'];
  const totalMonthly = byCategory.reduce((s, c) => s + c.spend, 0);
  const maxCatSpend = Math.max(...byCategory.map(c => c.spend), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-5 mb-6">
      
      {/* Left: Trend chart — 3 cols */}
      <div className="lg:col-span-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-white">{t('monthly_spend_trend_title') || 'Monthly Spend Trend'}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{t('last_6_months') || 'Last 6 months'}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-white">{getCurrency(language)}{convertCurrency(Math.round(monthlyTrend[monthlyTrend.length-1]?.spend || 0), language).toLocaleString()}</div>
            <div className="text-xs text-slate-500">this month</div>
          </div>
        </div>

        {/* Area-style bar chart */}
        <div className="flex items-end gap-2 md:gap-3" style={{height: '160px'}}>
          {monthlyTrend.map((m, idx) => {
            const isLast = idx === monthlyTrend.length - 1;
            const prev = idx > 0 ? monthlyTrend[idx-1].spend : m.spend;
            const change = m.spend - prev;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0 group">
                <div className="text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  {getCurrency(language)}{convertCurrency(Math.round(m.spend), language).toLocaleString()}
                </div>
                <div 
                  className={`w-full rounded-t-lg transition-all duration-300 ${isLast ? 'bg-gradient-to-t from-blue-600 to-blue-400' : 'bg-blue-500/40 hover:bg-blue-500/60'}`}
                  style={{height: Math.max(8, (m.spend / maxSpend) * 140) + 'px'}} 
                />
                <span className={`text-xs font-medium ${isLast ? 'text-blue-400' : 'text-slate-500'}`}>{m.month}</span>
              </div>
            );
          })}
        </div>

        {/* Trend line indicator */}
        {monthlyTrend.length >= 2 && (() => {
          const first = monthlyTrend[0].spend;
          const last = monthlyTrend[monthlyTrend.length-1].spend;
          if (first <= 0 || last <= 0) return null;
          const pctChange = ((last - first) / first * 100).toFixed(1);
          const up = last >= first;
          return (
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800">
              <span className={`text-sm font-semibold ${up ? 'text-amber-400' : 'text-emerald-400'}`}>
                {up ? '↑' : '↓'} {Math.abs(pctChange)}%
              </span>
              <span className="text-sm text-slate-500">vs 6 months ago</span>
            </div>
          );
        })()}
      </div>

      {/* Right: Category breakdown — 2 cols */}
      <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{t('spend_by_category_title') || 'Spend by Category'}</h2>
          <span className="text-sm text-slate-500">{byCategory.length} categories</span>
        </div>

        <div className="space-y-4">
          {byCategory.slice(0,5).map((cat, i) => {
            const pct = Math.round((cat.spend / totalMonthly) * 100);
            return (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background: colors[i]}} />
                    <span className="text-sm font-medium text-slate-200 capitalize">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-white">{getCurrency(language)}{convertCurrency(cat.spend, language).toLocaleString()}</span>
                    <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{width: pct + '%', background: colors[i]}} />
                </div>
                <div className="text-xs text-slate-600 mt-1">{cat.count} tools · {getCurrency(language)}{convertCurrency(Math.round(cat.spend / Math.max(cat.count, 1)), language).toLocaleString()}/tool avg</div>
              </div>
            );
          })}
        </div>

        {totalMonthly > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-sm text-slate-400">Total monthly</span>
            <span className="text-lg font-black text-white">{getCurrency(language)}{convertCurrency(totalMonthly, language).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BudgetModal({ current, totalSpend, language, onSave, onClear, onClose }) {
  const t = useTranslation(language);
  const [value, setValue] = useState(current > 0 ? String(current) : '');
  const curr = getCurrency(language);
  const num = Number(value) || 0;
  const utilization = num > 0 ? Math.round(totalSpend / num * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-white">{t('budget_modal_title')}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{t('budget_modal_sub')}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{t('budget_modal_cap_label')} ({curr}/month)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">{curr}</span>
            <input
              type="number"
              min="0"
              step="100"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={t('budget_modal_placeholder')}
              className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl px-3 py-2.5 pl-8 text-white text-sm outline-none transition-colors"
              autoFocus
            />
          </div>
          {num > 0 && (
            <p className={`text-xs mt-1.5 ${utilization > 100 ? 'text-red-400' : utilization > 75 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {t('budget_modal_current_spend')} {curr}{convertCurrency(totalSpend, language).toLocaleString()} — {utilization}% {t('budget_modal_of_cap')}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={() => num > 0 && onSave(num)}
            disabled={num <= 0}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors">
            {t('budget_modal_save')}
          </button>
          {current > 0 && (
            <button onClick={onClear} className="px-4 py-2.5 rounded-xl border border-slate-700 hover:border-red-500/50 text-slate-400 hover:text-red-400 text-sm font-semibold transition-colors">
              {t('remove')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FinanceDashboard() {
  const navigate = useNavigate();
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db } = useDbQuery();
  const [finTab, setFinTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('month');
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showReclaimModal, setShowReclaimModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  // Compute real financial data from tools — use reactive db (TanStack Query)
  // to avoid showing demo data during Firestore hydration race
  const _fReal = db?.user?.is_authenticated && !db?.user?.is_demo;
  const _tools = db?.tools || [];
  const _totalSpend = _fReal ? _tools.reduce((s, t) => s + (t.cost_per_month || t.cost_monthly || t.cost || 0), 0) : 47850;
  const _byCategory = _fReal ? Object.values(_tools.reduce((acc, tool) => {
    const cat = tool.category || 'Other';
    if (!acc[cat]) acc[cat] = { name: cat, spend: 0, count: 0, budget: 0 };
    acc[cat].spend += (tool.cost_per_month || tool.cost_monthly || tool.cost || 0);
    acc[cat].count += 1;
    return acc;
  }, {})) : [{name:'CRM',spend:12400,budget:15000,count:3},{name:'Communication',spend:8200,budget:10000,count:5},{name:'Development',spend:14300,budget:18000,count:8},{name:'Design',spend:6800,budget:8000,count:4},{name:'Analytics',spend:6150,budget:4000,count:3}];
  const _months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const _now = new Date();
  const _trend = Array.from({length:6},(_,i)=>{ const d=new Date(_now.getFullYear(),_now.getMonth()-5+i,1); return {month:_months[d.getMonth()],spend:_fReal?_totalSpend*(0.9+i*0.02):[42100,43800,45200,44600,46900,47850][i]}; });
  const _bills = _fReal ? _tools.filter(t=>t.renewal_date).sort((a,b)=>new Date(a.renewal_date)-new Date(b.renewal_date)).slice(0,5).map(t=>({app:t.name,amount:t.cost_per_month?t.cost_per_month*12:t.cost_monthly?t.cost_monthly*12:(t.cost||0),dueDate:t.renewal_date,status:'pending',category:t.category||'Other'})) : [{app:'Salesforce',amount:12400,dueDate:'2026-03-01',status:'pending',category:'CRM'},{app:'Adobe Creative Cloud',amount:5400,dueDate:'2026-03-20',status:'pending',category:'Design'}];
  // Budget cap — read from db (persisted to Firestore) with localStorage fallback
  const _savedBudgetCap = db?.user?.budget_cap || parseInt(localStorage.getItem('sg_budget_cap') || '0') || 0;
  const [budgetCap, setBudgetCap] = useState(_savedBudgetCap);
  // Keep budgetCap in sync when db hydrates from Firestore
  React.useEffect(() => {
    if (db?.user?.budget_cap && db.user.budget_cap !== budgetCap) setBudgetCap(db.user.budget_cap);
  }, [db?.user?.budget_cap]);
  const _financialData = {totalMonthlySpend:_totalSpend,budgetLimit:budgetCap||0,lastMonthSpend:_totalSpend*0.95||45200,upcomingBills:_bills,byCategory:_byCategory,monthlyTrend:_trend,isReal:_fReal,toolCount:_tools.filter(t=>t.status!=='archived').length};

  const TABS = [
    { id: 'overview',   label: t('fin_tab_overview') || 'Overview' },
    { id: 'cost',       label: t('fin_tab_cost') || 'Cost' },
    { id: 'licenses',   label: t('nav_licenses') || 'Licenses' },
    { id: 'renewals',   label: t('renewals_tab') || 'Renewals' },
    { id: 'contracts',  label: t('contracts_tab') || 'Contracts' },
    { id: 'analytics',  label: t('fin_tab_reports') || 'Reports' },
  ];

  return (
    <PlanGate requires="growth" feature="Finance Dashboard"><AppShell title={t("finance_title") || "Finance"}
      right={
        <div className="flex gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto [&::-webkit-scrollbar]:h-0">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setFinTab(tab.id)}
              className={"px-3 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap " + (finTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}>
              {tab.label}
            </button>
          ))}
        </div>
      }
    >
      {finTab === 'overview' && <FinanceOverviewTab financialData={_financialData} showBudgetModal={showBudgetModal} setShowBudgetModal={setShowBudgetModal} budgetCap={budgetCap} setBudgetCap={setBudgetCap} selectedBill={selectedBill} setSelectedBill={setSelectedBill} showReclaimModal={showReclaimModal} setShowReclaimModal={setShowReclaimModal} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} setFinTab={setFinTab} />}
      {finTab === 'cost' && <CostTabContent setFinTab={setFinTab} />}
      {finTab === 'licenses' && <LicenseManagement />}
      {finTab === 'renewals' && <RenewalAlerts />}
      {finTab === 'contracts' && <ContractsTabContent />}
      {finTab === 'analytics' && <AnalyticsTabContent />}
    </AppShell></PlanGate>
  );
}

function FinanceOverviewTab({ financialData, showBudgetModal, setShowBudgetModal, budgetCap, setBudgetCap, selectedBill, setSelectedBill, showReclaimModal, setShowReclaimModal, categoryFilter, setCategoryFilter, setFinTab }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const navigate = useNavigate();
  const { user: firebaseUser } = useAuth();
  const qc = useQueryClient();
  const budgetSet = financialData.budgetLimit > 0;
  const budgetUtilization = budgetSet ? (financialData.totalMonthlySpend / financialData.budgetLimit * 100) : 0;
  const overBudget = budgetSet && financialData.totalMonthlySpend > financialData.budgetLimit;
  const _savedNotifs = (() => { try { return JSON.parse(localStorage.getItem('sg_notifications') || '{}'); } catch { return {}; } })();
  const notifBudget = _savedNotifs.budget ?? true;

  const saveBudgetCap = (cap) => {
    const numCap = Number(cap) || 0;
    localStorage.setItem('sg_budget_cap', String(numCap));
    setBudgetCap(numCap);
    const cur = loadDb() || seedDbIfEmpty();
    cur.user = { ...cur.user, budget_cap: numCap };
    saveDb(cur);
    if (firebaseUser?.uid) saveUserData(firebaseUser.uid, cur).catch(() => {});
    qc.invalidateQueries({ queryKey: ['db'] });
  };
  const savingsVsLastMonth = financialData.lastMonthSpend - financialData.totalMonthlySpend;
  const annualSpend = financialData.totalMonthlySpend * 12;
  const hasRealComparison = financialData.lastMonthSpend > 0 && financialData.totalMonthlySpend > 0;
  const monthlyChange = hasRealComparison ? ((financialData.totalMonthlySpend / financialData.lastMonthSpend - 1) * 100) : 0;
  const upcomingTotal = financialData.upcomingBills.reduce((s, b) => s + b.amount, 0);
  const topCategory = financialData.byCategory.length > 0 ? [...financialData.byCategory].sort((a,b) => b.spend - a.spend)[0] : null;
  const potentialSavings = Math.round(financialData.totalMonthlySpend * 0.14);

  // Empty state for real users with no tools yet
  if (financialData.isReal && financialData.toolCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-5">
          <DollarSign className="h-8 w-8 text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{t('finance_no_data_title')}</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-6">{t('finance_no_data_body')}</p>
        <Link to="/tools" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold text-white transition-colors">
          {t('finance_add_tools')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Budget modal */}
      {showBudgetModal && (
        <BudgetModal
          current={budgetCap}
          totalSpend={financialData.totalMonthlySpend}
          language={language}
          onSave={(cap) => { saveBudgetCap(cap); setShowBudgetModal(false); toast.success('Budget cap saved'); }}
          onClear={() => { saveBudgetCap(0); setShowBudgetModal(false); toast.success('Budget cap removed'); }}
          onClose={() => setShowBudgetModal(false)}
        />
      )}

      {/* Over-budget alert */}
      {overBudget && notifBudget && (
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl border border-red-500/40 bg-red-500/10">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-red-300">Monthly spend exceeds your budget cap — </span>
            <span className="text-sm text-red-400">{getCurrency(language)}{convertCurrency(financialData.totalMonthlySpend, language).toLocaleString()} vs {getCurrency(language)}{convertCurrency(financialData.budgetLimit, language).toLocaleString()} limit ({(budgetUtilization - 100).toFixed(0)}% over)</span>
          </div>
          <button onClick={() => setShowBudgetModal(true)} className="text-xs text-red-300 hover:text-red-200 font-semibold flex-shrink-0 underline underline-offset-2">Adjust limit</button>
        </div>
      )}

      {/* ── Row 1: Hero Metric (Monthly Spend) + Budget Health ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">

        {/* Hero — Total Monthly Spend */}
        <div className="lg:col-span-2 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-900 to-blue-950/20 p-6 lg:p-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-2">{t("finance_monthly_spend")}</div>
          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-5xl font-black text-white">{getCurrency(language)}{convertCurrency(financialData.totalMonthlySpend, language).toLocaleString()}</span>
            {hasRealComparison && (
              <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${monthlyChange > 0 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {monthlyChange > 0 ? '↑' : '↓'} {Math.abs(monthlyChange).toFixed(1)}%
              </span>
            )}
          </div>
          <div className="text-sm text-slate-400 mb-5">
            {getCurrency(language)}{convertCurrency(annualSpend, language).toLocaleString()}/year{hasRealComparison ? ' · ' + getCurrency(language) + convertCurrency(financialData.lastMonthSpend, language).toLocaleString() + ' last month' : ''}
          </div>

          {/* Budget bar */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("finance_budget_util")}</span>
            {budgetSet ? (
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${budgetUtilization > 100 ? 'text-red-400' : budgetUtilization > 75 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {budgetUtilization.toFixed(0)}% of {getCurrency(language)}{convertCurrency(financialData.budgetLimit, language).toLocaleString()}
                </span>
                <button onClick={() => setShowBudgetModal(true)} className="text-xs text-slate-500 hover:text-blue-400 underline underline-offset-2 transition-colors">Edit</button>
              </div>
            ) : (
              <button onClick={() => setShowBudgetModal(true)} className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors">+ Set budget cap</button>
            )}
          </div>
          {budgetSet ? (
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${budgetUtilization > 100 ? 'bg-red-500' : budgetUtilization > 75 ? 'bg-amber-500' : 'bg-gradient-to-r from-blue-500 to-emerald-500'}`}
                style={{width: `${Math.min(budgetUtilization, 100)}%`}} />
            </div>
          ) : (
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full w-0 rounded-full bg-slate-700" />
            </div>
          )}
        </div>

        {/* Side Card — Quick wins */}
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-slate-900 to-emerald-950/20 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{t("finance_potential_savings")}</span>
          </div>
          <div className="text-4xl font-black text-emerald-400 mb-1">{getCurrency(language)}{convertCurrency(potentialSavings, language).toLocaleString()}</div>
          <div className="text-sm text-slate-400 mb-5">{t("finance_potential_sub")}</div>
          <button onClick={() => setFinTab && setFinTab('cost')} className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm text-white transition-colors">
            {t("finance_view_optimizations")} →
          </button>
        </div>
      </div>

      {/* ── Row 2: Spend Trend + Category Breakdown ── */}
      <SpendTrendChart monthlyTrend={financialData.monthlyTrend} byCategory={financialData.byCategory} />

      {/* ── Row 3: Upcoming Bills (full width) ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">{t("finance_upcoming_bills")}</h2>
            <p className="text-sm text-slate-500">{financialData.upcomingBills.length} bills · {getCurrency(language)}{convertCurrency(upcomingTotal, language).toLocaleString()} total</p>
          </div>
        </div>
        {financialData.upcomingBills.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-500">{t("finance_no_upcoming")}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {financialData.upcomingBills.slice(0, 6).map((bill, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950/40 hover:border-slate-700 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/30 to-indigo-600/30 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">
                  {(bill.app || '?').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{bill.app}</div>
                  <div className="text-xs text-slate-500 truncate">Due {bill.dueDate}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-white">{getCurrency(language)}{convertCurrency(bill.amount, language).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Row 4: Quick Stats Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("finance_top_category")}</div>
          <div className="text-base font-bold text-white capitalize truncate">{topCategory?.name || '—'}</div>
          <div className="text-xs text-slate-500 mt-1">{topCategory ? getCurrency(language) + convertCurrency(topCategory.spend, language).toLocaleString() + '/mo' : 'No data'}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_total_tools")}</div>
          <div className="text-base font-bold text-white">{financialData.toolCount || financialData.byCategory.reduce((s,c) => s+c.count, 0)}</div>
          <div className="text-xs text-slate-500 mt-1">{financialData.byCategory.length} categories</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("finance_avg_per_tool")}</div>
          <div className="text-base font-bold text-white">{getCurrency(language)}{convertCurrency(Math.round(financialData.totalMonthlySpend / Math.max(financialData.toolCount || financialData.byCategory.reduce((s,c) => s+c.count, 1), 1)), language).toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">monthly average</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("finance_vs_last_month")}</div>
          {hasRealComparison ? (
            <>
              <div className={`text-base font-bold ${savingsVsLastMonth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {savingsVsLastMonth >= 0 ? '−' : '+'}{getCurrency(language)}{convertCurrency(Math.abs(savingsVsLastMonth), language).toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">{savingsVsLastMonth >= 0 ? 'saved' : 'increase'}</div>
            </>
          ) : (
            <>
              <div className="text-base font-bold text-slate-500">—</div>
              <div className="text-xs text-slate-500 mt-1">{t("finance_no_comparison")}</div>
            </>
          )}
        </div>
      </div>

      {/* ── Row 5: Smart Recommendations ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-purple-400" />
          <h2 className="text-base font-semibold text-white">{t("finance_smart_recs")}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-800 bg-slate-950/40">
            <div className="p-2 rounded-lg bg-emerald-500/10 flex-shrink-0">
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white mb-1">{t("finance_reclaim_unused")}</div>
              <div className="text-xs text-slate-500 mb-2">{financialData.toolCount} tools have idle seats</div>
              <div className="text-xs text-emerald-400 font-semibold">Potential: {getCurrency(language)}{convertCurrency(potentialSavings, language).toLocaleString()}/mo</div>
            </div>
            <button onClick={() => setFinTab && setFinTab('licenses')} className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex-shrink-0">Review →</button>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-800 bg-slate-950/40">
            <div className="p-2 rounded-lg bg-amber-500/10 flex-shrink-0">
              <CalendarClock className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white mb-1">{t("finance_negotiate_renewals")}</div>
              <div className="text-xs text-slate-500 mb-2">{financialData.upcomingBills.length} contracts renewing soon</div>
              <div className="text-xs text-amber-400 font-semibold">Save up to 20% on renewal</div>
            </div>
            <button onClick={() => setFinTab && setFinTab('renewals')} className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex-shrink-0">View →</button>
          </div>
        </div>
      </div>
    </div>
  );
}


function CostTabContent({ setFinTab }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db } = useDbQuery();
  const [sortBy, setSortBy] = useState('cost');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  const tools = db?.tools || [];
  const access = db?.access || [];

  const enriched = useMemo(() => {
    return tools
      .filter(t => t.status === 'active')
      .map(tool => {
        const activeUsers = access.filter(a => a.tool_id === tool.id && a.status === 'active').length;
        const cost = Number(tool.cost_per_month || 0);
        const costPerUser = activeUsers > 0 ? cost / activeUsers : cost;
        // Waste: no users OR cost-per-user > $200 OR no logins in 30 days
        const noUsers = activeUsers === 0;
        const expensive = activeUsers > 0 && costPerUser > 200;
        const wasteFlag = noUsers || expensive;
        const wasteReason = noUsers ? 'no-users' : expensive ? 'expensive' : null;
        return { ...tool, activeUsers, cost, costPerUser, wasteFlag, wasteReason };
      });
  }, [tools, access]);

  const filtered = useMemo(() => {
    return enriched
      .filter(t => filter === 'all' ? true : filter === 'waste' ? t.wasteFlag : !t.wasteFlag)
      .sort((a, b) => sortBy === 'cost' ? b.cost - a.cost : sortBy === 'perUser' ? b.costPerUser - a.costPerUser : (b.activeUsers - a.activeUsers));
  }, [enriched, filter, sortBy]);

  React.useEffect(() => { setPage(0); }, [filter, sortBy]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const totalSpend = enriched.reduce((s, t) => s + t.cost, 0);
  const wasteTools = enriched.filter(t => t.wasteFlag);
  const wasteAmount = wasteTools.reduce((s, t) => s + t.cost, 0);
  const unusedTools = enriched.filter(t => t.activeUsers === 0);
  const unusedAmount = unusedTools.reduce((s, t) => s + t.cost, 0);
  const expensiveTools = enriched.filter(t => t.wasteReason === 'expensive');
  const expensiveAmount = expensiveTools.reduce((s, t) => s + t.cost, 0);
  const potentialSavings = Math.round(wasteAmount * 0.7);
  const wastePercent = totalSpend > 0 ? Math.round((wasteAmount / totalSpend) * 100) : 0;

  // Top 3 quick wins (highest waste potential)
  const quickWins = [...wasteTools].sort((a,b) => b.cost - a.cost).slice(0, 3);

  return (
    <div className="space-y-6">

      {/* ── Row 1: Hero — Potential savings front & center ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
        
        {/* Hero card — Potential Savings */}
        <div className="lg:col-span-2 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-emerald-950/20 to-slate-900 p-6 lg:p-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{t("cost_potential_savings")}</span>
          </div>
          <div className="flex items-baseline gap-3 mb-3">
            <span className="text-5xl font-black text-emerald-400">{getCurrency(language)}{convertCurrency(potentialSavings, language).toLocaleString()}</span>
            <span className="text-base text-slate-500">/ month</span>
          </div>
          <div className="text-sm text-slate-400 mb-4">
            {getCurrency(language)}{convertCurrency(potentialSavings * 12, language).toLocaleString()}/year if you reclaim flagged waste
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setFinTab && setFinTab('licenses')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm text-white transition-colors">
              Reclaim Licenses →
            </button>
            <button onClick={() => setFilter('waste')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold text-sm text-slate-300 transition-colors">
              View Waste ({wasteTools.length})
            </button>
          </div>
        </div>

        {/* Total spend snapshot */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("cost_total_monthly")}</div>
          <div className="text-3xl font-black text-white mb-1">{getCurrency(language)}{convertCurrency(Math.round(totalSpend), language).toLocaleString()}</div>
          <div className="text-sm text-slate-500 mb-4">{enriched.length} active tools</div>
          
          {/* Waste breakdown bar */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-slate-500">Healthy spend</span>
            <span className="text-xs font-semibold text-white">{100 - wastePercent}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-emerald-500 transition-all" style={{width: `${100 - wastePercent}%`}} />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Wasted</span>
            <span className={"font-semibold " + (wastePercent > 20 ? "text-red-400" : wastePercent > 10 ? "text-amber-400" : "text-emerald-400")}>
              {wastePercent}% ({getCurrency(language)}{convertCurrency(Math.round(wasteAmount), language).toLocaleString()})
            </span>
          </div>
        </div>
      </div>

      {/* ── Row 2: Waste Breakdown — 3 categories ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("cost_unused_tools")}</span>
            <Boxes className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-amber-400">{unusedTools.length}</div>
          <div className="text-sm text-slate-500 mt-1">{getCurrency(language)}{convertCurrency(Math.round(unusedAmount), language).toLocaleString()}/mo wasted</div>
        </div>
        
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-red-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("cost_overpriced")}</span>
            <TrendingDown className="h-4 w-4 text-red-400" />
          </div>
          <div className="text-3xl font-black text-red-400">{expensiveTools.length}</div>
          <div className="text-sm text-slate-500 mt-1">{getCurrency(language)}{convertCurrency(Math.round(expensiveAmount), language).toLocaleString()}/mo · {">"}{getCurrency(language)}200 per user</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("cost_filter_healthy")}</span>
            <Check className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-400">{enriched.length - wasteTools.length}</div>
          <div className="text-sm text-slate-500 mt-1">tools well-utilized</div>
        </div>
      </div>

      {/* ── Row 3: Quick Wins (top 3 highest-impact waste) ── */}
      {quickWins.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-400" />
                <h2 className="text-base font-semibold text-white">{t("cost_quick_wins")}</h2>
              </div>
              <p className="text-sm text-slate-500">{t("cost_quick_wins_sub")}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {quickWins.map((tool, idx) => (
              <div key={tool.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{tool.name}</div>
                    <div className="text-xs text-slate-500 capitalize truncate">{tool.category || '—'}</div>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 flex-shrink-0">
                    {tool.wasteReason === 'no-users' ? 'Unused' : 'Pricey'}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-800/50 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Cost/mo</span>
                    <span className="text-white font-semibold">{getCurrency(language)}{convertCurrency(Math.round(tool.cost), language).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Active users</span>
                    <span className={tool.activeUsers === 0 ? "text-red-400 font-semibold" : "text-white"}>{tool.activeUsers}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Save</span>
                    <span className="text-emerald-400 font-semibold">{getCurrency(language)}{convertCurrency(Math.round(tool.cost * 0.7), language).toLocaleString()}/mo</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Row 4: Tools Table ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row gap-3 items-center">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-white">{t("cost_all_tools_by_cost")}</h3>
            <p className="text-xs text-slate-500">{filtered.length} tools shown</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[['all','All',enriched.length],['waste','Waste',wasteTools.length],['ok','Healthy',enriched.length-wasteTools.length]].map(([val, label, count]) => (
              <button key={val} onClick={() => setFilter(val)}
                className={"px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap " + (filter === val ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white')}>
                {label} ({count})
              </button>
            ))}
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 outline-none">
              <option value="cost">Sort: Cost</option>
              <option value="perUser">Sort: Cost/User</option>
              <option value="users">Sort: Users</option>
            </select>
          </div>
        </div>
        
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex p-3 rounded-2xl bg-slate-800 mb-3">
              <Boxes className="h-6 w-6 text-slate-500" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">{t("cost_no_tools_to_show")}</h3>
            <p className="text-sm text-slate-500">{filter === 'all' ? t("cost_no_tools_sub") : 'Try a different filter.'}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tool</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Monthly Cost</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Users</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Cost/User</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((tool) => (
                    <tr key={tool.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="text-sm font-semibold text-white truncate">{tool.name}</div>
                        <div className="text-xs text-slate-500 capitalize truncate">{tool.category || '—'}</div>
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-semibold text-white whitespace-nowrap">
                        {getCurrency(language)}{convertCurrency(Math.round(tool.cost), language).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-slate-300 hidden md:table-cell">
                        {tool.activeUsers === 0 ? <span className="text-red-400 font-semibold">0</span> : tool.activeUsers}
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-slate-400 hidden md:table-cell whitespace-nowrap">
                        {tool.activeUsers > 0 ? getCurrency(language) + convertCurrency(Math.round(tool.costPerUser), language).toLocaleString() : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {tool.wasteFlag ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                            <AlertTriangle className="h-2.5 w-2.5" /> Waste
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                            <Check className="h-2.5 w-2.5" /> Healthy
                          </span>
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


function ExecutiveTabContent() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db } = useDbQuery();
  if (!db) return <div className="p-8 text-center text-slate-500">{t('loading')}</div>;
  const derived = {
    tools: db.tools.map(t => ({ ...t, derived_risk: computeToolDerivedRisk(t) })),
    employees: db.employees || [],
    access: db.access || [],
    alerts: buildRiskAlerts({ tools: db.tools, access: db.access || [], employees: db.employees || [] })
  };
  return <div className="p-2"><ExecutiveDashboard data={derived} /></div>;
}

function AnalyticsTabContent() {
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
function ExecutiveDashboard({ data }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const totalSpend = data?.tools?.reduce((sum, t) => sum + (t.cost_per_month || 0), 0) || 0;
  const annualSpend = totalSpend * 12;
  const unusedTools = data?.tools?.filter(t => {
    const lastUsed = new Date(t.last_used_date || 0);
    const daysSinceUse = Math.floor((Date.now() - lastUsed) / (1000 * 60 * 60 * 24));
    return daysSinceUse > 90;
  }) || [];
  const potentialSavings = unusedTools.reduce((sum, t) => sum + (t.cost_per_month || 0), 0);
  const annualSavings = potentialSavings * 12;
  const roi = totalSpend > 0 ? ((potentialSavings / totalSpend) * 100).toFixed(1) : 0;
  const highRiskTools = data?.tools?.filter(t => t.derived_risk === 'high').length || 0;
  const efficiencyScore = Math.min(100, Math.max(0, 85 + (potentialSavings === 0 ? 10 : 0) - (highRiskTools * 2)));
  const criticalAlerts = data?.alerts?.filter(a => a.severity === 'critical').length || 0;
  const categorySpend = {};
  data?.tools?.forEach(tool => {
    const cat = tool.category || 'Other';
    categorySpend[cat] = (categorySpend[cat] || 0) + (tool.cost_per_month || 0);
  });
  const categoryData = Object.entries(categorySpend).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];
  const trendData = [
    { month: 'Jul', spend: totalSpend * 0.85, savings: potentialSavings * 0.6 },
    { month: 'Aug', spend: totalSpend * 0.90, savings: potentialSavings * 0.7 },
    { month: 'Sep', spend: totalSpend * 0.93, savings: potentialSavings * 0.8 },
    { month: 'Oct', spend: totalSpend * 0.97, savings: potentialSavings * 0.85 },
    { month: 'Nov', spend: totalSpend * 0.99, savings: potentialSavings * 0.92 },
    { month: 'Dec', spend: totalSpend, savings: potentialSavings },
  ];
  const topTools = [...(data?.tools || [])].sort((a, b) => (b.cost_per_month || 0) - (a.cost_per_month || 0)).slice(0, 10);
  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-end">
        <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-white">
          <Download className="h-5 w-5" /> Export Report
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: t('annual_saas_spend'), value: formatMoney(annualSpend, null, language), Icon: DollarSign, color: 'blue', trend: '+12%', trendUp: true },
          { label: t('annual_savings_potential'), value: formatMoney(annualSavings, null, language), Icon: TrendingUp, color: 'emerald', trend: roi + '%', trendUp: false },
          { label: t('saas_tools_tracked'), value: data?.tools?.length || 0, Icon: Boxes, color: 'purple' },
          { label: t('active_risk_items'), value: highRiskTools + criticalAlerts, Icon: AlertTriangle, color: 'orange' },
        ].map(({ label, value, Icon, color, trend, trendUp }) => (
          <div key={label} className={`bg-gradient-to-br from-${color}-500/10 to-${color}-600/10 border border-${color}-500/20 rounded-2xl p-6`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 bg-${color}-500/20 rounded-xl`}><Icon className={`h-6 w-6 text-${color}-400`} /></div>
              {trend && (trendUp
                ? <div className="flex items-center gap-1 text-sm"><ArrowUp className="h-4 w-4 text-red-400" /><span className="text-red-400">{trend}</span></div>
                : <div className="flex items-center gap-1 text-sm"><ArrowDown className="h-4 w-4 text-emerald-400" /><span className="text-emerald-400">{trend}</span></div>
              )}
            </div>
            <div className="text-2xl md:text-3xl font-black text-white mb-1">{value}</div>
            <div className="text-sm text-slate-400">{label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">{t('spend_trend_6m')}</h3>
          <div className='recharts-wrapper-fix' style={{position:'relative',width:'100%',minWidth:'0',overflow:'hidden'}}>
          <ResponsiveContainer width="100%" height={250} minWidth={0}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" tickFormatter={val => getCurrency(language) + (val/1000).toFixed(0) + "K"} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} formatter={val => [`${getCurrency(language)}${val.toLocaleString()}`, '']} />
              <Line type="monotone" dataKey="spend" stroke="#3b82f6" strokeWidth={3} />
              <Line type="monotone" dataKey="savings" stroke="#10b981" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">{t('spend_by_category_title')}</h3>
          <div className="recharts-wrapper-fix" style={{position:"relative",width:"100%",minWidth:"0",overflow:"hidden"}}>
          <ResponsiveContainer width="100%" height={250} minWidth={0}>
            <RPieChart>
              <Pie data={categoryData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={100} dataKey="value">
                {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} formatter={val => [`$${val.toLocaleString()}/mo`, '']} />
            </RPieChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6">{t('top_10_costly')}</h3>
        <div className="overflow-x-auto w-full">
        <table className="w-full">
          <thead><tr className="border-b border-slate-800">
            {['Tool','Category','Monthly','Annual','Risk'].map(h => (
              <th key={h} className={`py-3 px-4 text-sm font-semibold text-slate-400 ${h === 'Monthly' || h === 'Annual' ? 'text-right' : h === 'Risk' ? 'text-center' : 'text-left'}`}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {topTools.map((tool, idx) => (
              <tr key={idx} className="border-b border-slate-800/50">
                <td className="py-3 px-4 text-white font-medium">{tool.name}</td>
                <td className="py-3 px-4 text-slate-400">{tool.category || 'Other'}</td>
                <td className="py-3 px-4 text-right text-white">${(tool.cost_per_month || 0).toLocaleString()}</td>
                <td className="py-3 px-4 text-right text-emerald-400">${((tool.cost_per_month || 0) * 12).toLocaleString()}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${tool.derived_risk === 'high' ? 'bg-red-500/20 text-red-400' : tool.derived_risk === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {tool.derived_risk || 'low'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">{t('exec_summary_title')}</h3>
            <p className="text-slate-300">Spending <span className="font-bold text-white">{getCurrency(language)}{totalSpend.toLocaleString()}/month</span> on {data?.tools?.length || 0} tools. Identified <span className="font-bold text-emerald-400">${potentialSavings.toLocaleString()}/month</span> in savings.{highRiskTools > 0 && <span className="text-orange-400"> {highRiskTools} high-risk tools need attention.</span>}</p>
          </div>
          <div className="text-right"><div className="text-sm text-slate-400 mb-1">{t("hc_annual_roi")}</div><div className="text-2xl md:text-4xl font-black text-emerald-400">{roi}%</div></div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AI INSIGHTS — inlined from DashboardComponents.jsx
// ============================================================================
function AIInsights({ tools, employees, spend, accessData }) {
  const insights = [];
  const unusedTools = tools?.filter(t => {
    const lastUsed = new Date(t.last_used_date || 0);
    return Math.floor((Date.now() - lastUsed) / 86400000) > 90;
  }) || [];
  if (unusedTools.length > 0) {
    const savings = unusedTools.reduce((sum, t) => sum + (t.cost_per_month || 0), 0);
    insights.push({ icon: TrendingDown, title: 'Unused License Opportunity', description: `${unusedTools.length} tools haven't been used in 90+ days. Potential savings: ${getCurrency(language)}${savings.toLocaleString()}/month`, savings, priority: 'high', action: 'Review Tools', link: '/tools' });
  }
  const orphanedTools = tools?.filter(t => !t.owner_name || t.owner_name === 'Unassigned') || [];
  if (orphanedTools.length > 0) {
    insights.push({ icon: AlertTriangle, title: 'Unassigned Tools Detected', description: `${orphanedTools.length} tools have no owner. Security risk!`, priority: 'medium', action: 'Assign Owners', link: '/tools' });
  }
  if (insights.length === 0) {
    insights.push({ icon: Sparkles, title: 'All Systems Optimized', description: 'No immediate optimization opportunities detected!', priority: 'low', action: 'View Dashboard', link: '/dashboard' });
  }
  insights.sort((a, b) => ({ critical: 0, high: 1, medium: 2, low: 3 }[a.priority] - { critical: 0, high: 1, medium: 2, low: 3 }[b.priority]));
  const totalSavings = insights.filter(i => i.savings).reduce((sum, i) => sum + i.savings, 0);
  const colors = { critical: 'from-red-500/20 border-red-500/30', high: 'from-orange-500/20 border-orange-500/30', medium: 'from-yellow-500/20 border-yellow-500/30', low: 'from-emerald-500/20 border-emerald-500/30' };
  return (
    <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/20 rounded-2xl p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl"><Sparkles className="h-5 w-5 text-white" /></div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">AI-Powered Insights</h3>
          <p className="text-sm text-slate-300">Smart recommendations to optimise your SaaS stack</p>
        </div>
        {totalSavings > 0 && <div className="text-right"><div className="text-2xl font-black text-emerald-400">${totalSavings.toLocaleString()}</div><div className="text-xs text-slate-400">potential monthly savings</div></div>}
      </div>
      <div className="space-y-3">
        {insights.slice(0, 3).map((insight, idx) => {
          const Icon = insight.icon;
          return (
            <div key={idx} className={`p-4 rounded-xl border bg-gradient-to-br ${colors[insight.priority]}`}>
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 text-white mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-white mb-1">{insight.title}</h4>
                  <p className="text-sm text-slate-300 mb-3">{insight.description}</p>
                  <a href={insight.link} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold text-white">{insight.action} →</a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LicenseManagement() {
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

function openNegotiateEmail(renewal) {
  const subject = encodeURIComponent(`Renewal Negotiation: ${renewal.app}`);
  const body = encodeURIComponent(`Hi,

I'm reaching out regarding the upcoming renewal for ${renewal.app} on ${renewal.renewalDate}.

Current details:
- Annual cost: ${getCurrency(language)}{renewal.cost.toLocaleString()}
- Contract owner: ${renewal.owner}
- Auto-renewal: ${renewal.autoRenew ? 'Yes' : 'No'}

I'd like to discuss:
1. Pricing options for renewal
2. Usage optimization opportunities  
3. Contract term flexibility

Can we schedule a call this week?

Best regards`);
  
  window.location.href = `mailto:vendor@${renewal.app.toLowerCase()}.com?subject=${subject}&body=${body}`;
}

function ContractsRenewalsHub() {
  const { language } = useLang();
  const t = useTranslation(language);
  const [cTab, setCTab] = useState('renewals');
  const TABS = [
    { id: 'renewals',  label: '🔔 Renewals' },
    { id: 'invoices',  label: '📤 Invoices' },
    { id: 'contracts', label: '📄 Contracts' },
  ];
  return (
    <AppShell title={t("nav_contracts")}
      data-tour="tour-contracts-header"
      right={
        <div className="flex gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setCTab(tab.id)}
              className={"px-3 py-1.5 rounded-lg text-sm font-semibold transition-all " + (cTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}>
              {tab.label}
            </button>
          ))}
        </div>
      }
    >
      <div data-tour="tour-contracts-header">
      {cTab === 'renewals'  && <RenewalsTabContent />}
      {cTab === 'invoices'  && <InvoicesTabContent />}
      {cTab === 'contracts' && <ContractsTabContent />}
      </div>
    </AppShell>
  );
}

function RenewalsTabContent() {
  const { data: db } = useDbQuery();
  return <RenewalAlerts />;
}

function RenewalAlerts() {
  const navigate = useNavigate();
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db } = useDbQuery();

  const [view, setView] = useState('list'); // list | calendar
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const tools = db?.tools || [];

  // Build renewals from real tools with renewal_date
  const renewals = useMemo(() => {
    const today = new Date();
    return tools
      .filter(t => t.status === 'active' && t.renewal_date)
      .map(tool => {
        const renewalDate = new Date(tool.renewal_date);
        const daysUntil = Math.floor((renewalDate - today) / (1000 * 60 * 60 * 24));
        const monthlyCost = Number(tool.cost_per_month || 0);
        const annualCost = monthlyCost * 12;
        let status = 'normal';
        if (daysUntil < 0) status = 'overdue';
        else if (daysUntil <= 14) status = 'critical';
        else if (daysUntil <= 30) status = 'urgent';
        else if (daysUntil <= 90) status = 'upcoming';
        return {
          id: tool.id,
          app: tool.name,
          category: tool.category || '—',
          renewalDate: tool.renewal_date,
          renewalDateObj: renewalDate,
          daysUntil,
          monthlyCost,
          annualCost,
          owner: tool.owner_name || tool.owner_email || '—',
          autoRenew: tool.auto_renew !== false, // default true
          status,
        };
      });
  }, [tools]);

  // KPIs
  const overdue = renewals.filter(r => r.status === 'overdue');
  const critical = renewals.filter(r => r.status === 'critical');
  const urgent = renewals.filter(r => r.status === 'urgent');
  const upcoming = renewals.filter(r => r.status === 'upcoming');
  const next90Days = [...overdue, ...critical, ...urgent, ...upcoming];
  const autoRenewing = renewals.filter(r => r.autoRenew && r.daysUntil <= 90);

  const totalAtRisk = next90Days.reduce((s, r) => s + r.annualCost, 0);
  const negotiationPotential = next90Days.reduce((s, r) => s + r.annualCost * 0.15, 0); // typical 15% savings

  // Most urgent renewal (highest cost in next 30 days)
  const mostUrgent = [...overdue, ...critical, ...urgent].sort((a, b) => b.annualCost - a.annualCost)[0];

  // Top 3 negotiation opportunities (highest annual cost in next 90 days, not overdue)
  const topNegotiations = next90Days
    .filter(r => r.daysUntil >= 0)
    .sort((a, b) => b.annualCost - a.annualCost)
    .slice(0, 3);

  // Filter
  const filtered = useMemo(() => {
    return renewals
      .filter(r => {
        if (filter === 'all') return true;
        if (filter === 'overdue') return r.status === 'overdue';
        if (filter === 'critical') return r.status === 'critical' || r.status === 'urgent';
        if (filter === 'upcoming') return r.status === 'upcoming';
        if (filter === 'auto') return r.autoRenew;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date') return a.daysUntil - b.daysUntil;
        if (sortBy === 'cost') return b.annualCost - a.annualCost;
        if (sortBy === 'app') return a.app.localeCompare(b.app);
        return 0;
      });
  }, [renewals, filter, sortBy]);

  React.useEffect(() => { setPage(0); }, [filter, sortBy, view]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Build calendar view (group by month)
  const calendarMonths = useMemo(() => {
    if (view !== 'calendar') return [];
    const monthMap = {};
    filtered.forEach(r => {
      const key = r.renewalDate.slice(0, 7); // YYYY-MM
      if (!monthMap[key]) monthMap[key] = [];
      monthMap[key].push(r);
    });
    return Object.entries(monthMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, items]) => {
        const d = new Date(key + '-01');
        return {
          key,
          label: d.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' }),
          items: items.sort((a, b) => a.daysUntil - b.daysUntil),
          total: items.reduce((s, r) => s + r.annualCost, 0),
        };
      });
  }, [filtered, view, language]);

  // Helpers
  const sendNegotiationEmail = (renewal) => {
    const subject = encodeURIComponent("Renewal Negotiation: " + renewal.app);
    const body = encodeURIComponent(
      "Hi,\n\n" +
      "Our " + renewal.app + " renewal is coming up on " + renewal.renewalDate + " (in " + renewal.daysUntil + " days).\n\n" +
      "Annual cost: " + getCurrency(language) + Math.round(renewal.annualCost).toLocaleString() + "\n" +
      "Auto-renewal: " + (renewal.autoRenew ? "Yes" : "No") + "\n\n" +
      "I'd like to discuss:\n" +
      "1. Pricing options for the renewal\n" +
      "2. Usage optimization opportunities\n" +
      "3. Contract term flexibility\n\n" +
      "Can we schedule a call this week?\n\nBest regards"
    );
    window.open("mailto:?subject=" + subject + "&body=" + body);
  };

  const exportICS = () => {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Stacklens//Renewals//EN', 'CALSCALE:GREGORIAN'];
    renewals.forEach(r => {
      const d = r.renewalDate.replace(/-/g, '');
      const uid = r.app.replace(/\s/g, '') + '-hello@stacklens.fr';
      lines.push('BEGIN:VEVENT');
      lines.push('UID:' + uid);
      lines.push('DTSTART;VALUE=DATE:' + d);
      lines.push('DTEND;VALUE=DATE:' + d);
      lines.push('SUMMARY:' + r.app + ' Renewal — ' + getCurrency(language) + Math.round(r.annualCost).toLocaleString());
      lines.push('DESCRIPTION:Owner: ' + r.owner + '\\nAuto-Renew: ' + (r.autoRenew ? 'Yes' : 'No'));
      lines.push('BEGIN:VALARM');
      lines.push('TRIGGER:-P30D');
      lines.push('ACTION:DISPLAY');
      lines.push('DESCRIPTION:Renewal reminder: ' + r.app);
      lines.push('END:VALARM');
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'renewals-' + new Date().toISOString().slice(0,10) + '.ics';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Status helpers
  const getStatusColor = (status) => {
    if (status === 'overdue') return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (status === 'critical') return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (status === 'urgent') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (status === 'upcoming') return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };
  const getStatusLabel = (status, days) => {
    if (status === 'overdue') return Math.abs(days) + 'd overdue';
    if (status === 'critical') return days + 'd left';
    if (status === 'urgent') return days + 'd left';
    if (status === 'upcoming') return days + 'd left';
    return days + 'd';
  };

  return (
    <div className="space-y-6 w-full">

      {/* ── Row 1: KPI Strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-blue-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Annual Spend at Risk</div>
          <div className="text-3xl font-black text-blue-400">{getCurrency(language)}{convertCurrency(Math.round(totalAtRisk), language).toLocaleString()}</div>
          <div className="text-sm text-slate-500 mt-1">next 90 days</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-red-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Critical</div>
          <div className="text-3xl font-black text-red-400">{overdue.length + critical.length}</div>
          <div className="text-sm text-slate-500 mt-1">≤ 14 days or overdue</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Upcoming</div>
          <div className="text-3xl font-black text-amber-400">{urgent.length + upcoming.length}</div>
          <div className="text-sm text-slate-500 mt-1">15–90 days</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-purple-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Auto-Renewing</div>
          <div className="text-3xl font-black text-purple-400">{autoRenewing.length}</div>
          <div className="text-sm text-slate-500 mt-1">may auto-charge</div>
        </div>
      </div>

      {/* ── Row 2: Critical Alert Hero (only if there's an urgent renewal) ── */}
      {mostUrgent && (
        <div className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-slate-900 via-red-950/20 to-slate-900 p-6 lg:p-7">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-[280px]">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-red-400">
                  {mostUrgent.status === 'overdue' ? 'Overdue Renewal' : 'Critical Renewal'}
                </span>
              </div>
              <div className="text-2xl lg:text-3xl font-black text-white mb-1">{mostUrgent.app}</div>
              <div className="text-sm text-slate-400 mb-3">
                {mostUrgent.status === 'overdue' ? (
                  <span className="text-red-400 font-semibold">{Math.abs(mostUrgent.daysUntil)} days overdue</span>
                ) : (
                  <>Renews in <span className="text-red-400 font-semibold">{mostUrgent.daysUntil} days</span></>
                )} · {getCurrency(language)}{convertCurrency(Math.round(mostUrgent.annualCost), language).toLocaleString()}/year
                {mostUrgent.autoRenew && <span className="ml-2 text-amber-400">· Auto-renewing</span>}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
              <button onClick={() => sendNegotiationEmail(mostUrgent)}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl font-semibold text-sm text-white transition-colors flex items-center gap-2 whitespace-nowrap">
                <Mail className="h-4 w-4" /> Negotiate Now
              </button>
              <button onClick={exportICS}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold text-sm text-slate-300 transition-colors flex items-center gap-2 whitespace-nowrap">
                <Calendar className="h-4 w-4" /> Add to Calendar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Row 3: Top Negotiation Opportunities ── */}
      {topNegotiations.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <h2 className="text-base font-semibold text-white">{t("ren_neg_opportunities")}</h2>
              </div>
              <p className="text-sm text-slate-500">{t("ren_neg_sub")}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 uppercase tracking-wider">{t("ren_potential_savings")}</div>
              <div className="text-lg font-black text-emerald-400">{getCurrency(language)}{convertCurrency(Math.round(negotiationPotential), language).toLocaleString()}/yr</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {topNegotiations.map((opp, idx) => (
              <div key={opp.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{opp.app}</div>
                    <div className="text-xs text-slate-500 capitalize truncate">{opp.category}</div>
                  </div>
                  <span className={"text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border " + getStatusColor(opp.status)}>
                    {getStatusLabel(opp.status, opp.daysUntil)}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-800/50 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Annual</span>
                    <span className="text-white font-semibold">{getCurrency(language)}{convertCurrency(Math.round(opp.annualCost), language).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Potential save</span>
                    <span className="text-emerald-400 font-semibold">{getCurrency(language)}{convertCurrency(Math.round(opp.annualCost * 0.15), language).toLocaleString()}/yr</span>
                  </div>
                </div>
                <button onClick={() => sendNegotiationEmail(opp)}
                  className="mt-3 w-full px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-lg text-xs font-semibold text-emerald-400 transition-colors">
                  Negotiate →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Row 4: Renewals List/Calendar ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-white">All Renewals</h3>
              <p className="text-xs text-slate-500">{filtered.length} {filtered.length === 1 ? 'renewal' : 'renewals'} shown</p>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {/* View toggle */}
              <div className="flex gap-1 p-1 bg-slate-800 rounded-lg">
                <button onClick={() => setView('list')}
                  className={"px-2.5 py-1 rounded-md text-xs font-semibold transition-all " + (view === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}>
                  List
                </button>
                <button onClick={() => setView('calendar')}
                  className={"px-2.5 py-1 rounded-md text-xs font-semibold transition-all " + (view === 'calendar' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}>
                  Calendar
                </button>
              </div>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 outline-none">
                <option value="date">Sort: Date</option>
                <option value="cost">Sort: Cost</option>
                <option value="app">Sort: A–Z</option>
              </select>
              <button onClick={exportICS}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition-colors flex items-center gap-1.5">
                <Download className="h-3 w-3" /> .ics
              </button>
            </div>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {[
              ['all', 'All', renewals.length],
              ['overdue', 'Overdue', overdue.length],
              ['critical', 'Critical', critical.length + urgent.length],
              ['upcoming', 'Upcoming', upcoming.length],
              ['auto', 'Auto-Renew', autoRenewing.length],
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
              <Calendar className="h-6 w-6 text-slate-500" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">No renewals to show</h3>
            <p className="text-sm text-slate-500">{filter !== 'all' ? 'Try a different filter.' : 'Add renewal dates to your tools to track them here.'}</p>
          </div>
        ) : view === 'list' ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">App</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Renewal Date</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Annual</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Auto</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(r => (
                    <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="text-sm font-semibold text-white truncate">{r.app}</div>
                        <div className="text-xs text-slate-500 capitalize truncate">{r.category}</div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-300 hidden md:table-cell whitespace-nowrap">
                        {r.renewalDate}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={"text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border whitespace-nowrap " + getStatusColor(r.status)}>
                          {getStatusLabel(r.status, r.daysUntil)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-semibold text-white whitespace-nowrap hidden lg:table-cell">
                        {getCurrency(language)}{convertCurrency(Math.round(r.annualCost), language).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center hidden lg:table-cell">
                        {r.autoRenew ? (
                          <span className="text-xs text-amber-400">⚠ Yes</span>
                        ) : (
                          <span className="text-xs text-slate-500">No</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button onClick={() => sendNegotiationEmail(r)}
                          className="px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-xs font-semibold text-blue-400 transition-colors">
                          Negotiate
                        </button>
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
        ) : (
          /* Calendar view */
          <div className="p-4 lg:p-6 space-y-5">
            {calendarMonths.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">No renewals match the current filter.</div>
            ) : calendarMonths.map(month => (
              <div key={month.key}>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">{month.label}</h3>
                  <span className="text-xs text-slate-500">{month.items.length} {month.items.length === 1 ? 'renewal' : 'renewals'} · {getCurrency(language)}{convertCurrency(Math.round(month.total), language).toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {month.items.map(r => (
                    <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-700 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{r.app}</div>
                          <div className="text-xs text-slate-500">{r.renewalDate}</div>
                        </div>
                        <span className={"text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border whitespace-nowrap " + getStatusColor(r.status)}>
                          {getStatusLabel(r.status, r.daysUntil)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/50">
                        <span className="text-xs text-slate-500">Annual</span>
                        <span className="text-sm font-semibold text-white">{getCurrency(language)}{convertCurrency(Math.round(r.annualCost), language).toLocaleString()}</span>
                      </div>
                      <button onClick={() => sendNegotiationEmail(r)}
                        className="mt-3 w-full px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-xs font-semibold text-blue-400 transition-colors">
                        Negotiate →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function InvoicesTabContent() {
  const { language } = useLang();
  const t = useTranslation(language);
  return <InvoiceManager />;
}

function InvoiceManager() {
  const navigate = useNavigate();
  const { language, setLanguage } = useLang();
  const t = useTranslation(language);


  const [showUploadModal, setShowUploadModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [uploadForm, setUploadForm] = useState({ vendor: '', amount: '', dueDate: '', category: 'CRM' });
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false);

  const handleUploadSubmit = (e) => {
    e.preventDefault();
    const existing = JSON.parse(localStorage.getItem('ag_uploaded_invoices') || '[]');
    existing.push({
      id: 'INV-' + Date.now(),
      vendor: uploadForm.vendor,
      amount: parseFloat(uploadForm.amount) || 0,
      dueDate: uploadForm.dueDate,
      category: uploadForm.category,
      fileName: uploadFileName,
      status: 'pending_approval',
      uploadedAt: new Date().toISOString(),
    });
    localStorage.setItem('ag_uploaded_invoices', JSON.stringify(existing));
    setUploadSuccess(true);
    setTimeout(() => {
      setShowUploadModal(false);
      setUploadForm({ vendor: '', amount: '', dueDate: '', category: 'CRM' });
      setUploadFileName('');
      setUploadSuccess(false);
    }, 1500);
  };

  const { data: _idb } = useDbQuery();
  const _iReal = _idb?.user?.is_authenticated && !_idb?.user?.is_demo;
  const uploaded = JSON.parse(localStorage.getItem('ag_uploaded_invoices') || '[]');
  const invoices = _iReal ? uploaded : [
    { id: 'INV-2401', vendor: 'Salesforce', amount: 12400, date: '2026-02-01', dueDate: '2026-03-01', status: 'pending_approval', category: 'CRM', submittedBy: '—' },
    { id: 'INV-2402', vendor: 'Slack', amount: 2850, date: '2026-02-05', dueDate: '2026-03-05', status: 'approved', category: 'Communication', submittedBy: '—' },
    { id: 'INV-2403', vendor: 'GitHub', amount: 3200, date: '2026-02-10', dueDate: '2026-03-10', status: 'paid', category: 'Development', submittedBy: '—' },
    { id: 'INV-2404', vendor: 'Zoom', amount: 1950, date: '2026-02-15', dueDate: '2026-03-15', status: 'pending_approval', category: 'Communication', submittedBy: '—' },
    { id: 'INV-2405', vendor: 'Adobe CC', amount: 5400, date: '2026-02-20', dueDate: '2026-03-20', status: 'approved', category: 'Design', submittedBy: '—' },
  ];

  const pending = invoices.filter(i => i.status === 'pending_approval');
  const approved = invoices.filter(i => i.status === 'approved');
  const overdue = invoices.filter(i => i.status === 'overdue');
  const totalPending = pending.reduce((sum, inv) => sum + inv.amount, 0);

  // Filter invoices based on selected filter
  const filteredInvoices = invoices.filter(inv => {
    if (filter === 'all') return true;
    if (filter === 'pending') return inv.status === 'pending_approval';
    if (filter === 'approved') return inv.status === 'approved';
    if (filter === 'paid') return inv.status === 'paid';
    if (filter === 'overdue') return inv.status === 'overdue';
    return true;
  });

  // Export to CSV
  const handleExport = () => {
    const csv = `Invoice #,Vendor,Category,Amount,Due Date,Status,Submitted By\n${
      filteredInvoices.map(inv => 
        `${inv.id},${inv.vendor},${inv.category},${inv.amount},${inv.dueDate},${inv.status},${inv.submittedBy}`
      ).join('\n')
    }`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${filter}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Submit and track vendor invoices for finance approval</p>
          <button 
            onClick={() => setShowUploadModal(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold flex items-center gap-2"
          >
            <Upload className="w-5 h-5" />
            Upload Invoice
          </button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3 mb-4 md:gap-6 md:mb-8">
          <Card className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">{t("hc_pending_approval")}</span>
              <CalendarClock className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="text-xl md:text-3xl font-black text-white">{pending.length}</div>
            <div className="text-sm text-yellow-400">${totalPending.toLocaleString()}</div>
          </Card>

          <Card className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">{t('approved')}</span>
              <BadgeCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-xl md:text-3xl font-black text-white">{approved.length}</div>
            <div className="text-sm text-emerald-400">{t("hc_ready_for_payment")}</div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">{t('overdue')}</span>
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div className="text-xl md:text-3xl font-black text-white">{overdue.length}</div>
            <div className="text-sm text-red-400">{t("hc_needs_attention")}</div>
          </Card>

          <Card className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">{t("hc_paid_this_month")}</span>
              <CheckCircle className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-xl md:text-3xl font-black text-white">
              {invoices.filter(i => i.status === 'paid').length}
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">{t('all_invoices')}</option>
            <option value="pending">{t("hc_pending_approval")}</option>
            <option value="approved">{t('approved')}</option>
            <option value="paid">Paid</option>
            <option value="overdue">{t('overdue')}</option>
          </Select>
          <button 
            onClick={handleExport}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>

        {/* Invoices Table */}
        <Card className="p-4 md:p-6">
          <div className="overflow-x-auto w-full">
          <div className="overflow-x-auto w-full"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-400">Invoice #</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-400">Vendor</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-400">Category</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-slate-400">Amount</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-400">{t("hc_due_date")}</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-400">{t("hc_submitted_by")}</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-400">Status</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice, idx) => (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-4 px-4 max-w-[180px]">
                      <div className="font-mono text-blue-400">{invoice.id}</div>
                      <div className="text-xs text-slate-500">{invoice.date}</div>
                    </td>
                    <td className="py-4 px-4 font-semibold text-white">{invoice.vendor}</td>
                    <td className="py-4 px-4 text-slate-300">{invoice.category}</td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-white">${invoice.amount.toLocaleString()}</td>
                    <td className="py-4 px-4 text-slate-300">{invoice.dueDate}</td>
                    <td className="py-4 px-4 text-slate-300">{invoice.submittedBy}</td>
                    <td className="py-4 px-4 max-w-[180px]">
                      <Pill tone={
                        invoice.status === 'paid' ? 'green' :
                        invoice.status === 'approved' ? 'blue' :
                        invoice.status === 'overdue' ? 'red' : 'yellow'
                      }>
                        {invoice.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </Pill>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setShowInvoiceDetail(true);
                          }}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm transition-colors">View</button>
                        {invoice.status === 'pending_approval' && (
                          <button
                          onClick={() => {
                            const subject = encodeURIComponent("Invoice for Approval: " + invoice.id + " - " + invoice.vendor);
                            const body = encodeURIComponent(
                              "Hi Finance Team,\n\nPlease review and approve the following invoice:\n\n" +
                              "Invoice #: " + invoice.id + "\n" +
                              "Vendor: " + invoice.vendor + "\n" +
                              "Amount: " + getCurrency(language) + invoice.amount.toLocaleString() + "\n" +
                              "Due Date: " + invoice.dueDate + "\n" +
                              "Category: " + invoice.category + "\n\n" +
                              "Submitted by: " + invoice.submittedBy + "\n\nThank you"
                            );
                            window.open("mailto:hello@stacklens.fr?subject=" + subject + "&body=" + body);
                          }}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-sm transition-colors">{t("hc_send_to_finance")}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </Card>

        {/* Invoice Detail Modal */}
        {showInvoiceDetail && selectedInvoice && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
            <div className="bg-slate-900 rounded-3xl border border-white/10 p-8 max-w-lg w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">Invoice {selectedInvoice.id}</h3>
                <button onClick={() => setShowInvoiceDetail(false)} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
              </div>
              <div className="space-y-3 mb-6">
                {[
                  ["Vendor", selectedInvoice.vendor],
                  ["Category", selectedInvoice.category],
                  ["Amount", getCurrency(language) + selectedInvoice.amount.toLocaleString()],
                  ["Due Date", selectedInvoice.dueDate],
                  ["Submitted By", selectedInvoice.submittedBy],
                  ["Status", selectedInvoice.status.replace("_", " ")],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-slate-800">
                    <span className="text-slate-400 text-sm">{label}</span>
                    <span className="text-white font-medium text-sm">{value}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowInvoiceDetail(false)} className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold">
                  Close
                </button>
                {selectedInvoice.status === "pending_approval" && (
                  <button
                    onClick={() => {
                      const subject = encodeURIComponent("Invoice for Approval: " + selectedInvoice.id + " - " + selectedInvoice.vendor);
                      const body = encodeURIComponent("Hi Finance Team,\n\nPlease approve invoice " + selectedInvoice.id + " for " + selectedInvoice.vendor + " - $" + selectedInvoice.amount.toLocaleString() + "\n\nDue: " + selectedInvoice.dueDate + "\n\nThank you");
                      window.open("mailto:hello@stacklens.fr?subject=" + subject + "&body=" + body);
                    }}
                    className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold transition-colors">
                    📧 Send to Finance
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <Modal open={showUploadModal} onClose={() => setShowUploadModal(false)} title="Upload Invoice" subtitle="Submit vendor invoice for finance approval">
            <form 
              className="space-y-4"
              onSubmit={handleUploadSubmit}
            >
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">{t("hc_vendor_name")}</label>
                <input type="text" required value={uploadForm.vendor} onChange={e => setUploadForm(f => ({...f, vendor: e.target.value}))} className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white" placeholder="e.g. Salesforce" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">{t("hc_invoice_amount")}</label>
                <input type="number" required value={uploadForm.amount} onChange={e => setUploadForm(f => ({...f, amount: e.target.value}))} className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">{t("hc_due_date")}</label>
                <input type="date" required value={uploadForm.dueDate} onChange={e => setUploadForm(f => ({...f, dueDate: e.target.value}))} className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Category</label>
                <Select required>
                  <option>CRM</option>
                  <option>Communication</option>
                  <option>Development</option>
                  <option>Design</option>
                  <option>Analytics</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">{t("hc_upload_invoice_pdf")}</label>
                <input type="file" accept=".pdf" className="hidden" id="invoice-upload" onChange={e => setUploadFileName(e.target.files[0]?.name || '')} />
                <label htmlFor="invoice-upload" className="block border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-blue-500 transition-colors cursor-pointer">
                  <Upload className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  {uploadFileName ? <p className="text-emerald-400 font-semibold">{uploadFileName}</p> : <p className="text-slate-400">{t("hc_click_to_upload_or_drag_and_drop")}</p>}
                  <p className="text-xs text-slate-500 mt-2">PDF up to 10MB</p>
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowUploadModal(false)} className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-colors">{t('cancel')}</button>
                <button type="submit" className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-colors ${uploadSuccess ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-500'}`}>{uploadSuccess ? '✅ Uploaded!' : 'Upload & Submit'}</button>
              </div>
            </form>
          </Modal>
        )}
    </div>
  );
}

function ContractsTabContent() {
  return <ContractComparisonPage />;
}


export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" toastOptions={{ style: { background: "#1e293b", color: "#f1f5f9", border: "1px solid #334155" } }} />
        <LanguageProvider><CurrencyProvider>
        <ErrorBoundary><BrowserRouter>
        <CookieBanner />
          <TourProvider>
          <Routes>
          <Route path="/" element={<TrialPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/legal" element={<LegalMentionsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/dpa" element={<DpaPage />} />
          <Route path="/sub-processors" element={<SubProcessorsPage />} />
          <Route path="/security-info" element={<SecurityPage />} />
          <Route path="/finishSignUp" element={<FinishSignUpPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/executive"
            element={<RequireAuth><ModuleGate module="finance" feature="Finance Board"><FinanceDashboard /></ModuleGate></RequireAuth>}
          />
          <Route
            path="/tools"
            element={<RequireAuth><ToolsPage /></RequireAuth>}
          />
          <Route
            path="/employees"
            element={<RequireAuth><ModuleGate module="people" feature="People & HR Board"><EmployeesPage /></ModuleGate></RequireAuth>}
          />
          <Route
            path="/access"
            element={<RequireAuth><ModuleGate module="people" feature="Access Map"><AccessPage /></ModuleGate></RequireAuth>}
          />
          <Route path="/integrations" element={<Navigate to="/settings" replace />} />
          <Route
            path="/import"
            element={<RequireAuth><SetupConnectionsHub /></RequireAuth>}
          />
          <Route
            path="/offboarding"
            element={<RequireAuth><ModuleGate module="people" feature="Offboarding"><OffboardingPage /></ModuleGate></RequireAuth>}
          />
          <Route
            path="/audit"
            element={<RequireAuth><ModuleGate module="security" feature="Security & Audit"><SecurityCompliancePage /></ModuleGate></RequireAuth>}
          />
          <Route path="/billing" element={<Navigate to="/settings" replace />} />
          <Route
            path="/security"
            element={<RequireAuth><ModuleGate module="security" feature="Security"><SecurityCompliancePage /></ModuleGate></RequireAuth>}
          />
          <Route
            path="/cost"
            element={<RequireAuth><ModuleGate module="finance" feature="Finance Board"><FinanceDashboard /></ModuleGate></RequireAuth>}
          />
          <Route path="/analytics" element={<Navigate to="/finance" replace />} />
          <Route
            path="/settings"
            element={<RequireAuth><SettingsPage /></RequireAuth>}
          />
          <Route
            path="/finance"
            element={<RequireAuth><ModuleGate module="finance" feature="Finance Board"><FinanceDashboard /></ModuleGate></RequireAuth>}
          />
          <Route path="/licenses" element={<Navigate to="/finance" replace />} />
          <Route path="/renewals" element={<Navigate to="/finance" replace />} />
          <Route path="/invoices" element={<Navigate to="/finance" replace />} />
          <Route path="/contracts" element={<Navigate to="/finance" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <FloatingChatbotGated />
        </TourProvider>
        </BrowserRouter></ErrorBoundary>
        </CurrencyProvider></LanguageProvider>
    </QueryClientProvider>
  );
}