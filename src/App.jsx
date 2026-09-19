import React, { useEffect, useState, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { resendEmailVerification, refreshEmailVerified } from './firebase-config';
import { useAuth } from './hooks/useAuth';
import { TourProvider } from './contexts/TourContext';
import { LanguageProvider, useLang } from './contexts/LangContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { ModuleGate } from './components/gates';
import { AppShell, CookieBanner, ErrorBoundary, PageBoundary } from './components/AppShell';
import { FloatingChatbotGated } from './components/FloatingChatbot';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslation } from './translations';
import { setQueryClient } from './lib/db';
import { applySeo } from './lib/seo';
import { Toaster } from 'react-hot-toast';

// ── Route-level code splitting ────────────────────────────────────────────────
// Factory functions keep import() calls un-evaluated until first render (true lazy).
const TrialPage            = React.lazy(() => import('./pages/TrialPage').then(m => ({ default: m.TrialPage })));
const OnboardingPage       = React.lazy(() => import('./pages/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const FinishSignUpPage     = React.lazy(() => import('./pages/FinishSignUpPage').then(m => ({ default: m.FinishSignUpPage })));
const DashboardPage        = React.lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ToolsPage            = React.lazy(() => import('./pages/ToolsPage').then(m => ({ default: m.ToolsPage })));
const EmployeesPage        = React.lazy(() => import('./pages/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const AccessPage           = React.lazy(() => import('./pages/AccessPage').then(m => ({ default: m.AccessPage })));
const ClientsPage          = React.lazy(() => import('./pages/ClientsPage').then(m => ({ default: m.ClientsPage })));
const OffboardingPage      = React.lazy(() => import('./pages/OffboardingPage').then(m => ({ default: m.OffboardingPage })));
const SecurityCompliancePage = React.lazy(() => import('./pages/SecurityCompliancePage').then(m => ({ default: m.SecurityCompliancePage })));
const SettingsPage         = React.lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const FinanceDashboard     = React.lazy(() => import('./pages/FinancePage').then(m => ({ default: m.FinanceDashboard })));
const FounderAdminPage     = React.lazy(() => import('./pages/FounderAdminPage').then(m => ({ default: m.FounderAdminPage })));

// The accountant channel: a landing page and a public, browser-only audit.
const AccountantsPage = React.lazy(() => import('./pages/AccountantsPage').then(m => ({ default: m.AccountantsPage })));
const SaasAuditPage   = React.lazy(() => import('./pages/SaasAuditPage').then(m => ({ default: m.SaasAuditPage })));

// Legal pages share one chunk (all resolved from the same dynamic import)
const NotFound          = React.lazy(() => import('./pages/LegalPages').then(m => ({ default: m.NotFound })));
const AboutPage         = React.lazy(() => import('./pages/LegalPages').then(m => ({ default: m.AboutPage })));
const ContactPage       = React.lazy(() => import('./pages/LegalPages').then(m => ({ default: m.ContactPage })));
const PrivacyPage       = React.lazy(() => import('./pages/LegalPages').then(m => ({ default: m.PrivacyPage })));
const TermsPage         = React.lazy(() => import('./pages/LegalPages').then(m => ({ default: m.TermsPage })));
const DpaPage           = React.lazy(() => import('./pages/LegalPages').then(m => ({ default: m.DpaPage })));
const SubProcessorsPage = React.lazy(() => import('./pages/LegalPages').then(m => ({ default: m.SubProcessorsPage })));
const LegalMentionsPage = React.lazy(() => import('./pages/LegalPages').then(m => ({ default: m.LegalMentionsPage })));
const SecurityPage      = React.lazy(() => import('./pages/LegalPages').then(m => ({ default: m.SecurityPage })));

// Sub-components used inside SetupConnectionsHub — lazy so they don't pull their
// parent page chunks into the main bundle
const LazyIntegrationConnectors = React.lazy(() => import('./pages/settings/IntegrationsTab').then(m => ({ default: m.IntegrationConnectors })));
const LazyImportWizard          = React.lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.ImportWizard })));



