// ── Offboarding: assignments ending, and temporary access ──────────────────
//
// Every assignment ending within a month or ended and not closed
// (lib/lifecycle.js), with the manager who answers for it, what is still
// open, when the next reminder or escalation goes out, and a checklist where
// each access and device is removed, returned, or kept under a written
// exception. "Close the assignment" is offered only once nothing is open.
// Editors act, viewers read. Nothing here reaches a vendor or a device.

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CalendarClock, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useDbMutations } from '../hooks/useDbQuery';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Button, Input } from './ui';
import { hasRole } from './gates';
import { assignments, expiringAccess, nextReminder, MIN_EXCEPTION_REASON } from '../lib/lifecycle';
import { addDays, todayISOUtc } from '../lib/renewalNotice';

const STAGE = {
  upcoming: ['lc_stage_upcoming', 'border-slate-600 bg-slate-800 text-slate-300'],
  remind: ['lc_stage_remind', 'border-amber-500/30 bg-amber-500/10 text-amber-400'],
  ending: ['lc_stage_ending', 'border-amber-500/30 bg-amber-500/10 text-amber-400'],
  ended: ['lc_stage_ended', 'border-red-500/30 bg-red-500/10 text-red-400'],
  overdue: ['lc_stage_overdue', 'border-red-500/40 bg-red-500/15 text-red-300'],
  ready_to_close: ['lc_stage_ready', 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'],
};
const TYPE_KEY = { employee: 'lc_type_employee', contractor: 'lc_type_contractor', intern: 'lc_type_intern', temporary: 'lc_type_temporary' };
const ACCESS_KEY = { to_remove: 'lc_item_to_remove', removal_open: 'lc_item_removal_open', excepted: 'lc_item_excepted' };

function ExceptionForm({ t, busy, onSubmit, onClose }) {
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState(addDays(todayISOUtc(), 30));
  const ok = reason.trim().length >= MIN_EXCEPTION_REASON && until;
  return (
    <form className="mt-2 grid gap-2 rounded-lg border border-slate-700 bg-slate-950/40 p-3 sm:grid-cols-[1fr_auto_auto]"
      onSubmit={(e) => { e.preventDefault(); if (ok) onSubmit({ reason, until }); }}>
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('lc_exc_reason_ph')} aria-label={t('lc_exc_reason')} required />
      <Input type="date" value={until} min={todayISOUtc()} onChange={(e) => setUntil(e.target.value)} aria-label={t('lc_exc_until')} required />
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>{t('act_cancel')}</Button>
        <Button type="submit" size="sm" disabled={!ok || busy}>{t('act_save')}</Button>
      </div>
    </form>
  );
}

