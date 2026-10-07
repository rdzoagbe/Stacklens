import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Briefcase, Users, FileCheck, Upload, Search, Send, ShieldCheck, ArrowRight, Globe2, Lock, Sparkles, Check, CheckCircle2 } from 'lucide-react';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { PublicNav } from '../components/PublicNav';
import { track } from '../lib/analytics';
import { submitContactForm, mailtoFallback } from '../lib/contact';
import { EARLY_ACCESS } from '../lib/earlyAccess';
import { Testimonials } from '../components/Testimonials';
import { CLIENT_WORKSPACE_LIMIT } from '../lib/plan';

// ── /experts-comptables ─────────────────────────────────────────────────────
//
// The homepage sells to the one overwhelmed ops person inside an SMB. This
// page sells to the person who already holds that SMB's invoices and bank
// feed for twenty to fifty companies at once: the accountant, the bookkeeper,
// the fractional CFO. Same product, different buyer, different leverage — one
// conversation here is fifty there.
//
// Everything it claims is something the product does today. "Up to fifty
// client workspaces" is the cap on paid plans in ClientsPage; the free audit
// is /audit-saas and runs in the browser; the integrations named are the ones
// in functions/index.js. If a claim here stops being true, change this page,
// not the product's description of itself.

// Module-scope on purpose (react-hooks/static-components).
function Card({ icon: Icon, title, body }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-blue-400" />
      </div>
      <div className="font-semibold text-lg mb-2">{title}</div>
      <p className="text-sm text-slate-400 leading-relaxed">{body}</p>
    </div>
  );
}

