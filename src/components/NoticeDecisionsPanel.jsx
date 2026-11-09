// ── Decisions before the last day to cancel ────────────────────────────────
//
// Finance → Renewals. A contract with a notice period has to be cancelled
// before its renewal date; this lists, per contract, the day to decide by
// (the last day to cancel minus the time purchasing needs) and lets an editor
// record what was decided for this renewal. Recording changes nothing at the
// vendor, and the panel says so. Dates come from lib/renewalNotice.js, the
// same rule the daily email uses (renewal-notice-parity.test.js).

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Lock, Check, Undo2 } from 'lucide-react';
import { noticeRows, RENEWAL_DECISIONS, DECISION_LABEL_KEY } from '../lib/renewalNotice';
import { formatMoney } from '../lib/dataUtils';
import { useDbMutations } from '../hooks/useDbQuery';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { hasRole } from './gates';

const fill = (s, vars) => Object.entries(vars).reduce((out, [k, v]) => out.split(`{${k}}`).join(String(v)), s);

export function NoticeDecisionsPanel({ tools }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const { decideRenewal } = useDbMutations();
  const canEdit = hasRole('editor');
  const fmtDate = (d) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
  const { due, decided, unknown } = useMemo(() => noticeRows(tools), [tools]);
  const choiceLabel = (c) => t(DECISION_LABEL_KEY[c]);

  if (!due.length && !decided.length && !unknown.length) return null;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6" aria-labelledby="rn-title">
      <div className="mb-4 flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" aria-hidden />
        <div>
          <h2 id="rn-title" className="text-base font-semibold text-white">{t('rn_title')}</h2>
          <p className="text-sm text-slate-500">{t('rn_sub')}</p>
        </div>
      </div>

      {due.length === 0 ? (
        <p className="text-sm text-slate-400">{t('rn_none')}</p>
      ) : (
        <ul className="divide-y divide-slate-800/60">
          {due.map((r) => (
            <li key={r.id || r.name} className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">{r.name}</span>
                  <span className={'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ' + (r.state === 'soon'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                    : 'border-red-500/30 bg-red-500/10 text-red-400')}>
                    {r.state === 'locked' ? <><Lock className="mr-1 inline h-3 w-3" aria-hidden />{t('rn_state_locked')}</> : t(r.state === 'act_now' ? 'rn_state_act_now' : 'rn_state_soon')}
                  </span>
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  {r.state === 'locked'
                    ? fill(t('rn_locked_line'), { date: fmtDate(r.notice_deadline), renewal: fmtDate(r.renewal_date) })
                    : r.days_to_decide < 0
                      ? fill(t('rn_decide_late'), { date: fmtDate(r.decide_by), days: r.days_to_deadline })
                      : fill(t('rn_decide_by'), { date: fmtDate(r.decide_by), days: r.days_to_decide })}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {fill(t('rn_last_day'), { date: fmtDate(r.notice_deadline), notice: r.notice_days })}
                  {r.procurement_lead_days > 0 && <> · {fill(t('rn_procurement'), { days: r.procurement_lead_days })}</>}
                  {' · '}{fill(t('rn_renews'), { date: fmtDate(r.renewal_date) })}
                  {r.annual > 0 && <> · {formatMoney(Math.round(r.annual), language)}{t('per_year')}</>}
                  {r.owner && <> · {t('rn_owner')} {r.owner}</>}
                </div>
              </div>
              {canEdit && (
                <div className="flex flex-shrink-0 flex-wrap gap-2" role="group" aria-label={fill(t('rn_record_for'), { name: r.name })}>
                  {RENEWAL_DECISIONS.map((c) => (
                    <button key={c} type="button" disabled={decideRenewal.isPending}
                      onClick={() => decideRenewal.mutate({ id: r.id, choice: c })}
                      className={'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ' + (c === 'cancel'
                        ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                        : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700')}>
                      {choiceLabel(c)}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {decided.length > 0 && (
        <div className="mt-4 border-t border-slate-800 pt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('rn_decided_title')}</h3>
          <ul className="space-y-2">
            {decided.map((r) => (
              <li key={r.id || r.name} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-slate-300">
                  <Check className="mr-1 inline h-4 w-4 text-emerald-400" aria-hidden />
                  <span className="font-semibold text-white">{r.name}</span>{' — '}
                  {choiceLabel(r.decision.choice)}
                  <span className="text-slate-500">
                    {' · '}{fill(t('rn_renews'), { date: fmtDate(r.renewal_date) })}
                    {r.notice_deadline && r.decision.choice === 'cancel' && <> · {fill(t('rn_last_day_short'), { date: fmtDate(r.notice_deadline) })}</>}
                    {r.decision.by && <> · {fill(t('rn_decided_by'), { by: r.decision.by, date: fmtDate(String(r.decision.at || '').slice(0, 10)) })}</>}
                  </span>
                </span>
                {canEdit && (
                  <button type="button" disabled={decideRenewal.isPending}
                    onClick={() => decideRenewal.mutate({ id: r.id, choice: null })}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-60">
                    <Undo2 className="h-3 w-3" aria-hidden />{t('rn_undo')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {unknown.length > 0 && (
        <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-400">
          {fill(t('rn_unknown'), { n: unknown.length })}{' '}
          <span className="text-slate-500">{unknown.slice(0, 5).map((r) => r.name).join(', ')}{unknown.length > 5 ? '…' : ''}</span>{' '}
          <Link to="/tools" className="font-semibold text-blue-400 hover:underline">{t('rn_unknown_cta')}</Link>
        </p>
      )}

      <p className="mt-4 text-xs text-slate-500">{t('rn_records_only')}</p>
    </section>
  );
}