export function AssignmentsPanel({ db }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const fill = (key, vars) => Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v ?? '')), t(key));
  const fmt = (d) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
  const { recordAssignment, recordRemoval, returnAsset } = useDbMutations();
  const canEdit = hasRole('editor');
  const list = useMemo(() => assignments(db), [db]);
  const temporary = useMemo(() => expiringAccess(db), [db]);
  const [open, setOpen] = useState(() => new Set());
  const [form, setForm] = useState(null); // { kind: 'access'|'device', id }
  const busy = recordAssignment.isPending || recordRemoval.isPending || returnAsset.isPending;

  if (!list.length && !temporary.length) return null;

  const toggle = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const except = (kind, id, opts) => recordAssignment.mutate({ step: kind === 'access' ? 'except_access' : 'except_device', id, ...opts }, { onSuccess: () => { setForm(null); toast.success(t('lc_exc_saved')); } });
  const endException = (kind, id) => recordAssignment.mutate({ step: kind === 'access' ? 'unexcept_access' : 'unexcept_device', id });
  const approve = (id) => recordRemoval.mutate({ ids: [id], step: 'approve', source: 'offboarding' }, { onSuccess: () => toast.success(t('rm_approved_toast')) });
  const small = 'rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-60';

  const reminderLine = (a) => {
    const next = nextReminder(a);
    if (!next) return null;
    return fill(next.kind === 'remind' ? 'lc_next_remind' : 'lc_next_escalate', { date: fmt(next.on) });
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6" aria-labelledby="lc-title" data-testid="assignments-panel">
      <h2 id="lc-title" className="flex items-center gap-2 text-base font-semibold text-white"><CalendarClock className="h-5 w-5 text-amber-400" aria-hidden />{t('lc_title')}</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-400">{t('lc_intro')}</p>

      {list.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-800/60">
          {list.map((a) => {
            const [stageKey, tone] = STAGE[a.stage];
            const expanded = open.has(a.id);
            return (
              <li key={a.id} className="py-3" data-testid={`assignment-${a.stage}`}>
                <button type="button" onClick={() => toggle(a.id)} aria-expanded={expanded} className="flex w-full flex-wrap items-center gap-2 text-left">
                  {expanded ? <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden /> : <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden />}
                  <span className="font-semibold text-white">{a.name}</span>
                  <span className="text-xs text-slate-500">{t(TYPE_KEY[a.worker_type])}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${tone}`}>
                    {a.escalated && <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden />}
                    {fill(stageKey, { days: Math.abs(a.days_to_end) })}
                  </span>
                  <span className="text-xs text-slate-400">{fill('lc_open_items', { n: a.open })}</span>
                </button>
                <div className="ml-6 mt-1 text-xs text-slate-500">
                  {fill('lc_ends_on', { date: fmt(a.end_date) })} · {a.manager ? fill('lc_manager_is', { manager: a.manager }) : <span className="text-red-400">{t('lc_no_manager')}</span>}
                  {reminderLine(a) && <> · {reminderLine(a)}</>}
                </div>

                {expanded && (
                  <div className="ml-6 mt-3 space-y-2">
                    {a.access.length === 0 && a.devices.length === 0 && <p className="text-sm text-slate-400">{t('lc_nothing_held')}</p>}
                    {a.access.map((i) => (
                      <div key={i.id} className="rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm text-slate-200">{i.tool} <span className="text-xs text-slate-500">· {i.state === 'excepted' ? fill('lc_item_excepted', { date: fmt(i.exception.until) }) : t(ACCESS_KEY[i.state])}</span></span>
                          {canEdit && (
                            <span className="flex flex-wrap gap-2">
                              {i.state === 'to_remove' && <button type="button" className={small} disabled={busy} onClick={() => approve(i.id)}>{t('rm_approve')}</button>}
                              {i.state === 'removal_open' && <Link to="/access?view=removals" className={small}>{t('rm_dash_open_action')} →</Link>}
                              {i.state !== 'excepted'
                                ? <button type="button" className={small} onClick={() => setForm({ kind: 'access', id: i.id })}>{t('lc_keep_until')}</button>
                                : <button type="button" className={small} disabled={busy} onClick={() => endException('access', i.id)}>{t('lc_end_exception')}</button>}
                            </span>
                          )}
                        </div>
                        {i.state === 'excepted' && <div className="mt-1 text-xs text-slate-500">{i.exception.reason}</div>}
                        {form?.kind === 'access' && form.id === i.id && <ExceptionForm t={t} busy={busy} onClose={() => setForm(null)} onSubmit={(o) => except('access', i.id, o)} />}
                      </div>
                    ))}
                    {a.devices.map((i) => (
                      <div key={i.id} className="rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm text-slate-200">{i.name} <span className="text-xs text-slate-500">· {i.state === 'excepted' ? fill('lc_item_kept_device', { date: fmt(i.exception.until) }) : t('lc_item_to_return')}</span></span>
                          {canEdit && (
                            <span className="flex flex-wrap gap-2">
                              {i.state === 'to_return' && <button type="button" className={small} disabled={busy} onClick={() => returnAsset.mutate(i.id, { onSuccess: () => toast.success(t('dev_returned_toast')) })}>{t('lc_mark_returned')}</button>}
                              {i.state !== 'excepted'
                                ? <button type="button" className={small} onClick={() => setForm({ kind: 'device', id: i.id })}>{t('lc_kept_by_agreement')}</button>
                                : <button type="button" className={small} disabled={busy} onClick={() => endException('device', i.id)}>{t('lc_end_exception')}</button>}
                            </span>
                          )}
                        </div>
                        {i.state === 'excepted' && <div className="mt-1 text-xs text-slate-500">{i.exception.reason}</div>}
                        {form?.kind === 'device' && form.id === i.id && <ExceptionForm t={t} busy={busy} onClose={() => setForm(null)} onSubmit={(o) => except('device', i.id, o)} />}
                      </div>
                    ))}
                    {canEdit && a.stage === 'ready_to_close' && (
                      <Button size="sm" disabled={busy} onClick={() => recordAssignment.mutate({ step: 'close', id: a.id }, { onSuccess: () => toast.success(t('lc_closed_toast')) })}>
                        <CheckCircle2 className="h-4 w-4" aria-hidden /> {t('lc_close')}
                      </Button>
                    )}
                    {a.stage !== 'ready_to_close' && a.days_to_end < 0 && <p className="text-xs text-slate-500">{t('lc_close_when_done')}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {temporary.length > 0 && (
        <div className="mt-5 border-t border-slate-800 pt-4" data-testid="temporary-access">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('lc_temp_title')}</h3>
          <ul className="mt-2 space-y-2">
            {temporary.map((x) => (
              <li key={x.id} className="rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-slate-200">{x.person} → {x.tool}{' '}
                    <span className={'text-xs ' + (x.days < 0 ? 'text-red-400' : 'text-amber-400')}>
                      · {x.days < 0 ? fill('lc_temp_expired', { date: fmt(x.expires_on) }) : fill('lc_temp_expires', { date: fmt(x.expires_on), days: x.days })}
                    </span>
                    {x.manager && <span className="text-xs text-slate-500"> · {fill('lc_manager_is', { manager: x.manager })}</span>}
                  </span>
                  {canEdit && (
                    <span className="flex flex-wrap gap-2">
                      {x.removal_open
                        ? <Link to="/access?view=removals" className={small}>{t('rm_dash_open_action')} →</Link>
                        : <button type="button" className={small} disabled={busy} onClick={() => approve(x.id)}>{t('rm_approve')}</button>}
                      <button type="button" className={small} onClick={() => setForm({ kind: 'access', id: x.id })}>{t('lc_keep_until')}</button>
                    </span>
                  )}
                </div>
                {form?.kind === 'access' && form.id === x.id && <ExceptionForm t={t} busy={busy} onClose={() => setForm(null)} onSubmit={(o) => except('access', x.id, o)} />}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 text-xs text-slate-500">{t('lc_footer')}</p>
    </section>
  );
}
