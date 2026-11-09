import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Hand, XCircle, Plug, FileUp, ShieldCheck, ArrowRight } from 'lucide-react';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { PublicNav } from '../components/PublicNav';
import { SOURCE_FACTS, SOURCE_IDS, sourceLabelKey } from '../lib/dataSources';

// ── /fonctionnalites: what works today ─────────────────────────────────────
//
// For a prospect (an IT director, a finance lead) who wants to know, before a
// call, what Stacklens does by itself, what it leaves to them, and what it
// does not do. Three rules hold the page to the code (capabilities.test.js):
//   - the connector table is SOURCE_FACTS itself (lib/dataSources.js), the
//     list the Integrations tab and the freshness panel read, so a connector
//     cannot be listed here and not exist, or write here and not there;
//   - every "works today" row names the module and function that does it,
//     and the test checks they exist;
//   - "not available" reuses the security page's own lines (sec_large_not_*),
//     so the two pages cannot say different things.

// Explicit lists, so the translation-key scanner sees every key rendered.
const CAPABILITIES = [
  { key: 'cap_inventory', proof: ['src/lib/dataSources.js', 'recordSourceRun'] },
  { key: 'cap_reviews', proof: ['src/lib/accessReviews.js', 'signOff'] },
  { key: 'cap_removals', proof: ['src/lib/removals.js', 'verifyRemoval'] },
  { key: 'cap_leavers', proof: ['src/lib/assets.js', 'devicesToReturn'] },
  { key: 'cap_renewals', proof: ['src/lib/renewalNotice.js', 'noticeTimeline'] },
  { key: 'cap_savings', proof: ['src/lib/savings.js', 'billingCheck'] },
  { key: 'cap_invoices', proof: ['src/lib/invoiceCheck.js', 'checkInvoices'] },
  { key: 'cap_trail', proof: ['functions/audit-chain.js', 'verifyChain'] },
  { key: 'cap_signin', proof: ['functions/sso-policy.js', 'ssoRefusal'] },
];
const ROW_KEYS = {
  cap_inventory: ['cap_inventory_title', 'cap_inventory_does', 'cap_inventory_you'],
  cap_reviews: ['cap_reviews_title', 'cap_reviews_does', 'cap_reviews_you'],
  cap_removals: ['cap_removals_title', 'cap_removals_does', 'cap_removals_you'],
  cap_leavers: ['cap_leavers_title', 'cap_leavers_does', 'cap_leavers_you'],
  cap_renewals: ['cap_renewals_title', 'cap_renewals_does', 'cap_renewals_you'],
  cap_savings: ['cap_savings_title', 'cap_savings_does', 'cap_savings_you'],
  cap_invoices: ['cap_invoices_title', 'cap_invoices_does', 'cap_invoices_you'],
  cap_trail: ['cap_trail_title', 'cap_trail_does', 'cap_trail_you'],
  cap_signin: ['cap_signin_title', 'cap_signin_does', 'cap_signin_you'],
};
const NOT_AVAILABLE = ['cap_not_removal', 'sec_large_not_1', 'sec_large_not_2', 'sec_large_not_3', 'sec_large_not_4', 'sec_large_not_5'];
const AUTH_KEY = { oauth: 'cap_auth_oauth', token: 'cap_auth_token', file: 'cap_auth_file', server: 'cap_auth_server' };
const AREA_KEY = { people: 'ds_area_people', tools: 'ds_area_tools', access: 'ds_area_access', devices: 'ds_area_devices', usage: 'ds_area_usage', invoices: 'ds_area_invoices' };
const TRUST = [
  { to: '/security-info', key: 'cap_trust_security' },
  { to: '/dpa', key: 'cap_trust_dpa' },
  { to: '/sub-processors', key: 'cap_trust_subproc' },
  { to: '/privacy', key: 'cap_trust_privacy' },
];

