// ── Access → Removals ──────────────────────────────────────────────────────
//
// Every access someone decided to remove, by step (lib/removals.js): still to
// do in the tool, removed but not verified, verified. Approving records a
// decision; the person keeps the access until it is removed in the tool, and
// marking it removed needs who did it and on what evidence. Editors act,
// viewers read. Nothing here contacts a vendor.

import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, CheckCircle2, Clock, ShieldCheck, Undo2 } from 'lucide-react';
import { useDbMutations } from '../hooks/useDbQuery';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Button, Input } from './ui';
import { hasRole } from './gates';
import { downloadText } from '../lib/dataUtils';
import { csvStyleFor, CSV_BOM } from '../lib/saasAudit';
import { removalQueue, removalsCsv, MIN_EVIDENCE } from '../lib/removals';

const SOURCE_KEY = { manual: 'rm_src_manual', review: 'rm_src_review', offboarding: 'rm_src_offboarding', eligibility: 'rm_src_eligibility', dashboard: 'rm_src_dashboard' };
const METHOD_KEY = { manual: 'rm_how_manual', vendor: 'rm_how_vendor', connector: 'rm_how_connector', unrecorded: 'rm_how_unrecorded' };
const VERIFY_KEY = { manual: 'rm_vhow_manual', connector: 'rm_vhow_connector' };
const VERIFIED_SHOWN = 20;

function StepForm({ kind, t, busy, onSubmit, onClose }) {
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const needs = kind !== 'request';
  const ok = !needs || text.trim().length >= MIN_EVIDENCE;
  return (
    <form className="mt-3 grid gap-2 rounded-xl border border-slate-700 bg-slate-950/40 p-3"
      onSubmit={(e) => { e.preventDefault(); if (ok) onSubmit(kind === 'request' ? { to, reference: text } : { evidence: text }); }}>
      {kind === 'request' && (
        <label className="grid gap-1 text-xs text-slate-400">{t('rm_form_to')}
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder={t('rm_form_to_ph')} />
        </label>
      )}
      <label className="grid gap-1 text-xs text-slate-400">
        {t(kind === 'request' ? 'rm_form_reference' : kind === 'complete' ? 'rm_form_evidence_done' : 'rm_form_evidence_verify')}
        <Input value={text} onChange={(e) => setText(e.target.value)} required={needs}
          placeholder={t(kind === 'request' ? 'rm_form_reference_ph' : kind === 'complete' ? 'rm_form_evidence_done_ph' : 'rm_form_evidence_verify_ph')} />
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>{t('act_cancel')}</Button>
        <Button type="submit" size="sm" disabled={!ok || busy}>{t('act_save')}</Button>
      </div>
    </form>
  );
}

