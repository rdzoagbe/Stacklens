import React, { useEffect, useMemo, useState, createContext, useContext, useRef, useCallback } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { signInWithGoogle, signInWithGoogleWorkspace, handleRedirectResult, signOutUser, onAuthChange, sendMagicLink, completeMagicLinkSignIn, callAI, loadUserData, saveUserData, syncUserProfile, getUserPlanFromFirestore, registerWithEmail, signInWithEmail, resetPassword, createBillingPortal, createCheckoutSession, logConsent, startTrial, logLegalAcceptance, loadAllUsersAdmin, founderExtendTrial, founderSetPlan, signInWithMicrosoft, saveReport, getReport, deleteReport, resendEmailVerification, deleteAccount, syncClaimsFromServer, sendInviteEmail } from './firebase-config';
import { uid, todayISO, safeParseISO, setFirestoreUid, loadDb, saveDb, hydrateFromFirestore, seedDbIfEmpty, resetDb } from './lib/db';
import { useDbQuery, useDbMutations } from './hooks/useDbQuery';
import { useAuth } from './hooks/useAuth';
import { TourContext, TourProvider, useTour, ProductTourOverlay, TOUR_STEPS, TOUR_LS_KEY } from './contexts/TourContext';
import { LanguageContext, LanguageProvider, useLang } from './contexts/LangContext';
import { CurrencyContext, CurrencyProvider, useCurrency, useCurrencyConverter } from './contexts/CurrencyContext';

// ── Compatibility stubs (migrated to Firestore) ──────────────
async function getUserProfile(uid) {
  const data = await loadUserData(uid);
  return { user: data?.user || null, error: null };
}
async function completeOnboarding(uid, profileData) {
  try {
    const db = await loadUserData(uid) || { tools: [], employees: [], access: [], user: {} };
    db.user = { ...db.user, ...profileData, onboardingCompleted: true };
    await saveUserData(uid, db);
    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: e.message };
  }
}


import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslation } from './translations';
import { LS_KEY, CATEGORIES, EMP_DEPARTMENTS, TOOL_STATUS, CRITICALITY, RISK_SCORE, ACCESS_LEVEL, ACCESS_STATUS, RISK_FLAG } from './lib/constants';
import { PLAN_TIERS, PLAN_LIMITS, TRIAL_DAYS, TRIAL_MS, resolvePlan, getTrialState, getPlanLimits } from './lib/plan';
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
  Share2,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart as RPieChart, Pie, Cell } from 'recharts';

// ============================================================================
// GLOBAL LANGUAGE CONTEXT — single source of truth for all pages
// ============================================================================
// LanguageContext, LanguageProvider, useLang — imported from ./contexts/LangContext
// ============================================================================


const cx = (...xs) => xs.filter(Boolean).join(" ");

// ============================================================================
// R'D LOGO - Custom Animated Logo for Roland D.
// ============================================================================
function RDLogo({ size = "md", onClick }) {
  const s = { sm: "h-9 w-9", md: "h-12 w-12", lg: "h-16 w-16" }[size] || "h-12 w-12";
  return (
    <button onClick={onClick} className={cx("relative group cursor-pointer transition-all duration-300 hover:scale-105 flex-shrink-0", s)}>
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-700 via-blue-600 to-blue-800 opacity-60 blur-md group-hover:opacity-90 transition-opacity duration-300" />
      <div className="relative flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 via-blue-600 to-blue-900 shadow-xl overflow-hidden h-full w-full border border-blue-400/30">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        <svg viewBox="0 0 32 32" fill="none" style={{width:"72%",height:"72%"}} className="relative z-10">
          {/* Shield shape */}
          <path d="M16 2L5 7v8c0 6.5 4.7 12.6 11 14 6.3-1.4 11-7.5 11-14V7L16 2z"
            fill="url(#shieldGrad)" stroke="#60a5fa" strokeWidth="0.5"/>
          {/* Keyhole circle */}
          <circle cx="16" cy="13" r="3.5" fill="none" stroke="white" strokeWidth="1.5" opacity="0.9"/>
          {/* Keyhole stem */}
          <rect x="14.5" y="15.5" width="3" height="4" rx="0.5" fill="white" opacity="0.9"/>
          {/* Circuit lines right */}
          <line x1="22" y1="11" x2="26" y2="11" stroke="#93c5fd" strokeWidth="1" opacity="0.8"/>
          <circle cx="27" cy="11" r="1" fill="#93c5fd" opacity="0.8"/>
          <line x1="22" y1="14" x2="25" y2="14" stroke="#93c5fd" strokeWidth="1" opacity="0.6"/>
          <circle cx="26" cy="14" r="1" fill="#93c5fd" opacity="0.6"/>
          <line x1="22" y1="17" x2="24" y2="17" stroke="#93c5fd" strokeWidth="1" opacity="0.4"/>
          <circle cx="25" cy="17" r="1" fill="#93c5fd" opacity="0.4"/>
          <defs>
            <linearGradient id="shieldGrad" x1="5" y1="2" x2="27" y2="30" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.9"/>
              <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.95"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
    </button>
  );
}

// ============================================================================
// SCROLL TO TOP BUTTON
// ============================================================================
function ScrollToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-8 right-8 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-full shadow-2xl transition-all z-50 hover:scale-110"
      aria-label="Scroll to top"
    >
      <ChevronUp className="w-6 h-6 text-white" />
    </button>
  );
}

function Card({ className, children }) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-slate-800 bg-slate-900/60 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

function CardHeader({ className, title, subtitle, right }) {
  return (
    <div className={cx("flex items-start justify-between gap-4 p-5", className)}>
      <div>
        <div className="text-lg font-semibold text-slate-100">{title}</div>
        {subtitle ? <div className="mt-1 text-sm text-slate-400">{subtitle}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function CardBody({ className, children }) {
  return <div className={cx("p-5 pt-0", className)}>{children}</div>;
}

function Divider() {
  return <div className="my-4 h-px bg-slate-800" />;
}

function Button({
  className,
  variant = "primary",
  size = "md",
  disabled,
  onClick,
  type = "button",
  children,
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-60";
  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-sm",
  };
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-500",
    secondary:
      "bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700",
    ghost: "bg-transparent text-slate-200 hover:bg-slate-800",
    danger: "bg-rose-600 text-white hover:bg-rose-500",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cx(base, sizes[size], variants[variant], className)}
    >
      {children}
    </button>
  );
}

function Input({ className, ...props }) {
  return (
    <input
      className={cx(
        "h-10 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40",
        className
      )}
      {...props}
    />
  );
}

function Select({ className, children, ...props }) {
  return (
    <select
      className={cx(
        "h-10 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cx(
        "w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40",
        className
      )}
      {...props}
    />
  );
}

function Pill({ tone = "slate", icon: Icon, children }) {
  const tones = {
    slate: "bg-slate-800/70 text-slate-200 border-slate-700",
    blue: "bg-blue-600/15 text-blue-200 border-blue-600/30",
    green: "bg-emerald-600/15 text-emerald-200 border-emerald-600/30",
    amber: "bg-amber-500/15 text-amber-200 border-amber-500/30",
    rose: "bg-rose-600/15 text-rose-200 border-rose-600/30",
    purple: "bg-violet-600/15 text-violet-200 border-violet-600/30",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        tones[tone]
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}

function Modal({ open, title, subtitle, onClose, children, footer }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur"
            onClick={onClose}
          />
          <motion.div
            className="relative z-10 w-[92vw] max-w-2xl max-h-[90vh] flex flex-col"
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
          >
            <Card className="overflow-hidden flex flex-col min-h-0">
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5 flex-shrink-0">
                <div>
                  <div className="text-lg font-semibold text-slate-100">{title}</div>
                  {subtitle ? (
                    <div className="mt-1 text-sm text-slate-400">{subtitle}</div>
                  ) : null}
                </div>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="h-4 w-4" />
                  Close
                </Button>
              </div>
              <div className="p-5 overflow-y-auto flex-1 min-h-0">{children}</div>
              {footer ? (
                <div className="border-t border-slate-800 bg-slate-950/80 backdrop-blur p-4 flex-shrink-0 sticky bottom-0">
                  {footer}
                </div>
              ) : null}
            </Card>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SkeletonRow({ cols = 6 }) {
  return (
    <div className="grid grid-cols-12 gap-3 py-2">
      {Array.from({ length: cols }).map((_, i) => (
        <div
          key={i}
          className={cx(
            "col-span-2 h-6 animate-pulse rounded-lg bg-slate-800/70",
            i === 0 ? "col-span-3" : ""
          )}
        />
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, action }) {
  const { language } = useLang();
  const t = useTranslation(language);
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-10 text-center">
      {Icon ? (
        <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
          <Icon className="h-6 w-6 text-slate-200" />
        </div>
      ) : null}
      <div className="text-base font-semibold text-slate-100">{title}</div>
      <div className="mt-1 max-w-md text-sm text-slate-400">{body}</div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

// ── Role-Based Access Control ─────────────────────────────────────────────
const ROLES = {
  owner:  { level: 4, label: 'Owner',  color: 'amber',   can: ['read','write','delete','invite','manage_billing','manage_roles'] },
  admin:  { level: 3, label: 'Admin',  color: 'blue',    can: ['read','write','delete','invite'] },
  editor: { level: 2, label: 'Editor', color: 'emerald', can: ['read','write'] },
  viewer: { level: 1, label: 'Viewer', color: 'slate',   can: ['read'] },
};

function getUserRole() {
  try {
    const db = JSON.parse(localStorage.getItem('accessguard_v1') || '{}');
    const teamRole = localStorage.getItem('sg_my_role') || 'owner';
    return teamRole.toLowerCase();
  } catch { return 'owner'; }
}

function can(action, role) {
  const r = role || getUserRole();
  const roleData = ROLES[r] || ROLES.owner;
  return roleData.can.includes(action);
}

function RoleGate({ requires, children, fallback = null }) {
  const userRole = getUserRole();
  const userLevel = ROLES[userRole]?.level || 4;
  const requiredLevel = ROLES[requires]?.level || 1;
  if (userLevel >= requiredLevel) return children;
  return fallback;
}

function RoleBadge({ role }) {
  const r = ROLES[role?.toLowerCase()] || ROLES.viewer;
  const colors = {
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    slate: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  };
  return (
    <span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border " + (colors[r.color] || colors.slate)}>
      {r.label}
    </span>
  );
}


// TourContext, TourProvider, useTour, ProductTourOverlay, TOUR_STEPS, TOUR_LS_KEY
// — imported from ./contexts/TourContext

function computeToolDerivedStatus(tool) {
  const ownerMissing = !tool.owner_email;
  if (tool.status === "decommissioned") return "decommissioned";
  if (ownerMissing) return "orphaned";
  const lastUsed = safeParseISO(tool.last_used_date);
  if (lastUsed) {
    const days = differenceInDays(new Date(), lastUsed);
    if (days >= 90) return "unused";
  }
  return "active";
}

function computeToolDerivedRisk(tool) {
  const status = computeToolDerivedStatus(tool);
  if (status === "orphaned") return "high";
  if (status === "unused") return "high";
  if (tool.criticality === "high" && status === "active") return "medium";
  return tool.risk_score || "low";
}

// Evidence card — explains WHY a tool has its risk level
// Note: uses English strings; translated at display time via t() in components
function getRiskEvidence(tool) {
  const reasons = [];
  const status = computeToolDerivedStatus(tool);
  if (status === 'orphaned') reasons.push({ key: 'evidence_orphaned', fallback: 'No owner assigned — no one is responsible for this tool' });
  if (status === 'unused') reasons.push({ key: 'evidence_unused', fallback: 'Marked as unused — may be wasting spend' });
  if (!tool.owner_email) reasons.push({ key: 'evidence_no_owner', fallback: 'No owner assigned' });
  if (!tool.mfa_required && !tool.mfa_enabled) reasons.push({ key: 'evidence_no_mfa', fallback: 'MFA not enabled' });
  if (tool.last_used_date) {
    const days = Math.floor((Date.now() - new Date(tool.last_used_date).getTime()) / (1000*60*60*24));
    if (days > 90) reasons.push({ key: 'evidence_not_used_days', fallback: `Not used in ${days} days`, days });
    else if (days > 60) reasons.push({ key: 'evidence_last_used_days', fallback: `Last used ${days} days ago`, days });
  } else {
    reasons.push({ key: 'evidence_no_usage_data', fallback: 'No usage data available' });
  }
  if (tool.cost_per_month && tool.cost_per_month > 100) reasons.push({ key: 'evidence_high_cost', fallback: `High cost: €${tool.cost_per_month}/mo` });
  if (tool.criticality === 'high') reasons.push({ key: 'evidence_business_critical', fallback: 'Tagged as business-critical' });
  return reasons;
}

function computeAccessDerivedRiskFlag(accessRow, employeesById, toolsById) {
  const emp = employeesById[accessRow.employee_id];
  const tool = toolsById[accessRow.tool_id];

  const toolStatus = tool ? computeToolDerivedStatus(tool) : "active";
  const ownerMissing = tool ? !tool.owner_email : false;

  if (accessRow.status !== "active") return "none";
  if (emp && emp.status === "offboarded") return "former_employee";
  if (emp && emp.status === "offboarding") return "needs_review";
  if (ownerMissing) return "orphaned";
  if (toolStatus === "unused") return "unused";

  const lastReviewed = safeParseISO(accessRow.last_reviewed_date);
  if (accessRow.access_level === "admin") {
    if (!lastReviewed) return "needs_review";
    const days = differenceInDays(new Date(), lastReviewed);
    if (days >= 180) return "needs_review";
    return "excessive_admin";
  }

  if (lastReviewed) {
    const days = differenceInDays(new Date(), lastReviewed);
    if (days >= 365) return "needs_review";
  }

  return "none";
}

function buildRiskAlerts(db, tr) {
  // tr: optional translation function. Falls back to English when absent (e.g. PDF export).
  const L = (key, fallback) => (tr ? tr(key) : fallback);
  const employeesById = Object.fromEntries(db.employees.map((e) => [e.id, e]));

  const orphanedTools = db.tools.filter((t) => !t.owner_email);
  const formerEmployeeAccess = db.access.filter((a) => {
    const e = employeesById[a.employee_id];
    return a.status === "active" && e && e.status === "offboarded";
  });

  const adminOverdueReview = db.access.filter((a) => {
    if (a.status !== "active") return false;
    if (a.access_level !== "admin") return false;
    const lastReviewed = safeParseISO(a.last_reviewed_date);
    if (!lastReviewed) return true;
    return differenceInDays(new Date(), lastReviewed) >= 180;
  });

  const toolsUnused90 = db.tools.filter((t) => {
    const d0 = safeParseISO(t.last_used_date);
    if (!d0) return false;
    return differenceInDays(new Date(), d0) >= 90;
  });

  const alerts = [];

  if (orphanedTools.length) {
    alerts.push({
      id: "orphaned_tools",
      severity: "critical",
      title: L("alert_orphaned_title", "Tools without owners detected"),
      body: L("alert_orphaned_body", "{n} tool(s) have no owner assigned.").replace("{n}", orphanedTools.length),
      action: { label: L("alert_orphaned_action", "Review Tools"), to: "/tools", icon: Boxes },
    });
  }

  if (formerEmployeeAccess.length) {
    alerts.push({
      id: "former_employee_access",
      severity: "critical",
      title: L("alert_former_title", "Former employees still have access"),
      body: L("alert_former_body", "{n} active access record(s) belong to offboarded employees.").replace("{n}", formerEmployeeAccess.length),
      action: { label: L("alert_former_action", "Offboarding"), to: "/offboarding", icon: UserMinus },
    });
  }

  if (adminOverdueReview.length) {
    alerts.push({
      id: "admin_overdue_review",
      severity: "high",
      title: L("alert_admin_title", "Admin access overdue for review"),
      body: L("alert_admin_body", "{n} admin access record(s) have not been reviewed in 6+ months.").replace("{n}", adminOverdueReview.length),
      action: { label: L("alert_admin_action", "Access Map"), to: '/access', icon: GitMerge },
    });
  }

  if (toolsUnused90.length) {
    alerts.push({
      id: "tools_unused_90",
      severity: "high",
      title: L("alert_unused_title", "Tools unused for 90+ days"),
      body: L("alert_unused_body", "{n} tool(s) have not been used in 90+ days.").replace("{n}", toolsUnused90.length),
      action: { label: L("alert_unused_action", "Audit Export"), to: "/audit", icon: Download },
    });
  }

  const needsReview = db.access.filter((a) => {
    if (a.status !== "active") return false;
    const lastReviewed = safeParseISO(a.last_reviewed_date);
    if (!lastReviewed) return true;
    return differenceInDays(new Date(), lastReviewed) >= 365;
  });
  if (needsReview.length) {
    alerts.push({
      id: "needs_review",
      severity: "medium",
      title: L("alert_review_title", "Access records need review"),
      body: L("alert_review_body", "{n} access record(s) are due for annual review.").replace("{n}", needsReview.length),
      action: { label: L("alert_review_action", "Review Access"), to: "/access", icon: GitMerge },
    });
  }

  const spend = db.tools.reduce((sum, t) => sum + Number(t.cost_per_month || 0), 0);
  if (spend > 1000) {
    alerts.push({
      id: "spend_watch",
      severity: "medium",
      title: L("alert_spend_title", "Monthly spend exceeds threshold"),
      body: L("alert_spend_body", "Current tool spend is {amount} / month.").replace("{amount}", `${getCurrency(localStorage.getItem("language") || "en")}${Math.round(spend)}`),
      action: { label: L("alert_spend_action", "Tools"), to: "/tools", icon: Boxes },
    });
  }

  return alerts.slice(0, 7);
}

function riskSeverityCounts(alerts) {
  const counts = { critical: 0, high: 0, medium: 0 };
  for (const a of alerts) counts[a.severity] = (counts[a.severity] || 0) + 1;
  return counts;
}


// Validation helpers
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateRequired(value, fieldName) {
  if (!value || !value.trim()) {
    toast.error(`${fieldName} is required`);
    return false;
  }
  return true;
}



function useIdleTimer(enabled) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!enabled) return;
    const savedSec = JSON.parse(localStorage.getItem('sg_security') || '{}');
    const minutes = parseInt(savedSec.timeout || '60', 10);
    if (!minutes || minutes <= 0) return;
    const ms = minutes * 60 * 1000;
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await signOutUser();
        navigate('/', { replace: true });
        toast(minutes + ' min idle — signed out for security');
      }, ms);
    };
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [enabled, navigate]);
}


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
  useIdleTimer(!!(isAuthed && !isDemo && firebaseUser));

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-950"><div className="text-white text-sm">{t('loading')}</div></div>;

  if (!isAuthed && !isDemo && !firebaseUser) return <Navigate to="/" replace state={{ from: location }} />;

  // Gate email/password users who haven't verified yet (Google/magic-link users are pre-verified)
  const isPasswordProvider = firebaseUser?.providerData?.[0]?.providerId === 'password';
  if (isPasswordProvider && firebaseUser?.emailVerified === false) {
    return <EmailVerificationWall email={firebaseUser.email} />;
  }

  return children;
}

function CategoryIcon({ category }) {
  const map = {
    engineering: Wrench,
    design: Sparkles,
    marketing: Activity,
    sales: Briefcase,
    finance: CreditCard,
    hr: Users,
    operations: Building2,
    security: Lock,
    communication: ExternalLink,
    other: Boxes,
  };
  const Icon = map[category] || Boxes;
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/40">
      <Icon className="h-4 w-4 text-slate-200" />
    </div>
  );
}

function StatusBadge({ status }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const m = {
    active: { tone: "green", icon: BadgeCheck, key: "active" },
    orphaned: { tone: "rose", icon: AlertTriangle, key: "orphaned" },
    unused: { tone: "amber", icon: CalendarClock, key: "unused" },
    decommissioned: { tone: "slate", icon: BadgeX, key: "decommissioned" },
    revoked: { tone: "slate", icon: BadgeX, key: "revoked" },
    pending_revocation: { tone: "amber", icon: RefreshCw, key: "pending" },
    offboarding: { tone: "amber", icon: RefreshCw, key: "offboarding" },
    offboarded: { tone: "slate", icon: BadgeX, key: "offboarded" },
  };
  const v = m[status];
  return (
    <Pill tone={v?.tone || "slate"} icon={v?.icon || Info}>
      {v ? t(v.key) : String(status || "-")}
    </Pill>
  );
}

function RiskBadge({ risk }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const m = {
    low: { tone: "green", icon: BadgeCheck, key: "low" },
    medium: { tone: "amber", icon: AlertTriangle, key: "medium" },
    high: { tone: "rose", icon: AlertTriangle, key: "high" },
    critical: { tone: "rose", icon: AlertTriangle, key: "critical" },
  };
  const v = m[risk];
  return (
    <Pill tone={v?.tone || "slate"} icon={v?.icon || Info}>
      {v ? t(v.key) : String(risk || "-")}
    </Pill>
  );
}

function AccessLevelBadge({ level }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const m = {
    admin: { tone: "rose", icon: Lock, key: "admin" },
    editor: { tone: "blue", icon: Pencil, key: "editor" },
    viewer: { tone: "slate", icon: BadgeCheck, key: "viewer" },
    billing: { tone: "purple", icon: CreditCard, key: "billing" },
  };
  const v = m[level];
  return (
    <Pill tone={v?.tone || "slate"} icon={v?.icon || Info}>
      {v ? t(v.key) : String(level || "-")}
    </Pill>
  );
}

function RiskFlagBadge({ flag }) {
  const m = {
    none: { tone: "green", icon: BadgeCheck, label: "OK" },
    orphaned: { tone: "rose", icon: AlertTriangle, label: "Orphaned tool" },
    unused: { tone: "amber", icon: CalendarClock, label: "Unused tool" },
    former_employee: { tone: "rose", icon: UserMinus, label: "Former employee" },
    excessive_admin: { tone: "amber", icon: Lock, label: "Admin" },
    needs_review: { tone: "blue", icon: RefreshCw, label: "Needs review" },
  };
  const v = m[flag] || { tone: "slate", icon: Info, label: String(flag || "-") };
  return (
    <Pill tone={v.tone} icon={v.icon}>
      {v.label}
    </Pill>
  );
}

// NAV uses translation keys — labels resolved in Sidebar/AppShell with t()
const NAV = [
  { to: "/dashboard",    tKey: "nav_dashboard",    icon: LayoutDashboard },
  { separator: true,     tKey: "nav_access_identity" },
  { to: "/tools",        tKey: "nav_tools",         icon: Boxes,       badgeKey: "tools" },
  { to: "/employees",    tKey: "nav_employees",      icon: Users,       badgeKey: "offboarding" },
  { to: "/access",       tKey: "nav_access",         icon: GitMerge,    badgeKey: "access" },
  { to: "/offboarding",  tKey: "nav_offboarding",    icon: UserMinus,   badgeKey: "offboarding" },
  { separator: true,     tKey: "nav_security" },
  { to: "/security",     tKey: "nav_security",       icon: Shield,      badgeKey: "security" },
  { separator: true,     tKey: "nav_finance_section" },
  { to: "/finance",      tKey: "nav_finance",        icon: BarChart3 },
  { separator: true,     tKey: "nav_platform" },
  { to: "/settings",     tKey: "nav_settings",       icon: Settings },
];

function useSidebarBadges() {
  const { data: db } = useDbQuery();
  return useMemo(() => {
    if (!db) return {};
    const employeesById = Object.fromEntries((db.employees || []).map(e => [e.id, e]));
    const toolsById = Object.fromEntries((db.tools || []).map(t => [t.id, t]));
    const activeAccess = (db.access || []).filter(a => a.status === 'active');

    const highRiskAccess = activeAccess.filter(a => {
      const flag = computeAccessDerivedRiskFlag(a, employeesById, toolsById);
      return flag === 'former_employee' || flag === 'excessive_admin';
    }).length;

    const highRiskTools = (db.tools || []).filter(t => computeToolDerivedRisk(t) === 'high').length;
    const noOwnerTools = (db.tools || []).filter(t => !t.owner_email).length;
    const offboardingQueue = (db.employees || []).filter(e => e.status === 'offboarding').length;

    return {
      security: highRiskAccess + highRiskTools,
      access: highRiskAccess,
      offboarding: offboardingQueue,
      tools: noOwnerTools,
    };
  }, [db]);
}

function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const { language } = useLang();
  const t = useTranslation(language);
  const badges = useSidebarBadges();

  return (
    <div
      className={cx(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-slate-800 bg-slate-950/60 backdrop-blur",
        collapsed ? "w-[78px]" : "w-[270px]"
      )}
    >
      <div className={collapsed ? "flex items-center justify-center p-4" : "flex items-center justify-between gap-2 p-4"}>
{!collapsed &&         <Link to="/dashboard" className="flex items-center gap-2">
          <RDLogo size="sm" onClick={() => window.location.href = "/dashboard"} />
          {!collapsed ? (
            <div>
              <div className="text-sm font-black tracking-tight bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Stacklens</div>
              <div className="flex items-center gap-1.5">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">SaaS Intelligence</div>
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] text-emerald-500 font-bold uppercase">Live</span>
                </div>
              </div>
            </div>
          ) : null}
        </Link>}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" strokeWidth="2"/>
              <path d="M15 4v16" strokeWidth="2"/>
              <path d="m9 10 2 2-2 2" strokeWidth="2"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" strokeWidth="2"/>
              <path d="M9 4v16" strokeWidth="2"/>
              <path d="m15 10-2 2 2 2" strokeWidth="2"/>
            </svg>
          )}
        </button>
      </div>

      <div className="px-3 pb-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            {!collapsed ? <div className="text-xs text-slate-300">{t('live_risk_checks')}</div> : null}
          </div>
          {!collapsed ? (
            <div className="mt-2 text-xs text-slate-500">Real-time invalidation via React Query.</div>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 overflow-auto px-2 pb-6">
        {NAV.map((item, idx) => {
          if (item.separator) {
            return (
              <div key={`sep-${idx}`} className="my-4 px-3">
                {!collapsed && (
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {t(item.tKey)}
                  </div>
                )}
                {!collapsed && <div className="mt-2 h-px bg-slate-800" />}
              </div>
            );
          }
          
          const active = location.pathname.startsWith(item.to);
          const Icon = item.icon;
          const badgeCount = item.badgeKey ? (badges[item.badgeKey] || 0) : 0;
          return (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? t(item.tKey) + (badgeCount > 0 ? ` (${badgeCount})` : '') : undefined}
              className={cx(
                "mb-1 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] transition",
                active
                  ? "bg-blue-600/15 text-blue-200 border border-blue-600/30"
                  : "text-slate-300 hover:bg-slate-900/60"
              )}
            >
              <div className="relative flex-shrink-0">
                <Icon className="h-4 w-4" />
                {badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-0.5 leading-none">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </div>
              {!collapsed ? (
                <span className="flex-1 flex items-center justify-between">
                  {t(item.tKey)}
                  {badgeCount > 0 && (
                    <span className="ml-auto rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 leading-none">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <SidebarFooter collapsed={collapsed} />
    </div>
  );
}

function SidebarFooter({ collapsed }) {
  const { user, logout, isDemo, endDemo, firebaseUser } = useAuth();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
  const { language, setLanguage } = useLang();
  const [showLangMenu, setShowLangMenu] = useState(false);

  const languages = [
    { code: 'en', flag: '🇬🇧', name: 'English' },
    { code: 'fr', flag: '🇫🇷', name: 'Français' },
  ];

  const currentLang = languages.find(l => l.code === language) || languages[0];


  const changeLanguage = (code) => {
    localStorage.setItem('language', code);
    setLanguage(code);
    setShowLangMenu(false);
    window.location.reload();
  };

  // Load user profile from Firestore
  useEffect(() => {
    const loadProfile = async () => {
      if (firebaseUser) {
        const { user: profile } = await getUserProfile(firebaseUser.uid);
        setUserProfile(profile);
      }
    };
    loadProfile();
  }, [firebaseUser]);

  const displayName = userProfile?.fullName || firebaseUser?.displayName || user?.email?.split('@')[0] || 'Demo User';
  const photoURL = firebaseUser?.photoURL;
  const companyName = userProfile?.companyName;
  const jobTitle = userProfile?.jobTitle;

  return (
    <div className="border-t border-slate-800 p-3">
      <div
        className={cx(
          "flex items-center gap-3 rounded-2xl bg-slate-900/40 p-3",
          collapsed ? "justify-center" : ""
        )}
      >
        {/* User Photo or Avatar */}
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950/30 overflow-hidden">
          {photoURL ? (
            <img src={photoURL} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <Users className="h-4 w-4 text-slate-200" />
          )}
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <div className="truncate text-xs font-medium text-slate-100">{displayName}</div>
              {user?.is_founder && (
                <span className="flex-shrink-0 text-amber-400 text-[10px] font-bold">⚡</span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {jobTitle && companyName ? (
                <span className="text-slate-400">{jobTitle} at {companyName}</span>
              ) : (
                <>
                  <span className="text-slate-300">{user?.email || user?.displayName || firebaseUser?.email || firebaseUser?.providerData?.[0]?.email || ""}</span>
                  {isDemo && <span className="ml-2 text-blue-300">· DEMO</span>}
                </>
              )}
            </div>
          </div>
        ) : null}
        {collapsed && user?.is_founder && (
          <div className="absolute -top-1 -right-1 text-amber-400 text-[10px]">⚡</div>
        )}
      </div>

      {!collapsed ? (
        <div className="mt-2 space-y-1.5">
          {user?.is_founder && (
            <a href="/founder-admin"
              className="flex items-center gap-2 w-full px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-colors">
              <span>⚡</span>
              <span>Founder Admin</span>
            </a>
          )}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                if (isDemo) endDemo();
                logout();
              }}
            >
              <BadgeX className="h-4 w-4" />
              {isDemo ? "Exit Demo" : "Logout"}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => { navigate('/settings'); setTimeout(() => { const el = document.querySelector('[data-tab="billing"]'); if(el) el.click(); }, 100); }}>
                <ExternalLink className="h-4 w-4" />
                {(() => { const _p = JSON.parse(localStorage.getItem('accessguard_v1') || '{}')?.user?.plan || 'free'; return _p === 'free' || _p === 'trial' ? 'Trial' : (_p.charAt(0).toUpperCase() + _p.slice(1)); })()}
            </Button>
          </div>
        </div>
      ) : null}
      {collapsed && user?.is_founder && (
        <div className="mt-2 flex justify-center">
          <a href="/founder-admin" title="Founder Admin" className="text-amber-400 text-base hover:text-amber-300 transition-colors">⚡</a>
        </div>
      )}
    </div>
  );
}

function LangSelectorCompact() {
  const { language, setLanguage } = useLang();
  const [open, setOpen] = React.useState(false);
  const langs = [
    { code: 'en', flag: '🇬🇧', name: 'EN' },
    { code: 'fr', flag: '🇫🇷', name: 'FR' },
  ];
  const current = langs.find(l => l.code === language) || langs[0];
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/60 border border-slate-700 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-all">
        <span>{current.flag}</span>
        <span className="text-xs font-semibold">{current.name}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[100px]">
          {langs.map(l => (
            <button key={l.code} onClick={() => { setLanguage(l.code); setOpen(false); }}
              className={"w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-800 transition-colors " + (language === l.code ? 'text-blue-400' : 'text-slate-300')}>
              <span>{l.flag}</span><span>{l.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


function useRenewalAlerts() {
  const { data: db } = useDbQuery();
  React.useEffect(() => {
    if (!db?.tools || !db?.user?.email) return;
    const today = new Date();
    const in30 = new Date(today); in30.setDate(today.getDate() + 30);
    const critical = db.tools.filter(t => {
      if (!t.renewal_date) return false;
      const rd = new Date(t.renewal_date);
      return rd >= today && rd <= in30;
    });
    if (critical.length > 0 && !sessionStorage.getItem('renewal_alert_shown')) {
      sessionStorage.setItem('renewal_alert_shown', '1');
      const names = critical.slice(0,3).map(t => t.name).join(', ');
      const more = critical.length > 3 ? ` +${critical.length-3} more` : '';
      toast('🔔 ' + critical.length + ' renewal' + (critical.length>1?'s':'') + ' due in 30 days: ' + names + more, {
        duration: 8000,
        style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #f59e0b' }
      });
    }
  }, [db]);
}

function TopBar({ title, right }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const _db = JSON.parse(localStorage.getItem("accessguard_v1") || "{}");
  const userName = _db?.user?.displayName || _db?.user?.email?.split("@")[0] || "Stacklens";
  return (
    <div className="border-b border-slate-800 bg-slate-950/30">
      {/* Title row — always fits, user avatar pinned right */}
      <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-3">
        <div>
          <div className="text-xl font-semibold text-slate-100">{title}</div>
          <div className="mt-0.5 text-sm text-slate-500">{t('topbar_subtitle')}</div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm text-slate-300 flex-shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600/20 text-blue-300 font-medium">
            {userName.charAt(0).toUpperCase()}
          </div>
          <span className="max-w-[120px] truncate">{userName}</span>
        </div>
      </div>
      {/* Tab/action bar — scrollable on narrow screens */}
      {right && (
        <div className="overflow-x-auto px-5 pb-3 [&::-webkit-scrollbar]:h-0">
          <div className="min-w-max">
            {right}
          </div>
        </div>
      )}
    </div>
  );
}


// ── Cookie Consent Banner (GDPR / CNIL compliant — v2) ──────────────────────
// CNIL requirements enforced:
//   1. All 4 Consent Mode v2 parameters controlled (analytics_storage, ad_storage,
//      ad_user_data, ad_personalization) — see index.html
//   2. Accept and Reject buttons have IDENTICAL visual prominence (same size, same
//      weight, same neutral color). CNIL fined Facebook €60M for unequal prominence.
//   3. Customize option shown on first layer, not hidden behind settings
//   4. One click to Reject, one click to Accept (CNIL parity rule)
//   5. Consent logged to Firestore for audit trail
//   6. Footer "Gérer les cookies" link re-opens banner (easy withdrawal)
//   7. Stored consent expires after 13 months (CNIL maximum)
//   8. No dark patterns: same styling, neutral language
const CONSENT_STORAGE_KEY = 'cookie_consent_v2';
const CONSENT_VERSION = 'v2-2026-04';

// Module-level ref for the cookie banner open function.
// Kept inside the module — not on window — so third-party scripts can't call it.
let _openCookieBanner = null;

function readStoredConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    if (stored.version !== CONSENT_VERSION) return null;
    const THIRTEEN_MONTHS_MS = 13 * 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - stored.timestamp > THIRTEEN_MONTHS_MS) return null;
    return stored;
  } catch { return null; }
}

function writeStoredConsent(choice) {
  const record = { choice, version: CONSENT_VERSION, timestamp: Date.now() };
  try { localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record)); } catch {}
  // Fire-and-forget Firestore audit log (does not block UI)
  try {
    if (typeof logConsent === 'function') {
      logConsent({
        choice,
        version: CONSENT_VERSION,
        userAgent: navigator.userAgent?.slice(0, 200) || '',
        language: navigator.language || '',
      }).catch(() => { /* silent — logging is best-effort */ });
    }
  } catch {}
}

function CookieBanner() {
  const [visible, setVisible] = useState(() => !readStoredConsent());
  const [showDetails, setShowDetails] = useState(false);
  const { language } = useLang();

  // Allow footer link to re-open the banner
  useEffect(() => {
    _openCookieBanner = () => {
      setShowDetails(false);
      setVisible(true);
    };
    return () => { _openCookieBanner = null; };
  }, []);

  if (!visible) return null;

  const isFr = language === 'fr';
  const t = isFr ? {
    title: 'Respect de votre vie privée',
    body: "Nous utilisons des cookies analytiques (Google Analytics) pour comprendre comment Stacklens est utilisé. Les cookies essentiels (authentification, sécurité) sont toujours actifs. Vous pouvez modifier votre choix à tout moment.",
    accept: 'Tout accepter',
    reject: 'Tout refuser',
    customize: 'Personnaliser',
    privacy: 'Politique de confidentialité',
    save: 'Enregistrer mes choix',
    essential: 'Cookies essentiels',
    essentialDesc: "Nécessaires au fonctionnement du site (authentification, sécurité). Ne peuvent pas être désactivés.",
    analytics: 'Cookies analytiques',
    analyticsDesc: "Google Analytics : pages visitées, durée de session, appareil. IP anonymisée.",
    alwaysOn: 'Toujours actifs',
  } : {
    title: 'Your privacy matters',
    body: 'We use analytics cookies (Google Analytics) to understand how Stacklens is used. Essential cookies (authentication, security) are always on. You can change your choice at any time.',
    accept: 'Accept all',
    reject: 'Reject all',
    customize: 'Customize',
    privacy: 'Privacy policy',
    save: 'Save my choices',
    essential: 'Essential cookies',
    essentialDesc: 'Required for the site to function (authentication, security). Cannot be disabled.',
    analytics: 'Analytics cookies',
    analyticsDesc: 'Google Analytics: pages visited, session duration, device. IP is anonymized.',
    alwaysOn: 'Always on',
  };

  const handleAccept = () => {
    window.enableAnalytics?.();
    writeStoredConsent('accepted');
    setVisible(false);
  };

  const handleReject = () => {
    window.disableAnalytics?.();
    writeStoredConsent('rejected');
    setVisible(false);
  };

  // CNIL-compliant button styling: BOTH buttons use the identical class set.
  // Same size, same weight, same neutral background, same text color.
  // Do NOT make one more visually prominent than the other.
  const btnClass = "flex-1 sm:flex-none px-5 py-2.5 rounded-lg border border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700 text-sm font-medium transition-colors min-w-[140px] text-center";

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-body"
      className="fixed bottom-0 left-0 right-0 z-[9999] p-4 sm:p-5 bg-slate-950/98 border-t border-slate-800 backdrop-blur-md shadow-2xl"
    >
      <div className="max-w-5xl mx-auto">
        {!showDetails ? (
          <div className="flex flex-col gap-4">
            <div>
              <div id="cookie-banner-title" className="text-base font-semibold text-white mb-1.5">
                🍪 {t.title}
              </div>
              <div id="cookie-banner-body" className="text-sm text-slate-300 leading-relaxed">
                {t.body}{' '}
                <Link to="/privacy" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
                  {t.privacy}
                </Link>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button onClick={handleReject} className={btnClass}>{t.reject}</button>
              <button onClick={() => setShowDetails(true)} className={btnClass}>{t.customize}</button>
              <button onClick={handleAccept} className={btnClass}>{t.accept}</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-base font-semibold text-white mb-3">🍪 {t.customize}</div>
              <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-medium text-white">{t.essential}</div>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{t.alwaysOn}</span>
                  </div>
                  <div className="text-xs text-slate-400 leading-relaxed">{t.essentialDesc}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="text-sm font-medium text-white mb-1">{t.analytics}</div>
                  <div className="text-xs text-slate-400 leading-relaxed">{t.analyticsDesc}</div>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button onClick={handleReject} className={btnClass}>{t.reject}</button>
              <button onClick={handleAccept} className={btnClass}>{t.accept}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TrialExpiredBanner() {
  const { user, isDemo } = useAuth();
  const { language } = useLang();
  const t = useTranslation(language);
  const navigate = useNavigate();

  if (isDemo) return null;
  const plan = resolvePlan(user);
  const { expired } = getTrialState(user);
  if (!expired || (plan && plan !== 'free')) return null;

  return (
    <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-base">⏰</span>
        <span className="font-semibold">{t('trial_expired_banner_title') || 'Your free trial has ended'}</span>
        <span className="text-amber-100 hidden sm:inline">— {t('trial_expired_banner_sub') || 'Upgrade to keep your team\'s SaaS stack visible and actionable.'}</span>
      </div>
      <button onClick={() => navigate('/app/settings?tab=billing')}
        className="bg-white text-amber-600 hover:bg-amber-50 px-3 py-1 rounded-lg text-xs font-bold transition-all flex-shrink-0">
        {t('upgrade_now') || 'Upgrade now'} →
      </button>
    </div>
  );
}

function DemoBanner() {
  const { isDemo } = useAuth();
  const navigate = useNavigate();
  const { language } = useLang();
  const t = useTranslation(language);
  if (!isDemo) return null;
  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-base">🎯</span>
        <span className="font-semibold">{t('ui_demo_mode')}</span>
        <span className="text-blue-200 hidden sm:inline">— Explore with sample data. Sign up for real data.</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/?signup=true')} className="bg-white text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg text-xs font-bold transition-all">
          Sign Up Free
        </button>
      </div>
    </div>
  );
}

// ── Error Boundary ──────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('ErrorBoundary caught:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-slate-400 text-sm mb-4">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-colors">
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppShell({ subtitle, title, right, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { language } = useLang();
  const t = useTranslation(language);
  const { user, logout, isDemo, endDemo, firebaseUser } = useAuth();

  const mobileDisplayName = firebaseUser?.displayName || user?.email?.split('@')[0] || 'You';
  const mobileEmail = user?.email || firebaseUser?.email || '';
  const mobilePhotoURL = firebaseUser?.photoURL;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_52%),radial-gradient(circle_at_bottom,rgba(99,102,241,0.10),transparent_55%)]" />
      <DemoBanner />
      <TrialExpiredBanner />
      <div className="flex flex-col md:flex-row w-full overflow-x-hidden md:h-screen">
        <div className="hidden md:block flex-shrink-0">
          <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        </div>

        <div className="md:hidden">
          <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
            <button onClick={() => setMobileOpen(true)} className="flex items-center justify-center w-9 h-9 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 transition-all active:scale-95">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <Link to="/dashboard" className="flex items-center gap-2">
              <RDLogo size="sm" />
              <div className="text-sm font-bold text-white">Stacklens</div>
            </Link>
            <LangSelectorCompact />
          </div>
          <Modal
            open={mobileOpen}
            title={t('navigation')}
            subtitle={t('jump_to')}
            onClose={() => setMobileOpen(false)}
            footer={
              <div className="flex justify-end">
                <Button variant="secondary" onClick={() => setMobileOpen(false)}>
                  Done
                </Button>
              </div>
            }
          >
            {/* User profile section — mobile only */}
            {(user || firebaseUser) && (
              <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-950/30 overflow-hidden flex-shrink-0">
                  {mobilePhotoURL ? (
                    <img src={mobilePhotoURL} alt={mobileDisplayName} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="h-4 w-4 text-slate-200" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-100">{mobileDisplayName}</div>
                  <div className="truncate text-xs text-slate-400">{mobileEmail}</div>
                </div>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    if (isDemo) endDemo();
                    logout();
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs flex-shrink-0"
                >
                  {t('logout') || 'Logout'}
                </button>
              </div>
            )}
            <div className="grid gap-2">
              {NAV.filter(n => !n.separator && n.icon).map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/30 p-3 text-sm hover:bg-slate-900/60"
                >
                  <n.icon className="h-4 w-4" />
                  {t(n.tKey)}
                </Link>
              ))}
            </div>
          </Modal>
        </div>

        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto w-full max-w-full md:h-screen">
          <div className="hidden md:block">
            <TopBar title={title} right={right} />
          </div>
          <div className="md:hidden bg-slate-950/90 border-b border-slate-800 px-4 py-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-base font-bold text-white">{title}</div>
              {right && <div className="flex-shrink-0">{right}</div>}
            </div>
          </div>
          <div className="p-3 md:p-6 lg:p-8 w-full max-w-full overflow-x-hidden min-w-0">{children}</div>
          {/* ── App Footer ── */}
          <footer className="border-t border-slate-800/60 bg-slate-950/40 px-4 md:px-6 py-4 mt-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <span>© {new Date().getFullYear()} Stacklens</span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">{t('ui_saas_for_smbs')}</span>
              </div>
              <div className="flex items-center gap-4">
                <Link to="/contact" className="hover:text-slate-300 transition-colors">{t('ui_contact')}</Link>
                <Link to="/privacy" className="hover:text-slate-300 transition-colors">{t('footer_privacy_policy')}</Link>
                <Link to="/terms" className="hover:text-slate-300 transition-colors">{t('footer_terms_of_service')}</Link>
                <Link to="/legal" className="hover:text-slate-300 transition-colors">{t('ui_legal')}</Link>
                <Link to="/security-info" className="hover:text-slate-300 transition-colors">{t('nav_security')}</Link>
                <Link to="/about" className="hover:text-slate-300 transition-colors">{t('ui_about')}</Link>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

function formatMoney(n, currency, lang) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return (currency || getCurrency(lang)) + '0';
  const cur = currency || getCurrency(lang);
  const converted = convertCurrency(v, lang);
  return cur + converted.toLocaleString();
}
function getCurrency(lang) {
  try {
    const activeLang = lang || localStorage.getItem('language') || 'en';
    // First check if user has explicitly set a currency in Settings
    const settings = JSON.parse(localStorage.getItem('sg_general') || '{}');
    if (settings.currency) {
      if (settings.currency.includes('£')) return '£';
      if (settings.currency.includes('€')) return '€';
      if (settings.currency.includes('¥')) return '¥';
      if (settings.currency.includes('$')) return '$';
    }
    // Otherwise, default based on language
    if (activeLang === 'fr') return '€';
    if (activeLang === 'es') return '€';
    return '$';
  } catch { return '$'; }
}
function convertCurrency(amountUSD, lang) {
  try {
    const cached = JSON.parse(localStorage.getItem('accessguard_fx_rates') || '{}');
    const rates = cached.rates || { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5 };
    const activeLang = lang || localStorage.getItem('language') || 'en';
    const settings = JSON.parse(localStorage.getItem('sg_general') || '{}');
    let code = 'USD';
    if (settings.currency?.includes('£')) code = 'GBP';
    else if (settings.currency?.includes('€')) code = 'EUR';
    else if (settings.currency?.includes('¥')) code = 'JPY';
    else if (activeLang === 'fr' || activeLang === 'es') code = 'EUR';
    const rate = rates[code] || 1;
    return Math.round(amountUSD * rate);
  } catch { return Math.round(amountUSD); }
}


// CurrencyContext, CurrencyProvider, useCurrency, useCurrencyConverter — imported from ./contexts/CurrencyContext

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows, columns) {
  const esc = (v) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  const header = columns.map((c) => esc(c)).join(",");
  const body = rows
    .map((r) => columns.map((c) => esc(r[c])).join(","))
    .join("\n");
  return `${header}\n${body}\n`;
}

function parseCsv(text) {
  // Strip UTF-8 BOM that Excel adds when saving as CSV
  const clean = text.replace(/^﻿/, '');
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = splitCsvLine(line);
    const obj = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = vals[i] ?? "";
    return obj;
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function LiveStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
      <div className="text-xs font-semibold text-slate-400">{label}</div>
      <motion.div
        className="mt-1 text-xl sm:text-2xl font-semibold"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        {Number(value || 0).toLocaleString()}
        <span className="text-sm font-normal text-slate-500">+</span>
      </motion.div>
    </div>
  );
}

function MiniStat({ label, value, tone = "blue" }) {
  const tones = {
    blue: "border-blue-600/30 bg-blue-600/10",
    amber: "border-amber-500/30 bg-amber-500/10",
    rose: "border-rose-600/30 bg-rose-600/10",
    slate: "border-slate-800 bg-slate-950/30",
  };
  return (
    <div className={cx("rounded-2xl border p-4", tones[tone] || tones.slate)}>
      <div className="text-xs font-semibold text-slate-400">{label}</div>
      <div className="mt-1 text-xl sm:text-2xl font-semibold">{value}</div>
    </div>
  );
}

function ProgressRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-100">{label}</div>
        <div className="text-xs text-slate-400">{value}%</div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-800">
        <div
          className="h-2 rounded-full bg-blue-600"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function DataTable({ columns, rows, rowKey, emptyIcon, emptyTitle, emptyBody }) {
  if (!rows.length) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} body={emptyBody} />;
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800">
      <div className="hidden md:grid grid-cols-12 gap-3 border-b border-slate-800 bg-slate-950/30 px-4 py-3 text-xs font-semibold text-slate-400">
        {columns.map((c) => (
          <div key={c.key} className={c.className}>
            {c.header}
          </div>
        ))}
      </div>
      <div className="divide-y divide-slate-800">
        {rows.map((r) => (
          <div key={rowKey(r)} className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 text-sm">
            {columns.map((c) => (
              <div key={c.key} className={cx("min-w-0", c.className)}>
                {c.cell(r)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

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

// ============================================================================
// TRIAL PAGE WITH IMPROVEMENTS
// ============================================================================
// ============================================================================
// ONBOARDING PAGE - Collect User Information
// ============================================================================
function OnboardingPage() {
  const navigate = useNavigate();
  const { user, firebaseUser } = useAuth();
  const { language } = useLang();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    jobTitle: '',
    companySize: '',
  });
  const [teamEmails, setTeamEmails] = useState(['']);
  const [directoryChoice, setDirectoryChoice] = useState(null); // null | 'google' | 'microsoft' | 'okta'
  const [dirSyncDone, setDirSyncDone] = useState(false);
  const [tourSlide, setTourSlide] = useState(0);

  const firstName = firebaseUser?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  // If no user, redirect to home
  useEffect(() => {
    if (!firebaseUser) { navigate('/', { replace: true }); return; }
    const key = 'sg_onboarded_' + firebaseUser.uid;
    if (localStorage.getItem(key) === 'true') { navigate('/dashboard', { replace: true }); }
  }, [firebaseUser, navigate]);

  const completeOnboardingAndGo = async (goToImport = false) => {
    setLoading(true);
    try {
      if (firebaseUser) {
        await completeOnboarding(firebaseUser.uid, {
          ...formData,
          onboardingCompleted: true,
          onboardingDate: new Date().toISOString(),
          pendingTeamInvites: teamEmails.filter(e => e.trim()),
        });
        localStorage.setItem('sg_onboarded_' + firebaseUser.uid, 'true');
      }
    } catch(e) {
      if (firebaseUser) localStorage.setItem('sg_onboarded_' + firebaseUser.uid, 'true');
    } finally { setLoading(false); }
    navigate(goToImport ? '/import' : '/dashboard', { replace: true });
  };

  const TOTAL_STEPS = 5; // 0=welcome, 1=profile, 2=team, 3=directory, 4=tour

  const tourSlides = [
    {
      icon: '📊',
      title: 'Your SaaS Dashboard',
      desc: 'See all your tools, costs, and usage in one place. Spot redundancies and unused licenses instantly.',
    },
    {
      icon: '👥',
      title: 'People & Access',
      desc: 'Track which employees have access to which tools. Offboard leavers in seconds — no more orphaned accounts.',
    },
    {
      icon: '💶',
      title: 'Finance & Renewals',
      desc: 'Never miss a renewal. Get alerts 30 days before contracts expire and track your full SaaS spend.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <RDLogo size="md" />
          <div className="text-xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Stacklens</div>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={"flex-1 h-1 rounded-full transition-all duration-300 " + (i <= step ? 'bg-emerald-500' : 'bg-slate-700')} />
          ))}
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-8">

          {/* STEP 0 — Welcome */}
          {step === 0 && (
            <div className="text-center space-y-6">
              <div className="text-5xl">👋</div>
              <div>
                <h1 className="text-3xl font-black text-white mb-2">Welcome, {firstName}!</h1>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Stacklens helps you track your SaaS tools, manage team access, and cut wasted spend.<br/>
                  This takes about 2 minutes to set up.
                </p>
              </div>
              <button onClick={() => setStep(1)}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20">
                Let's get started →
              </button>
              <button onClick={() => completeOnboardingAndGo(false)} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                Skip setup, go to dashboard
              </button>
            </div>
          )}

          {/* STEP 1 — Profile */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black text-white mb-1">{t('ob_about_company')}</h2>
                <p className="text-slate-500 text-sm">{t('ob_personalise')}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{t('ob_company_name')}</label>
                <input value={formData.companyName} onChange={e => setFormData(p => ({ ...p, companyName: e.target.value }))}
                  placeholder={t('ob_company_name')}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{t('ob_your_role')}</label>
                <select value={formData.jobTitle} onChange={e => setFormData(p => ({ ...p, jobTitle: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors">
                  <option value="">{t('ob_select_role')}</option>
                  {['CTO','VP of IT','IT Manager','IT Director','CEO','CFO','Operations Manager','Security Manager','Other'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{t('ob_company_size')}</label>
                <select value={formData.companySize} onChange={e => setFormData(p => ({ ...p, companySize: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors">
                  <option value="">{t('ob_select_size')}</option>
                  {['1-50','51-200','201-500','501-1000','1000+'].map(s => (
                    <option key={s} value={s}>{s} employees</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(0)} className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors">
                  ← Back
                </button>
                <button onClick={() => setStep(2)}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl transition-all">
                  Continue →
                </button>
              </div>
              <button onClick={() => setStep(2)} className="w-full text-center text-sm text-slate-500 hover:text-slate-300 transition-colors">
                Skip this step
              </button>
            </div>
          )}

          {/* STEP 2 — Team members */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <div className="text-4xl mb-3">👥</div>
                <h2 className="text-xl font-black text-white mb-1">{t('ob_invite_team_q')}</h2>
                <p className="text-slate-400 text-sm">{t('ob_invite_team_body')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setStep('2-yes')}
                  className="py-4 rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-sm transition-all">
                  ✅ Yes, invite team
                </button>
                <button onClick={() => setStep(3)}
                  className="py-4 rounded-2xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-400 font-semibold text-sm transition-all">
                  Skip for now
                </button>
              </div>
              <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                ← Back
              </button>
            </div>
          )}

          {/* STEP 2-yes — Email invite form */}
          {step === '2-yes' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black text-white mb-1">{t('ob_invite_your_team')}</h2>
                <p className="text-slate-400 text-sm">Enter email addresses — we'll send them an invite.</p>
              </div>
              <div className="space-y-2">
                {teamEmails.map((email, idx) => (
                  <div key={email || `email-${idx}`} className="flex gap-2">
                    <input value={email} onChange={e => {
                        const next = [...teamEmails]; next[idx] = e.target.value; setTeamEmails(next);
                      }}
                      type="email" placeholder={`colleague${idx + 1}@company.com`}
                      className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors" />
                    {teamEmails.length > 1 && (
                      <button onClick={() => setTeamEmails(teamEmails.filter((_, i) => i !== idx))}
                        className="px-3 py-2.5 bg-slate-800 hover:bg-red-500/20 border border-slate-700 text-slate-400 hover:text-red-400 rounded-xl text-sm transition-colors">✕</button>
                    )}
                  </div>
                ))}
                {teamEmails.length < 5 && (
                  <button onClick={() => setTeamEmails([...teamEmails, ''])}
                    className="w-full py-2 border border-dashed border-slate-600 hover:border-emerald-500/50 text-slate-500 hover:text-emerald-400 text-sm rounded-xl transition-colors">
                    + Add another
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors">
                  ← Back
                </button>
                <button onClick={() => { setStep(3); toast.success(t('toast_team_invites_saved')); }}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl transition-all">
                  Save invites & continue →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — Directory sync */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <div className="text-4xl mb-3">📂</div>
                <h2 className="text-xl font-black text-white mb-1">{t('ob_import_directory_q')}</h2>
                <p className="text-slate-400 text-sm">Connect Google Workspace, Microsoft 365, or Okta to auto-import your employees.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setStep('3-yes')}
                  className="py-4 rounded-2xl border-2 border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-bold text-sm transition-all">
                  ✅ Yes, connect it
                </button>
                <button onClick={() => setStep(4)}
                  className="py-4 rounded-2xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-400 font-semibold text-sm transition-all">
                  Skip for now
                </button>
              </div>
              <button onClick={() => setStep(2)} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                ← Back
              </button>
            </div>
          )}

          {/* STEP 3-yes — Directory provider picker */}
          {step === '3-yes' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black text-white mb-1">{t('ob_choose_directory')}</h2>
                <p className="text-slate-400 text-sm">You can always add more from Settings → Integrations.</p>
              </div>
              <div className="space-y-2">
                {[
                  { id: 'google', name: 'Google Workspace', sub: 'Import employees from G Suite / Cloud Identity',
                    logo: <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>,
                  },
                  { id: 'microsoft', name: 'Microsoft 365', sub: 'Import from Azure AD / Entra ID',
                    logo: <div className="w-5 h-5 grid grid-cols-2 gap-0.5"><div className="bg-[#F25022] rounded-sm"/><div className="bg-[#7FBA00] rounded-sm"/><div className="bg-[#00A4EF] rounded-sm"/><div className="bg-[#FFB900] rounded-sm"/></div>,
                  },
                  { id: 'okta', name: 'Okta', sub: 'Import from Okta Universal Directory',
                    logo: <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[8px] font-black text-white">OK</div>,
                  },
                ].map(p => (
                  <button key={p.id} onClick={() => setDirectoryChoice(p.id)}
                    className={"w-full flex items-center gap-3 p-4 rounded-2xl border transition-all " +
                      (directoryChoice === p.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-800/60 hover:border-slate-600')}>
                    <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center flex-shrink-0">{p.logo}</div>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-white">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.sub}</div>
                    </div>
                    {directoryChoice === p.id && <div className="ml-auto text-blue-400 text-lg">✓</div>}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors">
                  ← Back
                </button>
                <button
                  onClick={() => {
                    if (!directoryChoice) { toast.error(t('toast_select_provider')); return; }
                    setStep(4);
                    toast.success(t('toast_directory_connecting'));
                  }}
                  disabled={!directoryChoice}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl transition-all">
                  Select & continue →
                </button>
              </div>
              <button onClick={() => setStep(4)} className="w-full text-center text-sm text-slate-500 hover:text-slate-300 transition-colors">
                Skip for now
              </button>
            </div>
          )}

          {/* STEP 4 — Quick tour */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-5xl mb-3">{tourSlides[tourSlide].icon}</div>
                <h2 className="text-xl font-black text-white mb-2">{tourSlides[tourSlide].title}</h2>
                <p className="text-slate-400 text-sm leading-relaxed">{tourSlides[tourSlide].desc}</p>
              </div>
              {/* Slide dots */}
              <div className="flex justify-center gap-2">
                {tourSlides.map((_, i) => (
                  <button key={i} onClick={() => setTourSlide(i)}
                    className={"w-2 h-2 rounded-full transition-all " + (i === tourSlide ? 'bg-emerald-400 w-5' : 'bg-slate-600')} />
                ))}
              </div>
              <div className="flex gap-3">
                {tourSlide > 0 && (
                  <button onClick={() => setTourSlide(p => p - 1)}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors">
                    ←
                  </button>
                )}
                {tourSlide < tourSlides.length - 1 ? (
                  <button onClick={() => setTourSlide(p => p + 1)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 font-semibold rounded-xl transition-all">
                    Next →
                  </button>
                ) : (
                  <button onClick={() => completeOnboardingAndGo(directoryChoice !== null)}
                    disabled={loading}
                    className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg">
                    {loading ? 'Setting up…' : directoryChoice ? 'Go to dashboard & connect directory →' : 'Go to dashboard →'}
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Skip all escape hatch (except on tour slide) */}
        {step !== 4 && step !== 0 && (
          <div className="text-center mt-4">
            <button onClick={() => completeOnboardingAndGo(false)} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
              Skip everything and go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// TRIAL PAGE WITH IMPROVEMENTS
// ============================================================================
function TrialPage() {
  const navigate = useNavigate();
  const { language } = useLang();
  const t = useTranslation(language);

  const { login, startDemo, isAuthed, isDemo: isDemoUser, firebaseUser } = useAuth();

  // If already authenticated on mount, redirect away from landing page
  useEffect(() => {
    // Use a small delay so Firebase auth state settles before we check
    const timer = setTimeout(() => {
      if (isAuthed || firebaseUser) {
        const uid = firebaseUser?.uid;
        const done = uid ? localStorage.getItem('sg_onboarded_' + uid) === 'true' : false;
        navigate('/dashboard', { replace: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  // Only run once on mount — intentionally omitting deps to prevent loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [showAuth, setShowAuth] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [authTab, setAuthTab] = useState('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authConfirm, setAuthConfirm] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [activeFaq, setActiveFaq] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Analytics tracking helper
  const trackEvent = (eventName, params = {}) => {
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, params);
    }
  };

  // SSO Providers - exact match to screenshot
  const ssoProviders = [
    { id: 'google', name: 'Google', subtitle: 'Sign in with Google account', live: true },
    { id: 'microsoft', name: 'Microsoft', subtitle: 'Microsoft 365 / Azure AD', live: true },
    { id: 'github', name: 'GitHub', subtitle: 'Sign in with GitHub', live: false },
    { id: 'okta', name: 'Okta', subtitle: 'Enterprise SSO via Okta', live: false },
    { id: 'saml', name: 'SAML SSO', subtitle: 'Custom SAML 2.0 provider', live: false },
    { id: 'magic', name: 'Email magic link', subtitle: 'Passwordless — link sent to email', live: true },
  ];

  // No fake testimonials — we're in early access. Real testimonials come from real customers.
  const testimonials = [];

  // FAQs
  const faqs = [
    { q: "How long does setup take?", a: "Under 5 minutes. Upload a CSV or Excel file with your tools and employees. Stacklens maps everything automatically." },
    { q: "Do I need to install anything?", a: "No. 100% cloud-based. Works in your browser." },
    { q: "Do you support Google Workspace / Microsoft 365 sync?", a: "Not yet — real OAuth sync is on the roadmap for Q1/Q2 2026. For now, CSV/Excel import works great and takes 5 minutes." },
    { q: "How much can I save?", a: "It depends on your stack size. Most companies with 50+ tools have 10-30% waste they don't know about — idle licenses, forgotten subscriptions, ex-employee access." },
    { q: "Is my data secure?", a: "Yes. Your data is hosted on Google Cloud Platform in the EU (Firebase). GDPR-compliant by design. Data is encrypted in transit and at rest. You own your data and can export or delete it at any time." },
    { q: "Why is it so much cheaper than Zylo or Torii?", a: "They're built for enterprises with 1,000+ employees and dedicated procurement teams. Stacklens is built for SMBs — simpler feature set, lower infrastructure costs, solo founder. Different market, different price." },
  ];

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle SSO provider click
  const handleSSOClick = async (provider) => {
    setLoading(true);
    trackEvent('sso_clicked', { provider: provider.id });
    
    try {
      if (provider.id === 'google') {
        await login();
      } else if (provider.id === 'microsoft') {
        const { user, error } = await signInWithMicrosoft();
        if (error) {
          toast.error('Microsoft sign-in failed: ' + error);
          setLoading(false);
        }
        // onAuthChange handles the rest if sign-in succeeded
      } else if (provider.id === 'magic') {
        setShowEmailForm(true);
        setLoading(false);
      } else {
        toast.info(`${provider.name} SSO coming soon.`);
        setLoading(false);
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast.error(t('signin_failed_try_again'));
      setLoading(false);
    }
  };

  // Handle email magic link
  const handleEmailSubmit = async (email) => {
    setLoading(true);
    
    const { error } = await sendMagicLink(email);

    if (!error) {
      setShowEmailForm(false);
      setShowAuth(false);
      toast.success(t('magic_link_sent'));
    } else {
      toast.error(t('could_not_send_email') + ' ' + error + '. ' + t('lp_try_google_instead'));
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Subtle background gradient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      {/* ── NAV ── */}
      <nav className="relative z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl sticky top-0">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RDLogo size="md" onClick={() => window.location.href = "/"} />
              <div className="text-xl font-bold text-white">Stacklens</div>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors">{t('lp_nav_pricing')}</a>
              <a href="#faq" className="text-sm text-slate-400 hover:text-white transition-colors">{t('lp_nav_faq')}</a>
              <LangSelectorCompact />
              <button
                onClick={() => setShowAuth(true)}
                className="text-sm text-slate-400 hover:text-white transition-colors">
                {t('sign_in')}
              </button>
              <button
                onClick={() => { trackEvent('cta_click', { location: 'nav' }); setShowAuth(true); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold text-white transition-colors">
                {t('start_free')}
              </button>
            </div>
            <button
              onClick={() => setShowAuth(true)}
              className="md:hidden px-4 py-2 bg-blue-600 rounded-lg text-sm font-semibold">
              {t('start_free')}
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative z-10 pt-20 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-800 bg-slate-900/60 mb-8">
            <span className="text-xs font-medium text-slate-400">{t('lp_eu_badge')}</span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-white mb-6 leading-[1.05]">
            {t('lp_hero_title_1')}
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">{t('lp_hero_title_2')}</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('lp_hero_subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <button
              onClick={() => { trackEvent('cta_click', { location: 'hero_primary' }); setShowAuth(true); }}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-base font-semibold text-white transition-all hover:scale-[1.02] shadow-lg shadow-blue-900/40">
              {t('lp_hero_cta_primary')}
            </button>
            <button
              onClick={() => { trackEvent('cta_click', { location: 'hero_demo' }); startDemo(); navigate('/dashboard'); }}
              className="px-8 py-4 border border-slate-700 hover:border-slate-600 hover:bg-slate-900/60 rounded-xl text-base font-semibold text-slate-300 transition-all">
              {t('lp_hero_cta_demo')}
            </button>
          </div>
          <p className="text-xs text-slate-500">{t('lp_hero_free_note')}</p>
        </div>
      </section>

      {/* ── HOW IT WORKS — 3-step visual flow ── */}
      <section className="relative z-10 py-20 px-6 border-t border-slate-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">{t('lp_how_heading')}</h2>
            <p className="text-slate-500">{t('hero_no_integrations')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: t('lp_step1_title'),
                desc: t('lp_step1_desc'),
                detail: t('lp_step1_detail'),
                color: 'from-blue-500/20 to-blue-600/10',
                border: 'border-blue-500/30',
                icon: '📤',
              },
              {
                step: '02',
                title: t('lp_step2_title'),
                desc: t('lp_step2_desc'),
                detail: t('lp_step2_detail'),
                color: 'from-amber-500/20 to-amber-600/10',
                border: 'border-amber-500/30',
                icon: '🔍',
              },
              {
                step: '03',
                title: t('lp_step3_title'),
                desc: t('lp_step3_desc'),
                detail: t('lp_step3_detail'),
                color: 'from-emerald-500/20 to-emerald-600/10',
                border: 'border-emerald-500/30',
                icon: '✅',
              },
            ].map((s, i) => (
              <div key={i} className={`rounded-2xl border ${s.border} bg-gradient-to-br ${s.color} p-6`}>
                <div className="text-3xl mb-4">{s.icon}</div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('lp_step_label')} {s.step}</div>
                <h3 className="text-xl font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-slate-400 mb-4 leading-relaxed">{s.desc}</p>
                <p className="text-xs text-slate-500 italic">{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT STACKLENS FINDS — concrete outcomes ── */}
      <section className="relative z-10 py-24 px-6 border-t border-slate-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">{t('lp_problems_section_label')}</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white leading-tight max-w-3xl mx-auto">
              {t('lp_finds_heading_1')} <span className="text-blue-400">{t('lp_finds_heading_2')}</span>
            </h2>
            <p className="text-slate-500 mt-4 max-w-xl mx-auto">{t('lp_finds_subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                icon: '💸',
                title: t('lp_find1_title'),
                sub: t('lp_find1_sub'),
                action: t('lp_find1_action'),
                color: 'border-amber-500/30',
                bg: 'bg-amber-500/5',
              },
              {
                icon: '🔴',
                title: t('lp_find2_title'),
                sub: t('lp_find2_sub'),
                action: t('lp_find2_action'),
                color: 'border-red-500/30',
                bg: 'bg-red-500/5',
              },
              {
                icon: '📅',
                title: t('lp_find3_title'),
                sub: t('lp_find3_sub'),
                action: t('lp_find3_action'),
                color: 'border-blue-500/30',
                bg: 'bg-blue-500/5',
              },
              {
                icon: '👻',
                title: t('lp_find4_title'),
                sub: t('lp_find4_sub'),
                action: t('lp_find4_action'),
                color: 'border-purple-500/30',
                bg: 'bg-purple-500/5',
              },
              {
                icon: '🔓',
                title: t('lp_find5_title'),
                sub: t('lp_find5_sub'),
                action: t('lp_find5_action'),
                color: 'border-red-500/30',
                bg: 'bg-red-500/5',
              },
              {
                icon: '🏚️',
                title: t('lp_find6_title'),
                sub: t('lp_find6_sub'),
                action: t('lp_find6_action'),
                color: 'border-amber-500/30',
                bg: 'bg-amber-500/5',
              },
            ].map((item, i) => (
              <div key={i} className={`rounded-2xl border ${item.color} ${item.bg} p-5 hover:border-opacity-60 transition-colors`}>
                <div className="flex items-start gap-4">
                  <span className="text-2xl flex-shrink-0">{item.icon}</span>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-slate-400 mb-3">{item.sub}</p>
                    <span className="text-xs text-blue-400 font-semibold">{item.action}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <button
              onClick={() => { trackEvent('cta_click', { location: 'outcomes' }); setShowAuth(true); }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold text-white transition-all">
              {t('lp_finds_cta')}
            </button>
          </div>
        </div>
      </section>

      {/* ── WHO IT'S FOR ── */}
      <section className="relative z-10 py-20 px-6 border-t border-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t('accidental_saas_owner')}</h2>
          <p className="text-slate-400 max-w-2xl mx-auto mb-10">
            {t('lp_who_subtitle')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { role: t('lp_who_role1'), pain: t('lp_who_pain1') },
              { role: t('lp_who_role2'), pain: t('lp_who_pain2') },
              { role: t('lp_who_role3'), pain: t('lp_who_pain3') },
            ].map((p, i) => (
              <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-left">
                <div className="text-sm font-bold text-blue-400 mb-2">{p.role}</div>
                <p className="text-sm text-slate-400 leading-relaxed">{p.pain}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="relative z-10 py-20 px-6 border-t border-slate-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">{t('transparent_pricing')}</h2>
            <p className="text-slate-500">{t('public_pricing')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { id: 'free', name: t('lp_plan_free'), price: '€0', sub: t('lp_plan_free_sub'), features: [t('lp_feat_10_tools'), t('lp_feat_25_employees'), t('lp_feat_shadow_it'), t('lp_feat_basic_alerts')], cta: t('start_free'), highlight: false },
              { id: 'starter', name: t('lp_plan_starter'), price: '€29', sub: t('lp_plan_starter_sub'), features: [t('lp_feat_100_tools'), t('lp_feat_250_employees'), t('lp_feat_renewal_alerts'), t('lp_feat_csv_import'), t('lp_feat_5_seats')], cta: t('start_trial'), highlight: false },
              { id: 'hr_finance', name: t('lp_plan_hrfin'), price: '€49', sub: t('lp_plan_hrfin_sub'), features: [t('lp_feat_finance_board'), t('lp_feat_people_board'), t('lp_feat_access_tracking'), t('lp_feat_offboarding'), t('lp_feat_10_seats')], cta: t('start_trial'), highlight: false, badge: 'NEW' },
              { id: 'pro', name: t('lp_plan_pro'), price: '€79', sub: t('lp_plan_pro_sub'), features: [t('lp_feat_500_tools'), t('lp_feat_1500_employees'), t('lp_feat_ai_recs'), t('lp_feat_full_security'), t('lp_feat_15_seats')], cta: t('start_trial'), highlight: true },
              { id: 'enterprise', name: t('lp_plan_enterprise'), price: '€299', sub: t('lp_plan_enterprise_sub'), features: [t('lp_feat_unlimited'), t('lp_feat_sso_saml'), t('lp_feat_api_access'), t('lp_feat_dedicated_support')], cta: t('contact_sales'), highlight: false },
            ].map((p, i) => (
              <div
                key={i}
                className={"rounded-2xl border p-6 transition-all relative " + (
                  p.highlight
                    ? 'border-blue-500/60 bg-gradient-to-b from-blue-500/10 to-slate-900/40'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                )}>
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-blue-500 text-[10px] font-bold text-white uppercase tracking-wider">
                    {t('most_popular')}
                  </div>
                )}
                {p.badge && !p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-teal-500 text-[10px] font-bold text-white uppercase tracking-wider">
                    {p.badge}
                  </div>
                )}
                <div className="text-sm font-semibold text-slate-400 mb-2">{p.name}</div>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-4xl font-black text-white">{p.price}</span>
                  <span className="text-sm text-slate-500">{p.sub}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-slate-300">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    trackEvent('cta_click', { location: 'pricing_' + p.id });
                    if (p.id === 'enterprise') {
                      window.location.href = '/contact?subject=enterprise';
                    } else {
                      setShowAuth(true);
                    }
                  }}
                  className={"w-full py-2.5 rounded-lg text-sm font-semibold transition-colors " + (
                    p.highlight
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  )}>
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-slate-500 mt-8">
            {t('lp_pricing_footnote')}
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="relative z-10 py-20 px-6 border-t border-slate-900">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">{t('faq_title')}</h2>
            <p className="text-slate-500">{t('faq_subtitle')}</p>
          </div>
          <div className="space-y-3">
            {[
              { q: t('lp_faq_q1'), a: t('lp_faq_a1') },
              { q: t('lp_faq_q2'), a: t('lp_faq_a2') },
              { q: t('lp_faq_q3'), a: t('lp_faq_a3') },
              { q: t('lp_faq_q4'), a: t('lp_faq_a4') },
              { q: t('lp_faq_q5'), a: t('lp_faq_a5') },
              { q: t('lp_faq_q6'), a: t('lp_faq_a6') },
            ].map((f, i) => (
              <details
                key={i}
                className="group rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-900/60 transition-colors list-none">
                  <span className="text-sm font-semibold text-white pr-4">{f.q}</span>
                  <ChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-5 text-sm text-slate-400 leading-relaxed">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative z-10 py-24 px-6 border-t border-slate-900">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t('get_started_in_minutes')}</h2>
          <p className="text-slate-400 mb-8">
            {t('lp_final_subtitle')}
          </p>
          <button
            onClick={() => { trackEvent('cta_click', { location: 'final' }); setShowAuth(true); }}
            className="px-10 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-base font-semibold text-white transition-all hover:scale-[1.02] shadow-lg shadow-blue-900/40">
            {t('lp_final_cta')}
          </button>
          <p className="mt-4 text-xs text-slate-500">{t('lp_final_note')}</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-slate-800 bg-slate-950/60 backdrop-blur-sm mt-16">
        <div className="max-w-6xl mx-auto px-6 py-14">
          {/* Main footer grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12 md:pr-20">
            {/* Brand column */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <RDLogo size="sm" onClick={() => window.location.href = "/"} />
                <div className="text-base font-bold text-white">Stacklens</div>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                {t('lp_footer_tagline')}
              </p>
              <div className="text-xs text-slate-500">{t('lp_footer_built_eu')}</div>
            </div>

            {/* Product */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">{t('lp_footer_product')}</div>
              <ul className="space-y-3 text-sm">
                <li><a href="#pricing" onClick={(e) => { e.preventDefault(); document.getElementById('pricing')?.scrollIntoView({behavior:'smooth'}); }} className="text-slate-300 hover:text-white transition-colors">{t('lp_nav_pricing')}</a></li>
                <li><a href="#faq" onClick={(e) => { e.preventDefault(); document.getElementById('faq')?.scrollIntoView({behavior:'smooth'}); }} className="text-slate-300 hover:text-white transition-colors">{t('lp_nav_faq')}</a></li>
                <li><button onClick={() => { startDemo(); navigate('/dashboard'); }} className="text-slate-300 hover:text-white transition-colors text-left">{t('lp_footer_live_demo')}</button></li>
                <li><button onClick={() => setShowAuth(true)} className="text-slate-300 hover:text-white transition-colors text-left">{t('sign_in')}</button></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">{t('lp_footer_company')}</div>
              <ul className="space-y-3 text-sm">
                <li><Link to="/about" className="text-slate-300 hover:text-white transition-colors">{t('lp_footer_about')}</Link></li>
                <li><Link to="/contact" className="text-slate-300 hover:text-white transition-colors">{t('lp_footer_contact')}</Link></li>
                <li><a href="mailto:hello@stacklens.fr" className="text-slate-300 hover:text-white transition-colors">{t('lp_footer_contact')}</a></li>
                <li><Link to="/contact?subject=sales" className="text-slate-300 hover:text-white transition-colors">{t('lp_footer_sales')}</Link></li>
                <li><a href="mailto:hello@stacklens.fr" className="text-slate-300 hover:text-white transition-colors">{t('lp_footer_support')}</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">{t('lp_footer_legal')}</div>
              <ul className="space-y-3 text-sm">
                <li><Link to="/privacy" className="text-slate-300 hover:text-white transition-colors">{t('footer_privacy_policy')}</Link></li>
                <li><Link to="/terms" className="text-slate-300 hover:text-white transition-colors">{t('footer_terms_of_service')}</Link></li>
                <li><Link to="/legal" className="text-slate-300 hover:text-white transition-colors">{t('footer_legal_mentions')}</Link></li>
                <li><Link to="/dpa" className="text-slate-300 hover:text-white transition-colors">{language === 'fr' ? 'DPA (RGPD)' : 'DPA (GDPR)'}</Link></li>
                <li><Link to="/sub-processors" className="text-slate-300 hover:text-white transition-colors">{language === 'fr' ? 'Sous-traitants' : 'Sub-processors'}</Link></li>
                <li><Link to="/security-info" className="text-slate-300 hover:text-white transition-colors">{t('lp_footer_security')}</Link></li>
                <li><Link to="/about" className="text-slate-300 hover:text-white transition-colors">{language === 'fr' ? 'RGPD' : 'GDPR'}</Link></li>
                <li>
                  <button
                    type="button"
                    onClick={() => { if (_openCookieBanner) _openCookieBanner(); }}
                    className="text-slate-300 hover:text-white transition-colors text-sm text-left"
                  >
                    {t('lp_footer_manage_cookies')}
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-slate-800/60 flex flex-col md:flex-row items-center justify-between gap-4 md:pr-20">
            <div className="text-xs text-slate-500">
              {t('lp_footer_rights')}
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>{t('lp_footer_made_paris')}</span>
              <span className="text-slate-700">·</span>
              <a href="mailto:hello@stacklens.fr" className="hover:text-white transition-colors">hello@stacklens.fr</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ══════════════════════════════════════════════════════
           UNIFIED AUTH MODAL — SSO-first redesign
          ══════════════════════════════════════════════════════ */}
      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{background:'rgba(2,6,23,0.88)', backdropFilter:'blur(14px)'}}>
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden"
            style={{boxShadow:'0 0 100px rgba(59,130,246,0.18)'}}>

            {/* Subtle top glow bar */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/70 to-transparent" />

            {/* Close button */}
            <button onClick={() => { setShowAuth(false); setAuthError(''); setMagicSent(false); }}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all z-10">
              ✕
            </button>

            <div className="px-6 md:px-8 pt-8 pb-8">
              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-lg font-black text-white">Stacklens</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">{t('hc_saas_intelligence_platform')}</div>
                </div>
              </div>

              {/* Tab switcher */}
              <div className="flex gap-1 p-1 bg-slate-800/80 rounded-2xl border border-slate-700/50 mb-6">
                {[
                  { id: 'signin', label: t('lp_auth_tab_signin') },
                  { id: 'create', label: t('lp_auth_tab_create') },
                ].map(tab => (
                  <button key={tab.id} onClick={() => { setAuthTab(tab.id); setAuthError(''); setMagicSent(false); }}
                    className={"flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200 " +
                      (authTab === tab.id ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200")}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {magicSent ? (
                /* ── Magic link sent state (shared between both tabs) ── */
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Mail className="w-8 h-8 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-lg mb-1">{t("hc_check_your_inbox")}</div>
                    <div className="text-slate-400 text-sm">{t("hc_we_sent_a_magic_link_to")}</div>
                    <div className="text-blue-400 font-semibold text-sm mt-1">{authEmail}</div>
                  </div>
                  <div className="text-slate-500 text-xs">{t('lp_auth_magic_hint')}</div>
                  <button onClick={() => setMagicSent(false)} className="text-sm text-slate-400 hover:text-white transition-colors underline underline-offset-2">
                    {t('lp_auth_use_different')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {authError && <div className="text-rose-400 text-xs px-1 pb-1">{authError}</div>}

                  {/* ── SSO buttons — always visible at the top ── */}
                  <button onClick={() => handleSSOClick({ id: 'google', live: true })}
                    disabled={loading}
                    className="w-full py-3.5 bg-white hover:bg-slate-100 disabled:opacity-50 rounded-2xl text-slate-900 font-bold text-sm transition-all flex items-center justify-center gap-3 shadow-sm">
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    {t('lp_auth_continue_google')}
                  </button>

                  <button onClick={async () => {
                      setLoading(true); setAuthError('');
                      const { user, error } = await signInWithMicrosoft();
                      if (error) {
                        const msg = error.includes('auth/popup-blocked') ? t('lp_err_popup_blocked')
                          : error.includes('auth/account-exists') ? t('lp_err_account_exists')
                          : t('lp_err_ms_failed');
                        setAuthError(msg); setLoading(false); return;
                      }
                      if (user) {
                        const cur = seedDbIfEmpty();
                        cur.user = { ...cur.user, is_authenticated: true, is_demo: false, email: user.email, displayName: user.displayName || user.email?.split('@')[0], uid: user.uid };
                        saveDb(cur);
                        const done = localStorage.getItem('sg_onboarded_' + user.uid) === 'true';
                        window.location.replace(done ? '/dashboard' : '/onboarding');
                      }
                      setLoading(false);
                    }}
                    disabled={loading}
                    className="w-full py-3.5 bg-[#2F2F2F] hover:bg-[#3D3D3D] disabled:opacity-50 border border-slate-700/50 rounded-2xl text-white font-bold text-sm transition-all flex items-center justify-center gap-3">
                    <div className="w-5 h-5 grid grid-cols-2 gap-[3px] flex-shrink-0">
                      <div className="bg-[#F25022] rounded-[2px]"/><div className="bg-[#7FBA00] rounded-[2px]"/>
                      <div className="bg-[#00A4EF] rounded-[2px]"/><div className="bg-[#FFB900] rounded-[2px]"/>
                    </div>
                    {t('lp_auth_continue_microsoft')}
                  </button>

                  {/* Legal footer — always visible above email divider */}
                  <p className="text-center text-[10px] text-slate-600 leading-relaxed -mt-1">
                    {t('lp_auth_agree_1')}{' '}
                    <Link to="/terms" className="text-slate-500 hover:text-white underline" onClick={() => setShowAuth(false)}>{t('lp_auth_agree_terms')}</Link>
                    {' '}{t('lp_auth_agree_and')}{' '}
                    <Link to="/privacy" className="text-slate-500 hover:text-white underline" onClick={() => setShowAuth(false)}>{t('hc_privacy_policy')}</Link>
                  </p>

                  {/* Divider */}
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 h-px bg-slate-700/80" />
                    <span className="text-xs text-slate-500 font-medium">{t('lp_auth_or_email')}</span>
                    <div className="flex-1 h-px bg-slate-700/80" />
                  </div>

                  {/* ── SIGN IN — email fields ── */}
                  {authTab === 'signin' && (
                    <>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{t("hc_work_email")}</label>
                        <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                          placeholder="you@company.com"
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{t('lp_auth_password')}</label>
                        <div className="relative">
                          <input type={showPassword ? 'text' : 'password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12" />
                          <button type="button" onClick={() => setShowPassword(v => !v)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs">
                            {showPassword ? t('lp_auth_hide') : t('lp_auth_show')}
                          </button>
                        </div>
                      </div>
                      <button onClick={async () => {
                          setLoading(true); setAuthError('');
                          if (!authEmail) { setAuthError(t('lp_err_enter_email')); setLoading(false); return; }
                          if (!authPassword) { setAuthError(t('lp_err_enter_password')); setLoading(false); return; }
                          const { user, error } = await signInWithEmail(authEmail, authPassword);
                          if (error) {
                            setAuthError(error.replace('Firebase: ','').replace('(auth/wrong-password).','— wrong password').replace('(auth/user-not-found).','— no account found').replace('(auth/invalid-credential).','— invalid email or password'));
                            setLoading(false); return;
                          }
                          if (user) {
                            const cur = seedDbIfEmpty();
                            cur.user = { ...cur.user, is_authenticated: true, is_demo: false, email: user.email, displayName: user.displayName || authEmail.split('@')[0], uid: user.uid };
                            saveDb(cur);
                            const done = localStorage.getItem('sg_onboarded_' + user.uid) === 'true';
                            window.location.replace(done ? '/dashboard' : '/onboarding');
                          }
                          setLoading(false);
                        }}
                        disabled={loading || !authEmail || !authPassword}
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/20">
                        {loading ? t('lp_auth_signing_in') : t('lp_auth_signin_email')}
                      </button>
                      <div className="flex items-center justify-between gap-4">
                        <button onClick={async () => {
                            if (!authEmail) { setAuthError(t('lp_err_enter_email_first')); return; }
                            setLoading(true); setAuthError('');
                            const { error } = await sendMagicLink(authEmail);
                            if (!error) { setMagicSent(true); }
                            else { setAuthError(t('lp_err_could_not_send_link') + ' ' + error); }
                            setLoading(false);
                          }}
                          disabled={loading}
                          className="text-xs text-slate-500 hover:text-blue-400 transition-colors flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" />
                          {t('lp_auth_send_magic')}
                        </button>
                        <button onClick={async () => { if (!authEmail) { setAuthError(t('lp_err_enter_email_first2')); return; } const { error } = await resetPassword(authEmail); if (!error) toast.success(t('password_reset_sent')); else setAuthError(error); }}
                          className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                          {t('forgot_password')}
                        </button>
                      </div>
                    </>
                  )}

                  {/* ── CREATE ACCOUNT — email fields ── */}
                  {authTab === 'create' && (
                    <>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{t("hc_full_name")}</label>
                        <input type="text" value={authName} onChange={e => setAuthName(e.target.value)}
                          placeholder={t('lp_auth_name_placeholder')}
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{t("hc_work_email")}</label>
                        <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                          placeholder="you@company.com"
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{t('lp_auth_password')}</label>
                        <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)}
                          placeholder={t('lp_auth_password_min')}
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                      </div>
                      <button id="signup-btn" onClick={async () => {
                          if (!authName) { setAuthError(t('lp_err_enter_name')); return; }
                          if (!authEmail) { setAuthError(t('lp_err_enter_email2')); return; }
                          if (!authPassword || authPassword.length < 8) { setAuthError(t('lp_err_password_8')); return; }
                          setLoading(true); setAuthError('');
                          const { user, error } = await registerWithEmail(authEmail, authPassword, authName);
                          if (error) {
                            setAuthError(error.replace('Firebase: ','').replace('(auth/email-already-in-use).','— email already registered').replace('(auth/weak-password).','— password too weak'));
                            setLoading(false); return;
                          }
                          if (user) {
                            toast.success(t('account_created_verify'));
                            const cur = seedDbIfEmpty();
                            cur.user = { ...cur.user, is_authenticated: true, is_demo: false, email: user.email, displayName: authName, uid: user.uid };
                            saveDb(cur);
                            window.location.replace('/onboarding');
                          }
                          setLoading(false);
                        }}
                        disabled={loading || !authEmail || !authName || !authPassword}
                        className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold text-sm transition-all shadow-lg">
                        {loading ? t('lp_auth_creating') : t('lp_auth_create_email')}
                      </button>
                      <p className="text-center text-[11px] text-slate-600 leading-relaxed pt-1">
                        {t('lp_auth_agree_1')}{' '}
                        <Link to="/terms" className="text-slate-400 hover:text-white underline" onClick={() => setShowAuth(false)}>{t('lp_auth_agree_terms')}</Link>
                        {' '}{t('lp_auth_agree_and')}{' '}
                        <Link to="/privacy" className="text-slate-400 hover:text-white underline" onClick={() => setShowAuth(false)}>{t("hc_privacy_policy")}</Link>
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* ── Demo link ── */}
              {!magicSent && (
                <div className="mt-5 pt-5 border-t border-slate-800">
                  <button onClick={() => { setShowAuth(false); startDemo(); navigate('/dashboard'); }}
                    className="w-full py-2.5 rounded-xl border border-emerald-600/30 bg-emerald-600/5 hover:bg-emerald-600/10 text-emerald-400 hover:text-emerald-300 text-sm font-semibold transition-all flex items-center justify-center gap-2">
                    <Play className="w-3.5 h-3.5" />
                    {t('lp_auth_try_demo')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scroll to Top Button */}
      <ScrollToTop />
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
    alerts: buildRiskAlerts({ tools: db.tools, access: db.access || [], employees: db.employees || [] }, t)
  };
  
  return (
    <AppShell title={t("nav_executive")}>
      <PlanGate requires="professional" feature="Executive Dashboard"><ExecutiveDashboard data={derived} /></PlanGate>
    </AppShell>
  );
}

// ============================================================================
// GOOGLE WORKSPACE SYNC BUTTON
// ============================================================================

const OKTA_CLIENT_ID  = import.meta.env.VITE_OKTA_CLIENT_ID  || '6a09e0ebf5aaa66d02e605a6';
const AZURE_CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID || '5270e1b9-2a70-48d6-b0e1-cd5f22904968';

function WorkspaceConnector({ compact = false }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const muts = useDbMutations();
  const [syncing, setSyncing] = useState(null);
  const [status, setStatus]   = useState(null);
  const [oktaStep, setOktaStep]     = useState(null);
  const [oktaDomain, setOktaDomain] = useState('');
  const [cancelledProvider, setCancelledProvider] = useState(null); // 'google' | 'microsoft' | 'okta'

  // Auto-dismiss success/error status after 6s; clear stale loading if syncing stops
  React.useEffect(() => {
    if (!status) return;
    if (status.type === 'loading' && !syncing) { setStatus(null); return; }
    if (status.type !== 'loading') {
      const t = setTimeout(() => setStatus(null), 6000);
      return () => clearTimeout(t);
    }
  }, [status, syncing]);

  // Handle Microsoft 365 PKCE callback
  useEffect(() => {
    const params   = new URLSearchParams(window.location.search);
    const urlError = params.get('error');
    const urlState = params.get('state');

    // Detect OAuth cancellation from Microsoft / Okta redirect
    if (urlError === 'access_denied' || urlError === 'login_required') {
      const msState   = sessionStorage.getItem('ms_state');
      const oktaState = sessionStorage.getItem('okta_state');
      if (msState && urlState === msState) {
        sessionStorage.removeItem('ms_state');
        sessionStorage.removeItem('ms_code_verifier');
        window.history.replaceState({}, '', window.location.pathname);
        setCancelledProvider('microsoft');
        return;
      }
      if (oktaState && urlState === oktaState) {
        sessionStorage.removeItem('okta_state');
        sessionStorage.removeItem('okta_code_verifier');
        window.history.replaceState({}, '', window.location.pathname);
        setCancelledProvider('okta');
        return;
      }
    }

    const code     = params.get('code');
    const msState  = sessionStorage.getItem('ms_state');
    if (!code || !msState || urlState !== msState) return;

    const verifier = sessionStorage.getItem('ms_code_verifier');
    if (!verifier) return;

    sessionStorage.removeItem('ms_state');
    sessionStorage.removeItem('ms_code_verifier');
    window.history.replaceState({}, '', window.location.pathname);

    setSyncing('microsoft');
    setStatus({ type: 'loading', msg: 'Completing Microsoft 365 connection…' });

    (async () => {
      try {
        const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type:    'authorization_code',
            client_id:     AZURE_CLIENT_ID,
            code,
            redirect_uri:  window.location.origin,
            code_verifier: verifier,
            scope:         'https://graph.microsoft.com/User.Read.All offline_access openid',
          }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(tokenData.error_description || 'Token exchange failed');

        setStatus({ type: 'loading', msg: 'Importing users from Microsoft 365…' });
        const usersRes = await fetch(
          'https://graph.microsoft.com/v1.0/users?$top=999&$select=displayName,mail,userPrincipalName,jobTitle,department,accountEnabled',
          { headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' } }
        );
        if (!usersRes.ok) throw new Error('Failed to fetch users — ensure User.Read.All permission is granted in Azure');
        const msUsers = (await usersRes.json()).value || [];

        let count = 0;
        for (const u of msUsers) {
          const email = u.mail || u.userPrincipalName;
          if (!email) continue;
          try {
            await muts.createEmployee.mutateAsync({
              full_name:     u.displayName || email,
              email,
              department:    u.department || 'general',
              role:          u.jobTitle || 'Member',
              status:        u.accountEnabled ? 'active' : 'offboarded',
              imported_from: 'microsoft365',
            });
            count++;
          } catch {}
        }
        setStatus({ type: 'success', msg: `Imported ${count} employees from Microsoft 365!` });
      } catch (err) {
        setStatus({ type: 'error', msg: `Microsoft sync failed: ${err.message}` });
      } finally {
        setSyncing(null);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Okta PKCE callback when redirected back from Okta
  useEffect(() => {
    const params      = new URLSearchParams(window.location.search);
    const code        = params.get('code');
    const urlState    = params.get('state');
    const storedState = sessionStorage.getItem('okta_state');
    if (!code || !storedState || urlState !== storedState) return;

    const domain   = sessionStorage.getItem('okta_domain');
    const verifier = sessionStorage.getItem('okta_code_verifier');
    if (!domain || !verifier) return;

    sessionStorage.removeItem('okta_state');
    sessionStorage.removeItem('okta_code_verifier');
    sessionStorage.removeItem('okta_domain');
    window.history.replaceState({}, '', window.location.pathname);

    setSyncing('okta');
    setStatus({ type: 'loading', msg: 'Completing Okta connection…' });

    (async () => {
      try {
        const tokenRes = await fetch(`https://${domain}/oauth2/v1/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type:    'authorization_code',
            client_id:     OKTA_CLIENT_ID,
            code,
            redirect_uri:  window.location.origin,
            code_verifier: verifier,
          }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(tokenData.error_description || 'Token exchange failed');

        setStatus({ type: 'loading', msg: 'Importing users from Okta…' });
        const usersRes = await fetch(
          `https://${domain}/api/v1/users?limit=200&filter=status+eq+"ACTIVE"`,
          { headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' } }
        );
        if (!usersRes.ok) throw new Error('Failed to fetch Okta users — ensure API Access Management is enabled');
        const oktaUsers = await usersRes.json();

        let count = 0;
        for (const u of oktaUsers) {
          try {
            await muts.createEmployee.mutateAsync({
              full_name:       `${u.profile.firstName} ${u.profile.lastName}`.trim(),
              email:           u.profile.email,
              department:      u.profile.department || 'general',
              role:            u.profile.userType || 'Member',
              status:          'active',
              imported_from:   'okta',
            });
            count++;
          } catch {}
        }
        setStatus({ type: 'success', msg: `Imported ${count} employees from Okta!` });
      } catch (err) {
        setStatus({ type: 'error', msg: `Okta sync failed: ${err.message}` });
      } finally {
        setSyncing(null);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncGoogle = async () => {
    setSyncing('google');
    setStatus({ type: 'loading', msg: 'Requesting Google Workspace access…' });
    try {
      const { accessToken, error } = await signInWithGoogleWorkspace();
      if (error || !accessToken) throw new Error(error || 'Could not get Google access token');

      setStatus({ type: 'loading', msg: 'Importing users from Google Workspace…' });
      const res = await fetch(
        'https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=500&orderBy=email',
        { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error ${res.status} — make sure you are a Google Workspace admin`);
      }
      const data  = await res.json();
      const users = data.users || [];
      let count = 0;
      for (const u of users) {
        try {
          await muts.createEmployee.mutateAsync({
            full_name:     u.name?.fullName || u.primaryEmail,
            email:         u.primaryEmail,
            status:        u.suspended ? 'offboarded' : 'active',
            department:    u.orgUnitPath?.split('/').filter(Boolean).pop() || 'general',
            role:          u.isAdmin ? 'Admin' : 'Member',
            imported_from: 'google_workspace',
          });
          count++;
        } catch {}
      }
      setStatus({ type: 'success', msg: `Imported ${count} employees from Google Workspace!` });
    } catch (err) {
      const cancelled = err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request' || err.message?.includes('closed');
      if (cancelled) {
        setStatus(null);
        setCancelledProvider('google');
      } else {
        setStatus({ type: 'error', msg: `Google sync failed: ${err.message}` });
      }
    } finally {
      setSyncing(null);
    }
  };

  const connectMicrosoft = async () => {
    const arr      = new Uint8Array(32);
    crypto.getRandomValues(arr);
    const verifier  = btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const hash      = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const stateArr  = new Uint8Array(16);
    crypto.getRandomValues(stateArr);
    const state = btoa(String.fromCharCode(...stateArr)).replace(/[+/=]/g, '');

    sessionStorage.setItem('ms_code_verifier', verifier);
    sessionStorage.setItem('ms_state', state);

    const params = new URLSearchParams({
      client_id:             AZURE_CLIENT_ID,
      response_type:         'code',
      redirect_uri:          window.location.origin,
      scope:                 'https://graph.microsoft.com/User.Read.All offline_access openid',
      state,
      code_challenge:        challenge,
      code_challenge_method: 'S256',
    });
    window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
  };

  const connectOkta = async () => {
    const domain = oktaDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!domain) return;

    const arr      = new Uint8Array(32);
    crypto.getRandomValues(arr);
    const verifier = btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const hash     = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const stateArr = new Uint8Array(16);
    crypto.getRandomValues(stateArr);
    const state = btoa(String.fromCharCode(...stateArr)).replace(/[+/=]/g, '');

    sessionStorage.setItem('okta_code_verifier', verifier);
    sessionStorage.setItem('okta_state', state);
    sessionStorage.setItem('okta_domain', domain);

    const params = new URLSearchParams({
      client_id:             OKTA_CLIENT_ID,
      response_type:         'code',
      scope:                 'openid profile email okta.users.read',
      redirect_uri:          window.location.origin,
      state,
      code_challenge:        challenge,
      code_challenge_method: 'S256',
    });
    window.location.href = `https://${domain}/oauth2/v1/authorize?${params}`;
  };

  const providers = [
    {
      id:        'google',
      name:      'Google Workspace',
      desc:      'Import employees, departments & org structure',
      available: true,
      badge:     null,
      logo: (
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      ),
      action: syncGoogle,
    },
    {
      id:        'microsoft',
      name:      'Microsoft 365',
      desc:      'Sync from Azure AD / Entra ID',
      available: true,
      badge:     null,
      logo: (
        <div className="w-5 h-5 grid grid-cols-2 gap-0.5">
          <div className="bg-[#F25022] rounded-sm"/><div className="bg-[#7FBA00] rounded-sm"/>
          <div className="bg-[#00A4EF] rounded-sm"/><div className="bg-[#FFB900] rounded-sm"/>
        </div>
      ),
      action: connectMicrosoft,
    },
    {
      id:        'okta',
      name:      'Okta',
      desc:      'Import users from Okta directory',
      available: true,
      badge:     null,
      logo: (
        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
          <span className="text-[9px] font-black text-white">OK</span>
        </div>
      ),
      action: () => setOktaStep('domain'),
    },
  ];

  const providerName = cancelledProvider === 'google' ? 'Google Workspace' : cancelledProvider === 'microsoft' ? 'Microsoft 365' : 'Okta';
  const retryAction  = cancelledProvider === 'google' ? syncGoogle : cancelledProvider === 'microsoft' ? connectMicrosoft : () => setOktaStep('domain');

  return (
    <>
    {cancelledProvider && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setCancelledProvider(null)}>
        <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-start gap-4 mb-5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1">{t('ds_sync_not_completed')}</h3>
              <p className="text-sm text-slate-400">
                The {providerName} authorisation was cancelled before completing. Your directory was <strong className="text-white">not synced</strong> and no employees were imported.
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-400 mb-6">{t('ds_sync_try_again_q')}</p>
          <div className="flex gap-3">
            <button
              onClick={() => { setCancelledProvider(null); retryAction(); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-sm text-white transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Try Again
            </button>
            <button
              onClick={() => setCancelledProvider(null)}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-semibold text-sm text-slate-300 transition-colors"
            >
              Cancel Sync
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-500/20 rounded-xl">
          <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-white">{t('ds_directory_sync')}</h3>
          <p className="text-xs text-slate-400">{t('ds_auto_import_idp')}</p>
        </div>
      </div>

      {oktaStep === 'domain' && (
        <div className="mb-4 p-4 bg-slate-800 rounded-xl border border-slate-700">
          <p className="text-sm font-semibold text-white mb-1">{t('ds_connect_okta')}</p>
          <p className="text-xs text-slate-400 mb-3">Enter your Okta organization domain. You'll be redirected to authorize Stacklens to read your directory.</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="company.okta.com"
              value={oktaDomain}
              onChange={e => setOktaDomain(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && connectOkta()}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={connectOkta}
              disabled={!oktaDomain.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Authorize →
            </button>
            <button onClick={() => { setOktaStep(null); setOktaDomain(''); }} className="px-3 py-2 text-slate-400 hover:text-white text-sm rounded-lg transition-colors">
              Cancel
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">Stacklens only reads user directory data — no write access.</p>
        </div>
      )}

      <div className="space-y-2 mb-4">
        {providers.map(p => (
          <button
            key={p.id}
            onClick={p.action}
            disabled={syncing !== null}
            className={cx(
              "group relative flex items-center gap-4 p-4 rounded-xl border transition-all text-left w-full",
              p.available
                ? "border-slate-700 hover:border-blue-500/40 hover:bg-slate-800/60 cursor-pointer"
                : "border-slate-800 opacity-50 cursor-not-allowed"
            )}
          >
            <div className={cx(
              "flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center",
              p.available ? "bg-slate-700/60 border border-slate-600/40" : "bg-slate-800 border border-slate-800"
            )}>
              {p.logo}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-white">{p.name}</span>
                {p.badge && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-medium uppercase tracking-wide">{p.badge}</span>}
              </div>
              <div className="text-xs text-slate-500">{p.desc}</div>
            </div>
            <div className="flex-shrink-0">
              {syncing === p.id ? (
                <div className="h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              ) : p.available ? (
                <svg className="h-4 w-4 text-slate-500 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                </svg>
              ) : (
                <svg className="h-4 w-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>

      {status && (
        <div className={cx(
          "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm",
          status.type === 'success' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' :
          status.type === 'error'   ? 'bg-red-500/15 text-red-400 border border-red-500/20' :
                                      'bg-blue-500/15 text-blue-400 border border-blue-500/20'
        )}>
          {status.type === 'loading' && <div className="h-3.5 w-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
          {status.type === 'success' && <span>✓</span>}
          {status.type === 'error'   && <span>✗</span>}
          <span className="flex-1">{status.msg}</span>
          {status.type !== 'loading' && (
            <button onClick={() => setStatus(null)} className="ml-auto text-slate-500 hover:text-slate-300 flex-shrink-0">✕</button>
          )}
        </div>
      )}
    </div>
    </>
  );
}

function GoogleWorkspaceSync_OLD() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { firebaseUser } = useAuth();
  const muts = useDbMutations();
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncedCount, setSyncedCount] = useState(0);
  const getToken = (u) => u?.stsTokenManager?.accessToken || null;
  const hasPerms = firebaseUser ? getToken(firebaseUser) !== null : false;

  const handleSync = async () => {
    if (!firebaseUser) { setSyncStatus({ type: 'error', message: 'Sign in with Google first.' }); return; }
    const token = getToken(firebaseUser);
    if (!token) { setSyncStatus({ type: 'error', message: 'No access token — sign in with Google.' }); return; }
    setSyncing(true);
    setSyncStatus({ type: 'loading', message: 'Importing from Google Workspace...' });
    try {
      const res = await fetch('https://admin.googleapis.com/admin/directory/v1/users?domain=primary&maxResults=500', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
      const data = await res.json();
      const users = (data.users || []).map(u => ({
        name: u.name.fullName, email: u.primaryEmail,
        status: u.suspended ? 'offboarded' : 'active',
        department: u.orgUnitPath?.split('/').pop() || 'general',
        role: u.isAdmin ? 'admin' : 'user',
        google_user_id: u.id, imported_from: 'google_workspace',
        imported_at: new Date().toISOString(),
      }));
      let count = 0;
      for (const u of users) { try { await muts.addEmployee.mutateAsync(u); count++; } catch {} }
      setSyncedCount(count);
      setSyncStatus({ type: 'success', message: `Imported ${count} users from Google Workspace!` });
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      setSyncStatus({ type: 'error', message: `Sync failed: ${err.message}` });
    } finally { setSyncing(false); }
  };

  if (!firebaseUser) return null;
  return (
    <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-5 lg:p-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-blue-500/20 rounded-xl">
          <RefreshCw className={`h-6 w-6 text-blue-400 ${syncing ? 'animate-spin' : ''}`} />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white">{t("google_workspace_sync")}</h3>
          <p className="text-sm text-slate-300">Import users automatically from Google Workspace</p>
        </div>
        {hasPerms && (
          <button onClick={handleSync} disabled={syncing}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${syncing ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
      </div>
      {!hasPerms && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-sm text-yellow-400">⚠️ Sign in with a Google Workspace admin account to enable sync.</p>
        </div>
      )}
      {syncStatus && (
        <div className={`mt-4 p-4 rounded-xl border ${syncStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20' : syncStatus.type === 'error' ? 'bg-red-500/10 border-red-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
          <p className={`text-sm ${syncStatus.type === 'success' ? 'text-emerald-400' : syncStatus.type === 'error' ? 'text-red-400' : 'text-blue-400'}`}>{syncStatus.message}</p>
          {syncStatus.type === 'success' && syncedCount > 0 && <p className="text-xs text-slate-400 mt-2">Refreshing in 2 seconds...</p>}
        </div>
      )}
    </div>
  );
}



function TourEmptyState({ icon, title, subtitle, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div style={{
        fontSize: 56, marginBottom: 16,
        filter: 'drop-shadow(0 0 20px rgba(99,102,241,0.4))'
      }}>{icon}</div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm max-w-xs mb-6">{subtitle}</p>
      {action && (
        <button
          onClick={onAction}
          style={{
            padding: '10px 24px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

function TourLaunchButton() {
  const { startTour } = useTour();
  return (
    <button
      onClick={startTour}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px', borderRadius: 10,
        background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
        border: 'none', color: 'white', cursor: 'pointer',
        fontSize: 13, fontWeight: 700,
        boxShadow: '0 0 20px rgba(124,58,237,0.4)',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'none'}
    >
      <span style={{ fontSize: 16 }}>✨</span>
      Take the Tour
    </button>
  );
}

// Plan tier hierarchy
// PLAN_TIERS, PLAN_LIMITS, TRIAL_DAYS, TRIAL_MS, resolvePlan, getTrialState, getPlanLimits
// — imported from ./lib/plan

// Hook: returns current usage and limits for the user's plan
function usePlanLimits() {
  const { data: db } = useDbQuery();
  const plan = resolvePlan(db?.user);
  const limits = getPlanLimits(plan);
  const toolCount = db?.tools?.length || 0;
  const employeeCount = db?.employees?.length || 0;
  return {
    plan,
    limits,
    usage: { tools: toolCount, employees: employeeCount },
    canAdd: {
      tool: toolCount < limits.tools,
      employee: employeeCount < limits.employees,
    },
    pct: {
      tools: Math.min(100, Math.round((toolCount / limits.tools) * 100)),
      employees: Math.min(100, Math.round((employeeCount / limits.employees) * 100)),
    },
  };
}


function PlanGate({ requires, children, feature = 'this feature' }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const { user } = useAuth();
  const navigate = useNavigate();
  // Use resolvePlan so trial expiry is respected automatically
  const plan = resolvePlan(user);
  const userTier = PLAN_TIERS[plan] ?? 0;
  const requiredTier = PLAN_TIERS[requires] ?? 1;
  if (userTier >= requiredTier) return children;
  const planNames = { starter: 'Starter', growth: 'Growth', scale: 'Scale', unlimited: 'Unlimited' };
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="text-3xl md:text-6xl mb-4">🔒</div>
      <h2 className="text-2xl font-black text-white mb-2">{t("upgrade_to_access")} {feature}</h2>
      <p className="text-slate-400 mb-6 max-w-md">
        This feature requires the <span className="text-blue-400 font-semibold">{planNames[requires] || requires}</span> plan or higher.
        You're currently on the <span className="text-slate-300 font-semibold">{getPlanLimits(plan).label || plan}</span> plan.
      </p>
      <button onClick={() => { navigate('/settings'); setTimeout(() => { const el = document.querySelector('[data-tab="billing"]'); if(el) el.click(); }, 100); }}
        className="px-4 md:px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20">
        View Plans & Upgrade
      </button>
      <button onClick={() => navigate(-1)} className="mt-3 text-sm text-slate-500 hover:text-slate-300 transition-colors">
        ← Go back
      </button>
    </div>
  );
}


// ── Module Gate ────────────────────────────────────────────────
// Controls access to specific modules (Finance Board, People Board, etc.)
// Checks user.modules array OR falls back to plan tier
const MODULE_PLANS = {
  finance:   ['hr_finance', 'pro', 'enterprise', 'scale', 'unlimited', 'growth'],
  people:    ['hr_finance', 'pro', 'enterprise', 'scale', 'unlimited', 'growth'],
  security:  ['pro', 'enterprise', 'scale', 'unlimited', 'growth'],
  ai:        ['pro', 'enterprise', 'scale', 'unlimited', 'growth'],
  analytics: ['pro', 'enterprise', 'scale', 'unlimited', 'growth'],
};

function ModuleGate({ module, children, feature = 'this module' }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const { user } = useAuth();
  const navigate = useNavigate();
  const plan = resolvePlan(user);

  // Check if plan includes this module
  const allowedPlans = MODULE_PLANS[module] || [];
  const hasAccess = plan === 'trial' || allowedPlans.includes(plan);

  if (hasAccess) return children;

  const moduleNames = {
    finance: t('module_finance'), people: t('module_people'),
    security: t('module_security'), ai: t('module_ai'), analytics: t('module_analytics'),
  };
  const moduleDesc = {
    finance: t('module_desc_finance'), people: t('module_desc_people'),
    security: t('module_desc_security'), ai: t('module_desc_ai'), analytics: t('module_desc_analytics'),
  };
  const isHrFinanceModule = ['finance', 'people'].includes(module);
  const recommendedPlan = isHrFinanceModule ? 'HR & Finance Pack' : 'Pro';
  const recommendedPrice = isHrFinanceModule ? '€49/mo' : '€79/mo';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="text-5xl mb-4">🔒</div>
      <h2 className="text-2xl font-black text-white mb-2">
        {moduleNames[module]} — {t('module_not_included')}
      </h2>
      <p className="text-slate-400 mb-2 max-w-md">{moduleDesc[module]}</p>
      <p className="text-slate-400 mb-6 max-w-md">
        {t('module_available_from')}{' '}
        <span className="text-blue-400 font-semibold">{recommendedPlan}</span>
        {' '}({recommendedPrice})
      </p>
      <button onClick={() => navigate('/app/settings?tab=billing')}
        className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20">
        {t('view_plans_upgrade')}
      </button>
      <button onClick={() => navigate(-1)} className="mt-3 text-sm text-slate-500 hover:text-slate-300 transition-colors">
        ← {t('go_back')}
      </button>
    </div>
  );
}


// ── Plan Limit Banner ─────────────────────────────────────────────
// Shows current usage vs limit, prompts upgrade when near/at cap
function PlanLimitBanner({ resource = 'tools' }) {
  const { plan, limits, usage, pct } = usePlanLimits();
  const navigate = useNavigate();
  const { language } = useLang();
  const t = useTranslation(language);
  const isUnlimited = limits[resource] >= 99999;
  if (isUnlimited) return null;

  const usageNum = usage[resource];
  const limitNum = limits[resource];
  const percent = pct[resource];
  const isFull = usageNum >= limitNum;
  const isNear = percent >= 80;

  if (!isNear && !isFull) return null;

  const tone = isFull ? 'red' : 'amber';
  const Icon = AlertTriangle;

  return (
    <div className={"rounded-2xl border p-4 lg:p-5 flex items-center gap-4 " + (
      tone === 'red' ? 'border-red-500/30 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5'
    )}>
      <div className={"p-2 rounded-lg flex-shrink-0 " + (tone === 'red' ? 'bg-red-500/10' : 'bg-amber-500/10')}>
        <Icon className={"h-5 w-5 " + (tone === 'red' ? 'text-red-400' : 'text-amber-400')} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={"text-sm font-semibold " + (tone === 'red' ? 'text-red-400' : 'text-amber-400')}>
            {isFull ? `${resource} ${t('plan_limit_reached')}` : `${t('plan_limit_approaching')} ${resource} ${t('plan_limit_reached')}`}
          </span>
          <span className="text-xs text-slate-500">— {limits.label} plan</span>
        </div>
        <div className="text-xs text-slate-400 mb-2">
          {t('plan_limit_using')} <span className="font-semibold text-white">{usageNum}</span> of <span className="font-semibold text-white">{limitNum}</span> {resource}
          {isFull ? `. ${t('plan_limit_upgrade_msg')}` : `. ${limitNum - usageNum} ${t('plan_limit_remaining')}.`}
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden max-w-md">
          <div className={"h-full transition-all " + (tone === 'red' ? 'bg-red-500' : 'bg-amber-500')} style={{width: `${percent}%`}} />
        </div>
      </div>
      <button onClick={() => navigate('/settings')}
        className={"px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex-shrink-0 " + (
          tone === 'red' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'
        )}>
        {t('plan_limit_upgrade_btn')}
      </button>
    </div>
  );
}

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
      done: (db?.tools || []).filter(t => t.status !== 'archived').length > 0,
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

  // Auto-dismiss with brief celebration when all steps complete
  React.useEffect(() => {
    if (allDone && !dismissed) {
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

          {/* Progress bar */}
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-5">
            <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }} />
          </div>

          {/* Steps */}
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

function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Translation hook
  const { language, setLanguage } = useLang();
  const t = useTranslation(language);
  const [showImport, setShowImport] = useState(false);
  const [importKind, setImportKind] = useState(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  
  // ADD THESE LINES:
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAssignOwner, setShowAssignOwner] = useState(false);
  const [assignToolId, setAssignToolId] = useState(null);
  const [assignToolName, setAssignToolName] = useState('');
  const [orphanedTools] = useState(['GitHub', 'Figma', 'Notion']);
  const [selectedOwners, setSelectedOwners] = useState({});
  const { data: db, isLoading } = useDbQuery();
  const muts = useDbMutations();
  const qc = useQueryClient();
  const [resetConfirm, setResetConfirm] = useState(false);

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
    const spend = tools.reduce((sum, t) => sum + Number(t.cost_per_month || 0), 0);
    const highRiskTools = tools.filter((t) => t.derived_risk === "high").length;
    const formerAccess = access.filter((a) => a.derived_risk_flag === "former_employee").length;
    return { tools, access, alerts, counts, spend, highRiskTools, formerAccess };
  }, [db, t]);

  const markReviewed = (accId) => {
    muts.updateAccess.mutate(
      { id: accId, patch: { last_reviewed_date: todayISO(), risk_flag: "none" } },
      { onSuccess: () => toast.success(t('toast_marked_reviewed')) }
    );
  };

  const revokeAccess = (accId) => {
    muts.updateAccess.mutate(
      { id: accId, patch: { status: "revoked" } },
      { onSuccess: () => toast.success(t('toast_access_revoked')) }
    );
  };

  return (
    <AppShell title={t('dashboard')} right={
        <div className="flex items-center gap-2">
          <RoleGate requires="editor">
            <Button variant="secondary" size="sm" onClick={() => { setImportKind('tools'); setShowImport(true); }}>
              <Upload className="h-3.5 w-3.5" />{t('import_data')}
            </Button>
          </RoleGate>
          <Button variant="secondary" size="sm" onClick={() => printExecutiveSummary(db, { ...derived, alerts: buildRiskAlerts({ ...(db || {}), tools: derived.tools, access: derived.access }) })} title={t('dl_download_pdf_report')}>
            <FileText className="h-3.5 w-3.5" />{t('dl_pdf_report')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowShareModal(true)} title={t('dl_share_readonly')}>
            <Share2 className="h-3.5 w-3.5" />{t('dl_share_report')}
          </Button>
          <RoleGate requires="admin">
            {resetConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{t('dl_reset_confirm')}</span>
                <ConfirmButtons onConfirm={() => { resetDb(); setResetConfirm(false); }} onCancel={() => setResetConfirm(false)} />
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setResetConfirm(true)} title={t('dl_reset_all_data')}>
                <RefreshCw className="h-3.5 w-3.5" /> {t('reset_data')}
              </Button>
            )}
          </RoleGate>
          <LangSelectorCompact />
        </div>
      }>

                  {/* ══════════════════════════════════════════════════════ */}
      {/* DASHBOARD — IT Director / CTO view                    */}
      {/* Row 1: Directory Sync + Security Score (setup + health)*/}
      {/* Row 2: KPI strip (the numbers)                        */}
      {/* Row 3: Alerts + AI (what's broken + how to fix)       */}
      {/* Row 4: Spend + Shadow IT + Reviews (intelligence)     */}
      {/* Row 5: Quick Actions (take action)                    */}
      {/* ══════════════════════════════════════════════════════ */}

      {/* ── GETTING STARTED — shown to new real users only ── */}
      {db && !db.user?.is_demo && db.user?.is_authenticated && (
        <GettingStartedChecklist db={db} />
      )}

      {/* ── PRIORITY ACTION — the ONE thing to do first ── */}
      {derived.formerAccess > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-orange-500/5 to-transparent p-5 lg:p-6 mb-6">
          <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-rose-500/5 to-transparent pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-rose-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400">{t('ui_priority_act_now')}</span>
                </div>
                <h2 className="text-xl lg:text-2xl font-bold text-white mb-1">
                  {derived.formerAccess} {derived.formerAccess === 1 ? t('ui_ex_employee') : t('ui_ex_employees')} {t('ui_can_still_access')}
                </h2>
                <p className="text-sm text-slate-400">
                  {t('ui_priority_risk_body')}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <Button
                onClick={() => navigate('/offboarding')}
                className="w-full lg:w-auto !bg-rose-500 hover:!bg-rose-400 !text-white !px-6 !py-3 !font-bold shadow-lg shadow-rose-900/30">
                {t('ui_remove_their_access')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sample data active banner */}
      {db?._is_sample_data && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 mb-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm">
          <div className="flex items-center gap-2 text-amber-300">
            <span>⚡</span>
            <span className="font-semibold">{t('dl_sample_data_active')}</span>
            <span className="text-amber-400/70 hidden sm:inline">{t('dl_sample_example_data')}</span>
          </div>
          <button
            onClick={async () => {
              const existing = loadDb();
              const cleared = { ...existing, tools: [], employees: [], access: [], _is_sample_data: false };
              saveDb(cleared);
              qc.invalidateQueries({ queryKey: ['db'] });
              if (_firestoreUid) { try { await saveUserData(_firestoreUid, cleared); } catch(e) {} }
              toast.success(t('toast_sample_cleared'));
            }}
            className="text-xs font-semibold text-amber-300 hover:text-white border border-amber-500/40 hover:border-amber-400 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap">
            {t('dl_clear_import_real')}
          </button>
        </div>
      )}

      {/* Empty state — two clear paths */}
      {derived.tools.length === 0 && !db?._is_sample_data && (
        <div className="mb-6">
          <div className="text-center mb-6 pt-4">
            <div className="text-4xl mb-3">🔍</div>
            <h2 className="text-2xl font-bold text-white mb-2">{t('dl_welcome_stacklens')}</h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto">{t('dl_dashboard_empty')}</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {/* Option 1 — sample data */}
            <button
              onClick={() => {
                loadSampleDataForUser();
                qc.invalidateQueries({ queryKey: ['db'] });
                toast.success(t('toast_sample_loaded'));
              }}
              className="group flex flex-col items-start gap-3 p-6 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/50 transition-all text-left">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xl">✨</div>
              <div>
                <div className="font-bold text-white mb-1">{t('dl_explore_sample')}</div>
                <div className="text-xs text-slate-400 leading-relaxed">{t('dl_explore_sample_desc')}</div>
              </div>
              <div className="mt-auto text-xs font-semibold text-indigo-400 group-hover:text-indigo-300 transition-colors">{t('dl_load_instantly')}</div>
            </button>

            {/* Option 2 — real import */}
            <button
              onClick={() => { setImportKind('company'); setShowImport(true); }}
              className="group flex flex-col items-start gap-3 p-6 rounded-2xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all text-left">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xl">📂</div>
              <div>
                <div className="font-bold text-white mb-1">{t('dl_import_real_data')}</div>
                <div className="text-xs text-slate-400 leading-relaxed">{t('dl_import_real_desc')}</div>
              </div>
              <div className="mt-auto text-xs font-semibold text-blue-400 group-hover:text-blue-300 transition-colors">{t('dl_upload_file_arrow')}</div>
            </button>
          </div>

          {/* What you'll see */}
          <div className="mt-6 max-w-2xl mx-auto grid grid-cols-3 gap-3">
            {[
              { icon: '💸', label: t('dl_monthly_saas_spend') },
              { icon: '⚠️', label: t('dl_security_risk_alerts') },
              { icon: '🔑', label: t('dl_access_control_map') },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
                <span>{icon}</span>{label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Row 1: Directory Sync + Security Score ── */}
      {/* "Is my data connected? Am I safe?" */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 mb-6">

        {/* Directory Sync — the foundation of everything */}
        <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-900 to-blue-950/20 p-5 lg:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/20 rounded-xl">
              <Activity className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <span className="text-base font-semibold text-slate-100 block">{t('dl_directory_sync')}</span>
              <span className="text-xs text-slate-500">{t('dl_directory_sync_desc')}</span>
            </div>
          </div>
          <WorkspaceConnector compact={true} />
        </div>

        {/* Security Score — the north star */}
        {(() => {
          const totalTools = (derived?.tools || []).length;
          const totalEmployees = (derived?.access || []).length > 0 ? new Set((derived?.access || []).map(a => a.employee_id)).size : 0;
          const hasData = totalTools > 0 || totalEmployees > 0;
          const orphanedTools = (derived?.tools || []).filter(t => !t.owner_email).length;
          const formerAccess = derived?.formerAccess || 0;
          const highRiskTools = (derived?.tools || []).filter(t => t.derived_risk === 'high').length;

          // Real security score: 100 minus penalties
          const score = hasData ? Math.max(0, Math.min(100, 100 - (orphanedTools * 10) - (highRiskTools * 5) - (formerAccess * 8))) : null;
          const scoreColor = score === null ? '#475569' : score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
          const scoreLabel = score === null ? t('dl_no_data') : score >= 80 ? t('dl_good') : score >= 60 ? t('dl_needs_work') : t('dl_critical');
          const labelBg = score === null ? 'bg-slate-700/40 text-slate-400' : score >= 80 ? 'bg-emerald-500/20 text-emerald-400' : score >= 60 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400';

          // MFA coverage: % of tools with MFA enabled
          const toolsWithMfa = (derived?.tools || []).filter(t => t.mfa_required || t.mfa_enabled).length;
          const mfaCoverage = totalTools > 0 ? Math.round((toolsWithMfa / totalTools) * 100) : null;

          // Access reviews: count tools where last_reviewed > 90 days ago
          const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
          const overdueReviews = (derived?.access || []).filter(a => {
            if (!a.last_reviewed_date) return true;
            return new Date(a.last_reviewed_date).getTime() < ninetyDaysAgo;
          }).length;

          return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-semibold text-slate-100">{t('security_score') || 'Security Score'}</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${labelBg}`}>
              {scoreLabel}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative w-28 h-28 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="8"/>
                <circle cx="50" cy="50" r="40" fill="none"
                  stroke={scoreColor}
                  strokeWidth="8"
                  strokeDasharray={`${2*Math.PI*40}`}
                  strokeDashoffset={`${2*Math.PI*40*(1-(score||0)/100)}`}
                  strokeLinecap="round"/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-white">{score === null ? '—' : score}</span>
                <span className="text-xs text-slate-500">/ 100</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {[
                {label:t('dl_mfa_coverage'), value: mfaCoverage === null ? '—' : `${mfaCoverage}%`, color: mfaCoverage === null ? 'text-slate-500' : mfaCoverage >= 80 ? 'text-emerald-400' : 'text-amber-400'},
                {label:t('dl_access_reviews'), value: !hasData ? '—' : overdueReviews > 0 ? `${overdueReviews} ${t('dl_overdue')}` : t('dl_on_track'), color: !hasData ? 'text-slate-500' : overdueReviews > 0 ? 'text-red-400' : 'text-emerald-400'},
                {label:t('dl_ex_employees_access'), value:`${formerAccess} ${t('dl_active_suffix')}`, color: formerAccess > 0 ? 'text-red-400' : 'text-emerald-400'},
                {label:t('dl_tools_without_owners'), value:`${orphanedTools}`, color: orphanedTools > 0 ? 'text-amber-400' : 'text-emerald-400'},
              ].map((row,i)=>(
                <div key={i} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-slate-400">{row.label}</span>
                  <span className={`font-semibold ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
          <Link to="/security" className="block mt-4">
            <Button variant="secondary" className="w-full text-sm">{hasData ? t('dl_review_my_score') : t('dl_set_up_score')}</Button>
          </Link>
        </div>
          );
        })()}
      </div>

      {/* ── Row 2: KPI Strip ── */}
      {/* "Give me the numbers at a glance" */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 mb-6">
        {[
          { label: t('security_alerts') || 'Security Alerts', value: derived?.alerts?.length || 0, sub: `${derived?.counts?.critical||0} critical · ${derived?.counts?.high||0} high`, color: 'border-l-red-500', vcolor: 'text-red-400', link: '/security' },
          { label: t('dl_wasted_spend'), value: getCurrency(language) + convertCurrency(Math.round((derived?.spend||0)*0.14), language).toLocaleString(), sub: t('dl_idle_licenses'), color: 'border-l-amber-500', vcolor: 'text-amber-400', link: '/tools' },
          { label: t('monthly_spend') || 'Monthly Spend', value: getCurrency(language) + convertCurrency(derived?.spend||0, language).toLocaleString(), sub: getCurrency(language) + convertCurrency((derived?.spend||0)*12, language).toLocaleString() + '/yr', color: 'border-l-emerald-500', vcolor: 'text-emerald-400', link: '/finance' },
        ].map((kpi, i) => (
          <Link key={i} to={kpi.link}>
            <div className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6 border-l-4 ${kpi.color} hover:border-slate-700 hover:bg-slate-900/80 transition-all cursor-pointer group`}>
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-2">{kpi.label}</div>
                <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
              </div>
              <div className={`text-3xl lg:text-4xl font-black ${kpi.vcolor}`}>{kpi.value}</div>
              <div className="text-sm text-slate-500 mt-1.5">{kpi.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Action Inbox — "What needs my attention right now?" ── */}
      {(() => {
        // Build action items from real data
        const actions = [];

        // 1. Ex-employees with active access
        const formerWithAccess = (derived?.access || []).filter(a => a.derived_risk_flag === 'former_employee' && a.status === 'active');
        formerWithAccess.forEach(a => {
          actions.push({
            id: 'former-' + a.id,
            severity: 'critical',
            icon: '🔴',
            title: `${a.employee_name || t('ui_ex_employee')} ${t('action_still_has_access')} ${a.tool_name || 'a tool'}`,
            reason: t('action_former_reason'),
            action: t('action_revoke_access'),
            onAction: () => { muts.updateAccess.mutate({ id: a.id, patch: { status: 'revoked' } }, { onSuccess: () => toast.success(t('toast_access_revoked')) }); },
            link: '/offboarding',
          });
        });

        // 2. Tools with no owner
        const unownedTools = (derived?.tools || []).filter(tool => !tool.owner_email);
        unownedTools.slice(0, 5).forEach(tool => {
          actions.push({
            id: 'noowner-' + tool.id,
            severity: 'high',
            icon: '🟡',
            title: `${tool.name} ${t('action_no_owner')}`,
            reason: t('action_no_owner_reason').replace('{cost}', `${getCurrency(language)}${convertCurrency(tool.cost_per_month || 0, language).toLocaleString()}`),
            action: t('action_assign_owner'),
            toolId: tool.id,
            toolName: tool.name,
            needsOwner: true,
            link: '/tools',
          });
        });

        // 3. High-risk tools without MFA
        const highRiskNoMfa = (derived?.tools || []).filter(tool => tool.derived_risk === 'high' && !tool.mfa_required && !tool.mfa_enabled);
        highRiskNoMfa.slice(0, 3).forEach(tool => {
          actions.push({
            id: 'mfa-' + tool.id,
            severity: 'high',
            icon: '🛡️',
            title: `${tool.name} ${t('action_high_risk_no_mfa')}`,
            reason: t('action_mfa_reason').replace('{risk}', tool.derived_risk || '').replace('{date}', tool.last_used_date || t('unknown')),
            action: t('action_review'),
            link: '/security',
          });
        });

        // 4. Budget cap exceeded
        const _budgetCap = db?.user?.budget_cap || parseInt(localStorage.getItem('sg_budget_cap') || '0') || 0;
        const _notifBudget = (() => { try { return JSON.parse(localStorage.getItem('sg_notifications') || '{}'); } catch { return {}; } })().budget ?? true;
        if (_budgetCap > 0 && _notifBudget && (derived?.spend || 0) > _budgetCap) {
          const pct = Math.round((derived.spend / _budgetCap) * 100);
          actions.push({
            id: 'budget-exceeded',
            severity: 'high',
            icon: '💰',
            title: `Monthly spend is ${pct}% of your budget cap`,
            reason: `You've set a ${getCurrency(language)}${convertCurrency(_budgetCap, language).toLocaleString()}/mo cap. Current spend is ${getCurrency(language)}${convertCurrency(derived.spend, language).toLocaleString()}.`,
            action: 'View Finance',
            link: '/finance',
          });
        }

        // 5. Idle licenses (tools with cost but not used in 60+ days)
        const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);
        const idleTools = (derived?.tools || []).filter(tool => {
          if (!tool.cost_per_month || tool.cost_per_month <= 0) return false;
          if (!tool.last_used_date) return true;
          return new Date(tool.last_used_date).getTime() < sixtyDaysAgo;
        });
        idleTools.slice(0, 3).forEach(tool => {
          actions.push({
            id: 'idle-' + tool.id,
            severity: 'medium',
            icon: '💸',
            title: `${tool.name} — ${getCurrency(language)}${convertCurrency(tool.cost_per_month || 0, language).toLocaleString()}/mo ${t('action_possibly_wasted')}`,
            reason: t('action_idle_reason').replace('{date}', tool.last_used_date || t('never')),
            action: t('action_review_tool'),
            link: '/tools',
          });
        });

        if (actions.length === 0) return null;

        // Sort: critical first, then high, then medium
        const order = { critical: 0, high: 1, medium: 2 };
        actions.sort((a, b) => (order[a.severity] || 3) - (order[b.severity] || 3));

        return (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-red-500/20 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                </div>
                <span className="text-base font-semibold text-slate-100">{t('action_inbox') || 'Action inbox'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-semibold">{actions.length}</span>
              </div>
              <span className="text-xs text-slate-500">{t('action_inbox_sub') || 'Items needing your attention'}</span>
            </div>
            <div className="space-y-2.5">
              {actions.slice(0, 8).map((item) => (
                <div key={item.id} className={`flex items-start gap-3 rounded-xl p-3.5 border transition-colors ${
                  item.severity === 'critical' ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40' :
                  item.severity === 'high' ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40' :
                  'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}>
                  <span className="text-sm mt-0.5 flex-shrink-0">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-100">{item.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.reason}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.needsOwner ? (
                      <button onClick={() => { setAssignToolId(item.toolId); setAssignToolName(item.toolName); setShowAssignOwner(true); }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-xs font-semibold transition-colors">
                        {item.action}
                      </button>
                    ) : item.onAction ? (
                      <button onClick={item.onAction}
                        className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-semibold transition-colors">
                        {item.action}
                      </button>
                    ) : (
                      <Link to={item.link}>
                        <span className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-xs font-semibold transition-colors inline-block">
                          {item.action}
                        </span>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {actions.length > 8 && (
              <div className="mt-3 text-center">
                <Link to="/security" className="text-xs text-blue-400 hover:text-blue-300">{t('dl_view_all_items')} {actions.length} {t('dl_items_arrow')}</Link>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Row 3: Critical Alerts + AI Recommendations ── */}
      {/* "What's broken and how do I fix it?" */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-5 mb-6">
        <div className="lg:col-span-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-base font-semibold text-slate-100">{t('critical_alerts') || 'Critical Alerts'}</span>
            </div>
            <Pill tone="blue" icon={Sparkles}>{t('live')}</Pill>
          </div>
          <div className="space-y-2.5">
            {derived?.alerts?.length ? derived.alerts.slice(0,4).map((a) => (
              <div key={a.id} className={`flex items-start gap-3 rounded-xl p-3.5 border transition-colors hover:border-slate-700 ${a.severity === 'critical' ? 'bg-red-500/5 border-red-500/20' : 'bg-slate-950/40 border-slate-800'}`}>
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${a.severity === 'critical' ? 'bg-red-400' : 'bg-amber-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-100">{a.title}</div>
                  <div className="text-sm text-slate-500 mt-0.5 line-clamp-2">{a.body}</div>
                </div>
                <Link to={a.action.to} className="text-sm text-blue-400 hover:text-blue-300 flex-shrink-0 font-medium mt-0.5">{t('dl_fix_arrow')}</Link>
              </div>
            )) : (
              <div className="flex items-center gap-3 rounded-xl p-4 bg-emerald-500/5 border border-emerald-500/20">
                <BadgeCheck className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                <div className="text-sm text-emerald-400 font-semibold">{t('dl_all_clear_no_critical')}</div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-900 to-blue-950/20 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-500/20 rounded-lg">
                <Sparkles className="h-4 w-4 text-purple-400" />
              </div>
              <span className="text-base font-semibold text-slate-100">{t('dl_ai_recommendations')}</span>
            </div>
            <span className="text-xs text-slate-500">{t('dl_powered_by_claude')}</span>
          </div>
          <AIRecommendations tools={derived?.tools||[]} employees={db?.employees||[]} access={db?.access||[]} compact={true} />
        </div>
      </div>

      {/* ── Row 4: Spend + Shadow IT + Overdue Reviews ── */}
      {/* "Where is my money going? What don't I know about?" */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 mb-6">

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-semibold text-slate-100">{t('spend_trend') || 'Spend by Category'}</span>
            <span className="text-xs text-slate-500">{t('monthly')}</span>
          </div>
          {(derived?.tools||[]).length === 0 ? (
            <div className="text-center py-6 mb-4">
              <div className="text-3xl mb-2 opacity-40">💸</div>
              <div className="text-sm text-slate-400 mb-1">{t('dl_no_spend_data')}</div>
              <div className="text-xs text-slate-600">{t('dl_import_tools_spending')}</div>
            </div>
          ) : (
            <div className="space-y-3 mb-4">
              {Object.entries((derived?.tools||[]).reduce((acc,t)=>{const c=t.category||'other';acc[c]=(acc[c]||0)+(t.cost_per_month||0);return acc},{})).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([cat,spend],i)=>(
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400 capitalize">{cat}</span>
                    <span className="text-slate-200 font-medium">{getCurrency(language)}{convertCurrency(spend||0,language).toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{width:`${Math.min(100,Math.round((spend/(derived?.spend||1))*100))}%`}} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link to="/finance">
            <Button variant="secondary" className="w-full text-sm">{t('dl_dig_into_numbers')}</Button>
          </Link>
        </div>

        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-semibold text-slate-100">{t('dl_shadow_it_detected')}</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold">{t('badge_new')}</span>
          </div>
          {(() => {
            // Real shadow IT detection: tools tagged as 'shadow' or marked 'unsanctioned'
            const shadowTools = (derived?.tools||[]).filter(t => t.is_shadow || t.tag === 'shadow' || t.status === 'unsanctioned' || t.discovery_source === 'detected').slice(0, 3);
            if (shadowTools.length === 0) {
              return (
                <div className="text-center py-6 mb-4">
                  <div className="text-3xl mb-2 opacity-40">🔍</div>
                  <div className="text-sm text-slate-400 mb-1">{t('dl_no_shadow_it')}</div>
                  <div className="text-xs text-slate-600">{t('dl_import_tools_scan')}</div>
                </div>
              );
            }
            return (
              <div className="space-y-2.5 mb-4">
                {shadowTools.map((app, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/50">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-300 flex-shrink-0">{(app.name||'?')[0]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-200 truncate">{app.name}</div>
                      <div className="text-xs text-slate-500">{app.user_count || 0} employees</div>
                    </div>
                    <span className="text-xs font-semibold text-amber-400">{t('dl_unsanctioned')}</span>
                  </div>
                ))}
              </div>
            );
          })()}
          <Button variant="secondary" className="w-full text-sm" onClick={()=>toast(t('dl_shadow_report_soon'), { icon: '🔜' })}>{t('dl_see_behind')}</Button>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-semibold text-slate-100">{t('overdue_reviews') || 'Overdue Reviews'}</span>
            <span className="text-sm text-slate-500">{(derived?.access||[]).filter(a=>a.status==='active').length} {t('dl_pending_suffix')}</span>
          </div>
          {(derived?.access||[]).filter(a=>a.status==='active').length === 0 ? (
            <div className="text-center py-6 mb-4">
              <div className="text-3xl mb-2 opacity-40">📋</div>
              <div className="text-sm text-slate-400 mb-1">{t('dl_no_reviews_pending')}</div>
              <div className="text-xs text-slate-600">{t('dl_import_access_reviews')}</div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {(derived?.access||[]).filter(a=>a.status==='active').slice(0,3).map((a)=>(
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950/30">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {(a.employee_name||'?').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-200 truncate">{a.tool_name}</div>
                    <div className="text-xs text-slate-500 truncate">{a.employee_name}</div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={()=>markReviewed(a.id)} className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs transition-colors">✓</button>
                    <button onClick={()=>revokeAccess(a.id)} className="px-2.5 py-1.5 rounded-lg border border-red-800 bg-red-900/30 text-red-400 hover:bg-red-900/50 text-xs transition-colors">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link to="/access" className="block mt-4">
            <Button variant="secondary" className="w-full text-sm">{t('dl_review_pending_access')}</Button>
          </Link>
        </div>
      </div>

      {/* ── Row 5: Quick Actions ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-base font-semibold text-slate-100">{t('quick_actions') || 'Quick Actions'}</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Link to="/offboarding" className="w-full">
            <Button variant="secondary" className="w-full justify-start text-sm py-3"><UserMinus className="h-4 w-4" />{t('revoke_departing_access') || 'Revoke Departing Access'}</Button>
          </Link>
          <Link to="/access" className="w-full">
            <Button className="w-full justify-start text-sm py-3"><GitMerge className="h-4 w-4" />{t('review_admin_access') || 'Review Admin Access'}</Button>
          </Link>
          <Link to="/tools" className="w-full">
            <Button variant="secondary" className="w-full justify-start text-sm py-3"><Boxes className="h-4 w-4" />{t('assign_owners') || 'Assign Tool Owners'}</Button>
          </Link>
          <Link to="/licenses" className="w-full">
            <Button variant="secondary" className="w-full justify-start text-sm py-3"><Activity className="h-4 w-4" />{t('reclaim_licenses') || 'Reclaim Idle Licenses'}</Button>
          </Link>
        </div>
      </div>

{showImport && importKind && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={()=>setShowImport(false)}><div className="bg-slate-950 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative" onClick={e=>e.stopPropagation()}><button onClick={()=>setShowImport(false)} className="absolute top-4 right-4 w-8 h-8 bg-slate-800 rounded-lg text-slate-400 hover:text-white">x</button><ImportWizard defaultKind={importKind} onDone={()=>{setShowImport(false);setImportKind(null);}} /></div></div>)}
      {/* ── Assign Owner Modal ── */}
      <Modal
        open={showAssignOwner}
        title={t('dl_assign_tool_owner')}
        subtitle={`${t('dl_who_should_own')} ${assignToolName}?`}
        onClose={() => setShowAssignOwner(false)}
        footer={
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setShowAssignOwner(false)}>{t('cancel')}</Button>
          </div>
        }
      >
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {(db?.employees || []).filter(e => e.status === 'active').map(emp => (
            <button key={emp.id}
              onClick={() => {
                if (assignToolId) {
                  muts.updateTool.mutate(
                    { id: assignToolId, patch: { owner_email: emp.email, owner_name: emp.full_name } },
                    { onSuccess: () => { toast.success(`${emp.full_name} ${t('assign_is_now_owner')} ${assignToolName}`); setShowAssignOwner(false); } }
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
                <div className="text-xs text-slate-500 truncate">{emp.email} · {emp.department || t('no_dept')}</div>
              </div>
            </button>
          ))}
          {(db?.employees || []).filter(e => e.status === 'active').length === 0 && (
            <div className="text-center py-6 text-sm text-slate-500">{t("assign_no_active_employees")}</div>
          )}
        </div>
      </Modal>

      {showShareModal && (
        <ShareReportModal onClose={() => setShowShareModal(false)} db={db} user={user} />
      )}

    </AppShell>
  );
}

function ToolForm({ initial, employees, onSubmit, onClose }) {
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
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('th_status')}</div>
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
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('th_url')}</div>
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
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('fl_cost_per_month')}</div>
          <Input
            type="number"
            value={form.cost_per_month}
            onChange={(e) => setForm((f) => ({ ...f, cost_per_month: e.target.value }))}
          />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('fl_notes')}</div>
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

// Inline confirm: replaces ugly window.confirm with a small in-place "Sure? ✓ ✗" UI
function useConfirm() {
  const [pendingId, setPendingId] = useState(null);
  return {
    isPending: (id) => pendingId === id,
    ask: (id) => setPendingId(id),
    cancel: () => setPendingId(null),
    reset: () => setPendingId(null),
  };
}
function ConfirmButtons({ onConfirm, onCancel }) {
  return (
    <div className="flex gap-1 items-center">
      <button onClick={onCancel} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors text-xs font-bold" title="Cancel">✗</button>
      <button onClick={onConfirm} className="p-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors text-xs font-bold" title="Confirm">✓</button>
    </div>
  );
}

function ToolsPage() {
  const { data: db, isLoading } = useDbQuery();
  const { language, setLanguage } = useLang();
  const t = useTranslation(language);
  const tr = t;
  const muts = useDbMutations();

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [risk, setRisk] = useState("");
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const toggleSort = (field) => { if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortDir('asc'); } };
  const PAGE_SIZE = 25;
  const searchRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expandedTool, setExpandedTool] = useState(null);
  const [showToolOwnerModal, setShowToolOwnerModal] = useState(false);
  const deleteConfirm = useConfirm();
  const revokeConfirm = useConfirm();
  const [editingCost, setEditingCost] = useState(null);
  const [costValue, setCostValue] = useState('');
  const [ownerToolId, setOwnerToolId] = useState(null);
  const [ownerToolName, setOwnerToolName] = useState('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const navigate = useNavigate();

  // Get employees who have access to a specific tool (for drill-down)
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
        if (onlyUnassigned && t.owner_email) return false;
        return true;
      })
      .sort((a, b) => {
        let av, bv;
        if (sortField === 'cost') { av = a.cost_per_month || 0; bv = b.cost_per_month || 0; return sortDir === 'asc' ? av - bv : bv - av; }
        if (sortField === 'risk') { const o = { high: 0, medium: 1, low: 2 }; av = o[a.derived_risk] ?? 3; bv = o[b.derived_risk] ?? 3; return sortDir === 'asc' ? av - bv : bv - av; }
        if (sortField === 'status') { av = a.derived_status || ''; bv = b.derived_status || ''; }
        else { av = a.name || ''; bv = b.name || ''; }
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
  }, [tools, q, cat, status, risk, onlyUnassigned, sortField, sortDir]);

  React.useEffect(() => { setPage(0); }, [q, cat, status, risk, onlyUnassigned]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Category stats — only show ones with tools
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

  if (isLoading) return (
    <AppShell title={t("nav_tools")}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 h-24 animate-pulse" />)}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
          {[...Array(8)].map((_, i) => <SkeletonRow key={i} cols={6} />)}
        </div>
      </div>
    </AppShell>
  );

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
          <div className={`rounded-2xl border bg-slate-900/60 p-5 border-l-4 border-l-blue-500 cursor-pointer hover:border-slate-600 transition-all ${!risk && !status && !cat && !onlyUnassigned ? 'border-blue-500/60 ring-1 ring-blue-500/30' : 'border-slate-800'}`}
            onClick={() => { setRisk(''); setStatus(''); setCat(''); setQ(''); setOnlyUnassigned(false); }}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_total_tools")}</div>
            <div className="text-3xl font-black text-white">{tools.length}</div>
            <div className="text-sm text-slate-500">{tools.filter(t => t.derived_status === 'active').length} {tr('active')}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-emerald-500 cursor-pointer hover:border-slate-600 transition-all"
            onClick={() => navigate('/finance')}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_monthly_spend")}</div>
            <div className="text-3xl font-black text-emerald-400">{getCurrency(language)}{convertCurrency(Math.round(totalCost), language).toLocaleString()}</div>
            <div className="text-sm text-slate-500">{getCurrency(language)}{convertCurrency(Math.round(totalCost*12), language).toLocaleString()}/yr</div>
          </div>
          <div className={`rounded-2xl border bg-slate-900/60 p-5 border-l-4 border-l-red-500 cursor-pointer hover:border-slate-600 transition-all ${risk === 'high' ? 'border-red-500/60 ring-1 ring-red-500/30' : 'border-slate-800'}`}
            onClick={() => { setRisk(risk === 'high' ? '' : 'high'); setOnlyUnassigned(false); }}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_high_risk")}</div>
            <div className="text-3xl font-black text-red-400">{highRiskCount}</div>
            <div className="text-sm text-slate-500">{t("sub_click_to_filter")}</div>
          </div>
          <div className={`rounded-2xl border bg-slate-900/60 p-5 border-l-4 border-l-amber-500 cursor-pointer hover:border-slate-600 transition-all ${onlyUnassigned ? 'border-amber-500/60 ring-1 ring-amber-500/30' : 'border-slate-800'}`}
            onClick={() => { setOnlyUnassigned(v => !v); setRisk(''); }}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_unassigned")}</div>
            <div className="text-3xl font-black text-amber-400">{unassignedCount}</div>
            <div className="text-sm text-slate-500">{t("sub_click_to_filter")}</div>
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
                {tr('all_filter')} ({tools.length})
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
              <input ref={searchRef} className="w-full pl-9 pr-16 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"
                placeholder={t("search_placeholder_tools")} value={q} onChange={(e) => setQ(e.target.value)} />
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-700 rounded border border-slate-600">⌘K</kbd>
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
            <span className="text-xs text-slate-500 whitespace-nowrap">{filtered.length} {tr('found_count')}</span>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-2"><SkeletonRow cols={6} /><SkeletonRow cols={6} /><SkeletonRow cols={6} /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12">
              <EmptyState icon={Boxes} title={tools.length === 0 ? t('no_tools_found') : t('no_results')} body={tools.length === 0 ? t('no_tools_body') : t('try_adjusting_filters')}
                action={tools.length === 0 ? (
                  <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors">
                    <Plus className="h-4 w-4" />{t('add_tool')}
                  </button>
                ) : (
                  <button onClick={() => { setQ(''); setRisk(''); setStatus(''); setCat(''); setOnlyUnassigned(false); }} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-semibold transition-colors">
                    {t('clear_filter')}
                  </button>
                )}
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50">
                      {[['name', t('tool_name'), 'left'], ['', t('th_owner'), 'left hidden md:table-cell'], ['', t('th_last_used'), 'left hidden lg:table-cell'], ['risk', t('th_risk'), 'center'], ['status', t('th_status'), 'center hidden sm:table-cell'], ['cost', t('th_cost_mo'), 'right']].map(([field, label, align]) => (
                        <th key={label} className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider ${align.includes('center') ? 'text-center' : align.includes('right') ? 'text-right' : 'text-left'} ${align.includes('hidden') ? align.split(' ').filter(c=>c.startsWith('hidden')||c.startsWith('md')||c.startsWith('lg')||c.startsWith('sm')).join(' ') : ''} ${field ? 'cursor-pointer select-none hover:text-slate-300' : ''} text-slate-500 transition-colors`}
                          onClick={() => field && toggleSort(field)}>
                          <span className="inline-flex items-center gap-1">{label}{field && (sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕')}</span>
                        </th>
                      ))}
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('th_actions')}</th>
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
                          ) : <button onClick={(ev) => { ev.stopPropagation(); setOwnerToolId(t.id); setOwnerToolName(t.name); setShowToolOwnerModal(true); }} className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors">{tr('tools_assign_owner')}</button>}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-400 hidden lg:table-cell">{t.last_used_date || '—'}</td>
                        <td className="py-3 px-4 text-center"><RiskBadge risk={t.derived_risk} /></td>
                        <td className="py-3 px-4 text-center hidden sm:table-cell"><StatusBadge status={t.derived_status} /></td>
                        <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(ev) => ev.stopPropagation()}>
                          {editingCost === t.id ? (
                            <input autoFocus type="number" min="0" value={costValue}
                              className="w-24 text-right bg-slate-700 border border-blue-500 text-white text-sm rounded-lg px-2 py-1 focus:outline-none"
                              onChange={e => setCostValue(e.target.value)}
                              onBlur={() => { muts.updateTool.mutate({ id: t.id, patch: { cost_per_month: Number(costValue) } }); setEditingCost(null); }}
                              onKeyDown={e => { if (e.key === 'Enter') { muts.updateTool.mutate({ id: t.id, patch: { cost_per_month: Number(costValue) } }); setEditingCost(null); } if (e.key === 'Escape') setEditingCost(null); }} />
                          ) : (
                            <span className="text-sm font-semibold text-white cursor-pointer hover:text-blue-400 transition-colors" title={tr('edit') + ' cost'}
                              onClick={() => { setEditingCost(t.id); setCostValue(String(t.cost_per_month || 0)); }}>
                              {getCurrency(language)}{convertCurrency(t.cost_per_month || 0, language).toLocaleString()}
                              <span className="ml-1 text-slate-600 text-[10px]">✎</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex gap-1 justify-end" onClick={(ev) => ev.stopPropagation()}>
                            <button onClick={() => { setEditing(t); setOpen(true); }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" title={tr('edit')}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            {deleteConfirm.isPending(t.id) ? (
                              <ConfirmButtons onConfirm={() => { muts.deleteTool.mutate(t.id); toast.success(`${t.name} ${tr('toast_deleted')}`); deleteConfirm.reset(); }} onCancel={deleteConfirm.cancel} />
                            ) : (
                            <button onClick={() => deleteConfirm.ask(t.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-400 transition-colors" title={tr('delete')}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            )}
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
                                        {tr('why_risk_label') || `Why this tool is ${t.derived_risk} risk`}
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
                                <h4 className="text-sm font-semibold text-purple-400">{tr('drill_employees_using')} {t.name} ({getToolEmployees(t.id, t.name).length})</h4>
                                <Link to="/employees" className="text-xs text-slate-500 hover:text-purple-400 transition-colors">{tr("drill_view_all_employees")} →</Link>
                              </div>
                              {(() => {
                                const toolEmps = getToolEmployees(t.id, t.name);
                                if (toolEmps.length === 0) return (
                                  <div className="text-center py-4 text-sm text-slate-500">{tr("drill_no_employees")}</div>
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
                                          {revokeConfirm.isPending(emp.id) ? (
                                            <ConfirmButtons onConfirm={() => { muts.deleteAccess.mutate(emp.id); revokeConfirm.reset(); }} onCancel={revokeConfirm.cancel} />
                                          ) : (
                                          <button onClick={(ev) => { ev.stopPropagation(); revokeConfirm.ask(emp.id); }}
                                            className="p-1 rounded-lg bg-slate-800 hover:bg-red-600/20 text-slate-500 hover:text-red-400 transition-colors" title={tr('revoke_access_btn')}>
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                          )}
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
                    {tr('page_showing')} {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} {tr('page_of')} {filtered.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(0)} disabled={page === 0}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      {tr("page_first")}
                    </button>
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      {tr("page_prev")}
                    </button>
                    <span className="px-3 py-1 text-xs text-slate-300 font-semibold">
                      {tr('page_label')} {page + 1} / {totalPages}
                    </span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      {tr("page_next")}
                    </button>
                    <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      {tr("page_last")}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal open={open} title={editing ? tr('edit_tool_btn') : tr('add_tool_btn')} subtitle={tr('tool_inventory_sub')} onClose={() => setOpen(false)}>
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
        title={t('dl_assign_tool_owner')}
        subtitle={`${t('dl_who_should_own')} ${ownerToolName}?`}
        onClose={() => setShowToolOwnerModal(false)}
        footer={
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setShowToolOwnerModal(false)}>{t('cancel')}</Button>
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
                    { onSuccess: () => { toast.success(`${emp.full_name} ${t('assign_is_now_owner')} ${ownerToolName}`); setShowToolOwnerModal(false); } }
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
                <div className="text-xs text-slate-500 truncate">{emp.email} · {emp.department || t('no_dept')}</div>
              </div>
            </button>
          ))}
          {employees.filter(e => e.status === 'active').length === 0 && (
            <div className="text-center py-6 text-sm text-slate-500">{t("assign_no_active_employees")}</div>
          )}
        </div>
      </Modal>

    </AppShell>
  );
}

function EmployeeForm({ initial, onSubmit, onClose }) {
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
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('th_email')}</div>
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
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('employee_role')}</div>
          <Input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('th_status')}</div>
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

function EmployeesPage() {
  const { ready: ratesReady } = useCurrency();
  const { data: db, isLoading } = useDbQuery();
  const { language, setLanguage } = useLang();
  const t = useTranslation(language);
  const tr = t;
  const muts = useDbMutations();

  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const toggleSort = (field) => { if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortDir('asc'); } };

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expandedEmployee, setExpandedEmployee] = useState(null);
  const deleteConfirm = useConfirm();
  const revokeConfirm = useConfirm();

  const toolCounts = useMemo(() => {
    const m = new Map();
    (db?.access || []).forEach((a) => {
      if (a.status !== "active") return;
      m.set(a.employee_id, (m.get(a.employee_id) || 0) + 1);
    });
    return m;
  }, [db]);

  // Get the actual tools an employee has access to (for drill-down)
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
    }).sort((a, b) => {
      let av, bv;
      if (sortField === 'dept') { av = a.department || ''; bv = b.department || ''; }
      else if (sortField === 'role') { av = a.role || ''; bv = b.role || ''; }
      else if (sortField === 'status') { av = a.status || ''; bv = b.status || ''; }
      else { av = a.full_name || ''; bv = b.full_name || ''; }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [employees, q, dept, status, sortField, sortDir]);

  // Reset page when filters change
  React.useEffect(() => { setPage(0); }, [q, dept, status]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Departments to show in overview - only show ones that have employees
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

  if (isLoading) return (
    <AppShell title={t('nav_employees')}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 h-24 animate-pulse" />)}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
          {[...Array(8)].map((_, i) => <SkeletonRow key={i} cols={5} />)}
        </div>
      </div>
    </AppShell>
  );

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

        <PlanLimitBanner resource="employees" />

        {/* ── Row 1: Compact KPI strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-5">
          <div className={`rounded-2xl border bg-slate-900/60 p-5 border-l-4 border-l-blue-500 cursor-pointer hover:border-slate-600 transition-all ${!status ? 'border-blue-500/60 ring-1 ring-blue-500/30' : 'border-slate-800'}`}
            onClick={() => { setStatus(''); setDept(''); setQ(''); }}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_total")}</div>
            <div className="text-3xl font-black text-white">{employees.length}</div>
            <div className="text-sm text-slate-500">{t("sub_all_employees")}</div>
          </div>
          <div className={`rounded-2xl border bg-slate-900/60 p-5 border-l-4 border-l-emerald-500 cursor-pointer hover:border-slate-600 transition-all ${status === 'active' ? 'border-emerald-500/60 ring-1 ring-emerald-500/30' : 'border-slate-800'}`}
            onClick={() => setStatus(status === 'active' ? '' : 'active')}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_active")}</div>
            <div className="text-3xl font-black text-emerald-400">{activeCount}</div>
            <div className="text-sm text-slate-500">{t("sub_click_to_filter")}</div>
          </div>
          <div className={`rounded-2xl border bg-slate-900/60 p-5 border-l-4 border-l-amber-500 cursor-pointer hover:border-slate-600 transition-all ${status === 'offboarding' ? 'border-amber-500/60 ring-1 ring-amber-500/30' : 'border-slate-800'}`}
            onClick={() => setStatus(status === 'offboarding' ? '' : 'offboarding')}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_offboarding")}</div>
            <div className="text-3xl font-black text-amber-400">{offboardingCount}</div>
            <div className="text-sm text-slate-500">{t("sub_click_to_filter")}</div>
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
                {tr('all_filter')} ({employees.length})
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
              <option value="active">{t('emp_status_active')}</option>
              <option value="offboarding">{t('emp_status_offboarding')}</option>
              <option value="offboarded">{t('emp_status_offboarded')}</option>
            </select>
            <span className="text-xs text-slate-500 whitespace-nowrap">{filtered.length} {tr('found_count')}</span>
          </div>

          {/* ── Compact table ── */}
          {isLoading ? (
            <div className="p-6 space-y-2">
              <SkeletonRow cols={6} /><SkeletonRow cols={6} /><SkeletonRow cols={6} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12">
              <EmptyState icon={Users}
                title={employees.length === 0 ? t('no_employees_found') : t('no_results')}
                body={employees.length === 0 ? t('empty_employees') : t('try_adjusting_filters')}
                action={employees.length === 0 ? (
                  <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors">
                    <Plus className="h-4 w-4" />{t('add_employee')}
                  </button>
                ) : (
                  <button onClick={() => { setQ(''); setStatus(''); setDept(''); }} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-semibold transition-colors">
                    {t('clear_filter')}
                  </button>
                )}
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50">
                      {[['name', t('th_employee'), ''], ['dept', t('th_department'), 'hidden md:table-cell'], ['role', t('employee_role'), 'hidden lg:table-cell']].map(([field, label, extra]) => (
                        <th key={field} className={`text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-300 transition-colors ${extra}`}
                          onClick={() => toggleSort(field)}>
                          {label}{sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                        </th>
                      ))}
                      <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">{t('th_tools')}</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-300 transition-colors"
                        onClick={() => toggleSort('status')}>
                        {t('th_status')}{sortField === 'status' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('th_actions')}</th>
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
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" title={t('edit')}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <Link to={`/offboarding?employee=${encodeURIComponent(e.id)}`}>
                              <button className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors" title={t('nav_offboarding')}>
                                <UserMinus className="h-3.5 w-3.5" />
                              </button>
                            </Link>
                            {deleteConfirm.isPending(e.id) ? (
                              <ConfirmButtons onConfirm={() => { muts.deleteEmployee.mutate(e.id); deleteConfirm.reset(); }} onCancel={deleteConfirm.cancel} />
                            ) : (
                              <button onClick={() => deleteConfirm.ask(e.id)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-400 transition-colors" title={t('delete')}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* ── Expanded tools drill-down ── */}
                      {expandedEmployee === e.id && (
                        <tr>
                          <td colSpan="6" className="p-0">
                            <div className="bg-slate-950/80 border-y border-blue-500/20 px-6 py-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold text-blue-400">{e.full_name}{tr('drill_tools_for')} ({toolCounts.get(e.id) || 0})</h4>
                                <Link to={`/tools`} className="text-xs text-slate-500 hover:text-blue-400 transition-colors">{tr("drill_view_all_tools")} →</Link>
                              </div>
                              {(() => {
                                const empTools = getEmployeeTools(e.id);
                                if (empTools.length === 0) return (
                                  <div className="text-center py-4 text-sm text-slate-500">{tr("drill_no_active_tools")}</div>
                                );
                                return (
                                  <div className="grid gap-2">
                                    {empTools.map((tool, i) => {
                                      const toolObj = (db?.tools || []).find(x => x.id === tool.tool_id || x.name === tool.tool_name);
                                      const evidence = toolObj ? getRiskEvidence(toolObj) : [];
                                      return (
                                      <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition-colors">
                                        <div className="flex items-center gap-3 p-3">
                                          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-300 flex-shrink-0">
                                            {(tool.tool_name || '?')[0]}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-slate-200 truncate">{tool.tool_name}</div>
                                            <div className="text-xs text-slate-500">
                                              {tool.last_used ? `${tr('drill_last_used')} ${tool.last_used}` : tr('drill_no_usage')}
                                              {tool.cost > 0 && ` · €${tool.cost}/mo`}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 flex-shrink-0">
                                            {tool.mfa && <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold">MFA</span>}
                                            <span className={"px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase " + (
                                              tool.risk === 'high' ? 'bg-red-500/20 text-red-400' :
                                              tool.risk === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                              'bg-emerald-500/20 text-emerald-400'
                                            )}>{tool.risk || 'low'}</span>
                                            {revokeConfirm.isPending(tool.id) ? (
                                              <ConfirmButtons onConfirm={() => { muts.deleteAccess.mutate(tool.id); revokeConfirm.reset(); }} onCancel={revokeConfirm.cancel} />
                                            ) : (
                                              <button onClick={(ev) => { ev.stopPropagation(); revokeConfirm.ask(tool.id); }}
                                                className="p-1 rounded-lg bg-slate-800 hover:bg-red-600/20 text-slate-500 hover:text-red-400 transition-colors" title={tr('revoke')}>
                                                <X className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                        {evidence.length > 0 && (tool.risk === 'high' || tool.risk === 'medium') && (
                                          <div className="px-3 pb-3 pt-0">
                                            <div className="flex flex-wrap gap-1.5">
                                              {evidence.map((r, j) => (
                                                <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 border border-slate-700">
                                                  {tr(r.key) || r.fallback}
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
                    {tr('page_showing')} {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} {tr('page_of')} {filtered.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(0)} disabled={page === 0}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      {tr("page_first")}
                    </button>
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      {tr("page_prev")}
                    </button>
                    <span className="px-3 py-1 text-xs text-slate-300 font-semibold">
                      {tr('page_label')} {page + 1} / {totalPages}
                    </span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      {tr("page_next")}
                    </button>
                    <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      {tr("page_last")}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal open={open} title={editing ? tr('edit_employee_btn') : tr('add_employee_btn')} subtitle={tr('employee_directory_sub')} onClose={() => setOpen(false)}>
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


function AccessForm({ initial, tools, employees, onSubmit, onClose }) {
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
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('tool_name')}</div>
          <Select value={form.tool_id} onChange={(e) => setForm((f) => ({ ...f, tool_id: e.target.value }))}>
            {tools.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('employee')}</div>
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
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('status')}</div>
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
          <div className="mb-1 text-xs font-semibold text-slate-400">Granted</div>
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

function AccessPage() {
  const { data: db, isLoading } = useDbQuery();
  const muts = useDbMutations();
  const { language } = useLang();
  const t = useTranslation(language);
  const [viewMode, setViewMode] = useState('map');
  const [filterRisk, setFilterRisk] = useState('all');
  const [search, setSearch] = useState('');
  const [revokeAllConfirm, setRevokeAllConfirm] = useState(false);
  const rowRevokeConfirm = useConfirm();
  const [managingId, setManagingId] = useState(null);
  const [mapManaging, setMapManaging] = useState(null); // { id, empName, toolName, level }

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

    // Build the access matrix: employee → tools
    const matrix = {};
    const allTools = new Set();
    access.filter(a => a.status === 'active').forEach(a => {
      const empName = a.employee?.full_name || a.employee_name || 'Unknown';
      const toolName = a.tool?.name || a.tool_name || 'Unknown';
      if (!matrix[empName]) matrix[empName] = { employee: a.employee, tools: {} };
      matrix[empName].tools[toolName] = { level: a.access_level, risk: a.risk, id: a.id };
      allTools.add(toolName);
    });

    // Build tool → employees reverse map
    const toolMatrix = {};
    access.filter(a => a.status === 'active').forEach(a => {
      const toolName = a.tool?.name || a.tool_name || 'Unknown';
      if (!toolMatrix[toolName]) toolMatrix[toolName] = { tool: a.tool, employees: [] };
      toolMatrix[toolName].employees.push({ name: a.employee?.full_name || a.employee_name, level: a.access_level, risk: a.risk, dept: a.employee?.department, id: a.id });
    });

    return { access, highRisk, needsReview, matrix, toolMatrix, allTools: [...allTools].sort() };
  }, [db]);

  if (isLoading || !derived) return (
    <AppShell title={t('nav_access')}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 h-24 animate-pulse" />)}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
          {[...Array(8)].map((_, i) => <SkeletonRow key={i} cols={5} />)}
        </div>
      </div>
    </AppShell>
  );

  // Filter logic
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
          <div
            className={"rounded-2xl border bg-slate-900/60 p-5 border-l-4 border-l-blue-500 cursor-pointer transition-all " + (filterRisk === 'all' ? 'border-blue-500 ring-1 ring-blue-500/40' : 'border-slate-800 hover:border-slate-700')}
            onClick={() => { setFilterRisk('all'); }}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_total_access")}</div>
            <div className="text-3xl font-black text-white">{derived.access.filter(a => a.status === 'active').length}</div>
            <div className="text-sm text-slate-500">{t("sub_active_permissions")}</div>
          </div>
          <div
            className={"rounded-2xl border bg-slate-900/60 p-5 border-l-4 border-l-red-500 cursor-pointer transition-all " + (filterRisk === 'high' ? 'border-red-500 ring-1 ring-red-500/40' : 'border-slate-800 hover:border-slate-700')}
            onClick={() => { setFilterRisk('high'); setViewMode('table'); }}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_high_risk")}</div>
            <div className="text-3xl font-black text-red-400">{derived.highRisk.length}</div>
            <div className="text-sm text-slate-500">{t("sub_click_to_filter")}</div>
          </div>
          <div
            className={"rounded-2xl border bg-slate-900/60 p-5 border-l-4 border-l-amber-500 cursor-pointer transition-all " + (filterRisk === 'review' ? 'border-amber-500 ring-1 ring-amber-500/40' : 'border-slate-800 hover:border-slate-700')}
            onClick={() => { setFilterRisk('review'); setViewMode('table'); }}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_needs_review")}</div>
            <div className="text-3xl font-black text-amber-400">{derived.needsReview.length}</div>
            <div className="text-sm text-slate-500">{t("sub_click_to_filter")}</div>
          </div>
          <div
            className={"rounded-2xl border bg-slate-900/60 p-5 border-l-4 border-l-emerald-500 cursor-pointer transition-all " + (filterRisk === 'clean' ? 'border-emerald-500 ring-1 ring-emerald-500/40' : 'border-slate-800 hover:border-slate-700')}
            onClick={() => { setFilterRisk('clean'); setViewMode('table'); }}>
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
                <span className="text-base font-semibold text-white">{t('urgent_high_risk_header').replace('{n}', derived.highRisk.length)}</span>
              </div>
              {revokeAllConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{t('confirm_revoke_all_high').replace('{n}', derived.highRisk.length)}</span>
                  <ConfirmButtons onConfirm={() => { derived.highRisk.forEach(a => muts.updateAccess.mutate({ id: a.id, patch: { status: 'revoked' } })); toast.success(t('toast_all_high_risk_revoked')); setRevokeAllConfirm(false); }} onCancel={() => setRevokeAllConfirm(false)} />
                </div>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setRevokeAllConfirm(true)}>
                  {t("access_revoke_all_high")}
                </Button>
              )}
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
                    muts.updateAccess.mutate({ id: a.id, patch: { status: 'revoked' } }, { onSuccess: () => toast.success(t('toast_revoked')) });
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
            <option value="all">{t('all_risk_levels')}</option>
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
              <span className="text-xs text-slate-500">{t('employees_n_tools_n').replace('{e}', Object.keys(derived.matrix).length).replace('{t}', derived.allTools.length)}</span>
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
                                  onClick={() => setMapManaging({ id: access.id, empName, toolName, level: access.level })}
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

        {/* ── Map dot action panel ── */}
        {mapManaging && (
          <div className="rounded-2xl border border-blue-500/30 bg-slate-900/80 p-4 flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">{mapManaging.empName} → {mapManaging.toolName}</div>
              <div className="text-xs text-slate-500">{t('current_access')}: <span className="text-slate-300 font-medium">{mapManaging.level}</span></div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => { muts.updateAccess.mutate({ id: mapManaging.id, patch: { access_level: 'viewer' } }, { onSuccess: () => toast.success(t('toast_changed_to_viewer')) }); setMapManaging(null); }} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold">Viewer</button>
              <button onClick={() => { muts.updateAccess.mutate({ id: mapManaging.id, patch: { access_level: 'admin' } }, { onSuccess: () => toast.success(t('toast_changed_to_admin')) }); setMapManaging(null); }} className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-xs font-semibold">Admin</button>
              <button onClick={() => { muts.updateAccess.mutate({ id: mapManaging.id, patch: { status: 'revoked' } }, { onSuccess: () => toast.success(t('toast_revoked')) }); setMapManaging(null); }} className="px-3 py-1.5 bg-red-600/30 hover:bg-red-600/50 text-red-400 rounded-lg text-xs font-semibold">{t('revoke')}</button>
              <button onClick={() => setMapManaging(null)} className="p-1.5 text-slate-500 hover:text-white rounded-lg text-xs font-bold">✗</button>
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
                  if (sorted.length === 0) return <div className="text-sm text-slate-500 text-center py-4">{t('no_admin_access_yet')}</div>;
                  return sorted.map(([name, data]) => (
                    <div key={name} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/40 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{name}</div>
                        <div className="text-xs text-slate-500 truncate">{data.dept || t('no_department')}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-purple-400">{data.count}</div>
                        <div className="text-[10px] text-slate-500">{t('admin')}</div>
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
                  if (sorted.length === 0) return <div className="text-sm text-slate-500 text-center py-4">{t('no_access_records_yet')}</div>;
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
                  if (sorted.length === 0) return <div className="text-sm text-slate-500 text-center py-4">{t('no_departments_yet')}</div>;
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
                      <div className="text-xs text-slate-500">{tool?.category || t('uncategorized')}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {adminCount > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-semibold">{adminCount} {t('admin')}</span>}
                      <span className="text-xs text-slate-500">{t('n_users_label').replace('{n}', employees.length)}</span>
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
                    {employees.length > 5 && <div className="text-[10px] text-slate-600">{t('n_more_items').replace('{n}', employees.length - 5)}</div>}
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
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400">{t('th_employee')}</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400">{t('tool_name')}</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400">{t('th_level')}</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400">{t('th_status')}</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400">{t('th_risk')}</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400">{t('th_actions')}</th>
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
                      <span className={"px-2 py-0.5 rounded-full text-[10px] font-semibold " + (a.access_level === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400')}>{a.access_level}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={"px-2 py-0.5 rounded-full text-[10px] font-semibold " + (a.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400')}>{a.status}</span>
                    </td>
                    <td className="py-3 px-4">
                      {a.risk !== 'none' ? (
                        <span className={"px-2 py-0.5 rounded-full text-[10px] font-semibold " + (a.risk === 'former_employee' || a.risk === 'excessive_admin' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400')}>{a.risk.replace(/_/g, ' ')}</span>
                      ) : <span className="text-[10px] text-slate-600">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-1 justify-end items-center">
                        {managingId === a.id ? (
                          <div className="flex gap-1 items-center">
                            <button onClick={() => { muts.updateAccess.mutate({ id: a.id, patch: { access_level: 'viewer' } }, { onSuccess: () => toast.success(t('toast_changed_to_viewer')) }); setManagingId(null); }} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold">Viewer</button>
                            <button onClick={() => { muts.updateAccess.mutate({ id: a.id, patch: { access_level: 'admin' } }, { onSuccess: () => toast.success(t('toast_changed_to_admin')) }); setManagingId(null); }} className="px-2 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-xs font-semibold">Admin</button>
                            <button onClick={() => { muts.updateAccess.mutate({ id: a.id, patch: { status: 'revoked' } }, { onSuccess: () => toast.success(t('toast_revoked')) }); setManagingId(null); }} className="px-2 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-400 rounded-lg text-xs font-semibold">{t('revoke')}</button>
                            <button onClick={() => setManagingId(null)} className="px-1.5 py-1 text-slate-500 hover:text-white rounded-lg text-xs font-bold">✗</button>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => { setManagingId(a.id); rowRevokeConfirm.reset(); }} className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold">{t('manage')}</button>
                            {rowRevokeConfirm.isPending(a.id) ? (
                              <ConfirmButtons onConfirm={() => { muts.updateAccess.mutate({ id: a.id, patch: { status: 'revoked' } }, { onSuccess: () => toast.success(t('toast_revoked')) }); rowRevokeConfirm.reset(); }} onCancel={rowRevokeConfirm.cancel} />
                            ) : (
                              <button onClick={() => rowRevokeConfirm.ask(a.id)} className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-xs font-semibold">×</button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {filteredAccess.length > 25 && <div className="text-center py-3 text-xs text-slate-500">{t('showing_n_of_m').replace('{x}', 25).replace('{n}', filteredAccess.length)}</div>}
          </div>
        )}

      </div>
    </AppShell>
  );
}


// ── AI Access Recommendations ─────────────────────────────────────────────

// Cache AI recommendations to avoid 429 rate limits
const AI_RECS_CACHE_KEY = 'ag_ai_recs_cache';
const AI_RECS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCachedAIRecs() {
  try {
    const cached = JSON.parse(localStorage.getItem(AI_RECS_CACHE_KEY) || '{}');
    if (cached.data && Date.now() - cached.ts < AI_RECS_CACHE_TTL) return cached.data;
  } catch {}
  return null;
}
function setCachedAIRecs(data) {
  try { localStorage.setItem(AI_RECS_CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch {}
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
      const orphaned = (tools || []).filter(t => !t.owner_email);
      const unused = (tools || []).filter(t => {
        if (!t.last_used_date) return false;
        const days = Math.floor((today - new Date(t.last_used_date)) / 86400000);
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
- Tools without owners (no owner): ${orphaned.map(t => t.name).join(', ') || 'None'}
- Unused 90+ days: ${unused.map(t => t.name).join(', ') || 'None'}
- Monthly spend: ${getCurrency(language)}${(tools || []).reduce((s, t) => s + (t.cost_per_month || 0), 0).toLocaleString()}

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

  React.useEffect(() => { if (tools?.length > 0) generateRecs(); }, []);

  const colors = { high: 'red', medium: 'amber', low: 'blue' };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-xl">
            <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{t('ai_access_recommendations')}</h3>
            <p className="text-xs text-slate-400">{t('powered_by_claude_ai')}</p>
          </div>
        </div>
        <button onClick={generateRecs} disabled={loading}
          className="text-xs px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-lg border border-purple-500/20 transition-colors">
          {loading ? t('contract_analysing') : t('refresh')}
        </button>
      </div>
      {loading && <div className="flex items-center gap-2 text-slate-400 text-sm"><div className="h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"/><span>{t('analysing_access_data')}</span></div>}
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
              {expanded ? t('collapse') : `${t('show_more')} (${recs.length - 3})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Slack Notifications Setup ─────────────────────────────────────────────
function SlackNotifications() {
  const { language } = useLang();
  const t = useTranslation(language);
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
      toast.success(t('toast_slack_test_sent'));
    } catch(e) {
      toast.error(t('toast_slack_failed'));
    } finally { setTesting(false); }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-emerald-500/20 rounded-xl text-xl">💬</div>
        <div>
          <h3 className="text-base font-bold text-white">{t('slack_notifications')}</h3>
          <p className="text-xs text-slate-400">{t('slack_get_alerts')}</p>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">{t('slack_webhook_url')}</label>
          <input
            value={webhook}
            onChange={e => setWebhook(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 transition-colors"
          />
          <p className="text-xs text-slate-500 mt-1">
            <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">{t('slack_create_app')}</a> → Incoming Webhooks → Add New Webhook
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={save} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors">
            {saved ? `✓ ${t('saved_msg')}` : t('save')}
          </button>
          {webhook && (
            <button onClick={test} disabled={testing} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-xl transition-colors">
              {testing ? `${t('loading')}` : t('send')}
            </button>
          )}
        </div>
        <div className="pt-2 border-t border-slate-800">
          <p className="text-xs text-slate-500 mb-2">{t('slack_will_receive')}</p>
          <div className="grid grid-cols-2 gap-1">
            {[`🚨 ${t('high_risk_tools')}`, `👤 ${t('hc_former_employee_access')}`, `🔔 ${t('renewals_tab')} 30d`, `⚡ ${t('offboarding_title')}`].map(a => (
              <div key={a} className="text-xs text-slate-400 flex items-center gap-1">{a}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── License Benchmarking ──────────────────────────────────────────────────
function LicenseBenchmark({ tools }) {
  const { language } = useLang();
  const t = useTranslation(language);
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
    const key = (tool?.name || '').toLowerCase().replace(/[^a-z]/g, '');
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
          <h3 className="text-base font-bold text-white">{t('license_benchmarking')}</h3>
          <p className="text-xs text-slate-400">{t('license_costs_vs_industry')}</p>
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

function ChecklistItems() {
  const { language } = useLang();
  const t = useTranslation(language);
  const [checked, setChecked] = React.useState({});
  const items = [
    t('cl_revoke_saas'),
    t('cl_remove_sso'),
    t('cl_transfer_docs'),
    t('cl_recover_devices'),
    t('cl_archive_email'),
    t('cl_remove_slack'),
    t('cl_cancel_subs'),
  ];
  const doneCount = Object.values(checked).filter(Boolean).length;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500">{t('cl_n_of_m_completed').replace('{n}', doneCount).replace('{m}', items.length)}</span>
        {doneCount === items.length && <span className="text-xs text-emerald-400 font-semibold">{t('all_done')}</span>}
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

function printOffboardingChecklist(employee, activeRecords, allAccess) {
  const revokedRecords = allAccess.filter(a => a.employee_id === employee.id && a.status === 'revoked');
  const allRecords = [...revokedRecords, ...activeRecords];
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const bestPractices = [
    'Revoke all SaaS tool access',
    'Remove from SSO / identity provider',
    'Transfer ownership of shared documents',
    'Recover company devices (laptop, phone, badge)',
    'Archive or reassign corporate email',
    'Remove from Slack / Microsoft Teams',
    'Cancel user-specific subscriptions',
    'Update emergency contact lists',
    'Complete exit interview',
    'Return all access badges and keys',
  ];
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Offboarding Checklist — ${employee.full_name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; background: #fff; padding: 40px; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
  .brand { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
  .brand span { color: #3b82f6; }
  .doc-meta { text-align: right; font-size: 11px; color: #64748b; line-height: 1.8; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
  .emp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .emp-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .emp-card-label { font-size: 10px; text-transform: uppercase; color: #94a3b8; margin-bottom: 3px; }
  .emp-card-value { font-size: 13px; font-weight: 600; color: #0f172a; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; text-align: left; padding: 8px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; }
  td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
  .badge-revoked { background: #dcfce7; color: #16a34a; }
  .badge-active  { background: #fee2e2; color: #dc2626; }
  .badge-admin   { background: #eff6ff; color: #2563eb; }
  .badge-member  { background: #f8fafc; color: #64748b; }
  .checklist { columns: 2; gap: 16px; }
  .check-item { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 10px; break-inside: avoid; }
  .check-box { width: 14px; height: 14px; border: 2px solid #cbd5e1; border-radius: 3px; flex-shrink: 0; margin-top: 1px; }
  .check-label { font-size: 12px; color: #334155; line-height: 1.5; }
  .signature-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 8px; }
  .sig-line { border-bottom: 1px solid #94a3b8; padding-bottom: 4px; margin-bottom: 4px; height: 36px; }
  .sig-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
  .status-summary { display: flex; gap: 16px; margin-bottom: 12px; }
  .stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 16px; text-align: center; }
  .stat-num { font-size: 20px; font-weight: 800; color: #0f172a; }
  .stat-lbl { font-size: 10px; color: #94a3b8; text-transform: uppercase; }
  @media print {
    body { padding: 20px; }
    @page { margin: 15mm; }
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">Stack<span>lens</span></div>
    <div style="font-size:15px;font-weight:700;color:#334155;margin-top:6px">Offboarding Checklist</div>
  </div>
  <div class="doc-meta">
    <div><strong>Generated:</strong> ${today}</div>
    <div><strong>Confidential</strong> — HR Use Only</div>
    <div style="margin-top:4px;font-size:10px;color:#94a3b8">Ref: OB-${employee.id?.slice(-6)?.toUpperCase()}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Employee Information</div>
  <div class="emp-grid">
    <div class="emp-card">
      <div class="emp-card-label">Full Name</div>
      <div class="emp-card-value">${employee.full_name || '—'}</div>
    </div>
    <div class="emp-card">
      <div class="emp-card-label">Email</div>
      <div class="emp-card-value" style="font-size:11px">${employee.email || '—'}</div>
    </div>
    <div class="emp-card">
      <div class="emp-card-label">Department</div>
      <div class="emp-card-value">${employee.department || '—'}</div>
    </div>
    <div class="emp-card">
      <div class="emp-card-label">Role</div>
      <div class="emp-card-value">${employee.role || '—'}</div>
    </div>
    <div class="emp-card">
      <div class="emp-card-label">Start Date</div>
      <div class="emp-card-value">${employee.start_date || '—'}</div>
    </div>
    <div class="emp-card">
      <div class="emp-card-label">End Date</div>
      <div class="emp-card-value">${employee.end_date || 'TBD'}</div>
    </div>
    <div class="emp-card">
      <div class="emp-card-label">Status</div>
      <div class="emp-card-value" style="text-transform:capitalize">${employee.status || '—'}</div>
    </div>
    <div class="emp-card">
      <div class="emp-card-label">Manager</div>
      <div class="emp-card-value">${employee.manager || '—'}</div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">Access Summary</div>
  <div class="status-summary">
    <div class="stat"><div class="stat-num">${allRecords.length}</div><div class="stat-lbl">Total Access</div></div>
    <div class="stat"><div class="stat-num" style="color:#16a34a">${revokedRecords.length}</div><div class="stat-lbl">Revoked</div></div>
    <div class="stat"><div class="stat-num" style="color:${activeRecords.length > 0 ? '#dc2626' : '#16a34a'}">${activeRecords.length}</div><div class="stat-lbl">Still Active</div></div>
  </div>
  ${allRecords.length > 0 ? `
  <table>
    <thead><tr>
      <th>#</th><th>Tool / Application</th><th>Access Level</th><th>Granted Date</th><th>Last Accessed</th><th>Status</th>
    </tr></thead>
    <tbody>
      ${allRecords.map((r, i) => `<tr>
        <td style="color:#94a3b8">${i + 1}</td>
        <td><strong>${r.tool_name || '—'}</strong></td>
        <td><span class="badge badge-${r.access_level === 'admin' ? 'admin' : 'member'}">${r.access_level || '—'}</span></td>
        <td>${r.granted_date || '—'}</td>
        <td>${r.last_accessed_date || '—'}</td>
        <td><span class="badge badge-${r.status === 'revoked' ? 'revoked' : 'active'}">${r.status}</span></td>
      </tr>`).join('')}
    </tbody>
  </table>` : '<p style="color:#94a3b8;font-size:12px;padding:12px 0">No access records found.</p>'}
</div>

<div class="section">
  <div class="section-title">Offboarding Checklist</div>
  <div class="checklist">
    ${bestPractices.map(item => `
    <div class="check-item">
      <div class="check-box"></div>
      <div class="check-label">${item}</div>
    </div>`).join('')}
  </div>
</div>

<div class="section">
  <div class="section-title">Approvals &amp; Sign-off</div>
  <div class="signature-grid">
    <div>
      <div class="sig-line"></div>
      <div class="sig-label">HR Manager</div>
    </div>
    <div>
      <div class="sig-line"></div>
      <div class="sig-label">Direct Manager</div>
    </div>
    <div>
      <div class="sig-line"></div>
      <div class="sig-label">IT / Security</div>
    </div>
  </div>
</div>

<div class="footer">
  <span>Generated by Stacklens · stacklens.fr</span>
  <span>Confidential — ${today}</span>
  <span>Ref: OB-${employee.id?.slice(-6)?.toUpperCase()}</span>
</div>

<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

function OffboardingPage() {
  const { language } = useLang();
  const { ready: ratesReady } = useCurrency();
  const t = useTranslation(language);
  const { data: db, isLoading } = useDbQuery();
  const muts = useDbMutations();
  const nav = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const pre = params.get("employee") || "";

  const employees = useMemo(() => db?.employees || [], [db]);
  const access = db?.access || [];

  const [tab, setTab] = useState("queue"); // "queue" | "history"
  const [employeeId, setEmployeeId] = useState(pre || "");
  const [checked, setChecked] = useState({});
  const [revokeAllConfirm, setRevokeAllConfirm] = useState(false);
  const [revokeRiskyConfirm, setRevokeRiskyConfirm] = useState(false);

  useEffect(() => {
    if (pre) setEmployeeId(pre);
  }, [pre]);

  const employee = employees.find((e) => e.id === employeeId);
  const activeRecords = access.filter((a) => a.employee_id === employeeId && a.status === "active");

  const revokeOne = (id) => {
    muts.updateAccess.mutate({ id, patch: { status: "revoked" } }, { onSuccess: () => toast.success(t('toast_access_revoked')) });
  };
  const revokeAll = () => {
    if (!employee) return;
    activeRecords.forEach((r) => muts.updateAccess.mutate({ id: r.id, patch: { status: "revoked" } }));
    muts.updateEmployee.mutate({
      id: employeeId,
      patch: { status: "offboarded", end_date: employee?.end_date || todayISO() },
    });
    toast.success(`${employee.full_name} ${t('toast_employee_offboarded')} — ${activeRecords.length} ${t('toast_revoked_records')}`);
    setEmployeeId("");
    setRevokeAllConfirm(false);
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
          {employee && (
            <Button variant="secondary" onClick={() => printOffboardingChecklist(employee, activeRecords, access)}>
              <Download className="h-4 w-4" /> {t('off_print_checklist')}
            </Button>
          )}
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
                <div className="text-base font-semibold text-red-400 mb-1">{t('offboarding_security_risk_header').replace('{n}', riskRecords.length)}</div>
                <p className="text-sm text-slate-400 mb-4">{t('offboarding_security_risk_body')}</p>
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
                {revokeRiskyConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-300">{t('confirm_offboard_revoke_all')} {riskRecords.length} {t('confirm_revoke_all_risky')}</span>
                    <ConfirmButtons onConfirm={() => { riskRecords.forEach(a => muts.updateAccess.mutate({ id: a.id, patch: { status: "revoked" } })); toast.success(`${t('toast_revoked')} ${riskRecords.length} ${t('toast_revoked_records')}`); setRevokeRiskyConfirm(false); }} onCancel={() => setRevokeRiskyConfirm(false)} />
                  </div>
                ) : (
                  <button onClick={() => setRevokeRiskyConfirm(true)} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-xl font-semibold text-sm text-white transition-colors">
                    {t('access_revoke_all_high')}
                  </button>
                )}
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
                { id: "queue",   label: t('off_queue_tab').replace('{n}', upcoming.length) },
                { id: "history", label: t('off_history_tab').replace('{n}', offboarded.length) },
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
                            <div className="text-xs text-slate-500 truncate">{e.department || '—'} · {t('off_n_active_access').replace('{n}', empAccess.length)}</div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {days !== null && (
                              <span className={"text-[10px] font-semibold px-2 py-0.5 rounded-full " + (
                                urgent ? "bg-red-500/20 text-red-400" :
                                days <= 7 ? "bg-amber-500/20 text-amber-400" :
                                "bg-slate-700 text-slate-400"
                              )}>
                                {days < 0 ? t('offboarding_d_overdue').replace('{n}', Math.abs(days)) : days === 0 ? t('offboarding_today') : `${days}d`}
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
                              {e.department || '—'} · {t('off_offboarded_date').replace('{d}', e.end_date || t('recently') || 'recently')}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {revokedCount > 0 && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">{t('off_n_revoked').replace('{n}', revokedCount)}</span>
                            )}
                            {remainingCount > 0 && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">{t('off_n_risk').replace('{n}', remainingCount)}</span>
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
                    <button
                      onClick={() => printOffboardingChecklist(employee, activeRecords, access)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                      title="Print or save as PDF"
                    >
                      <Download className="h-3.5 w-3.5" />PDF
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-slate-800/50 p-2">
                      <div className="text-[10px] text-slate-500 uppercase">{t("offboarding_dept")}</div>
                      <div className="text-xs font-semibold text-white capitalize truncate">{employee.department || '—'}</div>
                    </div>
                    <div className="rounded-lg bg-slate-800/50 p-2">
                      <div className="text-[10px] text-slate-500 uppercase">{t("offboarding_access_label")}</div>
                      <div className="text-xs font-semibold text-white">{t('off_n_active').replace('{n}', activeRecords.length)}</div>
                    </div>
                    <div className="rounded-lg bg-slate-800/50 p-2">
                      <div className="text-[10px] text-slate-500 uppercase">{t("offboarding_end_date")}</div>
                      <div className="text-xs font-semibold text-white">{employee.end_date || t('off_tbd')}</div>
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
                        {activeRecords.map((r, idx) => (
                          <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950/40">
                            <div className="flex-shrink-0">
                              <input type="checkbox" checked={Boolean(checked[r.id])}
                                onChange={(e) => setChecked((m) => ({ ...m, [r.id]: e.target.checked }))}
                                className="w-4 h-4 rounded accent-emerald-500 cursor-pointer" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-white truncate">{r.tool_name}</div>
                              <div className="text-[10px] text-slate-500">
                                <span className="capitalize">{r.access_level}</span> · {t('off_granted_date').replace('{d}', r.granted_date || '—')}
                              </div>
                            </div>
                            <button onClick={() => revokeOne(r.id)}
                              className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-xs font-semibold transition-colors flex-shrink-0">
                              {t('revoke')}
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* One-click button */}
                      {revokeAllConfirm ? (
                        <div className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10">
                          <span className="text-sm text-red-300">{t('confirm_offboard_revoke_all')} {activeRecords.length} {t('confirm_revoke_all_risky')}</span>
                          <ConfirmButtons onConfirm={revokeAll} onCancel={() => setRevokeAllConfirm(false)} />
                        </div>
                      ) : (
                        <button onClick={() => setRevokeAllConfirm(true)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold text-sm text-white transition-all shadow-lg shadow-red-500/20">
                          <BadgeX className="h-4 w-4" />
                          {t('off_one_click_label').replace('{n}', activeRecords.length)}
                        </button>
                      )}
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

function ImportWizard({ defaultKind = null, onDone = null }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const muts = useDbMutations();
  const [step, setStep] = useState(defaultKind ? 2 : 0);  // 0=choose, 1=template, 2=upload, 3=done
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
    try {
      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        if (!window.XLSX) {
          await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            s.onload = res; s.onerror = () => rej(new Error('Failed to load Excel reader. Check your connection.'));
            document.head.appendChild(s);
          });
        }
        const ab = await file.arrayBuffer();
        const wb = window.XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        csv = window.XLSX.utils.sheet_to_csv(ws);
      } else {
        csv = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = (e) => res(e.target.result);
          reader.onerror = () => rej(new Error('Could not read file'));
          reader.readAsText(file);
        });
      }
    } catch (err) {
      toast.error(err.message || 'Could not read file. Try saving as CSV and uploading again.');
      return;
    }
    setText(csv);
    const detected = detectKind(csv);
    if (detected) {
      setKind(detected);
      toast.success(t('toast_detected') + ' ' + (KINDS[detected]?.label || detected));
    } else if (!kind) {
      toast('Could not detect file type — please select the data type above.', { icon: '⚠️' });
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
    } catch (err) {
      const msg = err?.message || '';
      if (msg.startsWith('PLAN_LIMIT:')) {
        toast.error(msg.replace('PLAN_LIMIT:', ''), { duration: 8000 });
      } else {
        toast.error(t('toast_import_failed') + ' ' + (msg || 'Unknown error'));
      }
    } finally { setImporting(false); }
  };

  const reset = () => { setStep(0); setKind(null); setText(''); setImported(null); };

  const STEP_LABELS = [t('import_step1'), t('import_step2') || 'Get template', t('import_step3'), t('import_step4') || t('done')];

  // Smart column detector — scores each kind against pasted headers
  const detectKind = (csvText) => {
    const firstLine = csvText.split('\n')[0].toLowerCase();
    const scores = { company: 0, tools: 0, employees: 0, access: 0 };

    // Unified company format: has BOTH employee_* AND tool_* columns
    const hasEmployeeFields = firstLine.includes('employee_name') || firstLine.includes('employee_email');
    const hasToolFields = firstLine.includes('tool_name') || firstLine.includes('tool_category') || firstLine.includes('tool_cost');
    const hasAccessLevel = firstLine.includes('access_level');

    if (hasEmployeeFields && hasToolFields) {
      scores.company += 10; // Strong signal — definitely unified format
      if (hasAccessLevel) scores.company += 3;
    }

    // Tools-only: has "name" (not "full_name" or "tool_name") + cost/category
    if (firstLine.includes('cost_per_month') || (firstLine.match(/(^|,)name(,|$)/) && !hasEmployeeFields && !hasToolFields)) {
      scores.tools += 5;
    }

    // Employees-only: has full_name + department, no tool fields
    if ((firstLine.includes('full_name') || firstLine.includes('department')) && !hasToolFields) {
      scores.employees += 5;
    }

    // Access-only: has tool_name + employee_email + access_level, but no tool_category/tool_cost
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
      toast.success(t('toast_detected_type') + ' ' + KINDS[detected].label + ' ✨');
    }
  };

  return (
    <div className="space-y-6">
      {/* Animated step progress */}
      <div className="flex items-center mb-8">
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

          {/* Column legend */}
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

          {/* Sample data preview */}
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

          {/* Smart detection notice */}
          {kind && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5">
              <span className="text-lg">{KINDS[kind].icon}</span>
              <span>{t('imp_importing_as')} <span className="text-white font-semibold">{KINDS[kind].label}</span></span>
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
                <span className="px-2 py-0.5 bg-slate-800 rounded font-mono">XLSX</span>
                <span className="px-2 py-0.5 bg-slate-800 rounded font-mono">XLS</span>
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
                                : <span className="text-rose-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {t('imp_missing')}</span>
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
                  <div className="text-xs text-slate-500">{t('imp_existing_updated')}</div>
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


function printExecutiveSummary(db, derived) {
  if (!db || !derived) return;
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const orgName = JSON.parse(localStorage.getItem('sg_general') || '{}').orgName || 'Your Organisation';
  const tools = derived.tools || [];
  const employees = derived.employees || [];
  const access = derived.access || [];
  const totalSpend = tools.reduce((s, t) => s + Number(t.cost_per_month || 0), 0);
  const annualSpend = totalSpend * 12;
  const activeTools = tools.filter(t => t.derived_status === 'active').length;
  const unusedTools = tools.filter(t => t.derived_status === 'unused' || t.derived_status === 'orphaned').length;
  const highRisk = tools.filter(t => t.derived_risk === 'high').length;
  const formerAccess = access.filter(a => a.derived_risk_flag === 'former_employee').length;
  const healthScore = derived.healthScore || 0;
  const healthLabel = healthScore >= 80 ? 'Audit Ready' : healthScore >= 60 ? 'Needs Attention' : 'At Risk';
  const healthColor = healthScore >= 80 ? '#10b981' : healthScore >= 60 ? '#f59e0b' : '#ef4444';
  const topTools = [...tools].sort((a, b) => Number(b.cost_per_month || 0) - Number(a.cost_per_month || 0)).slice(0, 10);
  const renewals = tools.filter(t => t.renewal_date).sort((a, b) => new Date(a.renewal_date) - new Date(b.renewal_date))
    .filter(t => { const d = new Date(t.renewal_date); const now = new Date(); return d >= now && d <= new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()); }).slice(0, 8);
  const byCategory = tools.reduce((acc, t) => { const k = t.category || 'Other'; acc[k] = (acc[k] || 0) + Number(t.cost_per_month || 0); return acc; }, {});
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const risks = derived.alerts || buildRiskAlerts(db) || [];
  const riskCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  risks.forEach(r => { if (riskCounts[r.severity] !== undefined) riskCounts[r.severity]++; });

  const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Executive SaaS Report — ${orgName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1e293b;background:#fff;padding:40px;font-size:13px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #0f172a}
  .brand{font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.5px}
  .brand span{color:#3b82f6}
  .doc-meta{text-align:right;font-size:11px;color:#64748b;line-height:1.9}
  .section{margin-bottom:26px}
  .section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:4px}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 12px;text-align:center}
  .kpi-num{font-size:26px;font-weight:800;color:#0f172a;line-height:1}
  .kpi-lbl{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px}
  .kpi-sub{font-size:11px;color:#64748b;margin-top:2px}
  .health-row{display:flex;align-items:center;gap:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin-bottom:16px}
  .health-circle{width:52px;height:52px;border-radius:50%;background:conic-gradient(${healthColor} ${healthScore * 3.6}deg,#e2e8f0 0deg);display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative}
  .health-inner{width:38px;height:38px;border-radius:50%;background:#f8fafc;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:${healthColor}}
  .risk-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .risk-card{border-radius:8px;padding:10px 12px;text-align:center}
  .risk-num{font-size:20px;font-weight:800}
  .risk-lbl{font-size:10px;font-weight:600;text-transform:uppercase}
  table{width:100%;border-collapse:collapse}
  th{background:#f1f5f9;text-align:left;padding:7px 10px;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;font-weight:600}
  td{padding:8px 10px;border-bottom:1px solid #f8fafc;font-size:12px;vertical-align:middle}
  .badge{display:inline-block;padding:2px 7px;border-radius:99px;font-size:9px;font-weight:700;text-transform:uppercase}
  .b-high{background:#fee2e2;color:#dc2626}
  .b-medium{background:#fef3c7;color:#d97706}
  .b-low{background:#dcfce7;color:#16a34a}
  .b-active{background:#dbeafe;color:#2563eb}
  .b-unused{background:#f1f5f9;color:#64748b}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .cat-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12px}
  .cat-bar-wrap{width:80px;height:6px;background:#e2e8f0;border-radius:3px;margin:0 8px}
  .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}
  @media print{body{padding:16px}@page{margin:12mm;size:A4}}
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="brand">Stack<span>lens</span></div>
    <div style="font-size:17px;font-weight:700;color:#334155;margin-top:6px">Executive SaaS Report</div>
    <div style="font-size:12px;color:#94a3b8;margin-top:3px">${orgName}</div>
  </div>
  <div class="doc-meta">
    <div><strong>Generated:</strong> ${today}</div>
    <div><strong>Confidential</strong> — Executive Use Only</div>
    <div style="margin-top:4px;font-size:10px;color:#94a3b8">Powered by Stacklens · stacklens.fr</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Key Performance Indicators</div>
  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-num">${tools.length}</div>
      <div class="kpi-lbl">Total Tools</div>
      <div class="kpi-sub">${activeTools} active · ${unusedTools} unused</div>
    </div>
    <div class="kpi">
      <div class="kpi-num" style="color:#3b82f6">${fmt(totalSpend)}</div>
      <div class="kpi-lbl">Monthly Spend</div>
      <div class="kpi-sub">${fmt(annualSpend)} / year</div>
    </div>
    <div class="kpi">
      <div class="kpi-num">${employees.length}</div>
      <div class="kpi-lbl">Employees</div>
      <div class="kpi-sub">${employees.filter(e => e.status === 'active').length} active</div>
    </div>
    <div class="kpi">
      <div class="kpi-num">${access.filter(a => a.status === 'active').length}</div>
      <div class="kpi-lbl">Access Records</div>
      <div class="kpi-sub">${formerAccess > 0 ? `<span style="color:#dc2626">${formerAccess} at risk</span>` : 'All clear'}</div>
    </div>
  </div>
</div>

<div class="two-col">
  <div class="section">
    <div class="section-title">Security Health Score</div>
    <div class="health-row">
      <div class="health-circle"><div class="health-inner">${healthScore}</div></div>
      <div>
        <div style="font-size:15px;font-weight:700;color:${healthColor}">${healthLabel}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">${highRisk} high-risk tools · ${formerAccess} ex-employee access</div>
      </div>
    </div>
    <div class="risk-grid">
      <div class="risk-card" style="background:#fee2e2"><div class="risk-num" style="color:#dc2626">${riskCounts.critical}</div><div class="risk-lbl" style="color:#dc2626">Critical</div></div>
      <div class="risk-card" style="background:#fef3c7"><div class="risk-num" style="color:#d97706">${riskCounts.high}</div><div class="risk-lbl" style="color:#d97706">High</div></div>
      <div class="risk-card" style="background:#fefce8"><div class="risk-num" style="color:#ca8a04">${riskCounts.medium}</div><div class="risk-lbl" style="color:#ca8a04">Medium</div></div>
      <div class="risk-card" style="background:#dcfce7"><div class="risk-num" style="color:#16a34a">${riskCounts.low}</div><div class="risk-lbl" style="color:#16a34a">Low</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Spend by Category</div>
    ${topCategories.map(([cat, spend], i) => {
      const pct = Math.round((spend / totalSpend) * 100) || 0;
      return `<div class="cat-row">
        <span style="color:#334155;font-weight:500">${cat}</span>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="cat-bar-wrap"><div style="height:6px;border-radius:3px;background:#3b82f6;width:${pct}%"></div></div>
          <span style="color:#64748b;width:60px;text-align:right">${fmt(spend)}</span>
        </div>
      </div>`;
    }).join('')}
    ${topCategories.length === 0 ? '<div style="color:#94a3b8;font-size:12px;padding:8px 0">No spend data available.</div>' : ''}
  </div>
</div>

<div class="section">
  <div class="section-title">Top Tools by Cost (Monthly)</div>
  <table>
    <thead><tr><th>#</th><th>Tool</th><th>Category</th><th>Owner</th><th>Status</th><th>Risk</th><th style="text-align:right">Monthly</th><th style="text-align:right">Annual</th></tr></thead>
    <tbody>
      ${topTools.map((t, i) => `<tr>
        <td style="color:#94a3b8">${i + 1}</td>
        <td><strong>${t.name}</strong>${t.url ? ` <span style="color:#94a3b8;font-size:10px">${t.url}</span>` : ''}</td>
        <td style="color:#64748b">${t.category || '—'}</td>
        <td style="color:#64748b">${t.owner_email || 'Unassigned'}</td>
        <td><span class="badge ${t.derived_status === 'active' ? 'b-active' : 'b-unused'}">${t.derived_status}</span></td>
        <td><span class="badge ${t.derived_risk === 'high' ? 'b-high' : t.derived_risk === 'medium' ? 'b-medium' : 'b-low'}">${t.derived_risk}</span></td>
        <td style="text-align:right;font-weight:600">${t.cost_per_month ? fmt(Number(t.cost_per_month)) : '—'}</td>
        <td style="text-align:right;color:#64748b">${t.cost_per_month ? fmt(Number(t.cost_per_month) * 12) : '—'}</td>
      </tr>`).join('')}
      <tr style="background:#f8fafc;font-weight:700">
        <td colspan="6" style="text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b">Total</td>
        <td style="text-align:right">${fmt(totalSpend)}</td>
        <td style="text-align:right">${fmt(annualSpend)}</td>
      </tr>
    </tbody>
  </table>
</div>

${renewals.length > 0 ? `
<div class="section">
  <div class="section-title">Upcoming Renewals (Next 90 Days)</div>
  <table>
    <thead><tr><th>Tool</th><th>Category</th><th>Renewal Date</th><th>Days Left</th><th style="text-align:right">Annual Cost</th></tr></thead>
    <tbody>
      ${renewals.map(t => {
        const days = Math.ceil((new Date(t.renewal_date) - new Date()) / 86400000);
        const urgentColor = days <= 7 ? '#dc2626' : days <= 30 ? '#d97706' : '#334155';
        return `<tr>
          <td><strong>${t.name}</strong></td>
          <td style="color:#64748b">${t.category || '—'}</td>
          <td>${t.renewal_date}</td>
          <td style="color:${urgentColor};font-weight:600">${days} days</td>
          <td style="text-align:right">${t.cost_per_month ? fmt(Number(t.cost_per_month) * 12) : '—'}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</div>` : ''}

${unusedTools > 0 || formerAccess > 0 ? `
<div class="section">
  <div class="section-title">Recommendations</div>
  <table>
    <thead><tr><th>Priority</th><th>Action</th><th>Potential Saving / Impact</th></tr></thead>
    <tbody>
      ${formerAccess > 0 ? `<tr><td><span class="badge b-high">Critical</span></td><td>Revoke ${formerAccess} active access record(s) belonging to offboarded employees</td><td>Security / Compliance</td></tr>` : ''}
      ${unusedTools > 0 ? `<tr><td><span class="badge b-medium">High</span></td><td>Review ${unusedTools} unused/orphaned tool(s) — consider cancelling licences</td><td>${fmt(tools.filter(t => t.derived_status === 'unused' || t.derived_status === 'orphaned').reduce((s, t) => s + Number(t.cost_per_month || 0), 0) * 12)} / year</td></tr>` : ''}
      ${highRisk > 0 ? `<tr><td><span class="badge b-medium">Medium</span></td><td>Assign owners to ${highRisk} high-risk tool(s) with no designated owner</td><td>Governance</td></tr>` : ''}
      <tr><td><span class="badge b-low">Low</span></td><td>Schedule quarterly access review for all critical tools</td><td>Best Practice</td></tr>
    </tbody>
  </table>
</div>` : ''}

<div class="footer">
  <span>Generated by Stacklens · stacklens.fr</span>
  <span>${orgName} · Confidential</span>
  <span>${today}</span>
</div>

<script>window.onload=function(){window.print();}</script>
</body>
</html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

function AuditTabContent() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db, isLoading } = useDbQuery();

  const derived = React.useMemo(() => {
    if (!db) return null;
    const tools = db.tools.map((tool) => ({
      ...tool,
      derived_status: computeToolDerivedStatus(tool),
      derived_risk: computeToolDerivedRisk(tool),
    }));
    const employeesById = Object.fromEntries(db.employees.map((e) => [e.id, e]));
    const toolsById = Object.fromEntries(tools.map((t) => [t.id, t]));
    const access = db.access.map((a) => ({
      ...a,
      derived_risk_flag: computeAccessDerivedRiskFlag(a, employeesById, toolsById),
    }));
    const activeTools    = tools.filter(t => t.derived_status === "active").length;
    const unusedTools    = tools.filter(t => t.derived_status === "unused" || t.derived_status === "orphaned").length;
    const highRiskCount  = tools.filter(t => t.derived_risk === "high").length;
    const formerEmpAccess = access.filter(a => a.derived_risk_flag === "former_employee").length;
    const spend          = tools.reduce((s, t) => s + Number(t.cost_per_month || 0), 0);
    const toolUserCount = {};
    db.access.filter(a => a.status === "active").forEach(a => {
      toolUserCount[a.tool_name] = (toolUserCount[a.tool_name] || 0) + 1;
    });
    const topToolsByUsers = Object.entries(toolUserCount).sort((a,b) => b[1]-a[1]).slice(0,8);
    return {
      tools, access, employees: db.employees,
      activeTools, unusedTools, highRiskCount, formerEmpAccess, spend, topToolsByUsers,
      healthScore: Math.round(Math.max(0, 100 - (highRiskCount * 10) - (formerEmpAccess * 5) - (unusedTools * 3))),
    };
  }, [db]);

  const exportTools = () => {
    if (!derived) return;
    const headers = ["Name","Category","Owner","Criticality","Status","Risk","Monthly Cost","Last Used","URL"];
    const rows = derived.tools.map(t => [t.name, t.category, t.owner_email||'Unassigned', t.criticality, t.derived_status, t.derived_risk, t.cost_per_month||0, t.last_used_date||'Never', t.url||'']);
    downloadText(`stacklens_tools_${todayISO()}.csv`, toCsv(headers, rows));
    toast.success(t('toast_tools_export'));
  };
  const exportEmployees = () => {
    if (!derived) return;
    const headers = ["Name","Email","Department","Role","Status","Start Date","End Date"];
    const rows = derived.employees.map(e => [e.full_name, e.email, e.department, e.role, e.status, e.start_date||'', e.end_date||'']);
    downloadText(`stacklens_employees_${todayISO()}.csv`, toCsv(headers, rows));
    toast.success(t('toast_employees_export'));
  };
  const exportAccess = () => {
    if (!derived) return;
    const headers = ["Tool","Employee","Email","Access Level","Granted","Last Accessed","Last Reviewed","Status","Risk Flag"];
    const rows = derived.access.map(a => [a.tool_name, a.employee_name, a.employee_email, a.access_level, a.granted_date||'', a.last_accessed_date||'', a.last_reviewed_date||'', a.status, a.derived_risk_flag||'none']);
    downloadText(`stacklens_access_${todayISO()}.csv`, toCsv(headers, rows));
    toast.success(t('toast_access_export'));
  };
  const exportFullPackage = () => { exportTools(); setTimeout(exportEmployees, 300); setTimeout(exportAccess, 600); };

  const healthColor = (s) => s >= 80 ? "text-emerald-400" : s >= 60 ? "text-amber-400" : "text-red-400";
  const healthBg = (s) => s >= 80 ? "bg-emerald-500" : s >= 60 ? "bg-amber-500" : "bg-red-500";

  if (isLoading || !derived) return (
    <div className="flex items-center justify-center py-20 text-slate-500">{t('audit_loading')}</div>
  );

  return (
    <div className="space-y-6">

      {/* ── Row 1: Audit Summary + Export Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">

        {/* Health Score Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">{t("audit_health_score")}</div>
          <div className="flex items-center gap-5">
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="6"/>
                <circle cx="50" cy="50" r="42" fill="none"
                  stroke={derived.healthScore >= 80 ? '#10b981' : derived.healthScore >= 60 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="6"
                  strokeDasharray={`${2*Math.PI*42}`}
                  strokeDashoffset={`${2*Math.PI*42*(1-derived.healthScore/100)}`}
                  strokeLinecap="round"/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-black ${healthColor(derived.healthScore)}`}>{derived.healthScore}</span>
              </div>
            </div>
            <div>
              <div className={`text-lg font-semibold ${healthColor(derived.healthScore)}`}>
                {derived.healthScore >= 80 ? t('security_audit_ready') : derived.healthScore >= 60 ? t('security_needs_attention') : t('security_at_risk')}
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {derived.healthScore >= 80 
                  ? t('audit_ready_msg') 
                  : derived.healthScore >= 60 
                    ? t('audit_needs_msg')
                    : t('audit_risk_msg')}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('nav_tools')}</div>
            <div className="text-2xl font-black text-white">{derived.activeTools}</div>
            <div className="text-xs text-slate-500">{t('audit_n_unused').replace('{n}', derived.unusedTools)}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('nav_employees')}</div>
            <div className="text-2xl font-black text-white">{derived.employees.length}</div>
            <div className="text-xs text-slate-500">{t('audit_n_active').replace('{n}', derived.employees.filter(e => e.status === 'active').length)}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('exec_access_records')}</div>
            <div className="text-2xl font-black text-white">{derived.access.length}</div>
            <div className="text-xs text-slate-500">{t('audit_n_active').replace('{n}', derived.access.filter(a => a.status === 'active').length)}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('audit_risk_items')}</div>
            <div className="text-2xl font-black text-red-400">{derived.highRiskCount + derived.formerEmpAccess}</div>
            <div className="text-xs text-slate-500">{t('audit_n_tools_n_access').replace('{n}', derived.highRiskCount).replace('{n}', derived.formerEmpAccess)}</div>
          </div>
        </div>

        {/* Export Actions */}
        <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-900 to-blue-950/20 p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">{t("audit_export_package")}</div>
          <p className="text-sm text-slate-400 mb-5">{t("audit_package_desc")}</p>
          <button onClick={() => printExecutiveSummary(db, derived)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-sm transition-colors mb-3">
            <FileText className="h-4 w-4" /> {t('audit_exec_pdf')}
          </button>
          <button onClick={exportFullPackage}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-semibold text-sm transition-colors mb-3">
            <Download className="h-4 w-4" /> {t("audit_download_full")}
          </button>
          <div className="text-xs text-slate-600 text-center">{t("audit_three_files")}</div>
        </div>
      </div>

      {/* ── Row 2: Individual Exports with preview ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
        {[
          {
            title: t('audit_tools_inventory'),
            desc: t('audit_tools_inventory_desc'),
            count: derived.tools.length,
            fn: exportTools,
            color: 'blue',
            preview: derived.tools.slice(0,3).map(tt => ({ name: tt.name, status: tt.derived_status, risk: tt.derived_risk })),
          },
          {
            title: t('audit_employee_directory'),
            desc: t('audit_employee_directory_desc'),
            count: derived.employees.length,
            fn: exportEmployees,
            color: 'emerald',
            preview: derived.employees.slice(0,3).map(e => ({ name: e.full_name, dept: e.department, status: e.status })),
          },
          {
            title: t('audit_access_records'),
            desc: t('audit_access_records_desc'),
            count: derived.access.length,
            fn: exportAccess,
            color: 'purple',
            preview: derived.access.slice(0,3).map(a => ({ tool: a.tool_name, user: a.employee_name, level: a.access_level })),
          },
        ].map(item => (
          <div key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-white">{item.title}</h3>
              <span className="text-xs text-slate-500">{t('audit_n_records').replace('{n}', item.count)}</span>
            </div>
            <p className="text-sm text-slate-400 mb-4">{item.desc}</p>
            
            {/* Mini preview table */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 mb-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">{t('audit_preview')}</div>
              <div className="space-y-1.5">
                {item.preview.map((row, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 truncate flex-1">{row.name || row.tool || '—'}</span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      (row.status === 'active' || row.level === 'admin') ? 'text-emerald-400' :
                      (row.risk === 'high' || row.status === 'offboarding') ? 'text-red-400' :
                      'text-slate-500'
                    }`}>{row.status || row.dept || row.level || '—'}</span>
                  </div>
                ))}
              </div>
              {item.count > 3 && <div className="text-[10px] text-slate-600 mt-1.5">{t('n_more_items').replace('{n}', item.count - 3)}</div>}
            </div>

            <button onClick={item.fn}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold text-sm transition-colors">
              <Download className="h-4 w-4" /> {t('audit_export_csv')}
            </button>
          </div>
        ))}
      </div>

      {/* ── Row 3: Tool Usage Heatmap ── */}
      {derived.topToolsByUsers.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-white">{t("audit_usage_dist")}</h2>
              <p className="text-sm text-slate-500">{t("audit_usage_sub")}</p>
            </div>
            <span className="text-xs text-slate-500">{t('audit_n_tools_users').replace('{n}', derived.topToolsByUsers.length)}</span>
          </div>
          <div className="space-y-3">
            {derived.topToolsByUsers.map(([name, count], idx) => {
              const maxCount = derived.topToolsByUsers[0]?.[1] || 1;
              const pct = Math.round((count / maxCount) * 100);
              const colors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#6366f1'];
              return (
                <div key={name} className="flex items-center gap-4">
                  <div className="w-28 text-sm text-slate-300 truncate font-medium">{name}</div>
                  <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{width: pct + '%', background: colors[idx % colors.length]}} />
                  </div>
                  <div className="w-20 text-right">
                    <span className="text-sm font-semibold text-white">{count}</span>
                    <span className="text-xs text-slate-500 ml-1">{t('audit_users')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Audit Log ── */}
      {(db?.audit_log?.length > 0) && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">{t('audit_log_title') || 'Activity Log'}</h2>
              <p className="text-sm text-slate-500">{t('audit_log_sub') || 'Record of all changes made in this workspace'}</p>
            </div>
            <button onClick={() => {
              const headers = ['Timestamp','Action','Actor','Target','Details'];
              const rows = (db.audit_log || []).map(e => [e.ts, e.action, e.actor, e.target || '', JSON.stringify({ tool: e.tool, dept: e.dept, from: e.from, to: e.to })]);
              downloadText(`stacklens_audit_log_${todayISO()}.csv`, toCsv(headers, rows));
              toast.success('Audit log exported');
            }} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition-colors">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Timestamp', 'Action', 'By', 'Target'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(db.audit_log || []).slice(0, 50).map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{new Date(entry.ts).toLocaleString()}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        entry.action.includes('delete') || entry.action === 'revoke_access' ? 'bg-red-500/15 text-red-400' :
                        entry.action.includes('add') ? 'bg-emerald-500/15 text-emerald-400' :
                        'bg-blue-500/15 text-blue-400'
                      }`}>{entry.action.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-400 truncate max-w-[140px]">{entry.actor}</td>
                    <td className="py-2.5 px-3 text-xs text-slate-300 truncate max-w-[200px]">
                      {entry.target || '—'}
                      {entry.tool && <span className="text-slate-500"> → {entry.tool}</span>}
                      {entry.from && entry.to && <span className="text-slate-500"> ({entry.from} → {entry.to})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(db.audit_log?.length || 0) > 50 && (
            <div className="text-center pt-3 text-xs text-slate-500">{t('showing_n_of_m')?.replace('{x}', 50).replace('{n}', db.audit_log.length) || `Showing 50 of ${db.audit_log.length} entries — export CSV for full log`}</div>
          )}
        </div>
      )}

    </div>
  );
}


function AuditExportPage() {
  const { data: db, isLoading } = useDbQuery();
  const { language } = useLang();
  const t = useTranslation(language);

  const derived = useMemo(() => {
    if (!db) return null;
    const tools = db.tools.map((tool) => ({
      ...tool,
      derived_status: computeToolDerivedStatus(tool),
      derived_risk: computeToolDerivedRisk(tool),
    }));
    const employeesById = Object.fromEntries(db.employees.map((e) => [e.id, e]));
    const toolsById     = Object.fromEntries(tools.map((t) => [t.id, t]));
    const access = db.access.map((a) => ({
      ...a,
      derived_risk_flag: computeAccessDerivedRiskFlag(a, employeesById, toolsById),
    }));

    // App health
    const activeTools    = tools.filter(t => t.derived_status === "active").length;
    const unusedTools    = tools.filter(t => t.derived_status === "unused" || t.derived_status === "orphaned").length;
    const highRiskCount  = tools.filter(t => t.derived_risk === "high").length;
    const formerEmpAccess = access.filter(a => a.derived_risk_flag === "former_employee").length;
    const spend          = tools.reduce((s, t) => s + Number(t.cost_per_month || 0), 0);

    // Login / usage stats — tools with recent last_used_date
    const now = new Date();
    const toolsWithLogins = tools.filter(t => {
      if (!t.last_used_date) return false;
      const d = new Date(t.last_used_date);
      return (now - d) / (1000 * 60 * 60 * 24) <= 30;
    }).length;

    // Per-tool user count from access records
    const toolUserCount = {};
    db.access.filter(a => a.status === "active").forEach(a => {
      toolUserCount[a.tool_name] = (toolUserCount[a.tool_name] || 0) + 1;
    });
    const topToolsByUsers = Object.entries(toolUserCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return {
      tools, access, employees: db.employees,
      activeTools, unusedTools, highRiskCount, formerEmpAccess, spend,
      toolsWithLogins, topToolsByUsers,
      healthScore: Math.round(Math.max(0, 100 - (highRiskCount * 10) - (formerEmpAccess * 5) - (unusedTools * 3))),
    };
  }, [db]);

  const exportTools = () => {
    if (!derived) return;
    downloadText(`tools_${todayISO()}.csv`, toCsv(derived.tools,
      ["name","category","owner_email","owner_name","criticality","url","description","derived_status","last_used_date","cost_per_month","derived_risk","notes"]
    ));
  };
  const exportEmployees = () => {
    if (!derived) return;
    downloadText(`employees_${todayISO()}.csv`, toCsv(derived.employees,
      ["full_name","email","department","role","status","start_date","end_date"]
    ));
  };
  const exportAccess = () => {
    if (!derived) return;
    downloadText(`access_${todayISO()}.csv`, toCsv(derived.access,
      ["tool_name","employee_name","employee_email","access_level","granted_date","last_accessed_date","last_reviewed_date","status","derived_risk_flag"]
    ));
  };
  const exportAll = () => { exportTools(); exportEmployees(); exportAccess(); };

  const healthColor = (score) =>
    score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-rose-400";
  const healthLabel = (score) =>
    score >= 80 ? "Healthy" : score >= 60 ? "Needs attention" : "At risk";

  return (
    <PlanGate requires="scale" feature="Audit Export"><AppShell
      title={"Export Audit" || 'Audit Export'}
      right={
        <Button onClick={exportAll}>
          <Download className="h-4 w-4" /> Full Audit Package
        </Button>
      }
    >
      <div className="grid gap-5">

        {/* Health + summary row */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <Card className="lg:col-span-1">
            <CardBody>
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">{t('app_health_score')}</div>
                {isLoading || !derived ? (
                  <div className="h-16 w-16 rounded-full border-4 border-slate-700 animate-pulse" />
                ) : (
                  <>
                    <div className={cx("text-2xl md:text-5xl font-black", healthColor(derived.healthScore))}>
                      {derived.healthScore}
                    </div>
                    <div className={cx("text-sm font-semibold mt-1", healthColor(derived.healthScore))}>
                      {healthLabel(derived.healthScore)}
                    </div>
                    <div className="mt-3 w-full bg-slate-800 rounded-full h-2">
                      <div
                        className={cx("h-2 rounded-full transition-all", derived.healthScore >= 80 ? "bg-emerald-500" : derived.healthScore >= 60 ? "bg-amber-500" : "bg-rose-500")}
                        style={{ width: `${derived.healthScore}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">{t('tool_inventory')}</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">{t('total_tools')}</span><span className="font-bold text-white">{derived?.tools.length ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('active')}</span><span className="font-bold text-emerald-400">{derived?.activeTools ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('orphaned')}</span><span className="font-bold text-amber-400">{derived?.unusedTools ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('high_risk')}</span><span className="font-bold text-rose-400">{derived?.highRiskCount ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('active')}</span><span className="font-bold text-blue-400">{derived?.toolsWithLogins ?? "—"}</span></div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">{t('risk_alerts')}</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">{t('total_access_records')}</span><span className="font-bold text-white">{derived?.access.length ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('active')}</span><span className="font-bold text-emerald-400">{derived?.access.filter(a => a.status === "active").length ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t("hc_former_employee_access")}</span><span className="font-bold text-rose-400">{derived?.formerEmpAccess ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Employees</span><span className="font-bold text-slate-300">{derived?.employees.length ?? "—"}</span></div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Spend</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">{t('monthly_total')}</span><span className="font-bold text-white">{derived ? formatMoney(derived.spend, null, language) : "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('annual_projection')}</span><span className="font-bold text-blue-400">{derived ? formatMoney(derived.spend * 12, null, language) : "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('avg_per_tool')}</span><span className="font-bold text-slate-300">{derived && derived.tools.length ? formatMoney(derived.spend / derived.tools.length, null, language) : "—"}</span></div>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
          {/* Tool login / user counts */}
          <Card>
            <CardHeader title="Users logged into tools" subtitle={t('all_permissions_sub')} />
            <CardBody>
              {isLoading || !derived ? <SkeletonRow cols={3} /> : derived.topToolsByUsers.length === 0 ? (
                <EmptyState icon={Users} title="No access data" body="Import access records to see tool usage." />
              ) : (
                <div className="space-y-3">
                  {derived.topToolsByUsers.map(([toolName, count]) => {
                    const pct = Math.round((count / derived.employees.length) * 100);
                    return (
                      <div key={toolName}>
                        <div className="flex items-center justify-between mb-1 text-sm">
                          <span className="text-slate-300 font-medium">{toolName}</span>
                          <span className="text-slate-400">{count} user{count !== 1 ? "s" : ""} <span className="text-slate-600">({pct}%)</span></span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-800">
                          <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Export buttons */}
          <Card>
            <CardHeader title="Export reports" subtitle="Timestamped CSV files" />
            <CardBody>
              <div className="space-y-3">
                {[
                  { label: "Tools report", sub: "Inventory, ownership, status, risk, spend", fn: exportTools, count: derived?.tools.length },
                  { label: "Employees report", sub: "Directory with department, role, dates, status", fn: exportEmployees, count: derived?.employees.length },
                  { label: "Access report", sub: "Tool-to-employee mappings and risk flags", fn: exportAccess, count: derived?.access.length },
                ].map(({ label, sub, fn, count }) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                    <div>
                      <div className="text-sm font-semibold text-white">{label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
                      {count !== undefined && <div className="text-xs text-slate-600 mt-0.5">{count} records</div>}
                    </div>
                    <Button size="sm" variant="secondary" onClick={fn}>
                      <Download className="h-4 w-4" /> Export
                    </Button>
                  </div>
                ))}
                <div className="rounded-2xl border border-blue-600/30 bg-blue-600/10 p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">{t('full_audit_package')}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{t('all_three_reports')}</div>
                  </div>
                  <Button size="sm" onClick={exportAll}>
                    <Download className="h-4 w-4" /> Export all
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Summary */}
        <Card>
          <CardHeader title="Audit summary" subtitle="Auto-generated compliance overview" />
          <CardBody>
            {isLoading || !derived ? <SkeletonRow cols={4} /> : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[
                  { icon: "✅", title: "Active tools", text: `${derived.activeTools} of ${derived.tools.length} tools are active and accounted for.`, ok: true },
                  derived.unusedTools > 0 && { icon: "⚠️", title: "Unused tools", text: `${derived.unusedTools} tools are unused or orphaned — consider reviewing or decommissioning.`, ok: false },
                  derived.highRiskCount > 0 && { icon: "🔴", title: "High-risk tools", text: `${derived.highRiskCount} tool${derived.highRiskCount !== 1 ? "s" : ""} flagged as high-risk require immediate review.`, ok: false },
                  derived.formerEmpAccess > 0 && { icon: "🚨", title: "Former employee access", text: `${derived.formerEmpAccess} access record${derived.formerEmpAccess !== 1 ? "s" : ""} belong to offboarded employees and should be revoked.`, ok: false },
                  derived.formerEmpAccess === 0 && { icon: "✅", title: "No ghost access", text: "No active access records linked to offboarded employees.", ok: true },
                  { icon: "💰", title: "Monthly spend", text: `Total SaaS spend is ${getCurrency(language)}{convertCurrency(derived.spend  || 0, language).toLocaleString()}/month (${getCurrency(language)}{convertCurrency(derived.spend * 12  || 0, language).toLocaleString()}/year).`, ok: true },
                ].filter(Boolean).map((item) => (
                  <div key={item.title} className={cx(
                    "rounded-xl border p-4 text-sm",
                    item.ok ? "border-emerald-800/40 bg-emerald-950/20" : "border-rose-800/40 bg-rose-950/20"
                  )}>
                    <div className="flex items-center gap-2 font-semibold text-white mb-1">
                      <span>{item.icon}</span>{item.title}
                    </div>
                    <div className="text-slate-400">{item.text}</div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </AppShell></PlanGate>
  );
}

function PricingTiers({ currentPlan = 'free' }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const [billingCycle, setBillingCycle] = useState('monthly');

  // IMPORTANT: These prices must match the landing page (TrialPage) exactly.
  // Landing page: Free €0 / Starter €29 / Pro €79 / Enterprise €299
  const plans = [
    {
      id: 'free', name: t('plan_free_name'),
      tagline: t('plan_free_tagline'),
      price: { monthly: 0, annual: 0 },
      features: t('plan_free_features').split('|'),
      popular: false,
    },
    {
      id: 'starter', name: 'Starter',
      tagline: t('plan_starter_tagline'),
      price: { monthly: 29, annual: 278 },
      features: t('plan_starter_features').split('|'),
      popular: false,
    },
    {
      id: 'hr_finance', name: t('plan_hrfinance_name'),
      tagline: t('plan_hrfinance_tagline'),
      price: { monthly: 49, annual: 470 },
      badge: t('plan_hrfinance_badge'),
      features: t('plan_hrfinance_features').split('|'),
      popular: false,
      monthlyPriceId: 'price_1TWxAB1yFs6IziIVjxw3CG2V',   // ← fill after creating Stripe product
      annualPriceId:  'price_1TWxFd1yFs6IziIVjPZnA8XT',    // ← fill after creating Stripe product
    },
    {
      id: 'pro', name: 'Pro',
      tagline: t('plan_pro_tagline'),
      price: { monthly: 79, annual: 758 },
      features: t('plan_pro_features').split('|'),
      popular: true,
    },
    {
      id: 'enterprise', name: 'Enterprise',
      tagline: t('plan_enterprise_tagline'),
      price: { monthly: 299, annual: 2870 },
      features: t('plan_enterprise_features').split('|'),
      popular: false,
    },
  ];
  const getPrice = (p) => {
    const v = p.price[billingCycle];
    if (typeof v !== 'number') return v;
    return billingCycle === 'monthly' ? '€' + v + '/mo' : '€' + v + '/yr';
  };
  const getSavings = (p) => {
    if (billingCycle === 'annual' && typeof p.price.annual === 'number' && p.price.annual > 0) {
      const s = p.price.monthly * 12 - p.price.annual;
      return s > 0 ? 'Save €' + s + '/year' : null;
    }
    return null;
  };
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-4">
        <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-400'}`}>{t('plan_billing_monthly')}</span>
        <button onClick={() => setBillingCycle(c => c === 'monthly' ? 'annual' : 'monthly')}
          className="relative w-14 h-7 bg-slate-700 rounded-full hover:bg-slate-600 transition-colors">
          <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${billingCycle === 'annual' ? 'translate-x-7' : ''}`} />
        </button>
        <span className={`text-sm font-medium ${billingCycle === 'annual' ? 'text-white' : 'text-slate-400'}`}>{t('plan_billing_annual')}</span>
        {billingCycle === 'annual' && <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full">{t('plan_billing_save20')}</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const savings = getSavings(plan);
          return (
            <div key={plan.id} className={`relative rounded-2xl p-8 ${plan.popular ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-2 border-blue-500' : 'bg-slate-900 border border-slate-800'}`}>
              {plan.popular && <div className="absolute -top-4 left-1/2 -translate-x-1/2"><span className="px-4 py-1 bg-blue-600 text-white text-sm font-bold rounded-full">{t("hc_most_popular")}</span></div>}
              <div className="text-center mb-6">
                <h3 className="text-2xl font-black text-white mb-2">{plan.name}</h3>
                <p className="text-sm text-slate-400">{plan.tagline}</p>
              </div>
              <div className="text-center mb-6">
                <div className="text-2xl md:text-4xl font-black text-white mb-2">{getPrice(plan)}</div>
                {savings && <div className="text-sm text-emerald-400 font-semibold">{savings}</div>}
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feat, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-300">{feat}</span>
                  </li>
                ))}
              </ul>
              <button
                disabled={isCurrent}
                onClick={async () => {
                  if (isCurrent) return;
                  if (plan.id === 'enterprise') { setShowContactModal(true); return; }
                  // Legal agreement check — required before checkout
                  if (!legalAccepted) {
                    toast.error(t('billing_accept_terms_error'));
                    return;
                  }
                  try {
                    // Log legal acceptance to Firestore for audit trail (best-effort)
                    if (db?.user?.uid) {
                      logLegalAcceptance(db.user.uid, db.user.email, plan.id).catch(() => {});
                    }
                    const priceId = billing === 'annual' ? plan.annualPriceId : plan.monthlyPriceId;
                    if (!priceId) { toast.error(t('toast_price_not_configured')); return; }
                    const { url, error } = await createCheckoutSession(priceId, db?.user?.email);
                    if (url) window.location.href = url;
                    else toast.error(error || 'Could not start checkout');
                  } catch(e) {
                    toast.error(t('toast_checkout_failed') + ' ' + e.message);
                  }
                }}
                className={`w-full py-3 rounded-xl font-bold transition-all ${isCurrent ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : plan.popular ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
                {isCurrent ? 'Current Plan' : plan.id === 'enterprise' ? t('contact_sales_btn') : `Upgrade to ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>
      {/* Legal acceptance checkbox — required before checkout, mandatory for GDPR + LCEN compliance */}
      <div className="mt-6 p-4 bg-slate-900/60 border border-slate-700 rounded-xl">
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={legalAccepted}
            onChange={e => setLegalAccepted(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 flex-shrink-0"
          />
          <span className="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
            {isFr
              ? <>J\'accepte les <Link to="/terms" target="_blank" className="text-blue-400 hover:text-blue-300 underline">Conditions générales</Link>, la <Link to="/privacy" target="_blank" className="text-blue-400 hover:text-blue-300 underline">Politique de confidentialité</Link> et l\'<Link to="/dpa" target="_blank" className="text-blue-400 hover:text-blue-300 underline">Accord de traitement des données (DPA RGPD)</Link>. Je comprends que mon abonnement se renouvellera automatiquement et que je peux le résilier à tout moment depuis mon tableau de bord.</>
              : <>I agree to the <Link to="/terms" target="_blank" className="text-blue-400 hover:text-blue-300 underline">Terms of Service</Link>, <Link to="/privacy" target="_blank" className="text-blue-400 hover:text-blue-300 underline">Privacy Policy</Link> and <Link to="/dpa" target="_blank" className="text-blue-400 hover:text-blue-300 underline">Data Processing Agreement (GDPR DPA)</Link>. I understand my subscription renews automatically and I can cancel at any time from my dashboard.</>
            }
          </span>
        </label>
      </div>
      <div className="text-center mt-4">
        <p className="text-sm text-slate-400 mb-4">Trusted by 800+ companies worldwide</p>
        <div className="flex items-center justify-center gap-8 text-slate-500 text-sm">
          <span className="flex items-center gap-1"><Shield className="h-4 w-4" /> SOC 2</span>
          <span className="flex items-center gap-1"><Lock className="h-4 w-4" /> GDPR</span>
          <span className="flex items-center gap-1"><Award className="h-4 w-4" /> 99.9% Uptime</span>
        </div>
      </div>
    </div>
  );
}

function BillingPage({ noShell = false }) {
  React.useEffect(() => { const p = new URLSearchParams(window.location.search); if (p.get("success")) { toast.success(t('toast_plan_upgraded')); setTimeout(() => { window.history.replaceState({}, "", window.location.pathname); window.location.reload(); }, 1500); } }, []);
  const handleManageSubscription = async () => {
    const { url, error } = await createBillingPortal(window.location.href);
    if (url) window.location.href = url;
    else toast.error(t('toast_portal_failed') + ' ' + (error || 'Unknown error'));
  };
  const { data: db } = useDbQuery();
  const muts = useDbMutations();
  const { language } = useLang();
  const t = useTranslation(language);
  const plan = db?.user?.is_founder ? 'scale' : (db?.user?.plan || db?.user?.subscription_plan || 'trial');
  const [billing, setBilling] = useState('monthly');
  const [showContactModal, setShowContactModal] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactSize, setContactSize] = useState('1-10');
  const [contactSent, setContactSent] = useState(false);

  // Real trial state — replaces the previous hardcoded mock
  const _trialState = getTrialState(db?.user);
  const trialDaysLeft = _trialState.daysLeft;
  const trialDaysUsed = TRIAL_DAYS - trialDaysLeft;
  const trialPct = Math.max(0, Math.min(100, (trialDaysUsed / TRIAL_DAYS) * 100));
  const isTrial = _trialState.isTrial || (plan === 'free' && !_trialState.expired);

  // 4 tiers: Free / Starter / Pro / Enterprise
  // Pricing matches Stripe products (EUR). Pro is the popular middle option.
  const plans = [
    {
      id: 'free',
      tName: 'plan_free', tTag: 'plan_free_tag',
      icon: '🎁', monthly: 0, annual: 0, isFree: true,
      color: 'from-slate-600 to-slate-700', border: 'border-slate-600/40',
      features: [
        { key: 'f_free_1', en: 'Up to 10 SaaS tools' },
        { key: 'f_free_2', en: 'Up to 25 employees' },
        { key: 'f_free_3', en: 'Shadow IT discovery' },
        { key: 'f_free_4', en: 'Basic security alerts' },
        { key: 'f_free_5', en: 'No credit card required' },
        { key: 'f_free_6', en: 'Forever free' },
      ],
      limits: { tools: 10, employees: 25 },
    },
    {
      id: 'starter',
      tName: 'plan_starter', tTag: 'plan_starter_tag',
      icon: '🌱', monthly: 29, annual: 278,
      color: 'from-blue-500 to-blue-700', border: 'border-blue-500/40',
      features: [
        { key: 'f_starter_1', en: 'Up to 100 SaaS tools' },
        { key: 'f_starter_2', en: 'Up to 250 employees' },
        { key: 'f_starter_3', en: 'Add / edit / delete data' },
        { key: 'f_starter_4', en: 'Renewal alerts' },
        { key: 'f_starter_5', en: 'CSV import & export' },
        { key: 'f_starter_6', en: '5 team members' },
        { key: 'f_starter_7', en: 'Email support' },
      ],
      limits: { tools: 100, employees: 250 },
    },
    {
      id: 'hr_finance',
      tName: 'plan_hr_finance', tTag: 'plan_hr_finance_tag',
      icon: '👥', monthly: 49, annual: 470,
      badge: 'NEW',
      color: 'from-teal-500 to-emerald-700', border: 'border-teal-500/40',
      features: [
        { key: 'f_hrf_1', en: 'Full Finance Board' },
        { key: 'f_hrf_2', en: 'People & HR Board' },
        { key: 'f_hrf_3', en: 'Access tracking & map' },
        { key: 'f_hrf_4', en: 'Offboarding queue' },
        { key: 'f_hrf_5', en: 'Budget tracking & renewal calendar' },
        { key: 'f_hrf_6', en: '10 team members' },
        { key: 'f_hrf_7', en: 'Priority email support' },
      ],
      limits: { tools: 250, employees: 500 },
    },
    {
      id: 'pro',
      tName: 'plan_pro', tTag: 'plan_pro_tag',
      icon: '🚀', monthly: 79, annual: 758,
      popular: true,
      color: 'from-emerald-600 to-teal-700', border: 'border-emerald-500/50',
      features: [
        { key: 'f_pro_1', en: 'Up to 500 SaaS tools' },
        { key: 'f_pro_2', en: 'Up to 1,500 employees' },
        { key: 'f_pro_3', en: 'AI recommendations' },
        { key: 'f_pro_4', en: 'Cost management & finance' },
        { key: 'f_pro_5', en: 'Full security & audit suite' },
        { key: 'f_pro_6', en: 'License optimization' },
        { key: 'f_pro_7', en: '15 team members' },
        { key: 'f_pro_8', en: 'Priority email support' },
      ],
      limits: { tools: 500, employees: 1500 },
    },
    {
      id: 'enterprise',
      tName: 'plan_enterprise', tTag: 'plan_enterprise_tag',
      icon: '⚡', monthly: 299, annual: 2870,
      color: 'from-violet-600 to-purple-700', border: 'border-violet-500/40',
      features: [
        { key: 'f_ent_1', en: 'Unlimited SaaS tools' },
        { key: 'f_ent_2', en: 'Unlimited employees' },
        { key: 'f_ent_3', en: 'SSO / SAML' },
        { key: 'f_ent_4', en: 'Advanced analytics & BI exports' },
        { key: 'f_ent_5', en: 'API access & custom integrations' },
        { key: 'f_ent_6', en: 'Dedicated account manager' },
        { key: 'f_ent_7', en: 'Unlimited team members' },
        { key: 'f_ent_8', en: 'SLA 99.9% uptime · 24/7 support' },
      ],
      limits: { tools: 99999, employees: 99999 },
    },
  ];

    // Feature translations (inline since they are plan-specific)
  const featureText = {
    en: {
      plan_free:'Free', plan_free_tag:'For small teams getting started',
      plan_starter:'Starter', plan_starter_tag:'For growing teams',
      plan_hr_finance:'HR & Finance', plan_hr_finance_tag:'For HR & Finance directors',
      plan_pro:'Pro', plan_pro_tag:'For teams that need full visibility and control',
      plan_enterprise:'Enterprise', plan_enterprise_tag:'For large organisations',
      f_free_1:'Up to 10 SaaS tools',f_free_2:'Up to 25 employees',f_free_3:'Shadow IT discovery',f_free_4:'Basic security alerts',f_free_5:'No credit card required',f_free_6:'Forever free',
      f_starter_1:'Up to 100 SaaS tools',f_starter_2:'Up to 250 employees',f_starter_3:'Add / edit / delete data',f_starter_4:'Renewal alerts',f_starter_5:'CSV import & export',f_starter_6:'5 team members',f_starter_7:'Email support',
      f_hrf_1:'Full Finance Board',f_hrf_2:'People & HR Board',f_hrf_3:'Access tracking & map',f_hrf_4:'Offboarding queue',f_hrf_5:'Budget tracking & renewal calendar',f_hrf_6:'10 team members',f_hrf_7:'Priority email support',
      f_growth_8:'Priority email support',
      f_unl_1:'Unlimited tools & employees',f_unl_2:'SSO / SAML',f_unl_3:'Custom integrations',f_unl_4:'Dedicated account manager',f_unl_5:'Custom contracts',f_unl_6:'SLA 99.9% uptime',f_unl_7:'Unlimited team members',f_unl_8:'24/7 priority support',
      f_startup_1:'Full access for 7 days',f_startup_2:'All features unlocked',f_startup_3:'Up to 10 SaaS tools',f_startup_4:'Up to 10 employees',f_startup_5:'No credit card required',f_startup_6:'Community support',
      f_growth_1:'Up to 200 SaaS tools',f_growth_2:'Up to 500 employees',f_growth_3:'AI recommendations',f_growth_4:'Cost management & finance',f_growth_5:'Full security suite',f_growth_6:'License optimization',f_growth_7:'10 team members',
      f_pro_1:'Up to 500 SaaS tools',f_pro_2:'Up to 1,500 employees',f_pro_3:'AI contract analysis',f_pro_4:'Full security & audit suite',f_pro_5:'Advanced analytics',f_pro_6:'15 team members',f_pro_7:'Priority support',f_pro_8:'CSV & data exports',
      f_ent_1:'Unlimited tools & employees',f_ent_2:'SSO / SAML',f_ent_3:'SCIM provisioning',f_ent_4:'Dedicated account manager',f_ent_5:'24/7 phone & Slack support',f_ent_6:'Custom contracts & invoicing',f_ent_7:'On-premise / private cloud option',f_ent_8:'Security review & SLA guarantee',
    },
    fr: {
      plan_free:'Gratuit', plan_free_tag:'Pour les petites équipes',
      plan_starter:'Starter', plan_starter_tag:'Pour les équipes en croissance',
      plan_hr_finance:'RH & Finance', plan_hr_finance_tag:'Pour les DRH et directeurs financiers',
      plan_pro:'Pro', plan_pro_tag:'Pour les équipes qui ont besoin de visibilité totale',
      plan_enterprise:'Enterprise', plan_enterprise_tag:'Pour les grandes organisations',
      f_free_1:"Jusqu’à 10 outils SaaS",f_free_2:"Jusqu’à 25 employés",f_free_3:"Détection du Shadow IT",f_free_4:"Alertes sécurité basiques",f_free_5:"Sans carte bancaire",f_free_6:"Gratuit pour toujours",
      f_starter_1:"Jusqu’à 100 outils SaaS",f_starter_2:"Jusqu’à 250 employés",f_starter_3:"Ajouter / modifier / supprimer",f_starter_4:"Alertes de renouvellement",f_starter_5:"Import & export CSV",f_starter_6:"5 membres d’équipe",f_starter_7:"Support par email",
      f_hrf_1:"Tableau de bord Finance complet",f_hrf_2:"Tableau RH & Personnes",f_hrf_3:"Suivi des accès & cartographie",f_hrf_4:"File d’attente d’offboarding",f_hrf_5:"Suivi budgétaire & calendrier de renouvellement",f_hrf_6:"10 membres d’équipe",f_hrf_7:"Support email prioritaire",
      f_startup_1:"Jusqu’à 10 outils SaaS",f_startup_2:"Jusqu’à 10 employés",f_startup_3:"Alertes de risque basiques",f_startup_4:"Export CSV",f_startup_5:"1 membre d’équipe",f_startup_6:"Support communautaire",
      f_growth_1:"Jusqu’à 50 outils SaaS",f_growth_2:"Jusqu’à 50 employés",f_growth_3:"Score de risque avancé",f_growth_4:"Tableau de bord Finance",f_growth_5:"Exports d’audit",f_growth_6:"Jusqu’à 5 membres",f_growth_7:"Support par email",
      f_scale_1:"Outils SaaS illimités",f_scale_2:"Employés illimités",f_scale_3:"Analyse IA des contrats",f_scale_4:"Gestion des licences",f_scale_5:"Rapports d’audit complets",f_scale_6:"Jusqu’à 15 membres",f_scale_7:"Support prioritaire",f_scale_8:"Accès API",
      f_pro_1:"Jusqu'à 500 outils SaaS",f_pro_2:"Jusqu'à 1 500 employés",f_pro_3:"Analyse IA des contrats",f_pro_4:"Suite sécurité & audit complète",f_pro_5:"Analytics avancés",f_pro_6:"15 membres d'équipe",f_pro_7:"Support prioritaire",f_pro_8:"Export CSV & données",
      f_ent_1:"Outils & employés illimités",f_ent_2:"SSO / SAML",f_ent_3:"Provisionnement SCIM",f_ent_4:"Responsable de compte dédié",f_ent_5:"Support 24/7 téléphone & Slack",f_ent_6:"Contrats & facturation personnalisés",f_ent_7:"Option sur site / cloud privé",f_ent_8:"Audit de sécurité & garantie SLA",
    },
    es: {
      f_startup_1:'Hasta 10 herramientas SaaS',f_startup_2:'Hasta 10 empleados',f_startup_3:'Alertas de riesgo básicas',f_startup_4:'Exportación CSV',f_startup_5:'1 miembro del equipo',f_startup_6:'Soporte comunitario',
      f_growth_1:'Hasta 50 herramientas SaaS',f_growth_2:'Hasta 50 empleados',f_growth_3:'Puntuación de riesgo avanzada',f_growth_4:'Panel de finanzas',f_growth_5:'Exportaciones de auditoría',f_growth_6:'Hasta 5 miembros',f_growth_7:'Soporte por email',
      f_scale_1:'Herramientas SaaS ilimitadas',f_scale_2:'Empleados ilimitados',f_scale_3:'Análisis IA de contratos',f_scale_4:'Gestión de licencias',f_scale_5:'Informes de auditoría completos',f_scale_6:'Hasta 15 miembros',f_scale_7:'Soporte prioritario',f_scale_8:'Acceso API',
      f_pro_1:'Todo en Scale',f_pro_2:'Análisis avanzados y exportaciones BI',f_pro_3:'Integraciones personalizadas',f_pro_4:'Miembros ilimitados',f_pro_5:'SSO / SAML (hasta 500 usuarios)',f_pro_6:'Incorporación dedicada',f_pro_7:'SLA 99,9% de disponibilidad',f_pro_8:'Soporte telefónico y por chat',
      f_ent_1:'Todo en Profesional',f_ent_2:'Usuarios y espacios de trabajo ilimitados',f_ent_3:'Aprovisionamiento SCIM',f_ent_4:'Gestor de cuenta dedicado',f_ent_5:'Soporte 24/7 teléfono y Slack',f_ent_6:'Contratos y facturación personalizados',f_ent_7:'Opción local / nube privada',f_ent_8:'Revisión de seguridad e informe de prueba de penetración',
    },
    de: {
      f_startup_1:'Bis zu 10 SaaS-Tools',f_startup_2:'Bis zu 10 Mitarbeiter',f_startup_3:'Grundlegende Risikowarnungen',f_startup_4:'CSV-Export',f_startup_5:'1 Teammitglied',f_startup_6:'Community-Support',
      f_growth_1:'Bis zu 50 SaaS-Tools',f_growth_2:'Bis zu 50 Mitarbeiter',f_growth_3:'Erweiterte Risikobewertung',f_growth_4:'Finanz-Dashboard',f_growth_5:'Audit-Exporte',f_growth_6:'Bis zu 5 Mitglieder',f_growth_7:'E-Mail-Support',
      f_scale_1:'Unbegrenzte SaaS-Tools',f_scale_2:'Unbegrenzte Mitarbeiter',f_scale_3:'KI-Vertragsanalyse',f_scale_4:'Lizenzverwaltung',f_scale_5:'Vollständige Audit-Berichte',f_scale_6:'Bis zu 15 Mitglieder',f_scale_7:'Prioritäts-Support',f_scale_8:'API-Zugang',
      f_pro_1:'Alles aus Scale',f_pro_2:'Erweiterte Analysen & BI-Exporte',f_pro_3:'Benutzerdefinierte Integrationen',f_pro_4:'Unbegrenzte Mitglieder',f_pro_5:'SSO / SAML (bis 500 Nutzer)',f_pro_6:'Dediziertes Onboarding',f_pro_7:'SLA 99,9% Verfügbarkeit',f_pro_8:'Telefon- & Chat-Support',
      f_ent_1:'Alles aus Professionell',f_ent_2:'Unbegrenzte Benutzer & Arbeitsbereiche',f_ent_3:'SCIM-Bereitstellung',f_ent_4:'Dedizierter Account-Manager',f_ent_5:'24/7 Telefon- & Slack-Support',f_ent_6:'Individuelle Verträge & Abrechnung',f_ent_7:'On-Premise / Private Cloud Option',f_ent_8:'Sicherheitsüberprüfung & Pen-Test-Bericht',
    },
    ja: {
      f_startup_1:'最大10のSaaSツール',f_startup_2:'最大10名の従業員',f_startup_3:'基本リスクアラート',f_startup_4:'CSVエクスポート',f_startup_5:'チームメンバー1名',f_startup_6:'コミュニティサポート',
      f_growth_1:'最大50のSaaSツール',f_growth_2:'最大50名の従業員',f_growth_3:'高度なリスクスコアリング',f_growth_4:'財務ダッシュボード',f_growth_5:'監査エクスポート',f_growth_6:'最大5名のメンバー',f_growth_7:'メールサポート',
      f_scale_1:'SaaSツール無制限',f_scale_2:'従業員無制限',f_scale_3:'AI契約分析',f_scale_4:'ライセンス管理',f_scale_5:'完全な監査レポート',f_scale_6:'最大15名のメンバー',f_scale_7:'優先サポート',f_scale_8:'APIアクセス',
      f_pro_1:'Scaleのすべてを含む',f_pro_2:'高度な分析とBIエクスポート',f_pro_3:'カスタムインテグレーション',f_pro_4:'メンバー無制限',f_pro_5:'SSO / SAML（最大500ユーザー）',f_pro_6:'専任オンボーディング',f_pro_7:'SLA 99.9%稼働率',f_pro_8:'電話・チャットサポート',
      f_ent_1:'Professionalのすべてを含む',f_ent_2:'ユーザーとワークスペース無制限',f_ent_3:'SCIMプロビジョニング',f_ent_4:'専任アカウントマネージャー',f_ent_5:'24/7電話・Slackサポート',f_ent_6:'カスタム契約・請求',f_ent_7:'オンプレミス/プライベートクラウドオプション',f_ent_8:'セキュリティレビュー・ペネトレーションテスト報告書',
    },
  };

  const ft = (key) => (featureText[language] || featureText.en)[key] || featureText.en[key] || key;

  const getPrice = (p) => {
    if (p.isTrial) return t('free_trial_label');
    if (p.isFree || p.id === 'free') return '€0';
    if (p.id === 'enterprise' && !p.monthly) return t('contact_sales');
    const v = billing === 'monthly' ? p.monthly : p.annual;
    return billing === 'monthly' ? '€' + v + '/mo' : '€' + v + '/yr';
  };

  const getSaving = (p) => {
    if (!p.monthly || !p.annual) return null;
    const saved = p.monthly * 12 - p.annual;
    return saved > 0 ? `Save €${saved}/yr` : null;
  };

  const [upgrading, setUpgrading] = useState(false);

  // Stripe price IDs — must match products in your Stripe Dashboard
  // Currency: EUR. Annual prices have 20% discount baked in.
  const PRICE_IDS = {
    starter:    { monthly: 'price_1TMhOt1yFs6IziIVgJGBbzoG', annual: 'price_1TMhfK1yFs6IziIVOtbhpy23' },  // €29 / €278
    hr_finance: { monthly: 'price_1TWxAB1yFs6IziIVjxw3CG2V',     annual: 'price_1TWxFd1yFs6IziIVjPZnA8XT' },        // €49 / €470 ← fill after Stripe setup
    pro:        { monthly: 'price_1TMhNW1yFs6IziIV5hwlssrt', annual: 'price_1TMhNW1yFs6IziIVMxiacXD7' },  // €79 / €758
    enterprise: { monthly: 'price_1TMhNk1yFs6IziIVPkv7RiLc', annual: 'price_1TMhNk1yFs6IziIViMLzewdQ' },  // €299 / €2870
    // Legacy aliases — if any existing user has plan='growth' or 'scale', map to closest current tier
    growth:     { monthly: 'price_1TMhNW1yFs6IziIV5hwlssrt', annual: 'price_1TMhNW1yFs6IziIVMxiacXD7' },  // → pro
    scale:      { monthly: 'price_1TMhNk1yFs6IziIVPkv7RiLc', annual: 'price_1TMhNk1yFs6IziIViMLzewdQ' },  // → enterprise
    unlimited:  { monthly: 'price_1TMhNk1yFs6IziIVPkv7RiLc', annual: 'price_1TMhNk1yFs6IziIViMLzewdQ' },  // → enterprise
  };

  const upgrade = async (id) => {
    if (id === 'enterprise') { setShowContactModal(true); return; }
    if (id === 'free' || id === 'startup') return;
    const priceId = PRICE_IDS[id]?.[billing] || PRICE_IDS[id]?.monthly;
    if (!priceId) { toast.error(t('toast_plan_not_available')); return; }
    setUpgrading(true);
    try {
      const { url, error } = await createCheckoutSession(priceId);
      if (error) throw new Error(error);
      if (url) window.location.href = url;
    } catch (err) {
      toast.error(t('toast_could_not_checkout') + ' ' + err.message);
    } finally {
      setUpgrading(false);
    }
  };

  const currentPlanObj = plans.find(p => p.id === plan);

  // Render header — used both standalone (in AppShell right) and inline
  const HeaderRight = (
    <div className="flex items-center gap-2">
      {isTrial && (
        <span className="flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
          ⏱ {trialDaysLeft} {t('trial_days_left')}
        </span>
      )}
      {plan !== 'free' && plan !== 'trial' && plan !== 'startup' && (
        <button onClick={handleManageSubscription} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5" />
          Manage Subscription
        </button>
      )}
      <Pill tone="blue" icon={CreditCard}>
        {isTrial ? 'Trial' : (plan.charAt(0).toUpperCase() + plan.slice(1))}
      </Pill>
    </div>
  );

  const Body = (
    <div className="space-y-8">
      {/* Inline header for nested mode */}
      {noShell && <div className="flex items-center justify-end">{HeaderRight}</div>}

        {/* Trial Banner */}
        {isTrial && (
          <div className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 p-7 shadow-lg shadow-amber-500/5">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">⏳</span>
                  <div>
                    <h3 className="text-xl font-black text-white">{t('trial_banner_title')}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-bold text-amber-400">Day {trialDaysUsed} of {TRIAL_DAYS}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-sm text-slate-400">{trialDaysLeft} {t('trial_days_left')}</span>
                    </div>
                  </div>
                </div>
                <p className="text-slate-300 text-sm mb-4 max-w-lg">{t('trial_no_card')}</p>
                <div className="flex items-center gap-3 mb-3 max-w-xs">
                  <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-400 to-orange-400 h-3 rounded-full transition-all" style={{width: trialPct + '%'}} />
                  </div>
                  <span className="text-xs text-amber-400 font-bold whitespace-nowrap">{trialPct.toFixed(0)}% used</span>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <button onClick={() => upgrade('scale')}
                  className="px-7 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black rounded-xl transition-all shadow-lg shadow-amber-500/30 text-sm block mb-2">
                  {t('upgrade_now')} ✨
                </button>
                <p className="text-xs text-slate-500">{t('cancel_anytime')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Billing Toggle */}
        <div className="flex flex-col items-center gap-3">
          <h2 className="text-2xl font-black text-white">{t('choose_plan')}</h2>
          <div className="flex items-center gap-3 p-1 bg-slate-900 rounded-xl border border-slate-800">
            {['monthly','annual'].map(c => (
              <button key={c} onClick={() => setBilling(c)}
                className={"px-4 py-2 rounded-lg text-sm font-semibold transition-all " + (billing === c ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white')}>
                {c === 'monthly' ? t('monthly') : t('annual')}
                {c === 'annual' && <span className="ml-1.5 text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">{t('save_20')}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Plan Cards — 5 tiers in a responsive grid */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {plans.map(p => {
            const isCurrent = plan === p.id || (isTrial && p.id === 'scale');
            return (
              <div key={p.id} className={"relative rounded-2xl border p-5 flex flex-col transition-all " + p.border + (p.popular ? ' shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/30' : '')}>
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                      ⭐ {t('most_popular')}
                    </span>
                  </div>
                )}
                {p.isTrial && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                      🎯 {t('trial_badge')}
                    </span>
                  </div>
                )}
                <div className={"h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-xl mb-3 " + p.color}>
                  {p.icon}
                </div>
                <div className="font-black text-lg text-white mb-0.5">{ft(p.tName)}</div>
                <div className="text-xs text-slate-500 mb-3 min-h-[2rem]">{ft(p.tTag)}</div>
                <div className="mb-4">
                  {p.isTrial ? (
                    <div>
                      <span className="text-xl md:text-3xl font-black text-amber-400">{t('free_trial_label')}</span>
                      <div className="text-xs text-slate-400 mt-1">7 days · No credit card</div>
                    </div>
                  ) : (
                    <span className="text-xl md:text-3xl font-black text-white">{getPrice(p)}</span>
                  )}
                  {p.monthly && !p.isTrial && <span className="text-xs text-slate-500 ml-1">/{billing === 'monthly' ? t('monthly') : 'yr'}</span>}
                </div>
                {getSaving(p) && billing === 'annual' && (
                  <span className="text-xs text-emerald-400 font-bold mb-3 block">{getSaving(p)}</span>
                )}
                <div className="flex-1 space-y-2 mb-5">
                  {p.features.map(f => (
                    <div key={f.key} className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-slate-300">{ft(f.key)}</span>
                    </div>
                  ))}
                </div>
                {isCurrent ? (
                  <div className="text-center py-2.5 rounded-xl bg-slate-800/60 text-slate-400 text-xs font-semibold">
                    {isTrial ? '✓ ' + t('active_trial') : '✓ ' + t('current_plan')}
                  </div>
                ) : p.id === 'enterprise' ? (
                  <button onClick={() => setShowContactModal(true)}
                    className={"w-full py-2.5 rounded-xl border text-xs font-bold transition-all " + p.border + " text-amber-300 hover:bg-amber-500/10"}>
                    {t('contact_sales')}
                  </button>
                ) : (
                  <button onClick={() => upgrade(p.id)}
                    className={"w-full py-2.5 rounded-xl font-bold transition-all text-xs text-white bg-gradient-to-r hover:opacity-90 shadow-lg " + p.color}>
                    {isTrial ? t('upgrade_now').split('—')[0].trim() : 'Upgrade'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* After-trial explainer */}
        {isTrial && (
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6">
            <h3 className="font-bold text-white mb-4">{t('after_trial_title')}</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { day: t('after_trial_d1_day'), title: t('after_trial_d1_title'), desc: t('after_trial_d1_desc'), color: 'text-amber-400' },
                { day: t('never'), title: t('after_trial_d2_title'), desc: t('after_trial_d2_desc'), color: 'text-slate-400' },
                { day: t('after_trial_d3_day'), title: t('plan_scale'), desc: t('after_trial_d3_desc'), color: 'text-emerald-400' },
              ].map(item => (
                <div key={item.day} className="p-4 rounded-xl bg-slate-800/60">
                  <div className={"text-xs font-bold uppercase tracking-wide mb-1 " + item.color}>{item.day}</div>
                  <div className="font-semibold text-white text-sm mb-1">{item.title}</div>
                  <div className="text-xs text-slate-500">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Usage meter */}
        {!isTrial && currentPlanObj?.limits && (
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6">
            <h3 className="font-bold text-white mb-4">{t('plan_usage')}</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: t('nav_tools'), used: db?.tools?.length || 0, max: currentPlanObj.limits.tools },
                { label: t('nav_employees'), used: db?.employees?.length || 0, max: currentPlanObj.limits.employees },
              ].map(({ label, used, max }) => {
                const pct = Math.min((used / max) * 100, 100);
                return (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-slate-400">{label}</span>
                      <span className={"font-bold " + (pct > 80 ? 'text-amber-400' : 'text-white')}>{used} / {max}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div className={"h-2 rounded-full transition-all " + (pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500')} style={{width: pct + '%'}} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* Enterprise Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6" onClick={() => setShowContactModal(false)}>
          <div className="bg-slate-900 rounded-3xl border border-white/10 p-8 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-bold mb-2">{t('talk_to_sales')}</h3>
            <p className="text-slate-400 text-sm mb-6">{t('plan_enterprise_tag')}</p>
            {contactSent ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">✅</div>
                <div className="font-bold text-white mb-1">Message sent!</div>
                <div className="text-sm text-slate-400">Our sales team will contact you within 1 business day.</div>
                <button onClick={() => { setShowContactModal(false); setContactSent(false); }} className="mt-6 px-6 py-2 bg-slate-800 rounded-xl text-sm font-semibold hover:bg-slate-700 transition-colors">{t('close')}</button>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-300 block mb-1.5">{t('work_email')}</label>
                    <input value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="you@company.com" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-300 block mb-1.5">{t('company_size')}</label>
                    <select value={contactSize} onChange={e => setContactSize(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500 transition-colors">
                      {['1–10','11–50','51–200','201–500','500+'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowContactModal(false)} className="flex-1 py-3 bg-slate-800 rounded-xl font-semibold text-sm hover:bg-slate-700 transition-colors">{t('cancel')}</button>
                  <button onClick={() => { window.open('mailto:sales@stacklens.fr?subject=Enterprise%20Enquiry&body=Email%3A%20' + encodeURIComponent(contactEmail) + '%0ASize%3A%20' + encodeURIComponent(contactSize)); setContactSent(true); }}
                    className="flex-1 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:opacity-90 rounded-xl font-bold text-sm text-white transition-all">
                    {t('send_enquiry')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Render with or without AppShell
  if (noShell) return Body;
  return <AppShell title={t('billing_title')} right={HeaderRight}>{Body}</AppShell>;
}


function IntegrationConnectors() {
  const { language } = useLang();
  const t = useTranslation(language);
  const _savedConnected = (() => { try { return JSON.parse(localStorage.getItem('sg_connected_integrations') || '["google-workspace","slack"]'); } catch { return ['google-workspace','slack']; } })();
  const [connectedIntegrations, setConnectedIntegrations] = useState(_savedConnected);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  
  const integrations = [
    {
      id: 'google-workspace',
      name: 'Google Workspace',
      description: 'Import users, track licenses, scan Gmail for invoices',
      icon: '🔵',
      category: 'Identity & Directory',
      features: ['User Sync', 'License Detection', 'Invoice Scanning'],
      status: 'available',
      setupTime: '5 min',
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Send alerts, track usage, manage members',
      icon: '💬',
      category: 'Communication',
      features: ['User Sync', 'Usage Analytics', 'Alert Notifications'],
      status: 'available',
      setupTime: '3 min',
    },
    {
      id: 'microsoft-365',
      name: 'Microsoft 365',
      description: 'Azure AD sync, license tracking, usage monitoring',
      icon: '🟦',
      category: 'Identity & Directory',
      features: ['Azure AD Sync', 'License Management', 'Usage Reports'],
      status: 'available',
      setupTime: '5 min',
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Track seats, monitor activity, manage team access',
      icon: '🐙',
      category: 'Development',
      features: ['Seat Tracking', 'Activity Monitoring', 'Team Management'],
      status: 'available',
      setupTime: '2 min',
    },
    {
      id: 'okta',
      name: 'Okta',
      description: 'SSO integration, user provisioning, app discovery',
      icon: '🔐',
      category: 'Identity & Directory',
      features: ['SSO', 'User Provisioning', 'App Discovery'],
      status: 'available',
      setupTime: '10 min',
    },
    {
      id: 'salesforce',
      name: 'Salesforce',
      description: 'Track licenses, monitor usage, optimize seats',
      icon: '☁️',
      category: 'CRM',
      features: ['License Tracking', 'Usage Monitoring', 'Cost Optimization'],
      status: 'available',
      setupTime: '5 min',
    },
    {
      id: 'zoom',
      name: 'Zoom',
      description: 'Track meeting licenses, monitor usage',
      icon: '📹',
      category: 'Communication',
      features: ['License Management', 'Usage Analytics'],
      status: 'coming-soon',
      setupTime: '3 min',
    },
    {
      id: 'asana',
      name: 'Asana',
      description: 'Project management tool tracking',
      icon: '📊',
      category: 'Productivity',
      features: ['Seat Tracking', 'Usage Reports'],
      status: 'coming-soon',
      setupTime: '3 min',
    },
  ];

  const handleConnect = (integrationId) => {
    const next = connectedIntegrations.includes(integrationId)
      ? connectedIntegrations.filter(id => id !== integrationId)
      : [...connectedIntegrations, integrationId];
    setConnectedIntegrations(next);
    localStorage.setItem('sg_connected_integrations', JSON.stringify(next));
  };

  const isConnected = (id) => connectedIntegrations.includes(id);

  const filteredIntegrations = useMemo(() => {
    return integrations.filter(integration => {
      const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           integration.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || integration.category === selectedCategory;
      const matchesStatus = selectedStatus === 'all' || 
                           (selectedStatus === 'connected' && isConnected(integration.id)) ||
                           (selectedStatus === 'available' && integration.status === 'available' && !isConnected(integration.id)) ||
                           (selectedStatus === 'coming-soon' && integration.status === 'coming-soon');
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [searchQuery, selectedCategory, selectedStatus, connectedIntegrations]);

  const categories = ['all', ...new Set(integrations.map(i => i.category))];
  const connectedCount = connectedIntegrations.length;
  const availableCount = integrations.filter(i => i.status === 'available' && !isConnected(i.id)).length;
  const comingSoonCount = integrations.filter(i => i.status === 'coming-soon').length;

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* Stats Header */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-blue-500/20 rounded-2xl">
            <Plug className="h-8 w-8 text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-black text-white">{t("integration_marketplace")}</h2>
            <p className="text-slate-400">{t('int_connect_automate')}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-slate-800">
            <div className="text-xl md:text-3xl font-black text-blue-400">{integrations.length}</div>
            <div className="text-sm text-slate-400 mt-1">{t('int_total')}</div>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-slate-800">
            <div className="text-xl md:text-3xl font-black text-emerald-400">{connectedCount}</div>
            <div className="text-sm text-slate-400 mt-1">{t('connected')}</div>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-slate-800">
            <div className="text-xl md:text-3xl font-black text-purple-400">{availableCount}</div>
            <div className="text-sm text-slate-400 mt-1">{'Available'}</div>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-slate-800">
            <div className="text-xl md:text-3xl font-black text-orange-400">{comingSoonCount}</div>
            <div className="text-sm text-slate-400 mt-1">{t('coming_soon_label')}</div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder={t('search_integrations')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">{t('all_status')}</option>
            <option value="connected">{t('connected')}</option>
            <option value="available">{'Available'}</option>
            <option value="coming-soon">{t('coming_soon_label')}</option>
          </select>
        </div>
      </div>

      {/* Integration Cards - UNIFORM GRID */}
      {filteredIntegrations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIntegrations.map(integration => {
            const connected = isConnected(integration.id);
            const comingSoon = integration.status === 'coming-soon';

            return (
              <div
                key={integration.id}
                className="relative bg-slate-900 border rounded-2xl p-6 flex flex-col min-h-[380px] transition-all hover:shadow-lg"
                style={{
                  borderColor: connected ? 'rgba(16, 185, 129, 0.5)' : comingSoon ? 'rgba(71, 85, 105, 1)' : 'rgba(30, 41, 59, 1)',
                  backgroundColor: connected ? 'rgba(16, 185, 129, 0.05)' : 'rgb(15, 23, 42)',
                  opacity: comingSoon ? 0.7 : 1
                }}
              >
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                  {connected && (
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Connected
                    </span>
                  )}
                  {comingSoon && (
                    <span className="px-3 py-1 bg-slate-700 text-slate-400 text-xs font-bold rounded-full">
                      Coming Soon
                    </span>
                  )}
                </div>

                {/* Icon & Title */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-2xl md:text-5xl">{integration.icon}</div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-white">{integration.name}</h4>
                    <div className="text-xs text-slate-500 mt-1">⏱️ {integration.setupTime} setup</div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-slate-400 mb-4">{integration.description}</p>

                {/* Features */}
                <div className="space-y-2 mb-4 flex-grow">
                  {integration.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="h-4 w-4 text-blue-400 flex-shrink-0" />
                      {feature}
                    </div>
                  ))}
                </div>

                {/* Connect Button */}
                <button
                  onClick={() => !comingSoon && handleConnect(integration.id)}
                  disabled={comingSoon}
                  className="w-full py-3 rounded-xl font-bold transition-all"
                  style={{
                    backgroundColor: connected ? 'rgb(71, 85, 105)' : comingSoon ? 'rgb(71, 85, 105)' : 'rgb(37, 99, 235)',
                    color: comingSoon ? 'rgb(148, 163, 184)' : 'white',
                    cursor: comingSoon ? 'not-allowed' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!comingSoon) {
                      e.currentTarget.style.backgroundColor = connected ? 'rgb(51, 65, 85)' : 'rgb(29, 78, 216)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = connected ? 'rgb(71, 85, 105)' : comingSoon ? 'rgb(71, 85, 105)' : 'rgb(37, 99, 235)';
                  }}
                >
                  {connected ? 'Disconnect' : comingSoon ? t('coming_soon_label') : 'Connect'}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="text-2xl md:text-5xl mb-4">🔍</div>
          <h3 className="text-xl font-bold text-white mb-2">{t('no_integrations_found')}</h3>
          <p className="text-slate-400">{t('filter_adjust')}</p>
        </div>
      )}

      {/* Bottom Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-2">{t('need_different_int')}</h3>
          <p className="text-slate-400 mb-4 text-sm">
            Let us know which tools you'd like us to support.
          </p>
          <a href={"mailto:hello@stacklens.fr?subject=" + encodeURIComponent("Integration Request — Stacklens") + "&body=" + encodeURIComponent("Hi Stacklens Team,\n\nI would like to request integration support for the following application(s):\n\nApp Name: \nApp URL: \nCategory (e.g. CRM, HR, Engineering): \nApprox. # of users: \nPriority (High / Medium / Low): \n\n---\n(Add more apps below if needed)\n\nApp Name: \nApp URL: \nCategory: \nApprox. # of users: \nPriority: \n\n---\n\nAdditional context:\n\n\nThank you!")} className="block w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-all text-center">
            Request Integration
          </a>
        </div>

        <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-2">{t('need_help')}</h3>
          <p className="text-slate-400 mb-4 text-sm">
            Our team is here to help you optimize your integrations.
          </p>
          <a href={"mailto:hello@stacklens.fr?subject=" + encodeURIComponent("Support Request — Stacklens") + "&body=" + encodeURIComponent("Hi Stacklens Support,\n\nI need help with:\n\n[ ] Integration setup\n[ ] Data import / sync issues\n[ ] Billing question\n[ ] Bug report\n[ ] Feature request\n[ ] Other\n\nDescription of the issue:\n\n\nSteps to reproduce (if bug):\n1. \n2. \n3. \n\nBrowser: " + navigator.userAgent.split(' ').pop() + "\nAccount: " + (JSON.parse(localStorage.getItem('accessguard_v1') || '{}')?.user?.email || 'N/A') + "\n\nThank you!")} className="block w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all text-center">
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}

function IntegrationsPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  return (
    <AppShell title={t("nav_integrations")}>
      <IntegrationConnectors />
    </AppShell>
  );
}


// ============================================================================
// NEW ENHANCED PAGES - Added for Security, Cost, Analytics, and Settings
// ============================================================================

function SecurityCompliancePage() {
  const [secActiveTab, setSecActiveTab] = useState('security');
  const { language } = useLang();
  const t = useTranslation(language);
  const navigate = useNavigate();
  const { data: db } = useDbQuery();
  const tools = db?.tools || [];
  
  // Calculate security metrics
  const criticalTools = tools.filter(t => t.criticality === 'high' && t.status === 'active').length;
  const orphanedTools = tools.filter(t => t.status === 'orphaned').length;
  const highRiskTools = tools.filter(t => t.risk_score === 'high').length;
  
  const securityScore = Math.max(0, 100 - (orphanedTools * 10) - (highRiskTools * 5));
  
  const alerts = [
    {
      type: 'critical',
      title: `${orphanedTools} orphaned tools detected`,
      description: 'These tools have no assigned owner and may pose security risks',
      tone: 'rose',
      icon: AlertTriangle,
      route: '/tools',
    },
    {
      type: 'warning',
      title: `${highRiskTools} high-risk tools need review`,
      description: `${t('review_admin_access')} and usage patterns for these applications`,
      tone: 'amber',
      icon: AlertTriangle,
      route: '/access',
    },
    {
      type: 'info',
      title: `${criticalTools} critical tools properly secured`,
      description: 'All critical applications have assigned owners and active monitoring',
      tone: 'green',
      icon: BadgeCheck,
      route: null,
    },
  ];

  return (
    <PlanGate requires="growth" feature="Security & Compliance"><AppShell title={t('security_title')}
      right={
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
            {[
              { id: 'security', label: 'Security' },
              { id: 'audit',    label: 'Audit Export' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setSecActiveTab(tab.id)}
                className={"px-4 py-1.5 rounded-lg text-sm font-semibold transition-all " + (secActiveTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {secActiveTab === 'security' && (
        <SecurityTabContent />
      )}
      {secActiveTab === 'audit' && (
        <AuditTabContent />
      )}
    </AppShell></PlanGate>
  );
}

function SecurityTabContent() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db } = useDbQuery();
  const navigate = useNavigate();

  const tools = db?.tools || [];
  const access = db?.access || [];
  const employees = db?.employees || [];

  const orphanedTools = tools.filter(t => t.status === 'active' && !t.owner_email).length;
  const highRiskTools = tools.filter(t => computeToolDerivedRisk(t) === 'high').length;
  const criticalTools = tools.filter(t => t.criticality === 'critical').length;
  const activeTools = tools.filter(t => t.status === 'active').length;
  const formerAccess = access.filter(a => {
    const emp = employees.find(e => e.id === a.employee_id);
    return emp && (emp.status === 'offboarding' || emp.status === 'inactive') && a.status === 'active';
  }).length;
  const mfaCoverage = activeTools > 0 ? Math.round(((activeTools - orphanedTools) / activeTools) * 100) : 100;
  const securityScore = Math.max(0, Math.min(100, 100 - (orphanedTools * 10) - (highRiskTools * 5) - (formerAccess * 8)));
  const scoreColor = securityScore >= 80 ? '#10b981' : securityScore >= 60 ? '#f59e0b' : '#ef4444';
  const scoreLabel = securityScore >= 80 ? t('dl_good') : securityScore >= 60 ? t('dl_needs_work') : t('dl_critical');

  const alerts = buildRiskAlerts({ tools, access, employees }, t);
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const highAlerts = alerts.filter(a => a.severity === 'high');
  const mediumAlerts = alerts.filter(a => a.severity === 'medium');

  const isRealUser = db?.user?.is_authenticated && !db?.user?.is_demo;

  if (isRealUser && tools.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
          <Shield className="h-8 w-8 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{t('security_no_tools_title')}</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-6">{t('security_no_tools_body')}</p>
        <Link to="/tools" className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold text-white transition-colors">
          {t('security_add_tools')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Row 1: Security Score + Key Metrics ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
        
        {/* Security Score — the hero */}
        <div className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="text-center">
            <div className="relative w-40 h-40 mx-auto mb-4">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="6"/>
                <circle cx="50" cy="50" r="42" fill="none"
                  stroke={scoreColor}
                  strokeWidth="6"
                  strokeDasharray={`${2*Math.PI*42}`}
                  strokeDashoffset={`${2*Math.PI*42*(1-securityScore/100)}`}
                  strokeLinecap="round"/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-white">{securityScore}</span>
                <span className="text-sm text-slate-500">/ 100</span>
              </div>
            </div>
            <div className="text-base font-semibold" style={{color: scoreColor}}>{scoreLabel}</div>
            <p className="text-sm text-slate-500 mt-1">{t("security_overall_posture")}</p>
          </div>
        </div>

        {/* Key Metrics — 2x2 grid */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("kpi_critical")}</span>
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <div className="text-3xl font-black text-red-400">{criticalAlerts.length}</div>
            <div className="text-sm text-slate-500 mt-1">{t("hc_require_immediate_action") || "Require immediate action"}</div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("kpi_former_access")}</span>
              <UserMinus className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-3xl font-black text-amber-400">{formerAccess}</div>
            <div className="text-sm text-slate-500 mt-1">{t("hc_ex_employees_with_access") || "Ex-employees with active access"}</div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("kpi_orphaned")}</span>
              <Boxes className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-3xl font-black text-purple-400">{orphanedTools}</div>
            <div className="text-sm text-slate-500 mt-1">{t("hc_no_owner_assigned") || "No owner assigned"}</div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("kpi_mfa_coverage")}</span>
              <Shield className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-emerald-400">{mfaCoverage}%</div>
            <div className="text-sm text-slate-500 mt-1">{activeTools - orphanedTools} {t('tools_secured_sub').replace('{n}', activeTools)}</div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Risk Alerts — grouped by severity ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-white">{t('security_alerts') || 'Security Alerts'}</h2>
            <p className="text-sm text-slate-500">{alerts.length} {t('security_alerts_active')}</p>
          </div>
          <div className="flex items-center gap-2">
            {criticalAlerts.length > 0 && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">{criticalAlerts.length} {t('critical')}</span>}
            {highAlerts.length > 0 && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">{highAlerts.length} {t('high')}</span>}
            {mediumAlerts.length > 0 && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">{mediumAlerts.length} {t('medium')}</span>}
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl p-5 bg-emerald-500/5 border border-emerald-500/20">
            <BadgeCheck className="h-6 w-6 text-emerald-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-emerald-400">{t("security_all_clear")}</div>
              <div className="text-xs text-slate-500 mt-0.5">{t("security_all_clear_sub")}</div>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {alerts.map((alert, idx) => {
              const tone = alert.severity === 'critical' ? 'red' : alert.severity === 'high' ? 'amber' : 'blue';
              const AlertIcon = alert.action?.icon || Shield;
              return (
                <div key={idx} className={`flex items-start gap-4 rounded-xl p-4 border transition-colors hover:border-slate-700 ${
                  tone === 'red' ? 'bg-red-500/5 border-red-500/20' :
                  tone === 'amber' ? 'bg-amber-500/5 border-amber-500/20' :
                  'bg-blue-500/5 border-blue-500/20'
                }`}>
                  <div className={`p-2 rounded-lg flex-shrink-0 ${
                    tone === 'red' ? 'bg-red-500/10' :
                    tone === 'amber' ? 'bg-amber-500/10' : 'bg-blue-500/10'
                  }`}>
                    <AlertIcon className={`h-4 w-4 ${
                      tone === 'red' ? 'text-red-400' :
                      tone === 'amber' ? 'text-amber-400' : 'text-blue-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-white">{alert.title}</span>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        tone === 'red' ? 'bg-red-500/20 text-red-400' :
                        tone === 'amber' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>{alert.severity}</span>
                    </div>
                    <div className="text-sm text-slate-400">{alert.body || alert.description}</div>
                  </div>
                  {alert.action && (
                    <Button variant="secondary" size="sm" onClick={() => navigate(alert.action.to)} className="flex-shrink-0">
                      {alert.action.label} →
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Row 3: Compliance + Tool Security Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">

        {/* Compliance Status */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <h2 className="text-base font-semibold text-white mb-4">{t("security_compliance")}</h2>
          <div className="space-y-3">
            {[
              { name: 'SOC 2 Type II', status: 'compliant', desc: t('soc2_desc') },
              { name: 'GDPR', status: 'compliant', desc: t('gdpr_desc') },
              { name: 'HIPAA', status: tools.length > 0 ? 'review' : 'non-compliant', desc: t('hipaa_desc') },
              { name: 'ISO 27001', status: 'compliant', desc: t('iso_desc') },
            ].map((c) => (
              <div key={c.name} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/30">
                <div>
                  <div className="text-sm font-semibold text-white">{c.name}</div>
                  <div className="text-xs text-slate-500">{c.desc}</div>
                </div>
                {c.status === 'compliant' ? (
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <BadgeCheck className="h-4 w-4" />
                    <span className="text-xs font-semibold">{t('sec_compliant')}</span>
                  </div>
                ) : c.status === 'review' ? (
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-xs font-semibold">{t('sec_review_needed')}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-red-400">
                    <X className="h-4 w-4" />
                    <span className="text-xs font-semibold">{t('sec_non_compliant')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tool Security Breakdown */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
          <h2 className="text-base font-semibold text-white mb-4">{t("security_tool_breakdown")}</h2>
          {(() => {
            const riskGroups = {
              'Critical': tools.filter(t => t.criticality === 'critical' && t.status === 'active'),
              'High Risk': tools.filter(t => computeToolDerivedRisk(t) === 'high' && t.status === 'active'),
              'Orphaned': tools.filter(t => t.status === 'active' && !t.owner_email),
              'Secured': tools.filter(t => t.status === 'active' && t.owner_email && computeToolDerivedRisk(t) !== 'high'),
            };
            const total = tools.filter(t => t.status === 'active').length || 1;
            const colors = { 'Critical': '#ef4444', 'High Risk': '#f59e0b', 'Orphaned': '#8b5cf6', 'Secured': '#10b981' };
            const rgLabels = { 'Critical': t('critical'), 'High Risk': t('high_risk'), 'Orphaned': t('orphaned'), 'Secured': t('rg_secured') };
            return (
              <div className="space-y-4">
                {/* Stacked bar */}
                <div className="flex h-4 rounded-full overflow-hidden bg-slate-800">
                  {Object.entries(riskGroups).map(([key, items]) => (
                    items.length > 0 && <div key={key} className="h-full transition-all" style={{width: `${(items.length/total)*100}%`, background: colors[key]}} title={`${rgLabels[key]}: ${items.length}`} />
                  ))}
                </div>
                {/* Legend + counts */}
                <div className="space-y-2.5">
                  {Object.entries(riskGroups).map(([key, items]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{background: colors[key]}} />
                        <span className="text-sm text-slate-300">{rgLabels[key]}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-white">{items.length}</span>
                        <span className="text-xs text-slate-500 w-10 text-right">{Math.round((items.length/total)*100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Top risky tools list */}
                {riskGroups['High Risk'].length > 0 && (
                  <div className="pt-3 border-t border-slate-800">
                    <div className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wider">{t("security_high_risk_tools")}</div>
                    {riskGroups['High Risk'].slice(0,3).map(tool => (
                      <div key={tool.id} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-slate-300">{tool.name}</span>
                        <button onClick={() => navigate('/tools')} className="text-xs text-blue-400 hover:text-blue-300">{t('security_review_action')} →</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}


function CostManagementPage() {
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
    <PlanGate requires="growth" feature="Cost Management"><AppShell title={t("cost_mgmt_title")}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 data-tour="tour-cost-header" className="text-2xl md:text-3xl font-black text-white mb-1">{t("cost_mgmt_title") || "Cost Management"}</h1>
            <p className="text-slate-400">{t('fin_find_waste')}</p>
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

function AnalyticsReportsPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db } = useDbQuery();
  const navigate = useNavigate();

  const tools = db?.tools || [];
  const employees = db?.employees || [];
  const access = db?.access || [];

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
    <PlanGate requires="scale" feature="Analytics & Reports"><AppShell title={t('analytics_title')}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">{t('fin_live_insights')}</p>
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

function SettingsPage() {
  const { language, setLanguage } = useLang();
  const t = useTranslation(language);
  const navigate = useNavigate();
  const { data: db } = useDbQuery();
  const qc = useQueryClient();
  const { isDemo, firebaseUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('general');
  const [saveMsg, setSaveMsg] = useState('');
  const [stripeMsg, setStripeMsg] = useState('');

  // Handle Stripe redirect-back: ?success=true or ?cancelled=true
  useEffect(() => {
    const success = searchParams.get('success');
    const cancelled = searchParams.get('cancelled');
    if (success === 'true') {
      setActiveTab('billing');
      setStripeMsg('success');
      // Sync plan: refresh custom claims from server, then pull Firestore plan into localStorage
      if (firebaseUser?.uid) {
        syncClaimsFromServer().then(() =>
          getUserPlanFromFirestore(firebaseUser.uid)
        ).then((planData) => {
          if (planData) {
            const cur = loadDb() || seedDbIfEmpty();
            cur.user = { ...cur.user, ...planData };
            saveDb(cur);
            qc.invalidateQueries({ queryKey: ['db'] });
          }
        }).catch(() => {});
      }
      setSearchParams({}, { replace: true });
    } else if (cancelled === 'true') {
      setActiveTab('billing');
      setStripeMsg('cancelled');
      setSearchParams({}, { replace: true });
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  const muts = useDbMutations();

  const saved = JSON.parse(localStorage.getItem('sg_general') || '{}');
  const [orgName, setOrgName] = useState(saved.orgName || 'My Organisation');
  const [timezone, setTimezone] = useState(saved.timezone || 'Europe/London');
  const [currency, setCurrency] = useState(saved.currency || 'GBP (£)');
  const [dateFormat, setDateFormat] = useState(saved.dateFormat || 'DD/MM/YYYY');

  const savedSec = JSON.parse(localStorage.getItem('sg_security') || '{}');
  const [mfaEnabled, setMfaEnabled] = useState(savedSec.mfa ?? false);
  const [sessionTimeout, setSessionTimeout] = useState(savedSec.timeout || '60');
  const [ipRestrict, setIpRestrict] = useState(savedSec.ipRestrict ?? false);
  const [auditLog, setAuditLog] = useState(savedSec.auditLog ?? true);
  const [deleteToolsConfirm, setDeleteToolsConfirm] = useState(false);
  const [deleteEmpsConfirm, setDeleteEmpsConfirm] = useState(false);
  const [deleteAccConfirm, setDeleteAccConfirm] = useState(false);

  const _savedApiKeys = (() => { try { return JSON.parse(localStorage.getItem('sg_api_keys') || '[]'); } catch { return []; } })();
  const [apiKeys, setApiKeys] = useState(_savedApiKeys);
  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKey, setShowNewKey] = useState(null);

  const saveApiKeys = (next) => { localStorage.setItem('sg_api_keys', JSON.stringify(next)); setApiKeys(next); };

  const _savedNotifs = (() => { try { return JSON.parse(localStorage.getItem('sg_notifications') || '{}'); } catch { return {}; } })();
  const [notifRenewal,    setNotifRenewal]    = useState(_savedNotifs.renewal    ?? true);
  const [notifOrphaned,   setNotifOrphaned]   = useState(_savedNotifs.orphaned   ?? true);
  const [notifHighRisk,   setNotifHighRisk]   = useState(_savedNotifs.highRisk   ?? true);
  const [notifOffboard,   setNotifOffboard]   = useState(_savedNotifs.offboard   ?? true);
  const [notifNewTool,    setNotifNewTool]    = useState(_savedNotifs.newTool    ?? true);
  const [notifCompliance, setNotifCompliance] = useState(_savedNotifs.compliance ?? false);
  const [notifWeekly,     setNotifWeekly]     = useState(_savedNotifs.weekly     ?? true);
  const [notifInvoice,    setNotifInvoice]    = useState(_savedNotifs.invoice    ?? false);
  const [notifBudget,     setNotifBudget]     = useState(_savedNotifs.budget     ?? true);

  const saveNotifications = (patch) => {
    const next = { renewal: notifRenewal, orphaned: notifOrphaned, highRisk: notifHighRisk,
      offboard: notifOffboard, newTool: notifNewTool, compliance: notifCompliance,
      weekly: notifWeekly, invoice: notifInvoice, budget: notifBudget, ...patch };
    localStorage.setItem('sg_notifications', JSON.stringify(next));
    const backendChanged = 'renewal' in patch || 'weekly' in patch;
    if (backendChanged) {
      const cur = loadDb() || seedDbIfEmpty();
      cur.user = {
        ...cur.user,
        ...('renewal' in patch ? { renewal_alerts: patch.renewal } : {}),
        ...('weekly'  in patch ? { weekly_summary: patch.weekly  } : {}),
      };
      saveDb(cur);
      if (firebaseUser?.uid) saveUserData(firebaseUser.uid, cur).catch(() => {});
      qc.invalidateQueries({ queryKey: ['db'] });
    }
  };

  const _mdb = JSON.parse(localStorage.getItem('accessguard_v1') || '{}')?.user;
  const _ownerMember = {
    id: 'owner',
    name: _mdb?.displayName || _mdb?.email?.split('@')[0] || 'Owner',
    email: _mdb?.email || '',
    role: 'Owner',
    joined: new Date().toISOString().slice(0, 10),
    avatar: (_mdb?.displayName || _mdb?.email || 'O')[0].toUpperCase(),
  };
  const _savedMembers = (() => {
    try { return JSON.parse(localStorage.getItem('sg_team_members') || '[]'); } catch { return []; }
  })();
  const [members, setMembers] = useState([_ownerMember, ..._savedMembers]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [showRoleInfo, setShowRoleInfo] = useState(false);
  const myRole = getUserRole();

  const saveMembers = (next) => {
    const withoutOwner = next.filter(m => m.id !== 'owner');
    localStorage.setItem('sg_team_members', JSON.stringify(withoutOwner));
    setMembers([_ownerMember, ...withoutOwner]);
  };

  const save = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
    setSaveMsg(t('saved_msg'));
    setTimeout(() => setSaveMsg(''), 2000);
  };

  const generateApiKey = () => {
    if (!newKeyName.trim()) return;
    const key = 'sg_live_' + Math.random().toString(36).slice(2, 18) + Math.random().toString(36).slice(2, 18);
    const newK = { id: 'key_' + Date.now(), name: newKeyName, created: new Date().toISOString().slice(0,10), lastUsed: 'Never', prefix: key.slice(0,16) + '••••' };
    saveApiKeys([...apiKeys, newK]);
    setShowNewKey(key);
    setNewKeyName('');
  };

  const tabs = [
    { id: 'general',       label: t('settings_general'),       icon: Wrench, group: 'core' },
    { id: 'team',          label: t('settings_team'),          icon: Users,  group: 'core' },
    { id: 'billing',       label: t('nav_billing') || 'Billing', icon: CreditCard, group: 'core' },
    { id: 'notifications', label: t('settings_notifications'), icon: Bell,   group: 'core' },
    { id: 'integrations',  label: t('nav_integrations') || 'Integrations', icon: Plug, group: 'advanced' },
    { id: 'security',      label: t('settings_security'),      icon: Shield, group: 'advanced' },
    { id: 'api',           label: t('settings_api'),           icon: Zap,    group: 'advanced' },
    { id: 'data',          label: t('settings_data'),          icon: Download, group: 'advanced' },
  ];
  const coreTabs = tabs.filter(t => t.group === 'core');
  const advancedTabs = tabs.filter(t => t.group === 'advanced');

  const Toggle = ({ checked, onChange }) => (
    <button onClick={() => onChange(!checked)} className={"relative w-11 h-6 rounded-full transition-colors " + (checked ? 'bg-emerald-500' : 'bg-slate-700')}>
      <div className={"absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform " + (checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );

  return (
    <AppShell title={t('settings_title')} right={
      <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
        {coreTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} data-tab={tab.id}
              className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap " + (activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}>
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
        <div className="w-px h-5 bg-slate-700 mx-1" />
        {advancedTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} data-tab={tab.id}
              className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap " + (activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}>
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>
    }>
      <div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* ── GENERAL ── */}
          {activeTab === 'general' && (
            <Card>
              <CardHeader title={t('general_settings')} subtitle={t('general_settings_sub')} />
              <CardBody>
                <div className="space-y-5 max-w-2xl">
                  {[
                    { label: t('org_name_label'), el: <input value={orgName} onChange={e=>setOrgName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500 transition-colors" placeholder={t('ob_company_name')} /> },

                    { label: t('time_zone_label'), el: <select value={timezone} onChange={e=>setTimezone(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none"><option>Europe/London</option><option>UTC</option><option>America/New_York</option><option>America/Los_Angeles</option><option>Europe/Paris</option><option>Asia/Tokyo</option></select> },
                    { label: t('date_format_label'), el: <select value={dateFormat} onChange={e=>setDateFormat(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none"><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></select> },

                  ].map(({ label, el }) => (
                    <div key={label}>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
                      {el}
                    </div>
                  ))}
                  <div className="flex items-center gap-3 pt-2">
                    <button onClick={() => save('sg_general', { orgName, timezone, currency, dateFormat })}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm transition-colors">
                      {t('save_changes')}
                    </button>
                    {saveMsg && <span className="text-sm text-emerald-400 font-semibold">{saveMsg}</span>}
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* ── TEAM ── */}
          {activeTab === 'team' && (
            <div className="space-y-4">
              <Card>
                <CardHeader title={t('team_members')} subtitle={members.length + " " + t('members_with_access')} />
                <CardBody>
                  <div className="space-y-2">
                    {members.map(m => (
                      <div key={m.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-800/50 transition-colors">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{m.avatar}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white text-sm">{m.name}</div>
                          <div className="text-xs text-slate-500">{m.email}</div>
                        </div>
                        <span className={"text-xs font-semibold px-2.5 py-1 rounded-full " + (m.role === 'Owner' ? 'bg-violet-500/15 text-violet-400' : m.role === 'Admin' ? 'bg-blue-500/15 text-blue-400' : 'bg-slate-700 text-slate-400')}>{m.role}</span>
                        <div className="text-xs text-slate-600">{t('joined_label')} {m.joined}</div>
                        {m.role !== 'Owner' && can('invite') && (
                          <button onClick={() => saveMembers(members.filter(x => x.id !== m.id))} className="text-xs text-rose-500 hover:text-rose-400 transition-colors">{t('remove_member')}</button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title={t("invite_team") || "Invite Team Member"} subtitle={t('invite_sub')} />
                <CardBody>
                  {inviteSent ? (
                    <div className="text-center py-4">
                      <div className="text-3xl mb-2">📧</div>
                      <div className="font-bold text-white mb-1">{t('invite_sent_to')} {inviteEmail}</div>
                      <button onClick={() => { setInviteSent(false); setInviteEmail(''); }} className="text-sm text-emerald-400 hover:underline mt-2">{t('invite_another')}</button>
                    </div>
                  ) : (
                    <div className="flex gap-3 flex-wrap">
                      <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                        className="flex-1 min-w-48 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="colleague@company.com" />
                      <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none">
                        <option value="admin">{t('role_admin_opt')}</option>
                        <option value="editor">{t('role_editor_opt')}</option>
                        <option value="viewer">{t('role_viewer_opt')}</option>
                      </select>
                      <div className="w-full mt-2 p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1.5">
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"></span><span><span className="text-amber-400 font-semibold">{t('role_owner')}</span> — {t('role_owner_desc')}</span></div>
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0"></span><span><span className="text-blue-400 font-semibold">{t('role_admin')}</span> — {t('role_admin_desc')}</span></div>
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></span><span><span className="text-emerald-400 font-semibold">{t('role_editor')}</span> — {t('role_editor_desc')}</span></div>
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0"></span><span><span className="text-slate-300 font-semibold">{t('role_viewer')}</span> — {t('role_viewer_desc')}</span></div>
                      </div>
                      <button onClick={async () => {
                        if (!inviteEmail || inviteSending) return;
                        const limit = getPlanLimits(resolvePlan(db?.user)).teamMembers;
                        if (members.length >= limit) {
                          toast.error(`Your ${getPlanLimits(resolvePlan(db?.user)).label} plan allows ${limit} team members. Upgrade to add more.`);
                          return;
                        }
                        const newMember = {
                          id: 'invite_' + Date.now(),
                          name: inviteEmail.split('@')[0],
                          email: inviteEmail,
                          role: inviteRole.charAt(0).toUpperCase() + inviteRole.slice(1),
                          joined: new Date().toISOString().slice(0, 10),
                          avatar: inviteEmail[0].toUpperCase(),
                        };
                        saveMembers([...members, newMember]);
                        setInviteSending(true);
                        try {
                          await sendInviteEmail({
                            inviteeEmail: inviteEmail,
                            inviterName: firebaseUser?.displayName || db?.user?.email?.split('@')[0],
                            orgName: localStorage.getItem('sg_general') ? JSON.parse(localStorage.getItem('sg_general') || '{}').orgName : 'Stacklens',
                          });
                          toast.success('Invite sent!');
                        } catch {
                          // Fallback: open mailto if Cloud Function is unavailable
                          window.open('mailto:' + inviteEmail
                            + '?subject=' + encodeURIComponent('You\'ve been invited to Stacklens')
                            + '&body=' + encodeURIComponent('Hi,\n\nYou\'ve been invited to join Stacklens.\n\nSign in at: https://stacklens.fr\n\nStacklens Team'));
                        } finally {
                          setInviteSending(false);
                        }
                        setInviteSent(true);
                      }}
                        disabled={inviteSending}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap">
                        {inviteSending ? t('sending') : t('send_invite')}
                      </button>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {activeTab === 'notifications' && (
            <Card>
              <CardHeader title={t('notifications_title')} subtitle={t('notifications_sub')} />
              <CardBody>
                <div className="space-y-1">
                  {[
                    { label: t('notif_tool_added'), sub: t('notif_tool_added_sub'), defaultOn: true, key: null },
                    { label: t('notif_orphaned_tool'), sub: t('notif_orphaned_tool_sub'), defaultOn: true, key: null },
                    { label: t('notif_high_risk_access'), sub: t('notif_high_risk_access_sub'), defaultOn: true, key: null },
                    { label: t('notif_offboarding'), sub: t('notif_offboarding_sub'), defaultOn: true, key: null },
                    { label: t('notif_renewal_due'), sub: t('notif_renewal_due_sub'), defaultOn: true, key: 'renewal_alerts' },
                    { label: t('notif_compliance'), sub: t('notif_compliance_sub'), defaultOn: false, key: null },
                    { label: t('notif_weekly'), sub: t('notif_weekly_sub'), defaultOn: true, key: null },
                    { label: t('notif_invoice'), sub: t('notif_invoice_sub'), defaultOn: false, key: null },
                    { label: t('budget_limit'), sub: t('notif_budget_sub'), defaultOn: true, key: null },
                  ].map(n => {
                    const isWired = n.key === 'renewal_alerts';
                    const checked = isWired
                      ? (db?.user?.renewal_alerts !== false)
                      : n.defaultOn;
                    return (
                      <div key={n.label} className="flex items-center justify-between py-3.5 border-b border-slate-800 last:border-0">
                        <div>
                          <div className="text-sm font-medium text-slate-200 flex items-center gap-2">
                            {n.label}
                            {isWired && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 font-semibold">LIVE</span>}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{n.sub}</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={checked}
                            onChange={isWired ? (e) => {
                              muts.setAuth.mutate(
                                { renewal_alerts: e.target.checked },
                                { onSuccess: () => toast.success(e.target.checked ? t('renewal_alerts_enabled') : t('renewal_alerts_disabled')) }
                              );
                            } : undefined}
                            defaultChecked={!isWired ? n.defaultOn : undefined}
                            readOnly={!isWired}
                          />
                          <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-emerald-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                        </label>
                      </div>
                    );
                  })}
                </div>
                <div className='mt-6'><SlackNotifications /></div>
              </CardBody>
            </Card>
          )}

          {/* ── SECURITY ── */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <Card>
                <CardHeader title={t('security_settings')} subtitle={t('security_settings_sub')} />
                <CardBody>
                  <div className="space-y-4">
                    {[
                      { label: t('require_mfa'), sub: t('require_mfa_sub'), key: 'mfa', val: mfaEnabled, set: setMfaEnabled },
                      { label: t('ip_restriction'), sub: t('ip_restriction_sub'), key: 'ip', val: ipRestrict, set: setIpRestrict },
                      { label: t('audit_logging'), sub: t('audit_logging_sub'), key: 'audit', val: auditLog, set: setAuditLog },
                    ].map(item => (
                      <div key={item.key} className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
                        <div>
                          <div className="font-medium text-slate-200 text-sm">{item.label}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{item.sub}</div>
                        </div>
                        <Toggle checked={item.val} onChange={item.set} />
                      </div>
                    ))}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('session_timeout')}</label>
                      <select value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500">
                        <option value="15">{t('min_15')}</option><option value="30">{'30 min'}</option><option value="60">{'1 hr'}</option><option value="480">{'8 hrs'}</option><option value="0">{t('never')}</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-5">
                    <button onClick={() => save('sg_security', { mfa: mfaEnabled, timeout: sessionTimeout, ipRestrict, auditLog })}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm transition-colors">
                      {t('save_security')}
                    </button>
                    {saveMsg && <span className="text-sm text-emerald-400 font-semibold">{saveMsg}</span>}
                  </div>
                </CardBody>
              </Card>
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardBody>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white text-sm mb-1">{t('sso_enterprise')}</div>
                      <p className="text-xs text-slate-400">{t('sso_desc')}</p>
                      <button onClick={() => { navigate('/settings'); setTimeout(() => { const el = document.querySelector('[data-tab="billing"]'); if(el) el.click(); }, 100); }} className="text-xs text-amber-400 font-semibold hover:underline mt-2 inline-block">{t('view_enterprise_plan')} →</button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ── API KEYS ── */}
          {activeTab === 'api' && (
            <div className="space-y-4">
              <Card>
                <CardHeader title={t('api_keys_title')} subtitle={t('api_keys_sub')} />
                <CardBody>
                  {showNewKey && (
                    <div className="mb-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <div className="text-sm font-bold text-emerald-400 mb-1">✓ {t('new_key_notice')}</div>
                      <div className="font-mono text-xs bg-slate-900 px-3 py-2 rounded-lg text-white break-all">{showNewKey}</div>
                      <button onClick={() => { navigator.clipboard.writeText(showNewKey); }} className="text-xs text-emerald-400 mt-2 hover:underline">{t("hc_copy_to_clipboard")}</button>
                    </div>
                  )}
                  <div className="space-y-3">
                    {apiKeys.map(k => (
                      <div key={k.id} className="flex items-center gap-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                        <Zap className="h-4 w-4 text-slate-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white text-sm">{k.name}</div>
                          <div className="font-mono text-xs text-slate-500">{k.prefix}</div>
                        </div>
                        <div className="text-right text-xs text-slate-600">
                          <div>{t('created_label')} {k.created}</div>
                          <div>{t('last_used_label')}: {k.lastUsed}</div>
                        </div>
                        <button onClick={() => { if (window.confirm(`Revoke key "${k.name}"? This cannot be undone.`)) saveApiKeys(apiKeys.filter(x => x.id !== k.id)); }} className="text-xs text-rose-500 hover:text-rose-400 transition-colors flex-shrink-0">{t('revoke')}</button>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title={t('generate_new_key_title')} subtitle={t('generate_new_key_sub')} />
                <CardBody>
                  <div className="flex gap-3">
                    <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500 transition-colors" placeholder={t('key_name_placeholder')} />
                    <button onClick={generateApiKey}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap">
                      {t('generate_key')}
                    </button>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ── DATA & PRIVACY ── */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              <Card>
                <CardHeader title={t('export_data')} subtitle={t('export_data_sub')} />
                <CardBody>
                  {/* Single "Export everything" button — GDPR Art. 20 */}
                  <button onClick={() => {
                    if (!db) return;
                    const exportCsv = (key, rows) => {
                      if (!rows.length) return;
                      const cols = Object.keys(rows[0]);
                      const csv = [cols.join(','), ...rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
                      const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
                      a.download = `stacklens-${key}-${todayISO()}.csv`; a.click();
                    };
                    setTimeout(() => exportCsv('tools', db.tools || []), 0);
                    setTimeout(() => exportCsv('employees', db.employees || []), 300);
                    setTimeout(() => exportCsv('access', db.access || []), 600);
                    setTimeout(() => exportCsv('audit_log', db.audit_log || []), 900);
                    toast.success(t('export_all_started') || 'Exporting 4 files…');
                  }} className="w-full flex items-center justify-center gap-2 mb-4 py-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-xl text-emerald-400 font-semibold text-sm transition-colors">
                    <Download className="h-4 w-4" />
                    {t('export_all_data') || 'Export all my data (GDPR Art. 20)'}
                  </button>

                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      { label: t('export_tools_label'), desc: t('export_tools_desc'), icon: Boxes, key: 'tools' },
                      { label: t('export_employees_label'), desc: t('export_employees_desc'), icon: Users, key: 'employees' },
                      { label: t('export_audit_label'), desc: t('export_audit_desc'), icon: Download, key: 'access' },
                    ].map(({ label, desc, icon: Icon, key }) => (
                      <button key={key} onClick={() => {
                        const rows = db?.[key] || [];
                        if (!rows.length) { toast(t('no_data_to_export') || 'No data to export'); return; }
                        const cols = Object.keys(rows[0]);
                        const csv = [cols.join(','), ...rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
                        const a = document.createElement('a');
                        a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
                        a.download = 'stacklens-' + key + '-' + new Date().toISOString().slice(0,10) + '.csv';
                        a.click();
                      }}
                        className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/60 border border-slate-800 hover:border-emerald-500/30 hover:bg-slate-800 transition-all text-left">
                        <Icon className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-white text-sm">{label}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardBody>
              </Card>
              <Card className="border-rose-500/20 bg-rose-500/5">
                <CardHeader title={t('danger_zone')} subtitle={t('danger_zone_sub')} />
                <CardBody>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-3 border-b border-rose-500/10">
                      <div>
                        <div className="font-medium text-slate-200 text-sm">{t('delete_tools')}</div>
                        <div className="text-xs text-slate-500">{t('del_tools_desc')}</div>
                      </div>
                      {deleteToolsConfirm ? (
                        <ConfirmButtons onConfirm={() => { muts.updateDb({ tools: [] }); toast.success(t('toast_deleted')); setDeleteToolsConfirm(false); }} onCancel={() => setDeleteToolsConfirm(false)} />
                      ) : (
                        <button onClick={() => setDeleteToolsConfirm(true)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors">
                          {t('del_tools_btn')}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-rose-500/10">
                      <div>
                        <div className="font-medium text-slate-200 text-sm">{t('delete_employees')}</div>
                        <div className="text-xs text-slate-500">{t('del_employees_desc')}</div>
                      </div>
                      {deleteEmpsConfirm ? (
                        <ConfirmButtons onConfirm={() => { muts.updateDb({ employees: [], access: [] }); toast.success(t('toast_deleted')); setDeleteEmpsConfirm(false); }} onCancel={() => setDeleteEmpsConfirm(false)} />
                      ) : (
                        <button onClick={() => setDeleteEmpsConfirm(true)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors">
                          {t('del_employees_btn')}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <div className="font-medium text-slate-200 text-sm">{t('delete_account')}</div>
                        <div className="text-xs text-slate-500">{t('del_account_desc')}</div>
                      </div>
                      {deleteAccConfirm ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-rose-300">{t('del_account_confirm')}</span>
                          <ConfirmButtons onConfirm={async () => {
                            setDeleteAccConfirm(false);
                            try {
                              await deleteAccount();
                              toast.success(t('del_account_done') || 'Account deleted');
                            } catch (err) {
                              if (err.code === 'auth/requires-recent-login') {
                                toast.error(t('del_account_reauth') || 'Please sign out and sign back in, then try again.');
                              } else {
                                toast.error(err.message);
                              }
                            }
                          }} onCancel={() => setDeleteAccConfirm(false)} />
                        </div>
                      ) : (
                        <button onClick={() => setDeleteAccConfirm(true)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 transition-colors">
                          {t('del_account_btn')}
                        </button>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ── BILLING ── */}
          {activeTab === 'billing' && (
            <div className="space-y-4">
              {stripeMsg === 'success' && (
                <div className="flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3">
                  <span className="text-lg mt-0.5">🎉</span>
                  <div>
                    <p className="text-sm font-semibold text-green-400">{t('stripe_success_title') || 'Subscription activated!'}</p>
                    <p className="text-xs text-green-300/80 mt-0.5">{t('stripe_success_sub') || 'Your plan is now active. Welcome aboard — your full stack is unlocked.'}</p>
                  </div>
                  <button onClick={() => setStripeMsg('')} className="ml-auto text-green-400/60 hover:text-green-400 text-lg leading-none">×</button>
                </div>
              )}
              {stripeMsg === 'cancelled' && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                  <span className="text-lg mt-0.5">💡</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-400">{t('stripe_cancelled_title') || 'Checkout cancelled'}</p>
                    <p className="text-xs text-amber-300/80 mt-0.5">{t('stripe_cancelled_sub') || "No charge was made. Upgrade whenever you're ready."}</p>
                  </div>
                  <button onClick={() => setStripeMsg('')} className="ml-auto text-amber-400/60 hover:text-amber-400 text-lg leading-none">×</button>
                </div>
              )}
              <RoleGate requires="owner" fallback={
                <Card><CardBody>
                  <div className="text-center py-8">
                    <div className="text-3xl mb-3">🔒</div>
                    <h3 className="text-lg font-semibold text-white mb-1">Owner Access Required</h3>
                    <p className="text-slate-400 text-sm">Only the account owner can manage billing and subscriptions.</p>
                  </div>
                </CardBody></Card>
              }>
                <BillingPage noShell={true} />
              </RoleGate>
            </div>
          )}

          {/* ── INTEGRATIONS ── */}
          {activeTab === 'integrations' && (
            <div className="space-y-4">
              <Card>
                <CardHeader title={t('nav_integrations') || 'Integrations'} subtitle={t('integrations_connect_sub')} />
                <CardBody>
                  <IntegrationConnectors />
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ============================================================================
// FOUNDER ADMIN DASHBOARD — only visible when db.user.is_founder === true
// ============================================================================
function FounderAdminPage() {
  const { data: db } = useDbQuery();
  const dbUser = db?.user;
  const { language } = useLang();
  const t = useTranslation(language);
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState({});

  const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;

  useEffect(() => {
    if (!dbUser?.is_founder) { navigate('/dashboard', { replace: true }); return; }
    loadAllUsersAdmin()
      .then(list => { setUsers(list); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [dbUser, navigate]);

  const trialDaysLeft = (u) => {
    if (!u.trial_started_at) return null;
    const start = typeof u.trial_started_at === 'number' ? u.trial_started_at : u.trial_started_at?.toMillis?.() || 0;
    const left = Math.ceil((start + TRIAL_MS - Date.now()) / 86400000);
    return left;
  };

  const effectivePlan = (u) => {
    if (u.is_founder) return 'founder';
    if (u.plan === 'trial') {
      const left = trialDaysLeft(u);
      return left > 0 ? `trial (${left}d left)` : 'trial (expired)';
    }
    return u.subscription_plan || u.plan || 'free';
  };

  const handleExtendTrial = async (uid, days) => {
    setActionLoading(prev => ({ ...prev, [uid]: true }));
    try {
      await founderExtendTrial(uid, days);
      toast.success(t('toast_trial_extended') + ' ' + days + ' ' + t('days'));
      const updated = await loadAllUsersAdmin();
      setUsers(updated);
    } catch (e) {
      toast.error(t('toast_failed') + ' ' + e.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [uid]: false }));
    }
  };

  const handleSetPlan = async (uid, plan) => {
    setActionLoading(prev => ({ ...prev, [uid]: true }));
    try {
      await founderSetPlan(uid, plan);
      toast.success(t('toast_plan_set') + ' ' + plan);
      const updated = await loadAllUsersAdmin();
      setUsers(updated);
    } catch (e) {
      toast.error(t('toast_failed') + ' ' + e.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [uid]: false }));
    }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || (u.email || '').toLowerCase().includes(q) || (u.displayName || '').toLowerCase().includes(q) || (u.uid || '').toLowerCase().includes(q);
  });

  const planBadgeColor = (u) => {
    const p = u.subscription_plan || u.plan || 'free';
    if (u.is_founder) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    if (p === 'trial') return trialDaysLeft(u) > 0 ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30';
    if (['pro', 'enterprise', 'scale'].includes(p)) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (['starter', 'hr_finance'].includes(p)) return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
    return 'bg-slate-700/60 text-slate-400 border-slate-600/30';
  };

  if (!dbUser?.is_founder) return null;

  const stats = {
    total: users.length,
    trial: users.filter(u => u.plan === 'trial' && trialDaysLeft(u) > 0).length,
    paid: users.filter(u => ['starter','hr_finance','pro','enterprise','scale','growth','unlimited'].includes(u.subscription_plan || u.plan)).length,
    free: users.filter(u => (u.plan || 'free') === 'free').length,
  };

  return (
    <AppShell title="Founder Admin" right={
      <span className="text-xs text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-full">
        ⚡ Founder only
      </span>
    }>
      <div className="space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total accounts', value: stats.total, color: 'text-white' },
            { label: 'Active trials', value: stats.trial, color: 'text-blue-400' },
            { label: 'Paid', value: stats.paid, color: 'text-emerald-400' },
            { label: 'Free', value: stats.free, color: 'text-slate-400' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('set_search_email_name')}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16 text-slate-500">Loading accounts…</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-400 text-sm">{error}</div>
        ) : (
          <div className="rounded-2xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('set_account')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('plan')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('set_trial_started')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('th_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-12 text-slate-500">{t('set_no_accounts')}</td></tr>
                  ) : filtered.map(u => {
                    const busy = actionLoading[u.uid];
                    const trialStart = u.trial_started_at
                      ? new Date(typeof u.trial_started_at === 'number' ? u.trial_started_at : u.trial_started_at?.toMillis?.() || 0).toLocaleDateString()
                      : '—';
                    return (
                      <tr key={u.uid} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white text-sm">{u.displayName || <span className="text-slate-500 italic">No name</span>}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{u.email || <span className="text-slate-600 italic">No email</span>}</div>
                          <div className="text-xs text-slate-700 mt-0.5 font-mono select-all">{u.uid}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${planBadgeColor(u)}`}>
                            {effectivePlan(u)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{trialStart}</td>
                        <td className="px-4 py-3">
                          {!u.is_founder && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => handleExtendTrial(u.uid, 7)}
                                disabled={busy}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all whitespace-nowrap"
                              >
                                {busy ? '…' : '+7 days trial'}
                              </button>
                              <button
                                onClick={() => handleExtendTrial(u.uid, 14)}
                                disabled={busy}
                                className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-xs font-semibold rounded-lg transition-all whitespace-nowrap"
                              >
                                {busy ? '…' : '+14 days'}
                              </button>
                              <select
                                onChange={e => { if (e.target.value) handleSetPlan(u.uid, e.target.value); e.target.value = ''; }}
                                disabled={busy}
                                defaultValue=""
                                className="px-2 py-1 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg cursor-pointer disabled:opacity-50"
                              >
                                <option value="">Set plan…</option>
                                {['free','trial','starter','hr_finance','pro','enterprise'].map(p => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          {u.is_founder && <span className="text-amber-400 text-xs">⚡ You</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHAREABLE REPORT
// ─────────────────────────────────────────────────────────────────────────────

function ShareReportModal({ onClose, db, user }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const [step, setStep] = useState('idle'); // idle | generating | done | error
  const [token, setToken] = useState(null);
  const [copied, setCopied] = useState(false);
  const [expiry, setExpiry] = useState('7');

  const reportUrl = token ? `${window.location.origin}/report/${token}` : '';

  const generate = async () => {
    setStep('generating');
    try {
      const tok = crypto.randomUUID().replace(/-/g, '');
      const tools = (db?.tools || []).map(t => ({
        name: t.name,
        category: t.category || 'other',
        cost: Number(t.cost_per_month || 0),
        status: t.status || 'active',
        risk: t.derived_risk || t.risk_score || 'low',
        criticality: t.criticality || 'medium',
      }));
      const topTools = [...tools].sort((a, b) => b.cost - a.cost).slice(0, 8);
      const spend = tools.reduce((s, t) => s + t.cost, 0);
      const riskCounts = tools.reduce((acc, t) => { acc[t.risk] = (acc[t.risk] || 0) + 1; return acc; }, {});
      const access = db?.access || [];
      const formerAccess = access.filter(a => a.derived_risk_flag === 'former_employee' || a.risk_flag === 'former_employee').length;
      const highRiskTools = tools.filter(t => t.risk === 'high').length;
      const expiresAt = Date.now() + parseInt(expiry) * 24 * 60 * 60 * 1000;

      const payload = {
        owner_uid: user?.uid || '',
        created_at: Date.now(),
        expires_at: expiresAt,
        snapshot: {
          tools: topTools,
          spend,
          employeeCount: (db?.employees || []).length,
          riskCounts,
          topTools,
          formerAccess,
          highRiskTools,
          companyName: user?.displayName?.split(' ')[0] + "'s company" || 'Your company',
          generatedAt: Date.now(),
        },
      };
      await saveReport(tok, payload);
      setToken(tok);
      setStep('done');
    } catch (err) {
      console.error(err);
      setStep('error');
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(reportUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const revoke = async () => {
    if (!token) return;
    try { await deleteReport(token); } catch (e) {}
    setToken(null);
    setStep('idle');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(2,6,23,0.85)', backdropFilter:'blur(12px)'}} onClick={onClose}>
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all z-10">✕</button>

        <div className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xl">🔗</div>
            <div>
              <div className="font-bold text-white text-lg">{t('share_report')}</div>
              <div className="text-xs text-slate-500">Read-only link — no sign-in required</div>
            </div>
          </div>

          {step === 'idle' && (
            <div className="space-y-5">
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4 space-y-2 text-sm text-slate-400">
                <div className="flex items-center gap-2"><span>💸</span> {t('share_monthly_summary')}</div>
                <div className="flex items-center gap-2"><span>⚠️</span> {t('share_risk_overview')}</div>
                <div className="flex items-center gap-2"><span>🛠️</span> {t('share_top_tools_cost')}</div>
                <div className="flex items-center gap-2"><span>🔒</span> {t('share_emails_hidden')}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">{t('share_link_expires')}</label>
                <div className="flex gap-2">
                  {[['7','7 days'],['30','30 days'],['365','1 year']].map(([val, label]) => (
                    <button key={val} onClick={() => setExpiry(val)}
                      className={"flex-1 py-2 rounded-xl text-sm font-semibold border transition-all " +
                        (expiry === val ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={generate}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl text-white font-bold text-sm transition-all shadow-lg">
                Generate shareable link →
              </button>
            </div>
          )}

          {step === 'generating' && (
            <div className="py-12 text-center">
              <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <div className="text-slate-400 text-sm">Generating your report…</div>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                <div className="text-xs font-semibold text-emerald-400 mb-2 uppercase tracking-wide">{t('share_your_link')}</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono truncate">{reportUrl}</div>
                  <button onClick={copy}
                    className={"px-3 py-2 rounded-lg text-xs font-bold transition-all flex-shrink-0 " + (copied ? 'bg-emerald-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300')}>
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="text-xs text-slate-500 text-center">Expires in {expiry} day{expiry !== '1' ? 's' : ''} · Anyone with this link can view</div>
              <div className="flex gap-2">
                <button onClick={copy}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold text-sm transition-all">
                  {copied ? '✓ Copied!' : '📋 Copy link'}
                </button>
                <button onClick={revoke}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 rounded-xl text-slate-400 text-sm font-semibold transition-all">
                  {t('revoke')}
                </button>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="py-8 text-center space-y-3">
              <div className="text-3xl">⚠️</div>
              <div className="text-white font-semibold">{t('share_could_not_generate')}</div>
              <div className="text-slate-400 text-sm">{t('share_make_sure_signed')}</div>
              <button onClick={() => setStep('idle')} className="text-sm text-blue-400 hover:text-blue-300 underline">{t('share_try_again')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { token } = useParams();
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | found | expired | notfound

  useEffect(() => {
    if (!token) { setStatus('notfound'); return; }
    getReport(token).then(data => {
      if (!data) { setStatus('notfound'); return; }
      if (data.expires_at && Date.now() > data.expires_at) { setStatus('expired'); return; }
      setReport(data);
      setStatus('found');
    });
  }, [token]);

  if (status === 'loading') return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (status === 'expired') return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="text-center space-y-3">
        <div className="text-5xl">⏰</div>
        <div className="text-white font-bold text-xl">{t('share_expired')}</div>
        <div className="text-slate-400 text-sm">{t('share_ask_owner_new')}</div>
        <a href="/" className="inline-block mt-4 text-blue-400 hover:text-blue-300 text-sm underline">Go to Stacklens →</a>
      </div>
    </div>
  );

  if (status === 'notfound') return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="text-center space-y-3">
        <div className="text-5xl">🔍</div>
        <div className="text-white font-bold text-xl">{t('share_not_found')}</div>
        <div className="text-slate-400 text-sm">{t('share_revoked_or_never')}</div>
        <a href="/" className="inline-block mt-4 text-blue-400 hover:text-blue-300 text-sm underline">Go to Stacklens →</a>
      </div>
    </div>
  );

  const s = report.snapshot;
  const fmt = (n) => new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  const riskColor = { high: 'text-rose-400', medium: 'text-amber-400', low: 'text-emerald-400' };
  const riskBg = { high: 'bg-rose-500/10 border-rose-500/20', medium: 'bg-amber-500/10 border-amber-500/20', low: 'bg-emerald-500/10 border-emerald-500/20' };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-black text-white text-sm">Stacklens</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest">{t('share_read_only')}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Generated {new Date(s.generatedAt).toLocaleDateString()}</span>
            <a href="/" className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors">Try Stacklens free →</a>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{t('share_saas_stack_report')}</h1>
          <p className="text-slate-400 text-sm">{s.companyName} · Shared via Stacklens</p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t('monthly_spend'), value: fmt(s.spend), icon: '💸', color: 'blue' },
            { label: t('tools_tracked'), value: s.tools?.length || 0, icon: '🛠️', color: 'indigo' },
            { label: t('nav_employees'), value: s.employeeCount || 0, icon: '👥', color: 'violet' },
            { label: t('former_employee_access'), value: s.formerAccess || 0, icon: '⚠️', color: s.formerAccess > 0 ? 'rose' : 'emerald' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className={`rounded-2xl border bg-slate-900/60 p-4 border-${color}-500/20`}>
              <div className="text-xl mb-1">{icon}</div>
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Risk breakdown */}
        {s.riskCounts && Object.keys(s.riskCounts).length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="text-sm font-bold text-white mb-4">{t('share_risk_breakdown')}</div>
            <div className="flex gap-3 flex-wrap">
              {Object.entries(s.riskCounts).sort((a,b) => ['high','medium','low'].indexOf(a[0]) - ['high','medium','low'].indexOf(b[0])).map(([risk, count]) => (
                <div key={risk} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${riskBg[risk] || 'bg-slate-800 border-slate-700'}`}>
                  <span className={`text-lg font-bold ${riskColor[risk] || 'text-slate-300'}`}>{count}</span>
                  <span className="text-xs text-slate-400 capitalize">{risk} risk</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top tools table */}
        {s.topTools?.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <div className="font-bold text-white text-sm">{t('share_top_tools_monthly')}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50">
                    <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('tool_name')}</th>
                    <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">{t('category')}</th>
                    <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('th_status')}</th>
                    <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('th_risk')}</th>
                    <th className="text-right py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('share_monthly_cost')}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.topTools.map((tool, i) => (
                    <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-5 font-semibold text-white">{tool.name}</td>
                      <td className="py-3 px-5 text-slate-400 capitalize hidden sm:table-cell">{tool.category}</td>
                      <td className="py-3 px-5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${
                          tool.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' :
                          tool.status === 'orphaned' ? 'bg-amber-500/15 text-amber-400' :
                          tool.status === 'unused' ? 'bg-rose-500/15 text-rose-400' :
                          'bg-slate-700 text-slate-400'}`}>
                          {tool.status}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`text-xs font-semibold capitalize ${riskColor[tool.risk] || 'text-slate-400'}`}>{tool.risk}</span>
                      </td>
                      <td className="py-3 px-5 text-right font-semibold text-white">{fmt(tool.cost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-700 bg-slate-950/40">
                    <td colSpan={3} className="py-3 px-5 text-xs text-slate-500">{t('share_total_shown')}</td>
                    <td />
                    <td className="py-3 px-5 text-right font-bold text-white">{fmt(s.spend)}/mo</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-500/10 to-indigo-500/5 p-6 text-center">
          <div className="text-white font-bold text-lg mb-2">{t('share_want_this')}</div>
          <p className="text-slate-400 text-sm mb-4 max-w-sm mx-auto">Stacklens gives you this dashboard in under 5 minutes. Free plan available — no credit card needed.</p>
          <a href="/" className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl text-white font-bold text-sm transition-all shadow-lg">
            Try Stacklens free →
          </a>
        </div>

        <div className="text-center text-xs text-slate-700 pb-4">
          Powered by <a href="/" className="text-slate-500 hover:text-slate-400">Stacklens</a> · This report was shared by the account owner · Employee data is anonymised
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  const { language } = useLang();
  const t = useTranslation(language);
  return <Navigate to="/" replace />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 250,
    },
  },
});


// ============================================================================
// LEGAL PAGES - Privacy, Terms, Security
// ── Contact Page ──────────────────────────────────────────────
function ContactPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const initialSubject = params.get('subject') || 'general';
  const [form, setForm] = useState({ name: '', email: '', subject: initialSubject, message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const subjects = [
    { value: 'general', label: t('contact_subject_general') },
    { value: 'sales', label: t('contact_subject_sales') },
    { value: 'support', label: t('contact_subject_support') },
    { value: 'feedback', label: t('contact_subject_feedback') },
    { value: 'partnership', label: t('contact_subject_partnership') },
    { value: 'enterprise', label: t('contact_subject_enterprise') },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setSending(true);
    try {
      // Send via Web3Forms (free, no backend needed)
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: import.meta.env.VITE_WEB3FORMS_KEY || '',
          from_name: form.name,
          email: form.email,
          subject: `[Stacklens ${form.subject}] from ${form.name}`,
          message: `Subject: ${subjects.find(s => s.value === form.subject)?.label || form.subject}\n\nFrom: ${form.name} (${form.email})\n\n${form.message}`,
          to: 'hello@stacklens.fr',
        }),
      });
      if (res.ok) {
        setSent(true);
        setForm({ name: '', email: '', subject: 'general', message: '' });
      } else {
        // Fallback: open mailto
        window.location.href = `mailto:hello@stacklens.fr?subject=${encodeURIComponent(`[Stacklens ${form.subject}] ${form.name}`)}&body=${encodeURIComponent(form.message + '\n\nFrom: ' + form.name + ' (' + form.email + ')')}`;
      }
    } catch {
      // Fallback: open mailto
      window.location.href = `mailto:hello@stacklens.fr?subject=${encodeURIComponent(`[Stacklens ${form.subject}] ${form.name}`)}&body=${encodeURIComponent(form.message + '\n\nFrom: ' + form.name + ' (' + form.email + ')')}`;
    }
    setSending(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-6">✉️</div>
          <h1 className="text-3xl font-bold mb-4">{t('contact_sent_title')}</h1>
          <p className="text-slate-400 mb-8">{t('contact_sent_body')}</p>
          <button onClick={() => navigate('/')} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold text-white transition-all">
            {t('contact_back_home')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-white flex items-center gap-1">
            ← {t('back')}
          </button>
          <LangSelectorCompact />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Left — form */}
          <div className="lg:col-span-3">
            <h1 className="text-3xl font-bold mb-2">{t('contact_title')}</h1>
            <p className="text-slate-400 mb-8">{t('contact_subtitle')}</p>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">{t('contact_full_name')} *</label>
                  <input
                    type="text" required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                    placeholder={t('contact_your_name')}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">{t('contact_work_email')} *</label>
                  <input
                    type="email" required value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                    placeholder={t('contact_your_email')}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">{t('contact_subject')}</label>
                <select
                  value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value}))}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  {subjects.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">{t('contact_message')} *</label>
                <textarea
                  required rows={6} value={form.message} onChange={e => setForm(f => ({...f, message: e.target.value}))}
                  placeholder={t('contact_how_help')}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={sending || !form.name || !form.email || !form.message}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white transition-all"
              >
                {sending ? t('contact_sending') : t('contact_send')}
              </button>
            </div>
          </div>

          {/* Right — info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <h3 className="text-sm font-bold text-white mb-4">{t('contact_other_ways')}</h3>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{t('contact_general')}</div>
                  <a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a>
                </div>
                <div>
                  <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Support</div>
                  <a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a>
                </div>
                <div>
                  <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{t('contact_sales_enterprise')}</div>
                  <a href="mailto:sales@stacklens.fr" className="text-blue-400 hover:text-blue-300">sales@stacklens.fr</a>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <h3 className="text-sm font-bold text-white mb-3">{t('contact_response_time')}</h3>
              <div className="space-y-2 text-sm text-slate-400">
                <div className="flex justify-between"><span>{t('contact_general_q')}</span><span className="text-slate-300">{'< 24h'}</span></div>
                <div className="flex justify-between"><span>Support</span><span className="text-slate-300">{'< 12h'}</span></div>
                <div className="flex justify-between"><span>{t('contact_sales_label')}</span><span className="text-slate-300">{'< 4h'}</span></div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <h3 className="text-sm font-bold text-white mb-3">{t('contact_based_in')}</h3>
              <p className="text-sm text-slate-400">Paris, France 🇫🇷</p>
              <p className="text-xs text-slate-500 mt-2">{t('contact_timezone')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Legal Mentions (Mentions Légales — required by French LCEN law) ──
// ============================================================================
// DPA — Data Processing Agreement (GDPR Article 28 compliant)
// Required before any B2B customer can be signed
// ============================================================================
function DpaPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-white flex items-center gap-1">← {t('back')}</button>
          <LangSelectorCompact />
        </div>
        <h1 className="text-3xl font-bold mb-2">{t('dpa_title')}</h1>
        <p className="text-slate-400 text-sm mb-2">{t('dpa_subtitle')} · {t('dpa_version')} 1.0 · {t('dpa_effective')} May 2026</p>
        <p className="text-slate-400 text-sm mb-10">{t('dpa_auto_accepted')}</p>

        <div className="space-y-8 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s1_title')}</h2>
            <p>{t('dpa_s1_body')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s2_title')}</h2>
            <p>{t('dpa_s2_body')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s3_title')}</h2>
            <p>{t('dpa_s3_intro')}</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-400">
              <li>{t('dpa_s3_item1')}</li>
              <li>{t('dpa_s3_item2')}</li>
              <li>{t('dpa_s3_item3')}</li>
              <li>{t('dpa_s3_item4')}</li>
              <li>{t('dpa_s3_item5')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s4_title')}</h2>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>{t('dpa_s4_item1')}</li>
              <li>{t('dpa_s4_item2')}</li>
              <li>{t('dpa_s4_item3')}</li>
              <li>{t('dpa_s4_item4')}</li>
              <li>{t('dpa_s4_item5')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s5_title')}</h2>
            <p>{t('dpa_s5_body')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s6_title')}</h2>
            <p className="mb-2">{t('dpa_s6_intro')}</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>{t('dpa_s6_item1')}</li>
              <li>{t('dpa_s6_item2')}</li>
              <li>{t('dpa_s6_item3')}</li>
              <li>{t('dpa_s6_item4')}</li>
              <li>{t('dpa_s6_item5')}</li>
              <li>{t('dpa_s6_item6')}</li>
              <li>{t('dpa_s6_item7')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s7_title')}</h2>
            <p>{t('dpa_s7_body')}</p>
            <p className="mt-2"><Link to="/sub-processors" className="text-blue-400 hover:text-blue-300">{t('dpa_s7_link')}</Link></p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s8_title')}</h2>
            <p>{t('dpa_s8_body')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s9_title')}</h2>
            <p>{t('dpa_s9_body')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s10_title')}</h2>
            <p>{t('dpa_s10_body')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s11_title')}</h2>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>{t('dpa_s11_item1')}</li>
              <li>{t('dpa_s11_item2')}</li>
              <li>{t('dpa_s11_item3')}</li>
              <li>{isFr ? 'Acceptations légales (CGU/CGV/DPA) : 5 ans (preuve contractuelle)' : 'Legal acceptances (ToS/DPA): 5 years (contractual proof)'}</li>
              <li>{t('dpa_s11_item4')}</li>
              <li>{t('dpa_s11_item5')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s12_title')}</h2>
            <p>{t('dpa_s12_body')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s13_title')}</h2>
            <p>{t('dpa_s13_body')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s14_title')}</h2>
            <p>{t('dpa_s14_body')}</p>
          </section>

          <section className="bg-slate-900/60 border border-slate-700 rounded-xl p-5">
            <h2 className="text-base font-semibold text-white mb-2">{t('dpa_contact_title')}</h2>
            <p className="text-slate-400">{t('dpa_contact_body')}</p>
            <p className="mt-2"><a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a></p>
            <p className="mt-1 text-xs text-slate-500">{t('dpa_response_time')}</p>
          </section>

          <div className="pt-8 border-t border-slate-800 text-xs text-slate-500 flex flex-wrap gap-4">
            <Link to="/privacy" className="text-blue-400 hover:text-blue-300">{t('dpa_footer_privacy')}</Link>
            <Link to="/sub-processors" className="text-blue-400 hover:text-blue-300">{t('dpa_footer_subproc')}</Link>
            <Link to="/legal" className="text-blue-400 hover:text-blue-300">{t('dpa_footer_legal')}</Link>
            <Link to="/terms" className="text-blue-400 hover:text-blue-300">{t('dpa_footer_terms')}</Link>
            <span className="ml-auto">{t('dpa_footer_updated')}: May 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-PROCESSORS PAGE
// ============================================================================
function SubProcessorsPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const isFr = language === 'fr';
  const navigate = useNavigate();

  const processors = [
    { name: 'Google Firebase', purpose: t('subproc_firebase_purpose'), location: 'EU (Belgique / Belgium)', link: 'https://firebase.google.com/support/privacy', transfer: t('subproc_firebase_transfer') },
    { name: 'Google Cloud Platform', purpose: t('subproc_gcp_purpose'), location: 'EU', link: 'https://cloud.google.com/privacy', transfer: t('subproc_gcp_transfer') },
    { name: 'Stripe', purpose: t('subproc_stripe_purpose'), location: 'EU (Irlande / Ireland)', link: 'https://stripe.com/privacy', transfer: t('subproc_stripe_transfer') },
    { name: 'Anthropic (Claude AI)', purpose: t('subproc_anthropic_purpose'), location: 'USA', link: 'https://www.anthropic.com/privacy', transfer: t('subproc_anthropic_transfer') },
    { name: 'OVHcloud', purpose: t('subproc_ovh_purpose'), location: 'EU (France)', link: 'https://www.ovhcloud.com/fr/personal-data-protection/', transfer: t('subproc_ovh_transfer') },
    { name: 'Google Analytics', purpose: t('subproc_ga_purpose'), location: 'EU', link: 'https://support.google.com/analytics/answer/6004245', transfer: t('subproc_ga_transfer') },
    { name: 'SendGrid (Twilio)', purpose: isFr ? 'Envoi d\'emails transactionnels (alertes de renouvellement)' : 'Transactional email delivery (renewal alerts)', location: 'USA', link: 'https://www.twilio.com/en-us/legal/privacy', transfer: isFr ? 'Transfert vers USA — SCCs en place' : 'Transfer to USA — SCCs in place' },
    { name: 'Web3Forms', purpose: isFr ? 'Traitement des soumissions du formulaire de contact' : 'Contact form submission processing', location: 'USA', link: 'https://web3forms.com/privacy', transfer: isFr ? 'Email de contact uniquement, aucune donnée conservée' : 'Contact email only, no data retained' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-white flex items-center gap-1">← {t('back')}</button>
          <LangSelectorCompact />
        </div>
        <h1 className="text-3xl font-bold mb-2">{t('subproc_title')}</h1>
        <p className="text-slate-400 text-sm mb-2">{t('subproc_last_updated')}: May 2026</p>
        <p className="text-slate-400 text-sm mb-10">{t('subproc_intro')}</p>

        <div className="space-y-4">
          {processors.map((p, i) => (
            <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-semibold text-white text-base">{p.name}</h3>
                  <p className="text-slate-400 text-sm mt-1">{p.purpose}</p>
                </div>
                <div className="text-right text-xs text-slate-500 min-w-[140px]">
                  <div className="font-medium text-slate-300">📍 {p.location}</div>
                  <div className="mt-1">{p.transfer}</div>
                </div>
              </div>
              <div className="mt-3">
                <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">
                  {t('subproc_privacy_policy_link')}
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-2">{t('subproc_change_notif_title')}</h2>
          <p className="text-slate-400 text-sm">{t('subproc_change_notif_body')}</p>
          <p className="text-sm mt-3">{t('subproc_questions')} <a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a></p>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-800 text-xs text-slate-500 flex flex-wrap gap-4">
          <Link to="/dpa" className="text-blue-400 hover:text-blue-300">{t('subproc_dpa_link')}</Link>
          <Link to="/privacy" className="text-blue-400 hover:text-blue-300">{t('subproc_privacy_link')}</Link>
          <Link to="/legal" className="text-blue-400 hover:text-blue-300">{t('subproc_legal_link')}</Link>
        </div>
      </div>
    </div>
  );
}

function LegalMentionsPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-white flex items-center gap-1">
            ← {t('back')}
          </button>
          <LangSelectorCompact />
        </div>
        <h1 className="text-3xl font-bold mb-8">{t('legal_title')}</h1>

        <div className="space-y-8 text-sm text-slate-300 leading-relaxed">
          {/* SECTION 1 — Éditeur (LCEN Art. 6 III — REQUIRED) */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_publisher_title')}</h2>
            <p><strong>Stacklens</strong></p>
            <p>{t('legal_published_by')}: Roland Dzoagbe</p>
            <p>{t('legal_status')}: {t('legal_status_value')}</p>
            <p>SIRET : 10483872700014</p>
            <p>Email : <a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a></p>
            <p>{t('legal_phone')}: 09 53 26 97 91</p>
            <p>{t('legal_address')}: Paris, France</p>
          </section>

          {/* SECTION 2 — Directeur de publication */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_publication_director_title')}</h2>
            <p>Roland Dzoagbe</p>
            <p>Email : <a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a></p>
          </section>

          {/* SECTION 3 — Hébergement */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_hosting_title')}</h2>
            <p><strong>Google Firebase / Google Cloud Platform</strong></p>
            <p>Google Ireland Limited</p>
            <p>Gordon House, Barrow Street, Dublin 4, Ireland</p>
            <p>Tél. : +353 1 543 1000</p>
            <p>{t('legal_website')}: <a href="https://firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">firebase.google.com</a></p>
          </section>

          {/* SECTION 4 — Domaine */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_domain_title')}</h2>
            <p><strong>stacklens.fr</strong></p>
            <p>Registrar : OVHcloud</p>
            <p>OVH SAS, 2 rue Kellermann, 59100 Roubaix, France</p>
            <p>Tél. : +33 9 72 10 10 07</p>
          </section>

          {/* SECTION 5 — Paiements */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_payment_title')}</h2>
            <p><strong>Stripe</strong></p>
            <p>Stripe Payments Europe, Limited</p>
            <p>1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Ireland</p>
            <p>{t('legal_website')}: <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">stripe.com</a></p>
          </section>

          {/* SECTION 6 — IA (EU AI Act transparency) */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_ai_title')}</h2>
            <p>{t('legal_ai_body')}</p>
            <p className="mt-2">{t('legal_ai_provider')}: Anthropic, PBC — 548 Market St, San Francisco, CA 94104, USA</p>
          </section>

          {/* SECTION 7 — Propriété intellectuelle */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_ip_title')}</h2>
            <p>{t('legal_ip_body')}</p>
          </section>

          {/* SECTION 8 — RGPD / CNIL */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_gdpr_title')}</h2>
            <p>{t('legal_gdpr_body')}</p>
            <p className="mt-2">{t('legal_exercise_rights')}: <a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a></p>
            <p className="mt-1">{t('legal_cnil_complaint')}</p>
            <p className="mt-1">{t('legal_see_our')} <Link to="/privacy" className="text-blue-400 hover:text-blue-300">{t('legal_privacy_link')}</Link> {t('legal_and_our')} <Link to="/dpa" className="text-blue-400 hover:text-blue-300">{t('legal_dpa_link')}</Link></p>
          </section>

          {/* SECTION 9 — Cookies */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_cookies_title')}</h2>
            <p>{t('legal_cookies_body')}</p>
          </section>

          {/* SECTION 10 — Droit applicable */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_law_title')}</h2>
            <p>{t('legal_law_body')}</p>
          </section>

          <div className="pt-8 border-t border-slate-800 text-xs text-slate-500">
            <p>{t('legal_last_updated')}: May 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================

function AboutPage() {
  const navigate = useNavigate();
  const { language } = useLang();
  const t = useTranslation(language);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <nav className="border-b border-white/5 bg-slate-950/50 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-4 cursor-pointer">
            <RDLogo size="md" />
            <div className="text-2xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Stacklens</div>
          </Link>
          <div className="flex items-center gap-4">
            <LangSelectorCompact />
            <Link to="/" className="text-slate-300 hover:text-white transition-colors">← {t('about_back_home')}</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-20">
        {/* Hero */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 mb-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">{t('about_our_mission')}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            {t('about_hero_1')} <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">{t('about_hero_2')}</span>
          </h1>
          <p className="text-xl text-slate-400 leading-relaxed">
            {t('about_hero_sub')}
          </p>
        </div>

        {/* The problem */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-4">{t('about_the_problem')}</h2>
          <div className="space-y-4 text-slate-300 leading-relaxed">
            <p>
              {t('about_problem_p1')}
            </p>
            <p>
              {t('about_problem_p2')}
            </p>
          </div>
        </section>

        {/* The solution */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-4">{t('about_our_approach')}</h2>
          <div className="space-y-4 text-slate-300 leading-relaxed">
            <p>
              {t('about_approach_p1')}
            </p>
            <p>
              {t('about_approach_p2')}
            </p>
          </div>
        </section>

        {/* Principles */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-6">{t('about_what_we_stand_for')}</h2>
          <div className="grid gap-4">
            {[
              { title: t('about_principle1_title'), body: t('about_principle1_body') },
              { title: t('about_principle2_title'), body: t('about_principle2_body') },
              { title: t('about_principle3_title'), body: t('about_principle3_body') },
              { title: t('about_principle4_title'), body: t('about_principle4_body') },
            ].map((p, i) => (
              <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                <div className="text-base font-semibold text-white mb-1">{p.title}</div>
                <div className="text-sm text-slate-400 leading-relaxed">{p.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact / CTA */}
        <section className="mb-14 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">{t('about_start_in_minutes')}</h2>
          <p className="text-slate-400 mb-6 max-w-xl mx-auto">
            {t('about_cta_sub')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/" className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold text-white transition-all">
              {t('about_get_started')}
            </Link>
            <a href="mailto:hello@stacklens.fr" className="px-6 py-3 border border-slate-700 hover:border-slate-600 rounded-xl text-sm font-semibold text-slate-300 transition-all">
              {t('contact_us')}
            </a>
          </div>
        </section>

        <div className="text-center text-xs text-slate-600">
          {t('about_footer_line')}
        </div>
      </div>
    </div>
  );
}

function PrivacyPage() {
  const navigate = useNavigate();
  const { language } = useLang();
  const t = useTranslation(language);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <nav className="border-b border-white/5 bg-slate-950/50 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div onClick={() => window.location.href = "/"} className="flex items-center gap-4 cursor-pointer">
            <RDLogo size="md" />
            <div className="text-2xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Stacklens</div>
          </div>
          <div className="flex items-center gap-4">
            <LangSelectorCompact />
            <button onClick={() => navigate(-1)} className="text-slate-300 hover:text-white transition-colors">← {t('back')}</button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-3xl md:text-5xl font-black mb-4 text-white">{t('privacy_title')}</h1>
        <p className="text-slate-400 mb-12">{t('privacy_last_updated')}: May 17, 2026</p>

        <div className="space-y-10 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s1_title')}</h2>
            <p>{t('privacy_s1_body')}</p>
            <p className="mt-2"><strong>Stacklens</strong> — Roland Dzoagbe<br/>Paris, Île-de-France, France<br/>Email: <a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a></p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s2_title')}</h2>
            <p className="mb-3">{t('privacy_s2_intro')}</p>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="font-semibold text-white mb-1">{t('privacy_s2_account_title')}</div>
                <p>{t('privacy_s2_account_body')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('privacy_s2_account_legal')}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="font-semibold text-white mb-1">{t('privacy_s2_saas_title')}</div>
                <p>{t('privacy_s2_saas_body')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('privacy_s2_saas_legal')}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="font-semibold text-white mb-1">{t('privacy_s2_payment_title')}</div>
                <p>{t('privacy_s2_payment_body')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('privacy_s2_payment_legal')}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="font-semibold text-white mb-1">{t('privacy_s2_dirsync_title')}</div>
                <p>{t('privacy_s2_dirsync_body')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('privacy_s2_dirsync_legal')}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="font-semibold text-white mb-1">{t('privacy_s2_analytics_title')}</div>
                <p>{t('privacy_s2_analytics_body')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('privacy_s2_analytics_legal')}</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s3_title')}</h2>
            <p className="mb-3">{t('privacy_s3_intro')}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-700 text-slate-400">
                  <th className="text-left py-2 pr-4">{t('privacy_s3_col_service')}</th>
                  <th className="text-left py-2 pr-4">{t('privacy_s3_col_purpose')}</th>
                  <th className="text-left py-2">{t('privacy_s3_col_location')}</th>
                </tr></thead>
                <tbody className="text-slate-300">
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">Firebase (Google)</td><td className="py-2 pr-4">{t('privacy_s3_firebase_purpose')}</td><td className="py-2">EU (Belgium)</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">Stripe</td><td className="py-2 pr-4">{t('privacy_s3_stripe_purpose')}</td><td className="py-2">EU (Ireland)</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">Anthropic (Claude AI)</td><td className="py-2 pr-4">{t('privacy_s3_anthropic_purpose')}</td><td className="py-2">USA</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">Google Analytics</td><td className="py-2 pr-4">{t('privacy_s3_ga_purpose')}</td><td className="py-2">EU</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">OVHcloud</td><td className="py-2 pr-4">{t('privacy_s3_ovh_purpose')}</td><td className="py-2">EU (France)</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">SendGrid (Twilio)</td><td className="py-2 pr-4">{t('privacy_s3_sendgrid_purpose')}</td><td className="py-2">USA</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">Web3Forms</td><td className="py-2 pr-4">{t('privacy_s3_web3forms_purpose')}</td><td className="py-2">USA</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">Google Workspace Admin API</td><td className="py-2 pr-4">{t('privacy_s3_gworkspace_purpose')}</td><td className="py-2">USA/EU</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">Microsoft Graph API</td><td className="py-2 pr-4">{t('privacy_s3_msgraph_purpose')}</td><td className="py-2">EU</td></tr>
                  <tr><td className="py-2 pr-4">Okta</td><td className="py-2 pr-4">{t('privacy_s3_okta_purpose')}</td><td className="py-2">{t('privacy_s3_okta_location')}</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s4_title')}</h2>
            <p>{t('privacy_s4_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s5_title')}</h2>
            <p>{t('privacy_s5_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s6_title')}</h2>
            <p className="mb-3">{t('privacy_s6_intro')}</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>{t('privacy_s6_right1')}</li>
              <li>{t('privacy_s6_right2')}</li>
              <li>{t('privacy_s6_right3')}</li>
              <li>{t('privacy_s6_right4')}</li>
              <li>{t('privacy_s6_right5')}</li>
              <li>{t('privacy_s6_right6')}</li>
            </ul>
            <p className="mt-3">{t('privacy_s6_exercise')} <a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a></p>
            <p className="mt-2">{t('privacy_s6_cnil')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s7_title')}</h2>
            <p>{t('privacy_s7_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s8_title')}</h2>
            <p>{t('privacy_s8_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s9_title')}</h2>
            <p>{t('privacy_s9_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s10_title')}</h2>
            <p>{t('privacy_s10_body')}</p>
            <p className="mt-2"><a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a></p>
            <p className="mt-1"><Link to="/contact" className="text-blue-400 hover:text-blue-300">{t('privacy_contact_form')}</Link></p>
          </section>
        </div>
      </div>
    </div>
  );
}

function TermsPage() {
  const navigate = useNavigate();
  const { language } = useLang();
  const t = useTranslation(language);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <nav className="border-b border-white/5 bg-slate-950/50 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div onClick={() => window.location.href = "/"} className="flex items-center gap-4 cursor-pointer">
            <RDLogo size="md" />
            <div className="text-2xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Stacklens</div>
          </div>
          <div className="flex items-center gap-4">
            <LangSelectorCompact />
            <button onClick={() => navigate(-1)} className="text-slate-300 hover:text-white transition-colors">← {t('back')}</button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-3xl md:text-5xl font-black mb-4 text-white">{t('terms_title')}</h1>
        <p className="text-slate-400 mb-12">{t('terms_last_updated')}: May 17, 2026</p>

        <div className="space-y-10 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s1_title')}</h2>
            <p>{t('terms_s1_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s2_title')}</h2>
            <p className="mb-3">{t('terms_s2_intro')}</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>{t('terms_s2_item1')}</li>
              <li>{t('terms_s2_item2')}</li>
              <li>{t('terms_s2_item3')}</li>
              <li>{t('terms_s2_item4')}</li>
              <li>{t('terms_s2_item5')}</li>
            </ul>
            <p className="mt-3">{t('terms_s2_reserve')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s3_title')}</h2>
            <p>{t('terms_s3_intro')}</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>{t('terms_s3_item1')}</li>
              <li>{t('terms_s3_item2')}</li>
              <li>{t('terms_s3_item3')}</li>
              <li>{t('terms_s3_item4')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s4_title')}</h2>
            <p className="mb-3">{t('terms_s4_intro')}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-700 text-slate-400">
                  <th className="text-left py-2 pr-4">Plan</th>
                  <th className="text-left py-2 pr-4">{t('terms_s4_col_price')}</th>
                  <th className="text-left py-2">{t('terms_s4_col_limits')}</th>
                </tr></thead>
                <tbody className="text-slate-300">
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">Free</td><td className="py-2 pr-4">€0</td><td className="py-2">10 {t('terms_s4_tools')}, 25 {t('terms_s4_employees')}</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">Starter</td><td className="py-2 pr-4">€29/{t('terms_s4_month')}</td><td className="py-2">100 {t('terms_s4_tools')}, 250 {t('terms_s4_employees')}</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">Pro</td><td className="py-2 pr-4">€79/{t('terms_s4_month')}</td><td className="py-2">500 {t('terms_s4_tools')}, 1500 {t('terms_s4_employees')}</td></tr>
                  <tr><td className="py-2 pr-4">Enterprise</td><td className="py-2 pr-4">€299/{t('terms_s4_month')}</td><td className="py-2">{t('terms_s4_unlimited')}</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">{t('terms_s4_pricing_note')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s5_title')}</h2>
            <p className="mb-2">{t('terms_s5_billing')}</p>
            <p className="mb-2 font-semibold text-white">{t('terms_s5_autorenew')}</p>
            <p className="mb-4">{t('terms_s5_cancel')}</p>
            {/* One-click cancellation — mandatory from June 19, 2026 (ordonnance n° 2026-2) */}
            <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-5">
              <p className="text-sm font-semibold text-white mb-1">{t('terms_s5_cancel_title')}</p>
              <p className="text-xs text-slate-400 mb-3">{t('terms_s5_cancel_law')}</p>
              <Link to="/app/settings?tab=billing" className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-400 text-sm font-medium rounded-lg transition-colors">
                🔴 {t('terms_s5_cancel_btn')}
              </Link>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s6_title')}</h2>
            <p>{t('terms_s6_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s7_title')}</h2>
            <p>{t('terms_s7_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s8_title')}</h2>
            <p>{t('terms_s8_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s9_title')}</h2>
            <p>{t('terms_s9_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s10_title')}</h2>
            <p>{t('terms_s10_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s11_title')}</h2>
            <p>{t('terms_s11_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s12_title')}</h2>
            <p>{t('terms_s12_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s13_title')}</h2>
            <p>{t('terms_s13_body')}</p>
            <p className="mt-2"><a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a></p>
            <p className="mt-1"><Link to="/contact" className="text-blue-400 hover:text-blue-300">{t('terms_contact_form')}</Link></p>
          </section>
        </div>
      </div>
    </div>
  );
}

function SecurityPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-white/5 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div onClick={() => window.location.href = "/"} className="flex items-center gap-3 cursor-pointer">
            <RDLogo size="sm" />
            <span className="text-lg font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Stacklens</span>
          </div>
          <div className="flex items-center gap-4">
            <LangSelectorCompact />
            <button onClick={() => window.history.back()} className="text-sm text-slate-400 hover:text-white transition-colors">← Back</button>
          </div>
        </div>
      </nav>
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 mb-6">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">{t('security_trust_centre')}</span>
          </div>
          <h1 className="text-2xl md:text-5xl font-black mb-4 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">{t("hc_your_data_is_safe_with_us")}</h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">Enterprise-grade security and compliance — built in from day one, not bolted on later.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {[
            { icon: "🛡️", label: "SOC 2 Type II", sub: "Annually audited" },
            { icon: "🇪🇺", label: "GDPR", sub: "EU data residency" },
            { icon: "🔐", label: "ISO 27001", sub: "Framework aligned" },
            { icon: "🏥", label: "HIPAA", sub: "Ready on request" },
          ].map(b => (
            <div key={b.label} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center hover:border-emerald-500/40 transition-all">
              <div className="text-4xl mb-2">{b.icon}</div>
              <div className="font-bold text-white text-sm">{b.label}</div>
              <div className="text-xs text-emerald-400 mt-1">{b.sub}</div>
            </div>
          ))}
        </div>

        <div className="space-y-5 mb-16">
          {[
            { icon: "🔒", title: "End-to-End Encryption", body: "All data encrypted in transit using TLS 1.3 and at rest using AES-256. Your SaaS inventory, employee records, and access data are never stored in plaintext. Encryption keys are rotated quarterly." },
            { icon: "🏗️", title: "Infrastructure & Hosting", body: "Stacklens runs on Google Cloud Platform (Firebase/GCP), hosted in the EU (europe-west1) by default. We use isolated, per-organisation Firestore databases. No data is ever co-mingled between customers." },
            { icon: "👤", title: "Data Access Controls", body: "Only you and users you explicitly invite can access your workspace. Stacklens staff have zero access to your data by default. Any internal access requires approval, is time-limited, and fully audit-logged." },
            { icon: "🔑", title: "Authentication & SSO", body: "We support Google OAuth 2.0, Magic Link (passwordless), and Microsoft 365 SSO. SAML 2.0 and enforced MFA are available on Enterprise plans." },
            { icon: "📋", title: "Activity Audit Logs", body: "Key events in Stacklens — logins, access grants, revocations, and data exports — are logged with a timestamp and user identity. Enterprise plans include extended log retention and export." },
            { icon: "🗑️", title: "Data Portability & Deletion", body: "You own your data. Export everything in CSV or JSON at any time from Settings. When you cancel, all your data is permanently deleted within 30 days. We do not sell or share your data with any third party." },
            { icon: "🔍", title: "Vulnerability Disclosure", body: "We take every security report seriously. If you discover a vulnerability, email hello@stacklens.fr with details. We aim to respond within 48 hours and acknowledge responsible disclosure." },
            { icon: "📡", title: "Uptime & Reliability", body: "Stacklens runs on Google Firebase infrastructure with automatic scaling and redundancy. We target 99.5% uptime. For any service issues, contact hello@stacklens.fr." },
          ].map(item => (
            <div key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 hover:border-slate-700 transition-all">
              <div className="flex items-start gap-4">
                <div className="text-3xl flex-shrink-0 mt-0.5">{item.icon}</div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{item.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-8 mb-8 text-center">
          <h3 className="text-xl font-bold text-white mb-2">{t('found_security_issue')}</h3>
          <p className="text-slate-400 mb-4 max-w-lg mx-auto">We take every security report seriously. We aim to respond within 48 hours. Responsible disclosure is always acknowledged.</p>
          <a href="mailto:hello@stacklens.fr" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-colors text-white">
            <Lock className="w-4 h-4" />
            hello@stacklens.fr
          </a>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <h3 className="text-xl font-bold text-white mb-2">{t("hc_download_security_whitepaper")}</h3>
          <p className="text-slate-400 mb-4">{t('security_full_docs')}</p>
          <a
            href="mailto:hello@stacklens.fr?subject=Security%20Documentation%20Request&body=Hi%2C%0A%0AI%20would%20like%20to%20receive%20the%20Stacklens%20security%20documentation.%0A%0ACompany%3A%20%0AUse%20case%3A%20"
            className="inline-flex items-center gap-2 px-6 py-3 border border-white/20 hover:border-white/40 rounded-xl font-semibold text-white transition-colors"
          >
            <Download className="w-4 h-4" />
            Request Security Documentation
          </a>
        </div>

        <div className="mt-10 text-center text-xs text-slate-600">
          Last updated: May 2026 · Questions? <a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:underline">hello@stacklens.fr</a>
        </div>
      </div>
    </div>
  );
}
// ============================================================================
// TOOLS PAGE - Complete SaaS Tool Management
// ============================================================================
// ============================================================================
// FINOPS PAGES - Finance Dashboard, License Management, Renewals, Invoices
// ============================================================================

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
            <span className="text-sm text-slate-400">{t('total_monthly')}</span>
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
  // Compute real financial data from tools
  const _tools = db?.tools || [];
  const _fReal = _tools.length > 0;
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
            <span className="text-xs text-slate-500">{t('fin_healthy_spend')}</span>
            <span className="text-xs font-semibold text-white">{100 - wastePercent}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-emerald-500 transition-all" style={{width: `${100 - wastePercent}%`}} />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">{t('fin_wasted')}</span>
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
                    <span className="text-slate-500">{t('th_cost_mo')}</span>
                    <span className="text-white font-semibold">{getCurrency(language)}{convertCurrency(Math.round(tool.cost), language).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">{t('fin_active_users')}</span>
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
              <option value="cost">{t('sort_cost')}</option>
              <option value="perUser">{t('sort_cost_user')}</option>
              <option value="users">{t('sort_users')}</option>
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
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('cost_col_tool')}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('cost_col_monthly_cost')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">{t('cost_col_users')}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">{t('th_cost_user')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('cost_col_status')}</th>
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
    alerts: buildRiskAlerts({ tools: db.tools, access: db.access || [], employees: db.employees || [] }, t)
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
    toast.success(t('toast_analytics_exported'));
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
  const { language } = useLang();
  const t = useTranslation(language);
  const insights = [];
  const unusedTools = tools?.filter(t => {
    const lastUsed = new Date(t.last_used_date || 0);
    return Math.floor((Date.now() - lastUsed) / 86400000) > 90;
  }) || [];
  if (unusedTools.length > 0) {
    const savings = unusedTools.reduce((sum, t) => sum + (t.cost_per_month || 0), 0);
    insights.push({ icon: TrendingDown, title: t('unused_licenses'), description: `${unusedTools.length} tools haven't been used in 90+ days. Potential savings: ${getCurrency(language)}${savings.toLocaleString()}/month`, savings, priority: 'high', action: t('review_tools'), link: '/tools' });
  }
  const orphanedTools = tools?.filter(t => !t.owner_name || t.owner_name === 'Unassigned') || [];
  if (orphanedTools.length > 0) {
    insights.push({ icon: AlertTriangle, title: t('unassigned_tools'), description: `${orphanedTools.length} tools have no owner. Security risk!`, priority: 'medium', action: t('assign_owners'), link: '/tools' });
  }
  if (insights.length === 0) {
    insights.push({ icon: Sparkles, title: t('all_optimized'), description: t('no_optimizations'), priority: 'low', action: t('nav_dashboard'), link: '/dashboard' });
  }
  insights.sort((a, b) => ({ critical: 0, high: 1, medium: 2, low: 3 }[a.priority] - { critical: 0, high: 1, medium: 2, low: 3 }[b.priority]));
  const totalSavings = insights.filter(i => i.savings).reduce((sum, i) => sum + i.savings, 0);
  const colors = { critical: 'from-red-500/20 border-red-500/30', high: 'from-orange-500/20 border-orange-500/30', medium: 'from-yellow-500/20 border-yellow-500/30', low: 'from-emerald-500/20 border-emerald-500/30' };
  return (
    <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/20 rounded-2xl p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl"><Sparkles className="h-5 w-5 text-white" /></div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">{t('ai_powered_insights')}</h3>
          <p className="text-sm text-slate-300">{t('ai_smart_recommendations')}</p>
        </div>
        {totalSavings > 0 && <div className="text-right"><div className="text-2xl font-black text-emerald-400">${totalSavings.toLocaleString()}</div><div className="text-xs text-slate-400">{t('potential_savings')}</div></div>}
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
                <option value="waste">{t('sort_waste')}</option>
                <option value="cost">{t('sort_cost')}</option>
                <option value="utilization">{t('sort_utilization')}</option>
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
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('th_application')}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('th_used_total')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">{t('th_utilization')}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">{t('th_cost_mo')}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('waste')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('license_action')}</th>
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
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('ren_annual_at_risk')}</div>
          <div className="text-3xl font-black text-blue-400">{getCurrency(language)}{convertCurrency(Math.round(totalAtRisk), language).toLocaleString()}</div>
          <div className="text-sm text-slate-500 mt-1">next 90 days</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-red-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('critical')}</div>
          <div className="text-3xl font-black text-red-400">{overdue.length + critical.length}</div>
          <div className="text-sm text-slate-500 mt-1">≤ 14 days or overdue</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('ren_upcoming')}</div>
          <div className="text-3xl font-black text-amber-400">{urgent.length + upcoming.length}</div>
          <div className="text-sm text-slate-500 mt-1">15–90 days</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-purple-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('ren_auto_renewing')}</div>
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
                    <span className="text-slate-500">{t('annual')}</span>
                    <span className="text-white font-semibold">{getCurrency(language)}{convertCurrency(Math.round(opp.annualCost), language).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">{t('ren_potential_save')}</span>
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
              <h3 className="text-base font-semibold text-white">{t('ren_all_renewals')}</h3>
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
                <option value="date">{t('sort_date')}</option>
                <option value="cost">{t('sort_cost')}</option>
                <option value="app">{t('sort_az')}</option>
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
            <h3 className="text-base font-semibold text-white mb-1">{t('ren_no_renewals')}</h3>
            <p className="text-sm text-slate-500">{filter !== 'all' ? 'Try a different filter.' : 'Add renewal dates to your tools to track them here.'}</p>
          </div>
        ) : view === 'list' ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('th_application')}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">{t('exec_renewal_date')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('th_status')}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">{t('annual')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">{t('renewal_auto')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('license_action')}</th>
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
              <div className="text-center py-10 text-slate-500 text-sm">{t('ren_no_match')}</div>
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
        <p className="text-sm text-slate-500">{t('inv_submit_track')}</p>
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
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-400">{t('th_vendor')}</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-400">{t('category')}</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-slate-400">{t('amount')}</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-400">{t("hc_due_date")}</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-400">{t("hc_submitted_by")}</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-400">{t('th_status')}</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-slate-400">{t('th_actions')}</th>
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
                <label className="block text-sm font-semibold text-slate-300 mb-2">{t('category')}</label>
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


function FinishSignUpPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState('');
  
  useEffect(() => {
    const completeSignIn = async () => {
      const { user, error } = await completeMagicLinkSignIn(window.location.href);
      
      if (user) {
        setStatus('success');
        // Check if user completed onboarding
        const { user: userData } = await getUserProfile(user.uid);
        setTimeout(() => {
          if (userData && userData.onboardingCompleted) {
            navigate('/dashboard', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        }, 2000);
      } else {
        setStatus('error');
        setError(error || 'Sign-in failed');
        console.error('Email link sign-in error:', error);
      }
    };
    
    completeSignIn();
  }, [navigate]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center text-white">
      <div className="text-center p-8">
        {status === 'processing' && (
          <>
            <div className="text-8xl mb-6 animate-pulse">⏳</div>
            <h1 className="text-4xl font-bold mb-4">{t("signing_in")}</h1>
            <p className="text-slate-400 text-lg">{t("hc_please_wait_a_moment")}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-8xl mb-6 animate-bounce">✅</div>
            <h1 className="text-4xl font-bold mb-4">{t("success")}</h1>
            <p className="text-slate-400 text-lg">{t("hc_welcome_to_accessguard")}</p>
            <p className="text-slate-500 mt-2">{t('redirecting_dashboard')}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-8xl mb-6">❌</div>
            <h1 className="text-4xl font-bold mb-4">{t("signin_failed")}</h1>
            <p className="text-slate-400 text-lg mb-6">
              {error === 'Invalid sign-in link' 
                ? 'This link has expired or is invalid.' 
                : 'Something went wrong with your sign-in.'}
            </p>
            <button 
              onClick={() => window.location.href = "/dashboard"}
              className="px-4 md:px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-lg transition-colors"
            >
              Return to Homepage
            </button>
          </>
        )}
      </div>
    </div>
  );
}


// ============================================================================
// CONTRACT COMPARISON PAGE
// ============================================================================

// ============================================================================
// CONTRACT COMPARISON + NEGOTIATION PAGE  (AI-powered)
// ============================================================================

function ContractComparisonPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const navigate = useNavigate();

  // ── View state ──────────────────────────────────────────────
  const [view, setView] = useState('upload'); // upload | analyze | results
  const [activeTab, setActiveTab] = useState('overview'); // overview | provisions | suggestions | chat

  // ── Contract inputs ─────────────────────────────────────────
  const [contractA, setContractA] = useState({ name: '', party: '', text: '', type: 'MSA', fileName: '' });
  const [contractB, setContractB] = useState({ name: '', party: '', text: '', type: 'MSA', fileName: '' });
  const [favors, setFavors] = useState('balanced'); // balanced | party-a | party-b
  const CONTRACT_TYPES = ['MSA', 'NDA', 'SaaS Agreement', 'SOW', 'Employment', 'Partnership', 'Other'];

  // ── Analysis results ────────────────────────────────────────
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  // ── Chat ────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // ── Rewrite state ────────────────────────────────────────────
  const [rewriteTarget, setRewriteTarget] = useState(null);
  const [rewriteMode, setRewriteMode] = useState('simplify'); // simplify | align | robust
  const [rewriteResult, setRewriteResult] = useState(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // ── Helpers ─────────────────────────────────────────────────
  const canAnalyze = contractA.text.trim().length > 50 && contractB.text.trim().length > 50;

  const LOADING_MSGS = [
    'Reading contract structure…',
    'Identifying key provisions…',
    'Comparing party positions…',
    'Calculating neutrality scores…',
    'Flagging deal breakers…',
    'Generating AI suggestions…',
    'Building comparison report…',
  ];

  // ── Run AI Analysis ──────────────────────────────────────────
  const runAnalysis = async () => {
    setLoading(true);
    setView('analyze');
    let msgIdx = 0;
    setLoadingMsg(LOADING_MSGS[0]);
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MSGS.length;
      setLoadingMsg(LOADING_MSGS[msgIdx]);
    }, 1800);

    const prompt = `You are an expert contract analyst. Compare these two contracts and respond ONLY with valid JSON (no markdown, no explanation).

CONTRACT A (${contractA.name || 'Contract A'} — ${contractA.party || 'Party A'}):
${contractA.text.slice(0, 3000)}

CONTRACT B (${contractB.name || 'Contract B'} — ${contractB.party || 'Party B'}):
${contractB.text.slice(0, 3000)}

Deal favorability preference: ${favors}
Contract type: ${contractA.type}

Respond with this exact JSON structure:
{
  "summary": "2-3 sentence executive summary of key differences",
  "neutralityScore": { "a": 45, "b": 72 },
  "riskScore": { "a": 3, "b": 6 },
  "favorability": "party-a | party-b | balanced",
  "overallVerdict": "one sentence verdict on which contract is stronger",
  "dealBreakers": [
    { "issue": "string", "contract": "A | B | Both", "severity": "critical | high | medium" }
  ],
  "focusAreas": [
    { "area": "string", "description": "string", "contract": "A | B | Both" }
  ],
  "provisions": [
    {
      "name": "string",
      "category": "Payment | Liability | IP | Termination | Confidentiality | Governing Law | Other",
      "contractA": "string (what contract A says)",
      "contractB": "string (what contract B says)",
      "difference": "minor | moderate | significant | missing",
      "favors": "A | B | Neutral",
      "marketStandard": "above | at | below",
      "issues": ["string"],
      "suggestion": "string AI recommendation"
    }
  ],
  "marketDeviations": [
    { "clause": "string", "deviation": "above | below", "description": "string" }
  ]
}`;

    try {
      const data = await callAI({ messages: [{ role: 'user', content: prompt }], max_tokens: 4000 });
      const raw = data.content?.[0]?.text || '{}';
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setAnalysis(parsed);
      setChatMessages([{
        role: 'assistant',
        content: `✅ Analysis complete! I've compared **${contractA.name || 'Contract A'}** vs **${contractB.name || 'Contract B'}**. ${parsed.summary} Ask me anything about specific clauses or provisions.`,
      }]);
      setView('results');
      setActiveTab('overview');
    } catch (e) {
      toast.error(t('toast_analysis_failed'));
      setView('upload');
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  // ── Rewrite a provision ──────────────────────────────────────
  const rewriteProvision = async (provision) => {
    setRewriteTarget(provision);
    setRewriteResult(null);
    setRewriteLoading(true);
    const modeDesc = { simplify: 'simpler plain English', align: 'aligned substantively between both contracts', robust: 'more robust and comprehensive' }[rewriteMode];
    try {
      const data = await callAI({ messages: [{
            role: 'user',
            content: `Rewrite this "${provision.name}" contract provision to be ${modeDesc}. 
Contract A version: ${provision.contractA}
Contract B version: ${provision.contractB}
Issues: ${provision.issues?.join(', ')}

Respond with ONLY the rewritten clause text, no explanation, no JSON.`,
          }], max_tokens: 800 });
      setRewriteResult(data.content?.[0]?.text || '');
    } catch {
      toast.error(t('toast_rewrite_failed'));
    } finally {
      setRewriteLoading(false);
    }
  };

  // ── Chat with contracts ──────────────────────────────────────
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);
    try {
      const context = `Contract A (${contractA.name}): ${contractA.text.slice(0, 1500)}\n\nContract B (${contractB.name}): ${contractB.text.slice(0, 1500)}\n\nAnalysis summary: ${analysis?.summary}`;
      const data = await callAI({ messages: [
            { role: 'user', content: `You are a contract analyst. Context:\n${context}` },
            ...chatMessages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMsg },
          ], max_tokens: 600 });
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.content?.[0]?.text || 'Sorry, I could not answer that.' }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Error reaching AI. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  // ── Color helpers ────────────────────────────────────────────
  const diffColor = { minor: 'text-emerald-400 bg-emerald-500/10', moderate: 'text-amber-400 bg-amber-500/10', significant: 'text-rose-400 bg-rose-500/10', missing: 'text-slate-400 bg-slate-500/10' };
  const severityColor = { critical: 'border-rose-500 bg-rose-500/10 text-rose-300', high: 'border-amber-500 bg-amber-500/10 text-amber-300', medium: 'border-blue-500 bg-blue-500/10 text-blue-300' };
  const marketColor = { above: 'text-emerald-400', at: 'text-blue-400', below: 'text-amber-400' };

  // ── UPLOAD VIEW ─────────────────────────────────────────────
  if (view === 'upload') return (
    <div className="space-y-6">

      {/* ── Row 1: Compact header strip ── */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{t("cc_title")}</h2>
              <p className="text-sm text-slate-400">{t("cc_subtitle")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Setup (type + favorability) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block">{t("cc_contract_type")}</label>
          <div className="flex flex-wrap gap-2">
            {CONTRACT_TYPES.map(type => (
              <button key={type} onClick={() => { setContractA(a => ({...a, type})); setContractB(b => ({...b, type})); }}
                className={'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ' + (contractA.type === type ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white')}>
                {type}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block">{t("cc_favorability")}</label>
          <div className="flex gap-2">
            {[['balanced',t('cc_balanced')],['party-a',t('cc_favor_a')],['party-b',t('cc_favor_b')]].map(([v,l]) => (
              <button key={v} onClick={() => setFavors(v)}
                className={'flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ' + (favors === v ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white')}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Two contract inputs side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
        {[
          { label: 'Contract A', accent: 'blue', state: contractA, setState: setContractA },
          { label: 'Contract B', accent: 'emerald', state: contractB, setState: setContractB },
        ].map(({ label, accent, state, setState }) => {
          const accentBorder = accent === 'blue' ? 'border-blue-500/30' : 'border-emerald-500/30';
          const accentDot = accent === 'blue' ? 'bg-blue-500' : 'bg-emerald-500';
          return (
            <div key={label} className={"rounded-2xl border bg-slate-900/60 p-5 space-y-3 " + accentBorder}>
              <div className="flex items-center gap-2">
                <div className={"w-2.5 h-2.5 rounded-full " + accentDot} />
                <span className="text-white font-semibold text-sm">{label}</span>
                <span className={"ml-auto text-xs " + (state.text.length > 50 ? 'text-emerald-400' : 'text-slate-500')}>
                  {state.text.length > 50 ? '✓ Ready' : state.text.length + ' chars'}
                </span>
              </div>
              <input
                value={state.name}
                onChange={e => setState(s => ({...s, name: e.target.value}))}
                placeholder={t("cc_doc_name_placeholder")}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
              />
              <input
                value={state.party}
                onChange={e => setState(s => ({...s, party: e.target.value}))}
                placeholder={t("cc_party_placeholder")}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
              />
              <textarea
                value={state.text}
                onChange={e => setState(s => ({...s, text: e.target.value}))}
                placeholder={"Paste " + label + " text here, or upload a file below..."}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-500 outline-none focus:border-blue-500 transition-colors resize-none"
                rows={10}
              />
              <div className="flex items-center gap-2">
                <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-400 hover:text-white transition-all">
                  <Upload className="h-3.5 w-3.5" />
                  {state.fileName || t('cc_upload_file')}
                  <input type="file" accept=".pdf,.docx,.doc,.txt,.rtf,.md" className="hidden" onChange={async(e)=>{
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const name = file.name.toLowerCase();
                    const reader = new FileReader();
                    if (name.endsWith(".pdf")) {
                      try {
                        const ab = await file.arrayBuffer();
                        const pdf = await window.pdfjsLib.getDocument({data:ab}).promise;
                        let text = "";
                        for (let i=1; i<=pdf.numPages; i++) {
                          const pg = await pdf.getPage(i);
                          const ct = await pg.getTextContent();
                          text += ct.items.map(x=>x.str).join(" ") + " ";
                        }
                        setState(s => ({...s, text: text.trim() || "Could not extract.", fileName: file.name}));
                      } catch (err) {
                        toast.error(t('toast_pdf_failed'));
                      }
                    } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
                      reader.onload = ev => {
                        const m = [...ev.target.result.matchAll(/<w:t[^>]*>([^<]+)<\/w:t>/g)];
                        setState(s => ({...s, text: m.map(x => x[1]).join(" "), fileName: file.name}));
                      };
                      reader.readAsText(file);
                    } else {
                      reader.onload = ev => setState(s => ({...s, text: ev.target.result, fileName: file.name}));
                      reader.readAsText(file);
                    }
                  }}/>
                </label>
                {state.fileName && <button onClick={() => setState(s => ({...s, text: "", fileName: ""}))} className="text-xs text-red-400 hover:text-red-300">clear</button>}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Row 4: Analyze CTA ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">{t("cc_ready_to_analyze")}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {canAnalyze ? t('cc_both_loaded') : t('cc_add_contract_text')}
          </div>
        </div>
        <button
          onClick={runAnalysis}
          disabled={!canAnalyze}
          className={"px-6 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 whitespace-nowrap " + (canAnalyze ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-600 cursor-not-allowed')}>
          <Sparkles className="h-4 w-4" />
          {t("cc_analyze_btn")}
        </button>
      </div>
    </div>
  );

  // ── LOADING VIEW ─────────────────────────────────────────────
  if (view === 'analyze') return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12">
      <div className="text-center space-y-4 max-w-md mx-auto">
        <div className="inline-flex p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 animate-pulse">
          <Sparkles className="h-8 w-8 text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-white">{t("cc_analyzing")}</h2>
        <p className="text-indigo-400 text-sm font-medium">{loadingMsg}</p>
        <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full animate-pulse" style={{ width: '70%' }} />
        </div>
        <p className="text-slate-500 text-xs">{t("cc_reading_clauses")}</p>
      </div>
    </div>
  );

  // ── RESULTS VIEW ─────────────────────────────────────────────
  if (view !== 'results' || !analysis) return null;

  const provisions = analysis.provisions || [];
  const dealBreakers = analysis.dealBreakers || [];
  const focusAreas = analysis.focusAreas || [];
  const marketDeviations = analysis.marketDeviations || [];

  return (
    <div className="space-y-6">

      {/* ── Row 1: Header strip with action buttons ── */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base lg:text-lg font-bold text-white truncate">
                <span className="text-blue-400">{contractA.name || 'Contract A'}</span>
                <span className="text-slate-500 mx-2">vs</span>
                <span className="text-emerald-400">{contractB.name || 'Contract B'}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{contractA.type} · {provisions.length} provisions analyzed</p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => { setView('upload'); setAnalysis(null); }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1.5">
              ← New Analysis
            </button>
            <button onClick={() => {
              const txt = `CONTRACT COMPARISON REPORT\n${contractA.name} vs ${contractB.name}\n\n${analysis.summary}\n\nPROVISIONS:\n${provisions.map(p => `${p.name}:\n  A: ${p.contractA}\n  B: ${p.contractB}\n  Suggestion: ${p.suggestion}`).join('\n\n')}`;
              const a = document.createElement('a'); a.href = 'data:text/plain,' + encodeURIComponent(txt); a.download = 'contract-comparison.txt'; a.click();
              toast.success(t('toast_report_exported'));
            }} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export Report
            </button>
          </div>
        </div>
      </div>

      {/* ── Row 2: KPI Strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-blue-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('ca_risk_score_a')}</div>
          <div className={"text-3xl font-black " + ((analysis.riskScore?.a || 0) > 6 ? 'text-rose-400' : 'text-amber-400')}>{analysis.riskScore?.a || 0}<span className="text-base text-slate-500">/10</span></div>
          <div className="text-sm text-slate-500 mt-1 truncate">{contractA.name || 'Contract A'}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-emerald-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('ca_risk_score_b')}</div>
          <div className={"text-3xl font-black " + ((analysis.riskScore?.b || 0) > 6 ? 'text-rose-400' : 'text-amber-400')}>{analysis.riskScore?.b || 0}<span className="text-base text-slate-500">/10</span></div>
          <div className="text-sm text-slate-500 mt-1 truncate">{contractB.name || 'Contract B'}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-indigo-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('ca_provisions')}</div>
          <div className="text-3xl font-black text-indigo-400">{provisions.length}</div>
          <div className="text-sm text-slate-500 mt-1">analyzed</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-rose-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('ca_deal_breakers')}</div>
          <div className="text-3xl font-black text-rose-400">{dealBreakers.length}</div>
          <div className="text-sm text-slate-500 mt-1">flagged</div>
        </div>
      </div>

      {/* ── Row 3: Neutrality / Favorability bars ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="text-base font-semibold text-white">Neutrality & Favorability</h3>
            <p className="text-xs text-slate-500">Higher score = more balanced terms</p>
          </div>
          <span className="text-xs text-slate-400 italic max-w-md text-right">{analysis.overallVerdict}</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-blue-400 text-xs font-semibold w-24 text-right truncate">{contractA.name || 'Contract A'}</span>
            <div className="flex-1 h-5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-1000 flex items-center justify-end pr-2"
                style={{ width: `${analysis.neutralityScore?.a || 50}%` }}>
                <span className="text-white text-[10px] font-bold">{analysis.neutralityScore?.a || 50}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 text-xs font-semibold w-24 text-right truncate">{contractB.name || 'Contract B'}</span>
            <div className="flex-1 h-5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-1000 flex items-center justify-end pr-2"
                style={{ width: `${analysis.neutralityScore?.b || 50}%` }}>
                <span className="text-white text-[10px] font-bold">{analysis.neutralityScore?.b || 50}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 4: Tab nav ── */}
      <div className="flex gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 w-fit overflow-x-auto max-w-full">
        {[
          { id: 'overview',    label: 'Overview' },
          { id: 'provisions',  label: `Provisions (${provisions.length})` },
          { id: 'suggestions', label: 'Rewrite' },
          { id: 'chat',        label: 'Ask AI' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={"px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap " + (activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Executive Summary */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-slate-400" />
              <h3 className="text-base font-semibold text-white">{t('ca_executive_summary')}</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{analysis.summary}</p>
          </div>

          {/* Deal Breakers + Focus Areas — two columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
            {/* Deal Breakers */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                  <h3 className="text-base font-semibold text-white">{t('ca_deal_breakers')}</h3>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-semibold">{dealBreakers.length} found</span>
              </div>
              {dealBreakers.length === 0 ? (
                <div className="py-6 text-center">
                  <Check className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-emerald-400 font-semibold">{t('ca_no_deal_breakers')}</p>
                  <p className="text-xs text-slate-500 mt-1">{t('ca_both_acceptable')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {dealBreakers.map((db, i) => (
                    <div key={i} className={"p-3 rounded-xl border " + (severityColor[db.severity] || severityColor.medium)}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold flex-1 min-w-0">{db.issue}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900/60 uppercase font-bold flex-shrink-0">{db.severity}</span>
                      </div>
                      <span className="text-xs opacity-70">In: Contract {db.contract}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Focus Areas */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-4 w-4 text-blue-400" />
                <h3 className="text-base font-semibold text-white">{t('ca_focus_areas')}</h3>
              </div>
              {focusAreas.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">{t('ca_no_focus_areas')}</p>
              ) : (
                <div className="space-y-2">
                  {focusAreas.map((fa, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
                      <div className="font-semibold text-blue-300 text-sm mb-1">{fa.area}</div>
                      <p className="text-xs text-slate-400 leading-relaxed">{fa.description}</p>
                      <span className="text-[10px] text-slate-600 mt-1.5 inline-block">Contract {fa.contract}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Market Deviations */}
          {marketDeviations.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-amber-400" />
                <h3 className="text-base font-semibold text-white">{t('ca_market_deviations')}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {marketDeviations.map((md, i) => (
                  <div key={i} className="rounded-xl bg-slate-800/40 border border-slate-800 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-white truncate">{md.clause}</span>
                      <span className={"text-[10px] font-bold uppercase flex-shrink-0 ml-2 " + (marketColor[md.deviation] || 'text-slate-400')}>
                        {md.deviation === 'above' ? '↑ Above' : '↓ Below'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{md.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PROVISIONS TAB ── */}
      {activeTab === 'provisions' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-white">{t('ca_all_provisions')}</h3>
                <p className="text-xs text-slate-500">{provisions.length} provisions compared side-by-side</p>
              </div>
            </div>
          </div>

          {provisions.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-slate-800 mb-3">
                <FileText className="h-6 w-6 text-slate-500" />
              </div>
              <p className="text-sm text-slate-500">{t('ca_no_provisions')}</p>
            </div>
          ) : provisions.map((p, i) => (
            <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden hover:border-slate-700 transition-colors">
              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-2 px-5 py-3 bg-slate-950/40 border-b border-slate-800">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-sm font-semibold text-white truncate">{p.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 uppercase font-bold flex-shrink-0">{p.category}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                  <span className={"text-[10px] px-2 py-0.5 rounded-full font-bold uppercase " + (diffColor[p.difference] || diffColor.moderate)}>
                    {p.difference}
                  </span>
                  <span className="text-xs text-slate-500">{t('ca_favors')} <span className="text-white font-semibold">{p.favors}</span></span>
                  <span className={"text-xs font-semibold " + (marketColor[p.marketStandard] || 'text-slate-400')}>
                    {p.marketStandard === 'above' ? '↑ market' : p.marketStandard === 'below' ? '↓ market' : '= market'}
                  </span>
                  <button onClick={() => { setRewriteTarget(p); setActiveTab('suggestions'); }}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/40 transition-colors font-semibold uppercase">
                    Rewrite
                  </button>
                </div>
              </div>

              {/* Side-by-side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-blue-400 text-[10px] font-bold uppercase tracking-wider truncate">{contractA.name || 'Contract A'}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{p.contractA || <span className="text-slate-600 italic">{t('ca_not_present')}</span>}</p>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider truncate">{contractB.name || 'Contract B'}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{p.contractB || <span className="text-slate-600 italic">{t('ca_not_present')}</span>}</p>
                </div>
              </div>

              {/* Issues + AI suggestion footer */}
              {(p.issues?.length > 0 || p.suggestion) && (
                <div className="px-5 py-3 bg-indigo-950/20 border-t border-slate-800 space-y-2">
                  {p.issues?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {p.issues.map((issue, j) => (
                        <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {issue}
                        </span>
                      ))}
                    </div>
                  )}
                  {p.suggestion && (
                    <p className="text-xs text-indigo-300 flex items-start gap-2">
                      <Sparkles className="h-3 w-3 text-indigo-400 mt-0.5 flex-shrink-0" />
                      <span>{p.suggestion}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── REWRITE TAB ── */}
      {activeTab === 'suggestions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
          {/* Left: pick provision + mode */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-slate-400" />
                <h3 className="text-base font-semibold text-white">{t('ca_select_provision')}</h3>
              </div>
              {provisions.length === 0 ? (
                <p className="text-sm text-slate-500">{t('ca_no_provisions_rewrite')}</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {provisions.map((p, i) => (
                    <button key={i} onClick={() => setRewriteTarget(p)}
                      className={"w-full text-left px-3 py-2 rounded-xl text-sm transition-all " + (rewriteTarget?.name === p.name ? 'bg-indigo-600 text-white' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800')}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">{p.name}</span>
                        <span className={"text-[10px] uppercase font-bold flex-shrink-0 " + (diffColor[p.difference] || diffColor.moderate)}>{p.difference}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <h3 className="text-base font-semibold text-white">{t('ca_rewrite_mode')}</h3>
              </div>
              <div className="space-y-2">
                {[
                  { v: 'simplify', label: 'Simplify', desc: 'Plain English, remove legal jargon' },
                  { v: 'align',    label: 'Align',    desc: 'Merge both versions substantively' },
                  { v: 'robust',   label: 'Robust',   desc: 'More comprehensive & protective' },
                ].map(mode => (
                  <button key={mode.v} onClick={() => setRewriteMode(mode.v)}
                    className={"w-full text-left px-4 py-3 rounded-xl transition-all " + (rewriteMode === mode.v ? 'bg-indigo-600/20 border border-indigo-500/40 text-white' : 'bg-slate-800/40 border border-transparent text-slate-400 hover:bg-slate-800')}>
                    <div className="font-semibold text-sm">{mode.label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{mode.desc}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => rewriteTarget && rewriteProvision(rewriteTarget)}
                disabled={!rewriteTarget || rewriteLoading}
                className={"w-full mt-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 " + (rewriteTarget && !rewriteLoading ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed')}>
                <Sparkles className="h-4 w-4" />
                {rewriteLoading ? 'Rewriting...' : 'Generate Rewrite'}
              </button>
            </div>
          </div>

          {/* Right: result */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <h3 className="text-base font-semibold text-white">{t('ca_rewritten_provision')}</h3>
            </div>
            {rewriteTarget && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-800/40 border border-slate-800 p-3">
                  <div className="text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-1">{t('ca_original_a')}</div>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">{rewriteTarget.contractA || '—'}</p>
                </div>
                <div className="rounded-xl bg-slate-800/40 border border-slate-800 p-3">
                  <div className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-1">{t('ca_original_b')}</div>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">{rewriteTarget.contractB || '—'}</p>
                </div>
              </div>
            )}
            <div className="rounded-xl bg-indigo-950/20 border border-indigo-500/20 p-4 min-h-32">
              {rewriteLoading ? (
                <div className="flex items-center gap-3 text-indigo-400">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  <span className="text-sm">{t('ca_rewriting')}</span>
                </div>
              ) : rewriteResult ? (
                <>
                  <div className="text-indigo-300 text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" /> AI Rewrite — {rewriteMode}
                  </div>
                  <p className="text-sm text-white leading-relaxed">{rewriteResult}</p>
                  <button onClick={() => { navigator.clipboard?.writeText(rewriteResult); toast.success(t('toast_copied_clipboard')); }}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-xs font-semibold transition-colors">
                    Copy
                  </button>
                </>
              ) : (
                <p className="text-sm text-slate-500">{t('ca_select_and_generate')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CHAT TAB ── */}
      {activeTab === 'chat' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col" style={{ height: '65vh' }}>
          <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">{t('ca_ask_ai')}</div>
              <div className="text-xs text-slate-500">{t('ca_ask_about')}</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {chatMessages.map((msg, i) => (
              <div key={i} className={"flex " + (msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={"max-w-2xl px-4 py-2.5 rounded-2xl text-sm leading-relaxed " + (
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-slate-800/60 text-slate-200 border border-slate-800 rounded-bl-sm'
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800/60 border border-slate-800 px-4 py-2.5 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: i*0.15 + 's' }} />)}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="px-4 py-2 border-t border-slate-800 flex flex-wrap gap-2">
            {['What are the key differences?','Which contract is riskier?','Summarize liability clauses','Any missing standard clauses?'].map(q => (
              <button key={q} onClick={() => setChatInput(q)}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors border border-slate-800">
                {q}
              </button>
            ))}
          </div>
          <div className="px-4 pb-4 pt-2 flex gap-2">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
              placeholder={t('ca_ask_anything_ph')}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
            />
            <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
              className={"px-4 py-2 rounded-xl font-semibold text-sm transition-all " + (!chatInput.trim() || chatLoading ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white')}>
              Send →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// Only render the chatbot when the user is authenticated
// Unauthenticated users get "Not authenticated" error from the Cloud Function
function FloatingChatbotGated() {
  const { user } = useAuth();
  if (!user?.is_authenticated || user?.is_demo) return null;
  return <FloatingChatbot />;
}

function FloatingChatbot() {
  const { language } = useLang();
  const t = useTranslation(language);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [serviceDown, setServiceDown] = useState(false);
  const bottomRef = React.useRef(null);

  React.useEffect(() => {
    if (open && !initialized) {
      setInitialized(true);
      // Probe the AI service immediately so the status dot is accurate upfront
      setLoading(true);
      callAI({ messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 })
        .then(() => {
          setMessages([{ role: 'assistant', content: t('chatbot_welcome') }]);
        })
        .catch(() => {
          setServiceDown(true);
          setMessages([{
            role: 'assistant',
            content: 'The AI assistant is temporarily unavailable — the service needs to be restarted. In the meantime, email us at hello@stacklens.fr and we\'ll get back to you shortly.',
          }]);
        })
        .finally(() => setLoading(false));
    }
  }, [open, initialized, t]);

  React.useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading || serviceDown) return;
    const userMsg = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      const data = await callAI({
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        system: `You are a helpful support assistant for Stacklens, a SaaS management platform. Be concise, friendly, and helpful. Answer questions about SaaS management, security, cost optimisation, and how to use Stacklens features.`,
        max_tokens: 1000,
      });
      const reply = data.content?.[0]?.text || 'Sorry, I could not respond right now.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setServiceDown(true);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'The AI assistant is temporarily unavailable. Please email us at hello@stacklens.fr and we\'ll get back to you shortly.',
      }]);
    } finally { setLoading(false); }
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 h-[480px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm">🤖</div>
              <div>
                <div className="text-white font-bold text-sm">{t('chatbot_title')}</div>
                <div className="text-blue-200 text-xs flex items-center gap-1">
                  {serviceDown
                    ? <><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> Unavailable</>
                    : <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> Online</>
                  }
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors text-xl leading-none">&times;</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={"flex " + (m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={"max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed " + (m.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-800 text-slate-200 rounded-bl-sm')}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 px-3 py-2 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="p-3 border-t border-slate-800 flex-shrink-0">
            {serviceDown ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                <span>💬</span>
                <span>Email us: <a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a></span>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={t('chatbot_placeholder')}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button onClick={send} disabled={!input.trim() || loading}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <button onClick={() => setOpen(o => !o)}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 shadow-lg shadow-blue-900/40 flex items-center justify-center transition-all hover:scale-105 active:scale-95">
        {open
          ? <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          : <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        }
      </button>
    </div>
  );
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
          <Route path="/report/:token" element={<ReportPage />} />
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
          <Route
            path="/founder-admin"
            element={<RequireAuth><FounderAdminPage /></RequireAuth>}
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <FloatingChatbotGated />
        </TourProvider>
        </BrowserRouter></ErrorBoundary>
        </CurrencyProvider></LanguageProvider>
    </QueryClientProvider>
  );
}