import React from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Users, FileCheck, Upload, Search, Send, ShieldCheck, ArrowRight, Globe2, Lock } from 'lucide-react';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { PublicNav } from '../components/PublicNav';
import { track } from '../lib/analytics';

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

export function AccountantsPage() {
  const { language } = useLang();
  const t = useTranslation(language);

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
