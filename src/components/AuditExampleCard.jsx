import React from 'react';
import { AlertTriangle, Clock, CircleCheck } from 'lucide-react';
import { formatMoney } from '../lib/currency';

// ── What the free audit returns, shown beside the landing headline ─────────
//
// An example, and it says so twice (the badge and the subtitle): the figures
// are made up for the illustration, not a customer's and not a promise. The
// findings are the audit's real kinds — a charge billed twice, a price rise, a
// renewal about to land — so the card shows what the button next to it does.

const ROWS = [
  { vendor: 'Slack', amount: 312, kind: 'dup' },
  { vendor: 'HubSpot', amount: 690, kind: 'rise' },
  { vendor: 'Dropbox', amount: 120, kind: 'renew', days: 4 },
  { vendor: 'Google Workspace', amount: 828, kind: 'ok' },
];
export const EXAMPLE_TOTAL = 4839;
export const EXAMPLE_COUNT = 17;

const FINDING = {
  dup: { tone: 'bg-danger-soft text-danger', Icon: AlertTriangle, key: 'lp_ex_dup' },
  rise: { tone: 'bg-warning-soft text-warning', Icon: Clock, key: 'lp_ex_rise' },
  renew: { tone: 'bg-warning-soft text-warning', Icon: Clock, key: 'lp_ex_renew' },
  ok: { tone: 'bg-success-soft text-success', Icon: CircleCheck, key: 'lp_ex_ok' },
};

export function AuditExampleCard({ t, language }) {
  const money = (n) => formatMoney(n, language);
  return (
    <section aria-label={t('lp_ex_title')} className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800">
        <div>
          <p className="text-base font-semibold text-white">{t('lp_ex_title')}</p>
          <p className="mt-0.5 text-xs text-slate-500">{t('lp_ex_sub')}</p>
        </div>
        <span className="shrink-0 rounded-full bg-brand-soft text-brand-text px-2.5 py-0.5 text-xs font-medium">{t('lp_ex_badge')}</span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-slate-800">
        <div className="bg-slate-900 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('lp_ex_subs_label')}</p>
          <p className="mt-2 text-3xl font-extrabold text-white tabular-nums">{money(EXAMPLE_TOTAL)}</p>
          <p className="mt-1 text-sm text-slate-400">{t('lp_ex_subs_note').replace('{n}', EXAMPLE_COUNT)}</p>
        </div>
        <div className="bg-slate-900 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('lp_ex_check_label')}</p>
          <p className="mt-2 text-3xl font-extrabold text-white tabular-nums">3</p>
          <p className="mt-1 text-sm text-slate-400">{t('lp_ex_check_note')}</p>
        </div>
      </div>
      <table className="w-full text-sm border-t border-slate-800">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
            <th scope="col" className="px-5 py-3 font-semibold">{t('lp_ex_col_vendor')}</th>
            <th scope="col" className="px-2 py-3 font-semibold">{t('lp_ex_col_finding')}</th>
            <th scope="col" className="px-5 py-3 font-semibold text-right">{t('lp_ex_col_month')}</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => {
            const f = FINDING[r.kind];
            return (
              <tr key={r.vendor} className="border-t border-slate-800">
                <td className="px-5 py-3 font-medium text-white">{r.vendor}</td>
                <td className="px-2 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${f.tone}`}>
                    <f.Icon className="h-3 w-3" aria-hidden="true" />
                    {t(f.key).replace('{n}', r.days ?? '')}
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-slate-400 tabular-nums">{money(r.amount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
