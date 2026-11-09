// ── Finance → Cost: savings, and what each one rests on ────────────────────
//
// Every figure here comes from lib/savings.js and can be followed down to the
// tool, the access rows, the contract dates and the decision behind it.
// Suspected, approved and realised are said apart; a realised saving is
// checked against the invoices Stacklens holds. Editors decide, viewers read.

import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, PiggyBank } from 'lucide-react';
import { useDbMutations } from '../hooks/useDbQuery';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Button, Input } from './ui';
import { hasRole } from './gates';
import { formatMoney, downloadText } from '../lib/dataUtils';
import { csvStyleFor, CSV_BOM } from '../lib/saasAudit';
import { savingsSummary, savingsCsv, MIN_REASON } from '../lib/savings';

const STAGE_TONE = {
  suspected: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  approved: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  rejected: 'border-slate-600 bg-slate-800 text-slate-400',
  realised: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
};
const STAGE_KEY = { suspected: 'sv_stage_suspected', approved: 'sv_stage_approved', rejected: 'sv_stage_rejected', realised: 'sv_stage_realised' };
const BASIS_KEY = { monthly: 'sv_stop_monthly', notice: 'sv_stop_notice', ends: 'sv_stop_ends', renewal: 'sv_stop_renewal', next_renewal: 'sv_stop_next_renewal' };
const BILLING_KEY = { confirmed: 'sv_bill_confirmed', contradicted: 'sv_bill_contradicted', awaiting: 'sv_bill_awaiting', no_billing: 'sv_bill_none' };