export function RemovalsView({ db }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const { recordRemoval } = useDbMutations();
  const canEdit = hasRole('editor');
  const q = useMemo(() => removalQueue(db), [db]);
  const [form, setForm] = useState(null); // { id, kind }
  const [showAllVerified, setShowAllVerified] = useState(false);
  const fmt = (at) => (at ? new Date(at).toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const fill = (key, vars) => Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v ?? '')), t(key));

  const run = (id, step, opts, okKey) => recordRemoval.mutate({ ids: [id], step, ...opts }, {
    onSuccess: () => { setForm(null); toast.success(t(okKey)); },
  });

  const csv = () => {
    const style = csvStyleFor(language);
    downloadText(`stacklens-access-removals-${new Date().toISOString().slice(0, 10)}.csv`, (language === 'en' ? '' : CSV_BOM) + removalsCsv(db, { sep: style.sep }));
  };

  const trail = (r) => (
    <div className="mt-1 space-y-0.5 text-xs text-slate-500">
      {r.approved && <div>{fill('rm_trail_approved', { by: r.approved.by || '—', at: fmt(r.approved.at), from: t(SOURCE_KEY[r.approved.source] || 'rm_src_manual') })}</div>}
      {r.requested && <div>{fill('rm_trail_requested', { by: r.requested.by || '—', at: fmt(r.requested.at), to: r.requested.to || '—' })}{r.requested.reference ? ` · ${r.requested.reference}` : ''}</div>}
      {r.completed && (r.completed.method === 'unrecorded'
        ? <div className="text-amber-400">{t('rm_trail_unrecorded')}</div>
        : <div>{fill('rm_trail_completed', { by: r.completed.by || '—', at: fmt(r.completed.at), how: t(METHOD_KEY[r.completed.method] || 'rm_how_manual') })} · {r.completed.evidence}</div>)}
      {r.verified && <div className="text-emerald-400">{fill('rm_trail_verified', { by: r.verified.by || '—', at: fmt(r.verified.at), how: t(VERIFY_KEY[r.verified.method] || 'rm_vhow_manual') })} · {r.verified.evidence}</div>}
    </div>
  );

  const renderRow = (row, children = null) => (
    <li key={row.id} className="py-3" data-testid={`removal-${row.stage}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{row.person || '—'} <span className="font-normal text-slate-500">→</span> {row.tool || '—'}</div>
          {trail(row.removal)}
        </div>
        {canEdit && children && <div className="flex flex-shrink-0 flex-wrap gap-2">{children}</div>}
      </div>
      {form?.id === row.id && (
        <StepForm kind={form.kind} t={t} busy={recordRemoval.isPending} onClose={() => setForm(null)}
          onSubmit={(opts) => form.kind === 'request'
            ? run(row.id, 'request', opts, 'rm_requested_toast')
            : form.kind === 'complete' ? run(row.id, 'complete', { method: 'manual', ...opts }, 'rm_completed_toast')
              : run(row.id, 'verify', { method: 'manual', ...opts }, 'rm_verified_toast')} />
      )}
    </li>
  );

  const btn = 'rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700';
  const verified = showAllVerified ? q.verified : q.verified.slice(0, VERIFIED_SHOWN);

  return (
    <div className="space-y-5" data-testid="removals-view">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <h2 className="text-base font-semibold text-white">{t('rm_title')}</h2>
            <p className="mt-1 text-sm text-slate-400">{t('rm_intro')}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={csv} disabled={!q.open.length && !q.unverified.length && !q.verified.length}>
            <Download className="h-4 w-4" aria-hidden /> {t('rm_export')}
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[['rm_open_title', q.open.length, 'text-red-400'], ['rm_unverified_title', q.unverified.length, 'text-amber-400'], ['rm_verified_title', q.verified.length, 'text-emerald-400']].map(([k, n, c]) => (
            <div key={k} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className={`text-2xl font-black ${c}`}>{n}</div>
              <div className="text-xs text-slate-500">{t(k)}</div>
            </div>
          ))}
        </div>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5" aria-labelledby="rm-open">
        <h3 id="rm-open" className="flex items-center gap-2 text-sm font-semibold text-white"><Clock className="h-4 w-4 text-red-400" aria-hidden />{t('rm_open_title')}</h3>
        <p className="text-xs text-slate-500">{t('rm_open_sub')}</p>
        {q.open.length === 0 ? <p className="mt-3 text-sm text-slate-400">{t('rm_open_none')}</p> : (
          <ul className="mt-2 divide-y divide-slate-800/60">
            {q.open.map((row) => (
              renderRow(row, <>
                {row.stage === 'approved' && <button type="button" className={btn} onClick={() => setForm({ id: row.id, kind: 'request' })}>{t('rm_mark_requested')}</button>}
                <button type="button" className={btn} onClick={() => setForm({ id: row.id, kind: 'complete' })}>{t('rm_mark_done')}</button>
                <button type="button" className="inline-flex items-center gap-1 px-2 text-xs font-semibold text-slate-400 hover:text-white"
                  onClick={() => { if (window.confirm(t('rm_cancel_confirm'))) run(row.id, 'cancel', {}, 'rm_cancelled_toast'); }}>
                  <Undo2 className="h-3 w-3" aria-hidden />{t('rm_cancel')}
                </button>
              </>)
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5" aria-labelledby="rm-unverified">
        <h3 id="rm-unverified" className="flex items-center gap-2 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4 text-amber-400" aria-hidden />{t('rm_unverified_title')}</h3>
        <p className="text-xs text-slate-500">{t('rm_unverified_sub')}</p>
        {q.unverified.length === 0 ? <p className="mt-3 text-sm text-slate-400">{t('rm_unverified_none')}</p> : (
          <ul className="mt-2 divide-y divide-slate-800/60">
            {q.unverified.map((row) => (
              renderRow(row, <>
                {row.removal.legacy && <button type="button" className={btn} onClick={() => setForm({ id: row.id, kind: 'complete' })}>{t('rm_add_evidence')}</button>}
                <button type="button" className={btn} onClick={() => setForm({ id: row.id, kind: 'verify' })}>{t('rm_mark_verified')}</button>
              </>)
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5" aria-labelledby="rm-verified">
        <h3 id="rm-verified" className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden />{t('rm_verified_title')}</h3>
        {q.verified.length === 0 ? <p className="mt-3 text-sm text-slate-400">{t('rm_verified_none')}</p> : (
          <ul className="mt-2 divide-y divide-slate-800/60">
            {verified.map((row) => renderRow(row))}
          </ul>
        )}
        {q.verified.length > VERIFIED_SHOWN && (
          <button type="button" className="mt-2 text-xs font-semibold text-blue-400 hover:underline" onClick={() => setShowAllVerified((v) => !v)}>
            {showAllVerified ? t('dash_todo_show_less') : t('dash_todo_show_all').replace('{n}', q.verified.length)}
          </button>
        )}
      </section>
    </div>
  );
}