function Step({ n, icon: Icon, title, body }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-blue-300">{n}</div>
      <div>
        <div className="flex items-center gap-2 font-semibold mb-1"><Icon className="w-4 h-4 text-blue-400" /> {title}</div>
        <p className="text-sm text-slate-400 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

// Explicit, so the translation-key scanner sees every key it renders.
const FAQ = [['acct_q1', 'acct_a1'], ['acct_q2', 'acct_a2'], ['acct_q3', 'acct_a3']];

// Every number in the offer comes from EARLY_ACCESS and the plan limits, so
// the page cannot promise more than the founder's grant button gives.
const ea = (s) => String(s || '')
  .replaceAll('{n}', EARLY_ACCESS.SPOTS).replaceAll('{months}', EARLY_ACCESS.MONTHS)
  .replaceAll('{calls}', EARLY_ACCESS.CALLS).replaceAll('{minutes}', EARLY_ACCESS.CALL_MINUTES)
  .replaceAll('{clients}', CLIENT_WORKSPACE_LIMIT);

// Module scope: a component created inside another's render remounts every render.
function Item({ children }) {
  return <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /><span>{children}</span></li>;
}

// ── Early access ────────────────────────────────────────────────────────────
//
// The application goes to the founder's inbox through the same contact form
// the /contact page uses (Web3Forms, listed on /sub-processors), and falls
// back to the visitor's own mail app if that fails. Nothing is stored here.
function EarlyAccess({ t }) {
  const [form, setForm] = useState({ name: '', email: '', firm: '', clients: '', role: '', message: '', consent: false });
  const [state, setState] = useState('idle'); // idle | sending | done
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const emailOk = /\S+@\S+\.\S+/.test(form.email);
  // What stands between the reader and the button, in words. A disabled button
  // that says nothing looks broken; this appears once they have started.
  const missing = [
    !form.name.trim() && t('ea_form_name'),
    !emailOk && (form.email ? t('ea_need_email') : t('ea_form_email')),
    !form.firm.trim() && t('ea_form_firm'),
    !form.clients && t('ea_form_clients'),
    !form.role && t('ea_form_role'),
    !form.consent && t('ea_need_consent'),
  ].filter(Boolean);
  const ready = missing.length === 0;
  const started = !!(form.name || form.email || form.firm || form.clients || form.role || form.consent);

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setState('sending');
    const payload = {
      name: form.name.trim(), email: form.email.trim(), subject: 'early-access',
      message: [
        `Programme: early access (${EARLY_ACCESS.PLAN}, ${EARLY_ACCESS.MONTHS} months)`,
        `Firm: ${form.firm.trim()}`, `Client files: ${form.clients}`, `Role: ${form.role}`,
        '', form.message.trim() || '(no message)',
      ].join('\n'),
    };
    // A bucket and a role label only: never the name, email or firm.
    track('early_access_applied', { clients: form.clients, role: form.role });
    try {
      await submitContactForm(payload);
      setState('done');
    } catch {
      mailtoFallback(payload);
      setState('idle');
    }
  };

  const field = 'mt-1 w-full h-11 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40';
  const label = 'block text-xs font-medium text-slate-400';

  return (
    <section id="acces-anticipe" className="mb-20 scroll-mt-24 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-900/60 to-slate-900/60 p-6 md:p-10">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 mb-5">
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">{t('ea_badge')}</span>
      </div>
      <h2 className="text-2xl md:text-3xl font-bold mb-3">{ea(t('ea_title'))}</h2>
      <p className="text-slate-300 leading-relaxed max-w-3xl mb-8">{ea(t('ea_sub'))}</p>

      <div className="grid md:grid-cols-3 gap-6 mb-10 text-sm text-slate-300">
        <div>
          <h3 className="font-semibold text-white mb-3">{t('ea_get_title')}</h3>
          <ul className="space-y-2"><Item>{ea(t('ea_get_1'))}</Item><Item>{ea(t('ea_get_2'))}</Item></ul>
        </div>
        <div>
          <h3 className="font-semibold text-white mb-3">{t('ea_give_title')}</h3>
          <ul className="space-y-2"><Item>{ea(t('ea_give_1'))}</Item><Item>{ea(t('ea_give_2'))}</Item></ul>
        </div>
        <div>
          <h3 className="font-semibold text-white mb-3">{t('ea_terms_title')}</h3>
          <ul className="space-y-2"><Item>{ea(t('ea_terms_1'))}</Item><Item>{ea(t('ea_terms_2'))}</Item><Item>{ea(t('ea_terms_3'))}</Item></ul>
        </div>
      </div>

      {!EARLY_ACCESS.OPEN ? (
        <p className="rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-4 text-slate-300">{ea(t('ea_full'))}</p>
      ) : state === 'done' ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 flex gap-3" role="status">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-emerald-200">{t('ea_done_title')}</div>
            <p className="text-sm text-emerald-200/80 mt-1">{t('ea_done_body')}</p>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 md:p-6">
          <h3 className="font-semibold text-lg mb-4">{t('ea_form_title')}</h3>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <label className={label}>{t('ea_form_name')}<input value={form.name} onChange={set('name')} autoComplete="name" className={field} /></label>
            <label className={label}>{t('ea_form_email')}<input type="email" value={form.email} onChange={set('email')} autoComplete="email" className={field} /></label>
            <label className={label}>{t('ea_form_firm')}<input value={form.firm} onChange={set('firm')} autoComplete="organization" className={field} /></label>
            <label className={label}>{t('ea_form_clients')}
              <select value={form.clients} onChange={set('clients')} className={field}>
                <option value="">—</option>
                <option value="<20">{t('ea_form_clients_1')}</option>
                {/* The buckets end at the plan's cap: a firm told nothing
                    about it when ticking "more than 100" would find out after. */}
                <option value={`20-${CLIENT_WORKSPACE_LIMIT}`}>{t('ea_form_clients_2').replace('{limit}', CLIENT_WORKSPACE_LIMIT)}</option>
                <option value={`>${CLIENT_WORKSPACE_LIMIT}`}>{t('ea_form_clients_3').replace('{limit}', CLIENT_WORKSPACE_LIMIT)}</option>
              </select>
              {form.clients === `>${CLIENT_WORKSPACE_LIMIT}` && (
                <span className="mt-1 block text-xs text-amber-300" data-testid="ea-over-cap">{t('ea_form_clients_over').replace('{limit}', CLIENT_WORKSPACE_LIMIT)}</span>
              )}
            </label>
            <label className={label + ' sm:col-span-2'}>{t('ea_form_role')}
              <select value={form.role} onChange={set('role')} className={field}>
                <option value="">—</option>
                <option value="expert_comptable">{t('ea_role_1')}</option>
                <option value="collaborateur">{t('ea_role_2')}</option>
                <option value="daf_externalise">{t('ea_role_3')}</option>
                <option value="other">{t('ea_role_4')}</option>
              </select>
            </label>
            <label className={label + ' sm:col-span-2'}>{t('ea_form_message')}
              <textarea value={form.message} onChange={set('message')} rows={3}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </label>
          </div>
          <label className="flex items-start gap-2.5 text-sm text-slate-300 mb-3 cursor-pointer">
            <input type="checkbox" checked={form.consent} onChange={set('consent')} className="mt-1 accent-blue-500" />
            <span>{t('ea_form_consent')}</span>
          </label>
          <p className="text-xs text-slate-500 mb-5">
            {t('ea_form_privacy')} <Link to="/privacy" className="underline hover:text-slate-300">{t('ea_form_privacy_link')}</Link>
          </p>
          {!ready && started && (
            <p className="text-xs text-amber-300 mb-3" data-testid="ea-missing">
              {t('ea_missing').replace('{fields}', missing.map((m) => String(m).toLowerCase()).join(', '))}
            </p>
          )}
          <button type="submit" disabled={!ready || state === 'sending'}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600">
            {state === 'sending' ? t('ea_form_sending') : t('ea_form_submit')} <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}
    </section>
  );
}