// ── The screen people land on when the email is in their spam folder ──────
//
// Verification mail from this app goes to Junk. Measured, not assumed: an
// Outlook mailbox junked it from SendGrid over @stacklens.fr with DMARC
// passing, and junked it again from Firebase's own sender over Google
// infrastructure. Two senders, opposite ends of the reputation scale, same
// folder.
//
// This screen used to say "We sent a verification link to <you>. Click the
// link to activate your account." — describing a happy path that demonstrably
// is not happening. Somebody signs up, looks in their inbox, finds nothing,
// and leaves. No error, nothing broken, no way for them to know where to look.
//
// So the copy now names the folder, and the resend works more than once.
//
// The sender address is deliberately NOT printed here. It is
// noreply@accessguard-v2.firebaseapp.com today and it changes the moment
// custom SMTP is switched back on in the Firebase console — a hardcoded
// address is a line of copy that silently becomes a lie, which is the exact
// failure this whole screen exists to stop. "Search for Stacklens" is true
// whatever the sender, because the subject line always carries the name.
const RESEND_COOLDOWN_SECONDS = 60;

function EmailVerificationWall({ email, onVerified }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  // Seconds left before Resend is available again.
  //
  // It used to be `disabled={resending || sent}` with `sent` never reset, so
  // the button worked exactly once and was then dead for the life of the
  // screen — and dead at 50% opacity with no explanation, on the screen where
  // the mail lands in Junk and a second copy is the obvious next thing to
  // want. A page reload was the only way back. Same family as the Continue
  // button in #270: an affordance that looks pressable and is not, saying
  // nothing about why.
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const handleResend = async () => {
    if (resending || cooldown > 0) return;
    setResending(true);
    try {
      const { error: err } = await resendEmailVerification();
      if (err) { setError(err); } else { setSent(true); setError(''); setCooldown(RESEND_COOLDOWN_SECONDS); }
    } finally {
      setResending(false);
    }
  };

  // The old version awaited firebaseUser.reload() and trusted a comment
  // claiming onAuthStateChanged would re-render. It does not fire on reload,
  // so for anyone who HAD clicked the link nothing was set, nothing changed,
  // and the wall stayed put — the button did nothing, which is the one thing
  // it cannot do, being the only way off this screen.
  //
  // Now the answer comes back from the server and is reported upwards, so the
  // component that owns the gate is the one that re-renders.
  const handleCheck = async () => {
    setChecking(true);
    setError('');
    try {
      const { verified, error: err } = await refreshEmailVerified();
      if (verified) onVerified();
      else setError(err || t('email_not_verified_yet') || 'Email not verified yet. Please check your inbox.');
    } catch (e) {
      setError(e.message);
    } finally {
      setChecking(false);
    }
  };

  const resendLabel = resending
    ? (t('sending') || 'Sending…')
    : cooldown > 0
      ? `${t('resend_in') || 'Resend available in'} ${cooldown}s`
      : (t('resend_verification') || 'Resend verification email');

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-5">
        <div className="text-5xl">✉️</div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">{t('verify_email_title') || 'Verify your email'}</h2>
          <p className="text-slate-400 text-sm">{t('verify_email_sub') || "We sent a verification link to"} <span className="text-white font-medium">{email}</span>. {t('verify_email_sub2') || "Click the link to activate your account."}</p>
        </div>

        {/* The whole point of this change. Not a footnote in grey 10px —
            the mail really does land in Junk, so this is as important as
            the sentence above it. */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left">
          <p className="text-amber-200 text-sm font-medium">
            {t('verify_check_spam_title') || 'Not in your inbox? Check spam or junk.'}
          </p>
          <p className="text-amber-200/70 text-xs mt-1">
            {t('verify_check_spam_body') || 'Search your mail for "Stacklens". Marking the message as "not spam" also means later emails from us reach your inbox.'}
          </p>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {sent && <p className="text-green-400 text-sm">{t('verification_resent') || 'Verification email resent!'}</p>}
        <div className="flex flex-col gap-3">
          <button onClick={handleCheck} disabled={checking}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-colors">
            {checking ? (t('checking') || 'Checking...') : (t('ive_verified') || "I've verified — continue")}
          </button>
          <button onClick={handleResend} disabled={resending || cooldown > 0}
            className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 disabled:cursor-not-allowed text-slate-300 rounded-xl font-semibold text-sm transition-colors">
            {resendLabel}
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
  const [justVerified, setJustVerified] = useState(false);

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-950"><div className="text-white text-sm">{t('loading')}</div></div>;

  if (!isAuthed && !isDemo && !firebaseUser) return <Navigate to="/" replace state={{ from: location }} />;

  // Gate email/password users who haven't verified yet (Google/magic-link users are pre-verified)
  //
  // `justVerified` is held HERE rather than in the wall, because this is the
  // component that decides whether to show it. The wall is a child: state it
  // sets re-renders only the wall, which is why the old button appeared to do
  // nothing even when the reload had succeeded.
  //
  // It is also why this does not simply re-read firebaseUser.emailVerified.
  // That object is the SDK's instance held in this hook's state; whether a
  // reload mutates it in place is an implementation detail, and the gate
  // should not depend on one. The server's answer is what is recorded.
  //
  // Not a security boundary and not pretending to be: this gate is UX. The
  // real enforcement is in the Firestore rules and the Cloud Functions, which
  // check the token, not this flag.
  const isPasswordProvider = firebaseUser?.providerData?.[0]?.providerId === 'password';
  if (isPasswordProvider && firebaseUser?.emailVerified === false && !justVerified) {
    return <EmailVerificationWall email={firebaseUser.email} onVerified={() => setJustVerified(true)} />;
  }

  return children;
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-slate-950">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function SetupConnectionsHub() {
  const { language } = useLang();
  const t = useTranslation(language);
  const [setupTab, setSetupTab] = useState(() => { const p = new URLSearchParams(window.location.search); return p.get('tab') || 'integrations'; });
  const _loc = useLocation();
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const p = new URLSearchParams(_loc.search); const tab = p.get('tab'); if (tab) setSetupTab(tab); }, [_loc.search]);
  const TABS = [
    { id: 'integrations', label: `🔌 ${t('integrations_tab')}`,  desc: t('int_connect_automate') },
    { id: 'import',       label: `📥 ${t('import_tab')}`,        desc: 'CSV & data import' },
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
            <h2 className="text-2xl font-black text-white mb-1">🔌 {t('integrations_tab')}</h2>
            <p className="text-slate-400">{t('integrations_connect_sub')}</p>
          </div>
          <Suspense fallback={<PageLoader />}><LazyIntegrationConnectors /></Suspense>
        </div>
      )}
      {setupTab === 'import' && <Suspense fallback={<PageLoader />}><LazyImportWizard /></Suspense>}
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

