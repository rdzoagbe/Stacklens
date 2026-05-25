import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle, Bell, Boxes, Check, CheckCircle, CreditCard,
  Download, Plug, Search, Shield, Users, Wrench, Zap,
} from 'lucide-react';
import {
  createBillingPortal, createCheckoutSession, getUserPlanFromFirestore,
  saveUserData, sendInviteEmail, syncClaimsFromServer,
} from '../firebase-config';
import { loadDb, saveDb, seedDbIfEmpty, todayISO } from '../lib/db';
import { toCsv, downloadText } from '../lib/dataUtils';
import { resolvePlan, TRIAL_DAYS, getTrialState, getPlanLimits } from '../lib/plan';
import { useDbQuery, useDbMutations } from '../hooks/useDbQuery';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Button, Card, CardHeader, CardBody, Pill } from '../components/ui';
import { RoleGate, can, getUserRole } from '../components/gates';
import { AppShell } from '../components/AppShell';
import { SlackNotifications } from './DashboardPage';

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
                    if (!priceId) { toast.error('Price not configured for this plan'); return; }
                    const { url, error } = await createCheckoutSession(priceId, db?.user?.email);
                    if (url) window.location.href = url;
                    else toast.error(error || 'Could not start checkout');
                  } catch(e) {
                    toast.error('Checkout failed: ' + e.message);
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

export function BillingPage({ noShell = false }) {
  React.useEffect(() => { const p = new URLSearchParams(window.location.search); if (p.get("success")) { toast.success("Plan upgraded!"); setTimeout(() => { window.history.replaceState({}, "", window.location.pathname); window.location.reload(); }, 1500); } }, []);
  const handleManageSubscription = async () => {
    const { url, error } = await createBillingPortal(window.location.href);
    if (url) window.location.href = url;
    else toast.error('Could not open billing portal: ' + (error || 'Unknown error'));
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
      f_startup_1:"Jusqu'à 10 outils SaaS",f_startup_2:"Jusqu'à 10 employés",f_startup_3:"Alertes de risque basiques",f_startup_4:"Export CSV",f_startup_5:"1 membre d'équipe",f_startup_6:"Support communautaire",
      f_growth_1:"Jusqu'à 50 outils SaaS",f_growth_2:"Jusqu'à 50 employés",f_growth_3:"Score de risque avancé",f_growth_4:"Tableau de bord Finance",f_growth_5:"Exports d'audit",f_growth_6:"Jusqu'à 5 membres",f_growth_7:"Support par email",
      f_scale_1:"Outils SaaS illimités",f_scale_2:"Employés illimités",f_scale_3:"Analyse IA des contrats",f_scale_4:"Gestion des licences",f_scale_5:"Rapports d'audit complets",f_scale_6:"Jusqu'à 15 membres",f_scale_7:"Support prioritaire",f_scale_8:"Accès API",
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
    if (!priceId) { toast.error('Plan not available. Contact us!'); return; }
    setUpgrading(true);
    try {
      const { url, error } = await createCheckoutSession(priceId);
      if (error) throw new Error(error);
      if (url) window.location.href = url;
    } catch (err) {
      toast.error('Could not start checkout: ' + err.message);
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
                <div className="font-black text-lg text-white mb-0.5">{t(p.tName)}</div>
                <div className="text-xs text-slate-500 mb-3 min-h-[2rem]">{t(p.tTag)}</div>
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
                { day: 'Day 14', title: 'Trial ends', desc: "You'll be prompted to choose a plan. Your data stays safe.", color: 'text-amber-400' },
                { day: t('never'), title: 'No surprise charges', desc: "We'll never charge you without your consent.", color: 'text-slate-400' },
                { day: 'Recommended', title: t('plan_scale'), desc: 'Keep all features. Cancel anytime.', color: 'text-emerald-400' },
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
                { label: 'Tools', used: db?.tools?.length || 0, max: currentPlanObj.limits.tools },
                { label: 'Employees', used: db?.employees?.length || 0, max: currentPlanObj.limits.employees },
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
          <div className="bg-slate-900 rounded-3xl border border-white/10 p-8 max-w-md w-full">
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


export function IntegrationConnectors() {
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
            <p className="text-slate-400">Connect your tools to automate SaaS management</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-slate-800">
            <div className="text-xl md:text-3xl font-black text-blue-400">{integrations.length}</div>
            <div className="text-sm text-slate-400 mt-1">Total</div>
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

export function IntegrationsPage() {
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

export function SettingsPage() {
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
                    { label: t('org_name_label'), el: <input value={orgName} onChange={e=>setOrgName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="Acme Corp" /> },

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
                      Save Changes
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
                <CardHeader title={t('team_members')} subtitle={`${members.length} of ${getPlanLimits(resolvePlan(db?.user)).teamMembers} seats used`} />
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
                        <div className="text-xs text-slate-600">Joined {m.joined}</div>
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
                        <option value="admin">Admin — Manage tools, employees & access</option>
                        <option value="editor">Editor — View & edit data</option>
                        <option value="viewer">Viewer — Read-only access</option>
                      </select>
                      <div className="w-full mt-2 p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1.5">
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"></span><span><span className="text-amber-400 font-semibold">Owner</span> — Full access + billing + roles</span></div>
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0"></span><span><span className="text-blue-400 font-semibold">Admin</span> — Manage tools, employees, access & offboarding</span></div>
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></span><span><span className="text-emerald-400 font-semibold">Editor</span> — View & edit data, cannot delete</span></div>
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0"></span><span><span className="text-slate-300 font-semibold">Viewer</span> — Read-only, no edits</span></div>
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
                    { label: 'Renewal due in 30 days',      sub: 'SaaS contract coming up for renewal — sent by email',  val: notifRenewal,    set: setNotifRenewal,    key: 'renewal',    live: true },
                    { label: 'New tool added to inventory',  sub: 'When a tool is added via import or manually',           val: notifNewTool,    set: setNotifNewTool,    key: 'newTool' },
                    { label: 'Orphaned tool detected',       sub: 'Tools with no assigned owner',                          val: notifOrphaned,   set: setNotifOrphaned,   key: 'orphaned' },
                    { label: 'High-risk access granted',     sub: 'Admin access given to a new user',                      val: notifHighRisk,   set: setNotifHighRisk,   key: 'highRisk' },
                    { label: 'Employee offboarding initiated', sub: 'When an offboarding task is started',                 val: notifOffboard,   set: setNotifOffboard,   key: 'offboard' },
                    { label: 'Compliance report ready',      sub: 'Weekly compliance digest',                              val: notifCompliance, set: setNotifCompliance, key: 'compliance' },
                    { label: 'Weekly summary email',         sub: 'Overview of spend, risk and usage',                     val: notifWeekly,     set: setNotifWeekly,     key: 'weekly' },
                    { label: 'Invoice approval required',    sub: 'New invoice needs sign-off',                            val: notifInvoice,    set: setNotifInvoice,    key: 'invoice' },
                    { label: t('budget_limit'),              sub: 'Monthly spend passes your set limit',                   val: notifBudget,     set: setNotifBudget,     key: 'budget' },
                  ].map(n => (
                    <div key={n.key} className="flex items-center justify-between py-3.5 border-b border-slate-800 last:border-0">
                      <div>
                        <div className="text-sm font-medium text-slate-200 flex items-center gap-2">
                          {n.label}
                          {n.live && <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">Live</span>}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{n.sub}</div>
                      </div>
                      <Toggle checked={n.val} onChange={(v) => { n.set(v); saveNotifications({ [n.key]: v }); }} />
                    </div>
                  ))}
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
                      Save Security Settings
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
                      <p className="text-xs text-slate-400">Connect your Okta, Azure AD, or Google Workspace SSO to enforce centralised authentication.</p>
                      <button onClick={() => { navigate('/settings'); setTimeout(() => { const el = document.querySelector('[data-tab="billing"]'); if(el) el.click(); }, 100); }} className="text-xs text-amber-400 font-semibold hover:underline mt-2 inline-block">View Enterprise Plan →</button>
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
                      <div className="text-sm font-bold text-emerald-400 mb-1">✓ New API key generated — copy it now, it won't be shown again</div>
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
                          <div>Created {k.created}</div>
                          <div>Last used: {k.lastUsed}</div>
                        </div>
                        <button onClick={() => { if (window.confirm(`Revoke key "${k.name}"? This cannot be undone.`)) saveApiKeys(apiKeys.filter(x => x.id !== k.id)); }} className="text-xs text-rose-500 hover:text-rose-400 transition-colors flex-shrink-0">{t('revoke')}</button>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Generate New Key" subtitle="Name it so you remember what it's for" />
                <CardBody>
                  <div className="flex gap-3">
                    <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500 transition-colors" placeholder={t('key_name_placeholder')} />
                    <button onClick={generateApiKey}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap">
                      Generate Key
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
                <CardHeader title={t('export_data')} subtitle={t('export_data_sub')
} />
                <CardBody>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      {
                        label: 'Tools & Licenses',
                        desc: 'All tool records, costs, owners',
                        icon: Boxes,
                        onClick: () => {
                          downloadText(`stacklens_tools_${todayISO()}.csv`, toCsv(db?.tools || [],
                            ["name","category","owner_email","criticality","url","derived_status","last_used_date","cost_per_month","derived_risk","notes"]
                          ));
                          toast.success('Tools exported');
                        },
                      },
                      {
                        label: 'Employees & Access',
                        desc: 'Employee directory and access map',
                        icon: Users,
                        onClick: () => {
                          downloadText(`stacklens_employees_${todayISO()}.csv`, toCsv(db?.employees || [],
                            ["full_name","email","department","role","status","start_date","end_date"]
                          ));
                          setTimeout(() => downloadText(`stacklens_access_${todayISO()}.csv`, toCsv(db?.access || [],
                            ["tool_name","employee_name","employee_email","access_level","granted_date","last_accessed_date","last_reviewed_date","status","derived_risk_flag"]
                          )), 300);
                          toast.success('Employees & access exported');
                        },
                      },
                      {
                        label: 'Audit Log',
                        desc: 'Full history of all actions',
                        icon: Download,
                        onClick: () => {
                          downloadText(`stacklens_audit_${todayISO()}.csv`, toCsv(db?.audit_log || [],
                            ["action","user","timestamp","details"]
                          ));
                          toast.success('Audit log exported');
                        },
                      },
                    ].map(({ label, desc, icon: Icon, onClick }) => (
                      <button key={label} onClick={onClick}
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
                    {[
                      {
                        label: 'Delete all tool data',
                        desc: 'Removes all tools, employees and access records',
                        btn: 'Delete Tools',
                        onClick: () => {
                          if (isDemo) { toast.error('Not available in demo mode.'); return; }
                          if (!window.confirm('Delete ALL tools, employees and access records? This cannot be undone.')) return;
                          const cur = loadDb() || seedDbIfEmpty();
                          cur.tools = []; cur.employees = []; cur.access = [];
                          saveDb(cur);
                          if (firebaseUser?.uid) saveUserData(firebaseUser.uid, cur).catch(() => {});
                          qc.invalidateQueries({ queryKey: ['db'] });
                          toast.success('All tool data deleted');
                        },
                      },
                      {
                        label: 'Delete all employee data',
                        desc: 'Removes all employee and access records',
                        btn: 'Delete Employees',
                        onClick: () => {
                          if (isDemo) { toast.error('Not available in demo mode.'); return; }
                          if (!window.confirm('Delete ALL employees and access records? This cannot be undone.')) return;
                          const cur = loadDb() || seedDbIfEmpty();
                          cur.employees = []; cur.access = [];
                          saveDb(cur);
                          if (firebaseUser?.uid) saveUserData(firebaseUser.uid, cur).catch(() => {});
                          qc.invalidateQueries({ queryKey: ['db'] });
                          toast.success('All employee data deleted');
                        },
                      },
                      {
                        label: 'Delete account',
                        desc: 'Permanently deletes your Stacklens account and all data',
                        btn: 'Delete Account',
                        danger: true,
                        onClick: () => {
                          if (isDemo) { toast.error('Not available in demo mode.'); return; }
                          window.location.href = 'mailto:hello@stacklens.fr?subject='
                            + encodeURIComponent('Account Deletion Request')
                            + '&body=' + encodeURIComponent(
                                'Please delete my Stacklens account.\n\nEmail: '
                                + (firebaseUser?.email || '')
                              );
                        },
                      },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between py-3 border-b border-rose-500/10 last:border-0">
                        <div>
                          <div className="font-medium text-slate-200 text-sm">{item.label}</div>
                          <div className="text-xs text-slate-500">{item.desc}</div>
                        </div>
                        <button onClick={item.onClick}
                          className={"text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors " + (item.danger ? 'border-rose-500/40 text-rose-400 hover:bg-rose-500/10' : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600')}>
                          {item.btn}
                        </button>
                      </div>
                    ))}
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
                <CardHeader title={t('nav_integrations') || 'Integrations'} subtitle="Connect Stacklens to your tools for automatic discovery and user sync" />
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
