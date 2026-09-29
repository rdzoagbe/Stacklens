import React from 'react';
import { Link } from 'react-router-dom';
import {
  Landmark, PieChart, FileSpreadsheet, FileWarning, TrendingUp, UserCheck, ListChecks,
  Upload, SlidersHorizontal, Eye, ShieldCheck, Lock, Globe2, ArrowRight,
} from 'lucide-react';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { PublicNav } from '../components/PublicNav';
import { track } from '../lib/analytics';

// ── /direction-financiere ──────────────────────────────────────────────────
//
// For the person who signs off the spend: the DAF, the cost controller, the
// "responsable financier" whose job description reads "élaboration des
// budgets du service, rapport mensuel des dépenses et du prévisionnel à la
// direction, contrôler la facturation fournisseur, garant du respect des
// budgets". Each row below takes one of those lines and names the screen in
// Stacklens that does it — today, not on a roadmap. finance-channel.test.js
// ties every row to the code that makes it true; if a row stops being true,
// change the row.

// Explicit lists, so the translation-key scanner sees every key rendered.
const DUTIES = [
  { icon: PieChart, duty: 'fin_d1_duty', how: 'fin_d1_how', where: 'fin_d1_where' },
  { icon: FileSpreadsheet, duty: 'fin_d2_duty', how: 'fin_d2_how', where: 'fin_d2_where' },
  { icon: FileWarning, duty: 'fin_d3_duty', how: 'fin_d3_how', where: 'fin_d3_where' },
  { icon: TrendingUp, duty: 'fin_d4_duty', how: 'fin_d4_how', where: 'fin_d4_where' },
  { icon: UserCheck, duty: 'fin_d5_duty', how: 'fin_d5_how', where: 'fin_d5_where' },
  { icon: ListChecks, duty: 'fin_d6_duty', how: 'fin_d6_how', where: 'fin_d6_where' },
];
const FAQ = [['fin_q1', 'fin_a1'], ['fin_q2', 'fin_a2'], ['fin_q3', 'fin_a3']];

// Module scope (react-hooks/static-components).
function Step({ n, icon: Icon, title, body }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-emerald-300">{n}</div>
      <div>
        <div className="flex items-center gap-2 font-semibold mb-1"><Icon className="w-4 h-4 text-emerald-400" /> {title}</div>
        <p className="text-sm text-slate-400 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

export function FinanceLeadsPage() {
  const { language } = useLang();
  const t = useTranslation(language);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <PublicNav t={t} right={<Link to="/audit-saas" className="hidden sm:inline text-slate-300 hover:text-white transition-colors">{t('fin_nav_audit')}</Link>} />

      <div className="max-w-5xl mx-auto px-6 py-20">
        {/* Hero */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 mb-6">
            <Landmark className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{t('fin_badge')}</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            {t('fin_title_1')} <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">{t('fin_title_2')}</span>
          </h1>
          <p className="text-xl text-slate-400 leading-relaxed mb-8">{t('fin_sub')}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/?signup=true" onClick={() => track('cta_click', { location: 'finance_hero', target: 'signup' })}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold transition-colors">
              {t('fin_cta_primary')} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/audit-saas" onClick={() => track('cta_click', { location: 'finance_hero', target: 'audit' })}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-slate-200 transition-colors">
              {t('fin_cta_secondary')}
            </Link>
          </div>
        </div>

        {/* Your job description, and where Stacklens does each line */}
        <section className="mb-20">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">{t('fin_duties_title')}</h2>
          <p className="text-slate-400 mb-8 max-w-3xl">{t('fin_duties_sub')}</p>
          <div className="grid md:grid-cols-2 gap-4" data-testid="fin-duties">
            {DUTIES.map(({ icon: Icon, duty, how, where }) => (
              <div key={duty} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="text-sm italic text-slate-400 pt-2">« {t(duty)} »</div>
                </div>
                <p className="text-slate-200 leading-relaxed">{t(how)}</p>
                <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-emerald-400/80">{t(where)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* How */}
        <section className="mb-20">
          <h2 className="text-2xl md:text-3xl font-bold mb-8">{t('fin_how_title')}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Step n="1" icon={Upload} title={t('fin_s1_title')} body={t('fin_s1_body')} />
            <Step n="2" icon={SlidersHorizontal} title={t('fin_s2_title')} body={t('fin_s2_body')} />
            <Step n="3" icon={Eye} title={t('fin_s3_title')} body={t('fin_s3_body')} />
          </div>
        </section>

        {/* Trust */}
        <section className="mb-20 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 md:p-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-400" /> {t('fin_trust_title')}</h2>
          <ul className="grid md:grid-cols-3 gap-4 text-sm text-slate-300">
            <li className="flex gap-2"><Globe2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> {t('fin_trust_1')}</li>
            <li className="flex gap-2"><Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> {t('fin_trust_2')}</li>
            <li className="flex gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> {t('fin_trust_3')}</li>
          </ul>
        </section>

        {/* FAQ */}
        <section className="mb-20">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">{t('fin_faq_title')}</h2>
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
        <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-8 md:p-10 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">{t('fin_final_title')}</h2>
          <p className="text-slate-300 mb-6 max-w-xl mx-auto">{t('fin_final_body')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/?signup=true" onClick={() => track('cta_click', { location: 'finance_final', target: 'signup' })}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold transition-colors">
              {t('fin_cta_primary')} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/experts-comptables" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-slate-200 transition-colors">
              {t('fin_cta_accountants')}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