export function AccountantsPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  // Links from the homepage and the free audit land on the offer itself. The
  // router scrolls to the top on navigation, so the hash is honoured here.
  const { hash } = useLocation();
  useEffect(() => {
    if (!['#acces-anticipe'].includes(hash)) return;
    const id = setTimeout(() => document.getElementById('acces-anticipe')?.scrollIntoView({ behavior: 'smooth' }), 50);
    return () => clearTimeout(id);
  }, [hash]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <PublicNav t={t} right={<Link to="/audit-saas" className="hidden sm:inline text-slate-300 hover:text-white transition-colors">{t('acct_nav_audit')}</Link>} />

      <div className="max-w-5xl mx-auto px-6 py-20">
        {/* Hero */}
        <div className="max-w-3xl mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 mb-6">
            <Briefcase className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">{t('acct_badge')}</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            {t('acct_title_1')} <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">{t('acct_title_2')}</span>
          </h1>
          <p className="text-xl text-slate-400 leading-relaxed mb-8">{t('acct_sub')}</p>
          {EARLY_ACCESS.OPEN && (
            <a href="#acces-anticipe" onClick={() => track('cta_click', { location: 'accountants_hero', target: 'early_access' })}
              className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-sm text-amber-200 hover:bg-amber-500/20 transition-colors">
              <Sparkles className="w-4 h-4 text-amber-400" /> {ea(t('ea_hero_link'))}
            </a>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/audit-saas" onClick={() => track('cta_click', { location: 'accountants_hero', target: 'audit' })}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold transition-colors">
              {t('acct_cta_primary')} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/?signup=true" onClick={() => track('cta_click', { location: 'accountants_hero', target: 'signup' })}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-slate-200 transition-colors">
              {t('acct_cta_secondary')}
            </Link>
          </div>
        </div>

        {/* Why */}
        <section className="mb-20">
          <h2 className="text-2xl md:text-3xl font-bold mb-8">{t('acct_why_title')}</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Card icon={FileCheck} title={t('acct_b1_title')} body={t('acct_b1_body')} />
            <Card icon={Users} title={t('acct_b2_title')} body={t('acct_b2_body')} />
            <Card icon={Briefcase} title={t('acct_b3_title')} body={t('acct_b3_body')} />
          </div>
        </section>

        {/* How */}
        <section className="mb-20">
          <h2 className="text-2xl md:text-3xl font-bold mb-8">{t('acct_how_title')}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Step n="1" icon={Upload} title={t('acct_s1_title')} body={t('acct_s1_body')} />
            <Step n="2" icon={Search} title={t('acct_s2_title')} body={t('acct_s2_body')} />
            <Step n="3" icon={Send} title={t('acct_s3_title')} body={t('acct_s3_body')} />
          </div>
        </section>

        {/* Trust */}
        <section className="mb-20 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 md:p-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-400" /> {t('acct_trust_title')}</h2>
          <ul className="grid md:grid-cols-3 gap-4 text-sm text-slate-300">
            <li className="flex gap-2"><Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> {t('acct_trust_1')}</li>
            <li className="flex gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> {t('acct_trust_2')}</li>
            <li className="flex gap-2"><Globe2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> {t('acct_trust_3')}</li>
          </ul>
        </section>

        {/* FAQ */}
        <section className="mb-20">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">{t('acct_faq_title')}</h2>
          <div className="space-y-4">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                <summary className="cursor-pointer font-semibold list-none flex justify-between items-center">
                  {t(q)}
                  <span className="text-slate-500 group-open:rotate-90 transition-transform">›</span>
                </summary>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">{t(a)}</p>
              </details>
            ))}
          </div>
        </section>

        <Testimonials t={t} language={language} />

        <EarlyAccess t={t} />

        {/* Final */}
        <section className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 p-8 md:p-10 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">{t('acct_final_title')}</h2>
          <p className="text-slate-300 mb-6 max-w-xl mx-auto">{t('acct_final_body')}</p>
          <Link to="/audit-saas" onClick={() => track('cta_click', { location: 'accountants_final', target: 'audit' })}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold transition-colors">
            {t('acct_cta_primary')} <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </div>
    </div>
  );
}
