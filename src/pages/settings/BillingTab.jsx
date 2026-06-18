import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Check, CreditCard } from 'lucide-react';
import {
  createBillingPortal, createCheckoutSession,
} from '../../firebase-config';
import { resolvePlan, TRIAL_DAYS, getTrialState } from '../../lib/plan';
import { useDbQuery } from '../../hooks/useDbQuery';
import { useLang } from '../../contexts/LangContext';
import { useTranslation } from '../../translations';
import { Pill } from '../../components/ui';
import { AppShell } from '../../components/AppShell';

export function BillingPage({ noShell = false }) {
  React.useEffect(() => { const p = new URLSearchParams(window.location.search); if (p.get("success")) { toast.success("Plan upgraded!"); setTimeout(() => { window.history.replaceState({}, "", window.location.pathname); window.location.reload(); }, 1500); } }, []);
  const handleManageSubscription = async () => {
    const { url, error } = await createBillingPortal(window.location.href);
    if (url) window.location.href = url;
    else toast.error('Could not open billing portal: ' + (error || 'Unknown error'));
  };
  const { data: db } = useDbQuery();
  const { language } = useLang();
  const t = useTranslation(language);
  const plan = resolvePlan(db?.user);
  const [billing, setBilling] = useState('monthly');
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactSize, setContactSize] = useState('1-10');
  const [contactSent, setContactSent] = useState(false);

  const _trialState = getTrialState(db?.user);
  const trialDaysLeft = _trialState.daysLeft;
  const trialDaysUsed = TRIAL_DAYS - trialDaysLeft;
  const trialPct = Math.max(0, Math.min(100, (trialDaysUsed / TRIAL_DAYS) * 100));
  const isTrial = _trialState.isTrial || (plan === 'free' && !_trialState.expired);

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

  const PRICE_IDS = {
    starter:    { monthly: 'price_1TMhOt1yFs6IziIVgJGBbzoG', annual: 'price_1TMhfK1yFs6IziIVOtbhpy23' },
    hr_finance: { monthly: 'price_1TWxAB1yFs6IziIVjxw3CG2V', annual: 'price_1TWxFd1yFs6IziIVjPZnA8XT' },
    pro:        { monthly: 'price_1TMhNW1yFs6IziIV5hwlssrt', annual: 'price_1TMhNW1yFs6IziIVMxiacXD7' },
    enterprise: { monthly: 'price_1TMhNk1yFs6IziIVPkv7RiLc', annual: 'price_1TMhNk1yFs6IziIViMLzewdQ' },
    growth:     { monthly: 'price_1TMhNW1yFs6IziIV5hwlssrt', annual: 'price_1TMhNW1yFs6IziIVMxiacXD7' },
    scale:      { monthly: 'price_1TMhNk1yFs6IziIVPkv7RiLc', annual: 'price_1TMhNk1yFs6IziIViMLzewdQ' },
    unlimited:  { monthly: 'price_1TMhNk1yFs6IziIVPkv7RiLc', annual: 'price_1TMhNk1yFs6IziIViMLzewdQ' },
  };

  const upgrade = async (id) => {
    if (id === 'enterprise') { setShowContactModal(true); return; }
    if (id === 'free' || id === 'startup') return;
    if (id === 'scale') { document.getElementById('billing-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
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
      {noShell && <div className="flex items-center justify-end">{HeaderRight}</div>}

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
              <button onClick={() => upgrade('scale')} disabled={upgrading}
                className="px-7 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black rounded-xl transition-all shadow-lg shadow-amber-500/30 text-sm block mb-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {upgrading ? '...' : t('upgrade_now') + ' ✨'}
              </button>
              <p className="text-xs text-slate-500">{t('cancel_anytime')}</p>
            </div>
          </div>
        </div>
      )}

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

      <div id="billing-plans" className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {plans.map(p => {
          const isCurrent = plan === p.id;
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
                <button onClick={() => upgrade(p.id)} disabled={upgrading}
                  className={"w-full py-2.5 rounded-xl font-bold transition-all text-xs text-white bg-gradient-to-r hover:opacity-90 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed " + p.color}>
                  {upgrading ? '...' : (isTrial ? t('upgrade_now').split('—')[0].trim() : 'Upgrade')}
                </button>
              )}
            </div>
          );
        })}
      </div>

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

  if (noShell) return Body;
  return <AppShell title={t('billing_title')} right={HeaderRight}>{Body}</AppShell>;
}
