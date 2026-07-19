import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, CreditCard } from 'lucide-react';
import {
  createBillingPortal, createCheckoutSession, logLegalAcceptance,
} from '../../firebase-config';
import { resolvePlan, TRIAL_DAYS, getTrialState } from '../../lib/plan';
import { useDbQuery } from '../../hooks/useDbQuery';
import { useLang } from '../../contexts/LangContext';
import { useTranslation } from '../../translations';
import { usePlanPricing } from '../../contexts/CurrencyContext';
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
  const pricing = usePlanPricing();
  const [billing, setBilling] = useState('monthly');

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
        { key: 'f_free_1' }, { key: 'f_free_2' }, { key: 'f_free_3' },
        { key: 'f_free_4' }, { key: 'f_free_5' }, { key: 'f_free_6' },
      ],
      limits: { tools: 10, employees: 25 },
    },
    {
      id: 'starter',
      tName: 'plan_starter', tTag: 'plan_starter_tag',
      icon: '🌱', monthly: 29, annual: 278,
      color: 'from-blue-500 to-blue-700', border: 'border-blue-500/40',
      features: [
        { key: 'f_starter_1' }, { key: 'f_starter_2' }, { key: 'f_starter_3' },
        { key: 'f_starter_4' }, { key: 'f_starter_5' }, { key: 'f_starter_6' },
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
        { key: 'f_hrf_1' }, { key: 'f_hrf_2' }, { key: 'f_hrf_3' },
        { key: 'f_hrf_4' }, { key: 'f_hrf_5' }, { key: 'f_hrf_6' },
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
        { key: 'f_pro_1' }, { key: 'f_pro_2' }, { key: 'f_pro_3' }, { key: 'f_pro_4' },
        { key: 'f_pro_5' }, { key: 'f_pro_6' }, { key: 'f_pro_7' },
      ],
      limits: { tools: 500, employees: 1500 },
    },
    {
      id: 'enterprise',
      tName: 'plan_enterprise', tTag: 'plan_enterprise_tag',
      icon: '⚡', monthly: 299, annual: 2870,
      color: 'from-violet-600 to-purple-700', border: 'border-violet-500/40',
      features: [
        { key: 'f_ent_1' }, { key: 'f_ent_2' }, { key: 'f_ent_3' },
        { key: 'f_ent_4' }, { key: 'f_ent_5' }, { key: 'f_ent_6' },
      ],
      limits: { tools: 99999, employees: 99999 },
    },
  ];

  // Every feature listed here exists in the product today. Team seats, SSO/SAML,
  // SCIM, account managers, and SLAs are intentionally absent — do not re-add a
  // feature to a plan card before it actually ships.
  const featureText = {
    en: {
      plan_free:'Free', plan_free_tag:'For small teams getting started',
      plan_starter:'Starter', plan_starter_tag:'For growing teams',
      plan_hr_finance:'HR & Finance', plan_hr_finance_tag:'For HR & Finance directors',
      plan_pro:'Pro', plan_pro_tag:'For teams that need full visibility and control',
      plan_enterprise:'Enterprise', plan_enterprise_tag:'For large organisations',
      f_free_1:'Up to 10 SaaS tools',f_free_2:'Up to 25 employees',f_free_3:'Shadow IT discovery',f_free_4:'Basic security alerts',f_free_5:'No credit card required',f_free_6:'Forever free',
      f_starter_1:'Up to 100 SaaS tools',f_starter_2:'Up to 250 employees',f_starter_3:'Add / edit / delete data',f_starter_4:'Renewal alerts',f_starter_5:'CSV import & export',f_starter_6:'Email support',
      f_hrf_1:'Full Finance Board',f_hrf_2:'People & HR Board',f_hrf_3:'Access tracking & map',f_hrf_4:'Offboarding queue',f_hrf_5:'Budget tracking & renewal calendar',f_hrf_6:'Priority email support',
      f_pro_1:'Up to 500 SaaS tools',f_pro_2:'Up to 1,500 employees',f_pro_3:'AI recommendations & contract analysis',f_pro_4:'Cost management & finance suite',f_pro_5:'Full security & audit suite',f_pro_6:'License optimization',f_pro_7:'Priority email support',
      f_ent_1:'Unlimited SaaS tools',f_ent_2:'Unlimited employees',f_ent_3:'Everything in Pro',f_ent_4:'Advanced analytics & CSV exports',f_ent_5:'Priority email support',f_ent_6:'Read-only REST API',
    },
    fr: {
      plan_free:'Gratuit', plan_free_tag:'Pour les petites équipes qui débutent',
      plan_starter:'Starter', plan_starter_tag:'Pour les équipes en croissance',
      plan_hr_finance:'RH & Finance', plan_hr_finance_tag:'Pour les DRH et directeurs financiers',
      plan_pro:'Pro', plan_pro_tag:'Pour les équipes qui ont besoin de visibilité totale',
      plan_enterprise:'Enterprise', plan_enterprise_tag:'Pour les grandes organisations',
      f_free_1:"Jusqu'à 10 outils SaaS",f_free_2:"Jusqu'à 25 employés",f_free_3:'Détection du Shadow IT',f_free_4:'Alertes de sécurité basiques',f_free_5:'Sans carte bancaire',f_free_6:'Gratuit pour toujours',
      f_starter_1:"Jusqu'à 100 outils SaaS",f_starter_2:"Jusqu'à 250 employés",f_starter_3:'Ajout / modification / suppression',f_starter_4:'Alertes de renouvellement',f_starter_5:'Import & export CSV',f_starter_6:'Support par email',
      f_hrf_1:'Tableau de bord Finance complet',f_hrf_2:'Tableau de bord RH & Personnel',f_hrf_3:'Suivi et carte des accès',f_hrf_4:"File d'offboarding",f_hrf_5:'Suivi budgétaire & calendrier des renouvellements',f_hrf_6:'Support email prioritaire',
      f_pro_1:"Jusqu'à 500 outils SaaS",f_pro_2:"Jusqu'à 1 500 employés",f_pro_3:'Recommandations IA & analyse de contrats',f_pro_4:'Gestion des coûts & suite finance',f_pro_5:'Suite sécurité & audit complète',f_pro_6:'Optimisation des licences',f_pro_7:'Support email prioritaire',
      f_ent_1:'Outils SaaS illimités',f_ent_2:'Employés illimités',f_ent_3:'Tout le plan Pro inclus',f_ent_4:'Analytics avancés & exports CSV',f_ent_5:'Support email prioritaire',f_ent_6:'API REST en lecture seule',
    },
    de: {
      plan_free:'Kostenlos', plan_free_tag:'Für kleine Teams am Anfang',
      plan_starter:'Starter', plan_starter_tag:'Für wachsende Teams',
      plan_hr_finance:'HR & Finanzen', plan_hr_finance_tag:'Für HR- und Finanzleiter',
      plan_pro:'Pro', plan_pro_tag:'Für Teams, die volle Transparenz brauchen',
      plan_enterprise:'Enterprise', plan_enterprise_tag:'Für große Organisationen',
      f_free_1:'Bis zu 10 SaaS-Tools',f_free_2:'Bis zu 25 Mitarbeiter',f_free_3:'Shadow-IT-Erkennung',f_free_4:'Grundlegende Sicherheitswarnungen',f_free_5:'Keine Kreditkarte nötig',f_free_6:'Für immer kostenlos',
      f_starter_1:'Bis zu 100 SaaS-Tools',f_starter_2:'Bis zu 250 Mitarbeiter',f_starter_3:'Daten anlegen / bearbeiten / löschen',f_starter_4:'Verlängerungs-Alerts',f_starter_5:'CSV-Import & -Export',f_starter_6:'E-Mail-Support',
      f_hrf_1:'Komplettes Finanz-Dashboard',f_hrf_2:'HR- & Personal-Dashboard',f_hrf_3:'Zugriffsverfolgung & -karte',f_hrf_4:'Offboarding-Warteschlange',f_hrf_5:'Budgetverfolgung & Verlängerungskalender',f_hrf_6:'Bevorzugter E-Mail-Support',
      f_pro_1:'Bis zu 500 SaaS-Tools',f_pro_2:'Bis zu 1.500 Mitarbeiter',f_pro_3:'KI-Empfehlungen & Vertragsanalyse',f_pro_4:'Kostenmanagement & Finanz-Suite',f_pro_5:'Komplette Sicherheits- & Audit-Suite',f_pro_6:'Lizenzoptimierung',f_pro_7:'Bevorzugter E-Mail-Support',
      f_ent_1:'Unbegrenzte SaaS-Tools',f_ent_2:'Unbegrenzte Mitarbeiter',f_ent_3:'Alles aus Pro enthalten',f_ent_4:'Erweiterte Analysen & CSV-Exporte',f_ent_5:'Bevorzugter E-Mail-Support',f_ent_6:'Schreibgeschützte REST-API',
    },
    es: {
      plan_free:'Gratis', plan_free_tag:'Para equipos pequeños que empiezan',
      plan_starter:'Starter', plan_starter_tag:'Para equipos en crecimiento',
      plan_hr_finance:'RRHH y Finanzas', plan_hr_finance_tag:'Para directores de RRHH y finanzas',
      plan_pro:'Pro', plan_pro_tag:'Para equipos que necesitan visibilidad total',
      plan_enterprise:'Enterprise', plan_enterprise_tag:'Para grandes organizaciones',
      f_free_1:'Hasta 10 herramientas SaaS',f_free_2:'Hasta 25 empleados',f_free_3:'Detección de Shadow IT',f_free_4:'Alertas de seguridad básicas',f_free_5:'Sin tarjeta de crédito',f_free_6:'Gratis para siempre',
      f_starter_1:'Hasta 100 herramientas SaaS',f_starter_2:'Hasta 250 empleados',f_starter_3:'Añadir / editar / eliminar datos',f_starter_4:'Alertas de renovación',f_starter_5:'Importación y exportación CSV',f_starter_6:'Soporte por email',
      f_hrf_1:'Panel de Finanzas completo',f_hrf_2:'Panel de RRHH y Personal',f_hrf_3:'Seguimiento y mapa de accesos',f_hrf_4:'Cola de offboarding',f_hrf_5:'Control de presupuesto y calendario de renovaciones',f_hrf_6:'Soporte prioritario por email',
      f_pro_1:'Hasta 500 herramientas SaaS',f_pro_2:'Hasta 1.500 empleados',f_pro_3:'Recomendaciones IA y análisis de contratos',f_pro_4:'Gestión de costes y suite financiera',f_pro_5:'Suite completa de seguridad y auditoría',f_pro_6:'Optimización de licencias',f_pro_7:'Soporte prioritario por email',
      f_ent_1:'Herramientas SaaS ilimitadas',f_ent_2:'Empleados ilimitados',f_ent_3:'Todo lo del plan Pro',f_ent_4:'Análisis avanzados y exportaciones CSV',f_ent_5:'Soporte prioritario por email',f_ent_6:'API REST de solo lectura',
    },
    pt: {
      plan_free:'Grátis', plan_free_tag:'Para pequenas equipas a começar',
      plan_starter:'Starter', plan_starter_tag:'Para equipas em crescimento',
      plan_hr_finance:'RH e Finanças', plan_hr_finance_tag:'Para diretores de RH e financeiros',
      plan_pro:'Pro', plan_pro_tag:'Para equipas que precisam de visibilidade total',
      plan_enterprise:'Enterprise', plan_enterprise_tag:'Para grandes organizações',
      f_free_1:'Até 10 ferramentas SaaS',f_free_2:'Até 25 funcionários',f_free_3:'Deteção de Shadow IT',f_free_4:'Alertas de segurança básicos',f_free_5:'Sem cartão de crédito',f_free_6:'Grátis para sempre',
      f_starter_1:'Até 100 ferramentas SaaS',f_starter_2:'Até 250 funcionários',f_starter_3:'Adicionar / editar / eliminar dados',f_starter_4:'Alertas de renovação',f_starter_5:'Importação e exportação CSV',f_starter_6:'Suporte por email',
      f_hrf_1:'Painel de Finanças completo',f_hrf_2:'Painel de RH e Pessoas',f_hrf_3:'Rastreio e mapa de acessos',f_hrf_4:'Fila de offboarding',f_hrf_5:'Controlo orçamental e calendário de renovações',f_hrf_6:'Suporte prioritário por email',
      f_pro_1:'Até 500 ferramentas SaaS',f_pro_2:'Até 1.500 funcionários',f_pro_3:'Recomendações IA e análise de contratos',f_pro_4:'Gestão de custos e suite financeira',f_pro_5:'Suite completa de segurança e auditoria',f_pro_6:'Otimização de licenças',f_pro_7:'Suporte prioritário por email',
      f_ent_1:'Ferramentas SaaS ilimitadas',f_ent_2:'Funcionários ilimitados',f_ent_3:'Tudo do plano Pro',f_ent_4:'Análises avançadas e exportações CSV',f_ent_5:'Suporte prioritário por email',f_ent_6:'API REST apenas de leitura',
    },
  };

  const ft = (key) => (featureText[language] || featureText.en)[key] || featureText.en[key] || key;

  const getPrice = (p) => {
    if (p.isTrial) return t('free_trial_label');
    if (p.isFree || p.id === 'free') return pricing.format(0);
    if (p.id === 'enterprise' && !p.monthly) return t('contact_sales');
    const v = billing === 'monthly' ? p.monthly : p.annual;
    return pricing.format(v);
  };

  const getSaving = (p) => {
    if (!p.monthly || !p.annual) return null;
    const saved = p.monthly * 12 - p.annual;
    return saved > 0 ? `Save ${pricing.format(saved)}/yr` : null;
  };

  // Holds the id of the plan whose checkout is in flight (null when idle) so
  // only the clicked card shows the spinner — a bare boolean lit up every card.
  const [upgrading, setUpgrading] = useState(null);

  const PRICE_IDS = {
    starter:    { monthly: 'price_1TMhOt1yFs6IziIVgJGBbzoG', annual: 'price_1TMhfK1yFs6IziIVOtbhpy23' },
    hr_finance: { monthly: 'price_1TWxAB1yFs6IziIVjxw3CG2V', annual: 'price_1TWxFd1yFs6IziIVjPZnA8XT' },
    pro:        { monthly: 'price_1TMhNW1yFs6IziIV5hwlssrt', annual: 'price_1TMhNW1yFs6IziIVMxiacXD7' },
    enterprise: { monthly: 'price_1TMhNk1yFs6IziIVPkv7RiLc', annual: 'price_1TMhNk1yFs6IziIViMLzewdQ' },
    growth:     { monthly: 'price_1TMhNW1yFs6IziIV5hwlssrt', annual: 'price_1TMhNW1yFs6IziIVMxiacXD7' },
    scale:      { monthly: 'price_1TMhNk1yFs6IziIVPkv7RiLc', annual: 'price_1TMhNk1yFs6IziIViMLzewdQ' },
    unlimited:  { monthly: 'price_1TMhNk1yFs6IziIVPkv7RiLc', annual: 'price_1TMhNk1yFs6IziIViMLzewdQ' },
  };

  // Explicit contract step: Upgrade opens the agreement dialog; checkout only
  // starts from proceedToCheckout() once the user has ticked "I agree".
  const [consentPlan, setConsentPlan] = useState(null);
  const [consentChecked, setConsentChecked] = useState(false);

  const upgrade = (id) => {
    if (id === 'free' || id === 'startup') return;
    if (id === 'scale') { document.getElementById('billing-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const priceId = PRICE_IDS[id]?.[billing] || PRICE_IDS[id]?.monthly;
    if (!priceId) { toast.error('Plan not available. Contact us!'); return; }
    setConsentChecked(false);
    setConsentPlan(id);
  };

  const proceedToCheckout = async () => {
    const id = consentPlan;
    if (!id) return;
    const priceId = PRICE_IDS[id]?.[billing] || PRICE_IDS[id]?.monthly;
    setConsentPlan(null);
    setUpgrading(id);
    // GDPR/LCEN audit trail: the user explicitly accepted the Terms/Privacy/DPA
    // in the dialog above (best-effort, never blocks).
    if (db?.user?.uid) logLegalAcceptance(db.user.uid, db.user.email, id);
    try {
      const { url, error } = await createCheckoutSession(priceId);
      if (error) throw new Error(error);
      if (url) window.location.href = url;
    } catch (err) {
      toast.error('Could not start checkout: ' + err.message);
    } finally {
      setUpgrading(null);
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
              <button onClick={() => upgrade('scale')} disabled={!!upgrading}
                className="px-7 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black rounded-xl transition-all shadow-lg shadow-amber-500/30 text-sm block mb-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {upgrading === 'scale' ? '...' : t('upgrade_now') + ' ✨'}
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
                {p.monthly > 0 && !p.isTrial && <span className="text-xs text-slate-500 ml-1">/{billing === 'monthly' ? 'mo' : 'yr'}</span>}
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
              ) : (
                <button onClick={() => upgrade(p.id)} disabled={!!upgrading}
                  className={"w-full py-2.5 rounded-xl font-bold transition-all text-xs text-white bg-gradient-to-r hover:opacity-90 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed " + p.color}>
                  {upgrading === p.id ? '...' : (isTrial ? t('upgrade_now').split('—')[0].trim() : 'Upgrade')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-slate-500">
        {t('bill_agree_prefix')}{' '}
        <Link to="/terms" className="text-slate-400 underline hover:text-white transition-colors">{t('bill_terms')}</Link>,{' '}
        <Link to="/privacy" className="text-slate-400 underline hover:text-white transition-colors">{t('bill_privacy')}</Link>{' '}
        {t('bill_and')}{' '}
        <Link to="/dpa" className="text-slate-400 underline hover:text-white transition-colors">{t('bill_dpa')}</Link>.
      </p>

      {consentPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setConsentPlan(null)}>
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-2">{t('consent_title')}</h3>
            <p className="text-sm text-slate-400 mb-4">{t('consent_intro')}</p>
            <div className="flex flex-col gap-1.5 mb-4 text-sm">
              <Link to="/terms" target="_blank" className="text-indigo-400 underline hover:text-indigo-300">{t('bill_terms')}</Link>
              <Link to="/privacy" target="_blank" className="text-indigo-400 underline hover:text-indigo-300">{t('bill_privacy')}</Link>
              <Link to="/dpa" target="_blank" className="text-indigo-400 underline hover:text-indigo-300">{t('bill_dpa')}</Link>
            </div>
            <label className="flex items-start gap-2.5 text-sm text-slate-300 mb-5 cursor-pointer">
              <input type="checkbox" checked={consentChecked} onChange={e => setConsentChecked(e.target.checked)} className="mt-0.5 accent-indigo-500" />
              <span>{t('consent_check')}</span>
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConsentPlan(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors">
                {t('cancel')}</button>
              <button onClick={proceedToCheckout} disabled={!consentChecked}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                {t('consent_continue')}</button>
            </div>
          </div>
        </div>
      )}

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

    </div>
  );

  if (noShell) return Body;
  return <AppShell title={t('billing_title')} right={HeaderRight}>{Body}</AppShell>;
}