// Let resetDb() clear on-screen data instantly via the shared cache.
setQueryClient(queryClient);






// ── Head management ────────────────────────────────────────────────────────
// Inside the router so it runs on every navigation. Without this every route
// served index.html's hardcoded canonical pointing at the homepage, so each
// URL in sitemap.xml declared itself a duplicate of / and was dropped.
function SeoHead() {
  const { pathname } = useLocation();
  useEffect(() => { applySeo(pathname); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" toastOptions={{ style: { background: "#1e293b", color: "#f1f5f9", border: "1px solid #334155" } }} />
        <LanguageProvider><CurrencyProvider>
        <ErrorBoundary><BrowserRouter>
        <SeoHead />
        <CookieBanner />
          <TourProvider>
          <Suspense fallback={<PageLoader />}>
          <PageBoundary>
          <Routes>
          <Route path="/" element={<TrialPage />} />
          <Route path="/experts-comptables" element={<AccountantsPage />} />
          <Route path="/audit-saas" element={<SaasAuditPage />} />
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
            path="/clients"
            element={<RequireAuth><ClientsPage /></RequireAuth>}
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
          <Route path="/founder-admin" element={<RequireAuth><FounderAdminPage /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
          </PageBoundary>
          </Suspense>
        <FloatingChatbotGated />
        </TourProvider>
        </BrowserRouter></ErrorBoundary>
        </CurrencyProvider></LanguageProvider>
    </QueryClientProvider>
  );
}