function SourceTable({ ids, t }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-4 py-3">{t('cap_col_source')}</th>
            <th className="px-4 py-3">{t('cap_col_reads')}</th>
            <th className="px-4 py-3">{t('cap_col_how')}</th>
            <th className="px-4 py-3">{t('cap_col_writes')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {ids.map((id) => {
            const f = SOURCE_FACTS[id];
            return (
              <tr key={id} data-testid={`cap-source-${id}`}>
                <td className="px-4 py-3 font-semibold text-white">{t(sourceLabelKey(id))}</td>
                <td className="px-4 py-3 text-slate-300">{f.feeds.map((a) => t(AREA_KEY[a])).join(', ')}</td>
                <td className="px-4 py-3 text-slate-400">{t(id === 'invoice:bank' ? 'cap_auth_bank' : AUTH_KEY[f.auth])}</td>
                <td className={'px-4 py-3 ' + (f.writes ? 'text-amber-300' : 'text-slate-400')}>
                  {f.writes ? t('cap_writes_block_signin') : t('cap_writes_none')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CapabilitiesPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const connectors = SOURCE_IDS.filter((id) => SOURCE_FACTS[id].connector);
  const files = SOURCE_IDS.filter((id) => !SOURCE_FACTS[id].connector);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PublicNav t={t} />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{t('cap_eyebrow')}</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">{t('cap_title')}</h1>
          <p className="mt-4 text-lg text-slate-400">{t('cap_intro')}</p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 text-emerald-300"><CheckCircle2 className="h-4 w-4" aria-hidden />{t('cap_legend_does')}</span>
            <span className="inline-flex items-center gap-1.5 text-amber-300"><Hand className="h-4 w-4" aria-hidden />{t('cap_legend_you')}</span>
            <span className="inline-flex items-center gap-1.5 text-slate-400"><XCircle className="h-4 w-4" aria-hidden />{t('cap_legend_not')}</span>
          </div>
        </header>

        <section className="mt-12" aria-labelledby="cap-today">
          <h2 id="cap-today" className="text-xl font-bold">{t('cap_today_title')}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {CAPABILITIES.map(({ key }) => {
              const [title, does, you] = ROW_KEYS[key];
              return (
                <article key={key} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5" data-testid={`cap-${key}`}>
                  <h3 className="font-semibold text-white">{t(title)}</h3>
                  <p className="mt-3 flex gap-2 text-sm text-slate-300"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" aria-label={t('cap_legend_does')} />{t(does)}</p>
                  <p className="mt-2 flex gap-2 text-sm text-slate-400"><Hand className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" aria-label={t('cap_legend_you')} />{t(you)}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-14" aria-labelledby="cap-connectors">
          <h2 id="cap-connectors" className="flex items-center gap-2 text-xl font-bold"><Plug className="h-5 w-5 text-blue-400" aria-hidden />{t('cap_connectors_title')}</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">{t('cap_connectors_intro')}</p>
          <div className="mt-4"><SourceTable ids={connectors} t={t} /></div>
          <h3 className="mt-8 flex items-center gap-2 text-lg font-semibold"><FileUp className="h-5 w-5 text-slate-400" aria-hidden />{t('cap_files_title')}</h3>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">{t('cap_files_intro')}</p>
          <div className="mt-4"><SourceTable ids={files} t={t} /></div>
        </section>

        <section className="mt-14 rounded-2xl border border-slate-800 bg-slate-900/40 p-6" aria-labelledby="cap-not">
          <h2 id="cap-not" className="flex items-center gap-2 text-xl font-bold"><XCircle className="h-5 w-5 text-slate-400" aria-hidden />{t('cap_not_title')}</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            {NOT_AVAILABLE.map((k) => <li key={k} className="flex gap-2"><span aria-hidden className="text-slate-500">—</span>{t(k)}</li>)}
          </ul>
        </section>

        <section className="mt-14" aria-labelledby="cap-trust">
          <h2 id="cap-trust" className="flex items-center gap-2 text-xl font-bold"><ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden />{t('cap_trust_title')}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map(({ to, key }) => (
              <Link key={to} to={to} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm font-semibold text-white hover:border-slate-700">
                {t(key)} <ArrowRight className="inline h-4 w-4" aria-hidden />
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-14 flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
          <p className="min-w-0 flex-[1_1_320px] text-slate-300">{t('cap_cta_body')}</p>
          <Link to="/?demo=true" className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">{t('cap_cta_demo')}</Link>
          <Link to="/audit-saas" className="text-sm font-semibold text-emerald-300 hover:underline">{t('cap_cta_audit')}</Link>
        </section>
      </main>
    </div>
  );
}
