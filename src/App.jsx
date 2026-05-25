import React, { useEffect, useState, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { resendEmailVerification } from './firebase-config';
import { useAuth } from './hooks/useAuth';
import { TourProvider } from './contexts/TourContext';
import { LanguageProvider, useLang } from './contexts/LangContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { ModuleGate } from './components/gates';
import { AppShell, CookieBanner, ErrorBoundary } from './components/AppShell';
import { FloatingChatbotGated } from './components/FloatingChatbot';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslation } from './translations';
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
const OffboardingPage      = React.lazy(() => import('./pages/OffboardingPage').then(m => ({ default: m.OffboardingPage })));
const SecurityCompliancePage = React.lazy(() => import('./pages/SecurityCompliancePage').then(m => ({ default: m.SecurityCompliancePage })));
const SettingsPage         = React.lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const FinanceDashboard     = React.lazy(() => import('./pages/FinancePage').then(m => ({ default: m.FinanceDashboard })));
const ContractComparisonPage = React.lazy(() => import('./pages/ContractComparisonPage').then(m => ({ default: m.ContractComparisonPage })));

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
const LazyIntegrationConnectors = React.lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.IntegrationConnectors })));
const LazyImportWizard          = React.lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.ImportWizard })));

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





export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" toastOptions={{ style: { background: "#1e293b", color: "#f1f5f9", border: "1px solid #334155" } }} />
        <LanguageProvider><CurrencyProvider>
        <ErrorBoundary><BrowserRouter>
        <CookieBanner />
          <TourProvider>
          <Suspense fallback={<PageLoader />}>
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
          </Suspense>
        <FloatingChatbotGated />
        </TourProvider>
        </BrowserRouter></ErrorBoundary>
        </CurrencyProvider></LanguageProvider>
    </QueryClientProvider>
  );
}