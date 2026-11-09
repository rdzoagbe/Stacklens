import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, WifiOff, Database, FileDown, User, Printer } from 'lucide-react';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { PublicNav } from '../components/PublicNav';
import { LEGAL_ENTITY, EXIT_NOTICE_DAYS } from '../lib/constants';

// ── /note-donnees: how client data is handled, on one page ─────────────────
//
// Accountants told us (a simulated panel, then to be confirmed in real calls)
// that they will not put a client's bank statement into a tool they cannot
// vouch for. This page is what they hand the client: what the free audit does
// with the file (nothing leaves the computer, and how to check it with the
// internet switched off), what a paid workspace stores and where, the exit
// rules, and who runs Stacklens. Every sentence is held to the code or to the
// legal documents by data-note.test.js; it prints on white for a PDF.

function Section({ icon: Icon, title, children }) {
  return (
    <section className="mt-8 break-inside-avoid print:mt-3">
      <h2 className="flex items-center gap-2 text-lg font-bold text-white print:text-[12pt]"><Icon className="h-5 w-5 text-emerald-400 print:hidden" aria-hidden />{title}</h2>
      <div className="mt-2 space-y-2 text-slate-300 leading-relaxed print:mt-1 print:space-y-1 print:text-[10.5pt] print:leading-snug">{children}</div>
    </section>
  );
}

export function DataNotePage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const who = t('dn_who_body')
    .replace('{publisher}', LEGAL_ENTITY.publisher).replace('{siret}', LEGAL_ENTITY.siret)
    .replace('{city}', LEGAL_ENTITY.city).replace('{email}', LEGAL_ENTITY.email);
  const link = 'text-blue-400 hover:text-blue-300 underline';

  return (
    <div className="min-h-screen bg-slate-950 text-white print:bg-white print:[&_*]:!text-black">
      <div className="print:hidden"><PublicNav t={t} /></div>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 print:py-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{t('dn_eyebrow')}</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl print:text-[20pt]">{t('dn_title')}</h1>
        <p className="mt-4 text-lg text-slate-400 print:mt-1 print:text-[10.5pt]">{t('dn_intro')}</p>
        <button type="button" onClick={() => window.print()} data-testid="dn-print"
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-line-control px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 print:hidden">
          <Printer className="h-4 w-4" aria-hidden /> {t('dn_print')}
        </button>

        <Section icon={ShieldCheck} title={t('dn_audit_title')}>
          <p>{t('dn_audit_body')}</p>
        </Section>

        <Section icon={WifiOff} title={t('dn_check_title')}>
          <ol className="list-decimal space-y-1 pl-5" data-testid="dn-check">
            <li>{t('dn_check_1')}</li>
            <li>{t('dn_check_2')}</li>
            <li>{t('dn_check_3')}</li>
            <li>{t('dn_check_4')}</li>
          </ol>
        </Section>

        <Section icon={Database} title={t('dn_ws_title')}>
          <p>{t('dn_ws_body')}</p>
          <p className="text-sm">
            <Link to="/sub-processors" className={link}>{t('dn_link_subproc')}</Link>{' · '}
            <Link to="/dpa" className={link}>{t('dn_link_dpa')}</Link>{' · '}
            <Link to="/privacy" className={link}>{t('dn_link_privacy')}</Link>
          </p>
        </Section>

        <Section icon={FileDown} title={t('dn_exit_title')}>
          <p data-testid="dn-exit">{t('dn_exit_body').replace('{days}', EXIT_NOTICE_DAYS)}</p>
        </Section>

        <Section icon={User} title={t('dn_who_title')}>
          <p data-testid="dn-who">{who}</p>
          <p className="text-sm text-slate-400">{t('dn_who_small')} <Link to="/legal" className={link}>{t('dn_link_legal')}</Link></p>
        </Section>

        <p className="mt-10 border-t border-slate-800 pt-4 text-xs text-slate-500 print:mt-4 print:pt-2">{t('dn_footer')} stacklens.fr/note-donnees</p>
      </main>
    </div>
  );
}
