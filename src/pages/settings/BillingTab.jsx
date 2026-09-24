import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, CreditCard } from 'lucide-react';
import {
  createBillingPortal, createCheckoutSession, logLegalAcceptance,
} from '../../firebase-config';
import { resolvePlan, TRIAL_DAYS, getTrialState, getPlanLimits } from '../../lib/plan';
import { track } from '../../lib/analytics';
import { useDbQuery } from '../../hooks/useDbQuery';
import { useLang } from '../../contexts/LangContext';
import { useTranslation } from '../../translations';
import { usePlanPricing } from '../../contexts/CurrencyContext';
import { Pill } from '../../components/ui';
import { PLAN_CARDS, planFeatures, planText } from '../../lib/planCards';
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
  // Only a running trial. This used to include every free account whose trial
  // had not expired, so someone who never started one saw a trial countdown.
  const isTrial = plan === 'trial';

  // Words, prices and every number on the cards come from src/lib/planCards.js,
  // shared with the landing page; only the look is decided here.
  const LOOK = {
    free:       { icon: '🎁', color: 'from-slate-600 to-slate-700', border: 'border-slate-600/40', isFree: true },
    starter:    { icon: '🌱', color: 'from-blue-500 to-blue-700', border: 'border-blue-500/40' },
    hr_finance: { icon: '👥', color: 'from-teal-500 to-emerald-700', border: 'border-teal-500/40', badge: 'NEW' },
    pro:        { icon: '🚀', color: 'from-emerald-600 to-teal-700', border: 'border-emerald-500/50', popular: true },
    enterprise: { icon: '⚡', color: 'from-violet-600 to-purple-700', border: 'border-violet-500/40' },
  };
  const plans = PLAN_CARDS.map((c) => ({
    ...c, ...LOOK[c.id],
    tName: 'plan_' + c.id, tTag: 'plan_' + c.id + '_tag',
    lines: planFeatures(c.id, language),
    limits: getPlanLimits(c.id),
  }));

  const ft = (key) => planText(language, key);

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

  const showPlans = () => document.getElementById('billing-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const upgrade = (id) => {
    if (id === 'free' || id === 'startup') return;
    const priceId = PRICE_IDS[id]?.[billing] || PRICE_IDS[id]?.monthly;
    if (!priceId) { toast.error(t('bill_plan_unavailable')); return; }
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
    track('checkout_started', { plan: id, billing });
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
          {t('bill_manage_sub')}
        </button>
      )}
      <Pill tone="blue" icon={CreditCard}>
        {isTrial ? 'Trial' : getPlanLimits(plan).label}
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
                    <span className="text-sm font-bold text-amber-400">{t('trial_day_of').replace('{n}', trialDaysUsed).replace('{total}', TRIAL_DAYS)}</span>
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
              <button onClick={showPlans} disabled={!!upgrading}
                className="px-7 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black rounded-xl transition-all shadow-lg shadow-amber-500/30 text-sm block mb-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {t('upgrade_now') + ' ✨'}
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
                {p.lines.map(line => (
                  <div key={line} className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-300">{line}</span>
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
              { day: t('after_trial_d1_day').replace('{n}', TRIAL_DAYS), title: t('after_trial_d1_title'), desc: t('after_trial_d1_desc'), color: 'text-amber-400' },
              { day: t('never'), title: t('after_trial_d2_title'), desc: t('after_trial_d2_desc'), color: 'text-slate-400' },
              { day: t('after_trial_d3_day'), title: planText(language, 'plan_pro'), desc: t('after_trial_d3_desc'), color: 'text-emerald-400' },
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