function StepForm({ kind, t, busy, onSubmit, onClose }) {
  const [text, setText] = useState('');
  const [stop, setStop] = useState('');
  const ok = text.trim().length >= MIN_REASON;
  return (
    <form className="mt-3 grid gap-2 rounded-xl border border-slate-700 bg-slate-950/40 p-3"
      onSubmit={(e) => { e.preventDefault(); if (ok) onSubmit(kind === 'realise' ? { evidence: text, stops_on: stop } : { note: text }); }}>
      <label className="grid gap-1 text-xs text-slate-400">
        {t(kind === 'realise' ? 'sv_form_evidence' : 'sv_form_reason')}
        <Input value={text} onChange={(e) => setText(e.target.value)} required
          placeholder={t(kind === 'realise' ? 'sv_form_evidence_ph' : 'sv_form_reason_ph')} />
      </label>
      {kind === 'realise' && (
        <label className="grid gap-1 text-xs text-slate-400">{t('sv_form_stop')}
          <Input type="date" value={stop} onChange={(e) => setStop(e.target.value)} />
        </label>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>{t('act_cancel')}</Button>
        <Button type="submit" size="sm" disabled={!ok || busy}>{t('act_save')}</Button>
      </div>
    </form>
  );
}

export function SavingsPanel({ db }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const money = (n) => formatMoney(Math.round(Number(n) || 0), language);
  const fmt = (d) => (d ? new Date(d.length === 10 ? `${d}T00:00:00Z` : d).toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
  const fill = (key, vars) => Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v ?? '')), t(key));
  const { recordSaving } = useDbMutations();
  const canEdit = hasRole('editor');
  const sum = useMemo(() => savingsSummary(db), [db]);
  const [form, setForm] = useState(null);

  const run = (id, step, opts = {}, okKey = 'sv_saved_toast') => recordSaving.mutate({ id, step, ...opts }, {
    onSuccess: () => { setForm(null); toast.success(t(okKey)); },
  });
  const csv = () => {
    const style = csvStyleFor(language);
    downloadText(`stacklens-savings-${new Date().toISOString().slice(0, 10)}.csv`,
      (language === 'en' ? '' : CSV_BOM) + savingsCsv(db, { sep: style.sep, decimal: style.decimal || '.' }));
  };

  const count = (n) => (n === 1 ? t('sv_tile_count_one') : fill('sv_tile_count', { n }));
  const tile = (labelKey, value, sub, tone) => (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t(labelKey)}</div>
      <div className={`mt-1 text-2xl font-black tabular-nums ${tone}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );

  const evidence = (i) => {
    const lines = [];
    if (i.access === 'no_access_recorded') lines.push(<span className="text-amber-400">{t('sv_ev_no_access_recorded')}</span>);
    else if (i.access) lines.push(fill('sv_ev_no_active_access', { n: i.access_rows.total, removed: i.access_rows.removed }));
    if (i.stage !== 'realised') lines.push(i.last_used
      ? fill(i.usage_source ? 'sv_ev_last_used_read' : 'sv_ev_last_used_typed', { date: fmt(i.last_used), source: i.usage_source || '' })
      : t('sv_ev_last_used_unknown'));
    if (i.commitment && i.stage !== 'rejected') lines.push(i.commitment.basis === 'unknown'
      ? <span className="text-amber-400">{t('sv_stop_unknown')}</span>
      : `${fill(BASIS_KEY[i.commitment.basis], { date: fmt(i.commitment.stops_on) })} · ${fill('sv_next12', { amount: money(i.commitment.next12) })}`);
    const d = i.decision;
    if (d && i.stage === 'approved') lines.push(fill(d.by_owner ? 'sv_dec_approved_owner' : 'sv_dec_approved', { by: d.by || '—', at: fmt(d.at) }) + (d.note ? ` · ${d.note}` : ''));
    if (d && i.stage === 'rejected') lines.push(`${fill('sv_dec_rejected', { by: d.by || '—', at: fmt(d.at) })} · ${d.note}`);
    if (d && i.stage === 'realised') {
      lines.push(`${fill('sv_dec_realised', { by: d.by || '—', at: fmt(d.at), stop: fmt(d.stops_on) })} · ${d.evidence}`);
      if (i.billing) lines.push(<span className={i.billing.state === 'confirmed' ? 'text-emerald-400' : i.billing.state === 'contradicted' ? 'text-red-400' : 'text-slate-400'}>
        {fill(BILLING_KEY[i.billing.state], { date: fmt(i.billing.last_invoice), until: fmt(i.billing.until) })}</span>);
    }
    return lines;
  };

  const btn = 'rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700';

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6" aria-labelledby="sv-title" data-testid="savings-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h2 id="sv-title" className="flex items-center gap-2 text-base font-semibold text-white"><PiggyBank className="h-5 w-5 text-emerald-400" aria-hidden />{t('sv_title')}</h2>
          <p className="mt-1 text-sm text-slate-400">{t('sv_intro')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={csv} disabled={!sum.items.length}><Download className="h-4 w-4" aria-hidden /> {t('sv_export')}</Button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tile('sv_tile_suspected', `${money(sum.suspected.monthly)}${t('per_mo_short')}`,
          `${count(sum.suspected.count)}${sum.unrecordedAccess.count ? ' · ' + fill('sv_tile_unrecorded', { n: sum.unrecordedAccess.count }) : ''}`, 'text-amber-400')}
        {tile('sv_tile_approved', `${money(sum.approved.monthly)}${t('per_mo_short')}`, count(sum.approved.count), 'text-blue-400')}
        {tile('sv_tile_next12', money(sum.next12),
          sum.commitmentUnknown ? fill('sv_tile_next12_unknown', { n: sum.commitmentUnknown }) : t('sv_tile_next12_sub'), 'text-white')}
        {tile('sv_tile_realised', `${money(sum.realised.monthly)}${t('per_mo_short')}`,
          `${fill('sv_tile_confirmed', { n: sum.confirmed.count, total: sum.realised.count })}${sum.contradicted.count ? ' · ' + fill('sv_tile_contradicted', { n: sum.contradicted.count }) : ''}`, 'text-emerald-400')}
      </div>

      {sum.items.length === 0 ? <p className="mt-4 text-sm text-slate-400">{t('sv_none')}</p> : (
        <ul className="mt-4 divide-y divide-slate-800/60">
          {sum.items.map((i) => (
            <li key={i.id} className="py-3" data-testid={`saving-${i.stage}`}>
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{i.name}</span>
                    <span className="text-sm tabular-nums text-slate-300">{money(i.monthly)}{t('per_mo_short')}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STAGE_TONE[i.stage]}`}>{t(STAGE_KEY[i.stage])}</span>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                    {evidence(i).map((line, n) => <li key={n}>{line}</li>)}
                  </ul>
                </div>
                {canEdit && i.stage !== 'realised' && (
                  <div className="flex flex-shrink-0 flex-wrap gap-2">
                    {i.stage === 'suspected' && <button type="button" className={btn} onClick={() => run(i.id, 'approve')}>{t('sv_approve')}</button>}
                    {i.stage !== 'rejected' && <button type="button" className={btn} onClick={() => setForm({ id: i.id, kind: 'realise' })}>{t('sv_realise')}</button>}
                    {i.stage === 'suspected' && <button type="button" className={btn} onClick={() => setForm({ id: i.id, kind: 'reject' })}>{t('sv_reject')}</button>}
                    {i.stage !== 'suspected' && <button type="button" className="px-2 text-xs font-semibold text-slate-400 hover:text-white" onClick={() => run(i.id, 'reopen')}>{t('sv_reopen')}</button>}
                  </div>
                )}
              </div>
              {form?.id === i.id && (
                <StepForm kind={form.kind} t={t} busy={recordSaving.isPending} onClose={() => setForm(null)}
                  onSubmit={(opts) => run(i.id, form.kind, opts, form.kind === 'realise' ? 'sv_realised_toast' : 'sv_saved_toast')} />
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-slate-500">{t('sv_footer')}</p>
    </section>
  );
}
