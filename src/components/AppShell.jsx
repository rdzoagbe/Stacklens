import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { loadUserData, logConsent } from '../firebase-config';
import { resolvePlan, getTrialState, getPlanLimits } from '../lib/plan';
import { cx } from '../lib/utils';
import { useDbQuery } from '../hooks/useDbQuery';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { RDLogo, Button, Modal } from '../components/ui';
import {
  LayoutDashboard, Boxes, Users, GitMerge, UserMinus, Shield, BarChart3, Settings,
  ChevronDown, BadgeX, ExternalLink,
} from 'lucide-react';

export const NAV = [
  { to: "/dashboard",    tKey: "nav_dashboard",    icon: LayoutDashboard },
  { separator: true,     tKey: "nav_access_identity" },
  { to: "/tools",        tKey: "nav_tools",         icon: Boxes },
  { to: "/employees",    tKey: "nav_employees",      icon: Users },
  { to: "/access",       tKey: "nav_access",         icon: GitMerge },
  { to: "/offboarding",  tKey: "nav_offboarding",    icon: UserMinus },
  { separator: true,     tKey: "nav_security" },
  { to: "/security",     tKey: "nav_security",       icon: Shield },
  { separator: true,     tKey: "nav_finance_section" },
  { to: "/finance",      tKey: "nav_finance",        icon: BarChart3 },
  { separator: true,     tKey: "nav_platform" },
  { to: "/settings",     tKey: "nav_settings",       icon: Settings },
];

export function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const { language } = useLang();
  const t = useTranslation(language);

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
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cx(
                "mb-1 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] transition",
                active
                  ? "bg-blue-600/15 text-blue-200 border border-blue-600/30"
                  : "text-slate-300 hover:bg-slate-900/60"
              )}
            >
              <Icon className="h-4 w-4" />
              {!collapsed ? <span>{t(item.tKey)}</span> : null}
            </Link>
          );
        })}
      </nav>

      <SidebarFooter collapsed={collapsed} />
    </div>
  );
}

async function _getUserProfile(uid) {
  const data = await loadUserData(uid);
  return { user: data?.user || null, error: null };
}

export function SidebarFooter({ collapsed }) {
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

  useEffect(() => {
    const loadProfile = async () => {
      if (firebaseUser) {
        const { user: profile } = await _getUserProfile(firebaseUser.uid);
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
      {user?.is_founder && !collapsed && (
        <div className="mb-2 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider text-center">
          ⚡ Founder mode
        </div>
      )}
      {user?.is_founder && collapsed && (
        <div className="mb-2 flex justify-center" title="Founder mode active">
          <span className="text-amber-400 text-base">⚡</span>
        </div>
      )}
      <div
        className={cx(
          "flex items-center gap-3 rounded-2xl bg-slate-900/40 p-3",
          collapsed ? "justify-center" : ""
        )}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-950/30 overflow-hidden">
          {photoURL ? (
            <img src={photoURL} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <Users className="h-4 w-4 text-slate-200" />
          )}
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-slate-100">{displayName}</div>
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
      </div>

      {!collapsed ? (
        <div className="mt-3 flex gap-2">
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
              {(() => { const _p = JSON.parse(localStorage.getItem('accessguard_v1') || '{}')?.user?.plan || 'free'; return _p === 'free' || _p === 'trial' ? 'Trial' : (getPlanLimits(_p).label || (_p.charAt(0).toUpperCase() + _p.slice(1))); })()}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function LangSelectorCompact() {
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

export function useRenewalAlerts() {
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

export function TopBar({ title, right }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const _db = JSON.parse(localStorage.getItem("accessguard_v1") || "{}");
  const userName = _db?.user?.displayName || _db?.user?.email?.split("@")[0] || "Stacklens";
  return (
    <div className="border-b border-slate-800 bg-slate-950/30">
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
//   1. All 4 Consent Mode v2 parameters controlled
//   2. Accept and Reject buttons have IDENTICAL visual prominence (CNIL parity rule)
//   3. Customize option shown on first layer
//   4. One click to Reject, one click to Accept
//   5. Consent logged to Firestore for audit trail
//   6. Stored consent expires after 13 months (CNIL maximum)
const CONSENT_STORAGE_KEY = 'cookie_consent_v2';
const CONSENT_VERSION = 'v2-2026-04';

export let _openCookieBanner = null;

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
  try { localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record)); } catch { /* noop */ }
  try {
    if (typeof logConsent === 'function') {
      logConsent({
        choice,
        version: CONSENT_VERSION,
        userAgent: navigator.userAgent?.slice(0, 200) || '',
        language: navigator.language || '',
      }).catch(() => {});
    }
  } catch { /* noop */ }
}

export function CookieBanner() {
  const [visible, setVisible] = useState(() => !readStoredConsent());
  const [showDetails, setShowDetails] = useState(false);
  const { language } = useLang();

  useEffect(() => {
    _openCookieBanner = () => {
      setShowDetails(false);
      setVisible(true);
    };
    return () => { _openCookieBanner = null; };
  }, []);

  if (!visible) return null;

  // Intentional local bilingual object — not the global translation hook.
  // CookieBanner must work before the app is fully mounted and needs CNIL-compliant
  // French text regardless of user's saved language preference.
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

  // CNIL-compliant: BOTH buttons use the identical class set — same size, weight, color.
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

export function TrialExpiredBanner() {
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

export function DemoBanner() {
  const { isDemo } = useAuth();
  const navigate = useNavigate();
  if (!isDemo) return null;
  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-base">🎯</span>
        <span className="font-semibold">You&apos;re in Demo Mode</span>
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

export class ErrorBoundary extends React.Component {
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

// Resets error state on each route change so one broken page doesn't lock the app.
export function PageBoundary({ children }) {
  const { pathname } = useLocation();
  return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>;
}

export function AppShell({ subtitle, title, right, children }) {
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
          <footer className="border-t border-slate-800/60 bg-slate-950/40 px-4 md:px-6 py-4 mt-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <span>© {new Date().getFullYear()} Stacklens</span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">SaaS management for SMBs</span>
              </div>
              <div className="flex items-center gap-4">
                <Link to="/contact" className="hover:text-slate-300 transition-colors">Contact</Link>
                <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacy</Link>
                <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms</Link>
                <Link to="/legal" className="hover:text-slate-300 transition-colors">Legal</Link>
                <Link to="/security-info" className="hover:text-slate-300 transition-colors">Security</Link>
                <Link to="/about" className="hover:text-slate-300 transition-colors">About</Link>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
