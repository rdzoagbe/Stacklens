import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { Printer, Download, CheckCircle2 } from 'lucide-react';
import { useDbMutations } from '../hooks/useDbQuery';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Modal, Button, Input, Select, useEnumLabel, useCategoryLabel } from './ui';
import { hasRole } from './gates';
import { downloadText } from '../lib/dataUtils';
import { csvStyleFor, CSV_BOM } from '../lib/saasAudit';
import { departmentsInUse } from '../lib/eligibility';
import { rowsInScope, summary, canSignOff, reviewCsv, sortReviews } from '../lib/accessReviews';

// ── Access → Reviews ───────────────────────────────────────────────────────
//
// A review campaign (lib/accessReviews.js): start one over everyone, a tool
// or a department; answer keep or revoke for each access row; sign off with
// your name. Signing is what changes the access rows, and what turns the
// review into evidence: a printed page or a CSV with every decision, the
// reviewer and the dates.

const fill = (s, vars) => Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), s);
const small = 'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40';

function StartReview({ db, t, label, onStart, busy }) {
  const [scope, setScope] = useState('all');
  const [target, setTarget] = useState('');
  const tools = (db?.tools || []).filter((x) => x.status !== 'decommissioned');
  const depts = useMemo(() => departmentsInUse(db?.employees || []), [db]);
  const effectiveTarget = scope === 'tool' ? (target || tools[0]?.id || '') : scope === 'department' ? (target || depts[0]?.value || '') : '';
  const count = rowsInScope(db, scope, effectiveTarget).length;
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5" data-testid="review-start">
      <h2 className="text-base font-semibold text-white">{t('ar_start_title')}</h2>
      <p className="mt-1 mb-4 text-sm text-slate-400 max-w-3xl">{t('ar_start_intro')}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-400">
          {t('ar_scope')}
          <Select value={scope} onChange={(e) => { setScope(e.target.value); setTarget(''); }} className="mt-1 w-48">
            <option value="all">{t('ar_scope_all')}</option>
            <option value="tool">{t('ar_scope_tool')}</option>
            <option value="department">{t('ar_scope_department')}</option>
          </Select>
        </label>
        {scope === 'tool' && (
          <label className="text-xs text-slate-400">
            {t('col_tool')}
            <Select value={effectiveTarget} onChange={(e) => setTarget(e.target.value)} className="mt-1 w-56" data-testid="review-target">
              {tools.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </label>
        )}
        {scope === 'department' && (
          <label className="text-xs text-slate-400">
            {t('elig_departments')}
            <Select value={effectiveTarget} onChange={(e) => setTarget(e.target.value)} className="mt-1 w-56" data-testid="review-target">
              {depts.map((d) => <option key={d.value} value={d.value}>{label(d.value)} ({d.count})</option>)}
            </Select>
          </label>
        )}
        <Button onClick={() => onStart({ scope, target: effectiveTarget })} disabled={busy || count === 0}>
          {fill(t('ar_start_btn'), { n: count })}
        </Button>
      </div>
      {count === 0 && <p className="mt-2 text-xs text-slate-500">{t('ar_nothing_in_scope')}</p>}
    </section>
  );
}

function OpenReview({ review, t, enumLabel, label, canEdit, onDecide, onRemaining, onSign, busy }) {
  const s = summary(review);
  const title = review.label ? fill(t('ar_review_of'), { scope: review.label }) : t('ar_review_everyone');
  return (
    <section className="rounded-2xl border border-blue-500/30 bg-slate-900/60" data-testid="review-open">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="text-xs text-slate-500">{fill(t('ar_started'), { date: review.started_at.slice(0, 10), by: review.started_by || '—' })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400" data-testid="review-progress">{fill(t('ar_progress'), { done: s.total - s.undecided, total: s.total })}</span>
          {canEdit && s.undecided > 0 && (
            <button type="button" onClick={() => onRemaining('keep')} disabled={busy} className={small + ' bg-slate-800 hover:bg-slate-700 text-slate-200'}>{t('ar_keep_remaining')}</button>
          )}
          {canEdit && (
            <Button size="sm" onClick={onSign} disabled={busy || !canSignOff(review)}>
              <CheckCircle2 className="h-3.5 w-3.5" /> {t('ar_sign')}
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/50 text-left text-xs text-slate-400">
              <th className="py-2.5 px-4">{t('col_employee')}</th>
              <th className="py-2.5 px-4">{t('col_tool')}</th>
              <th className="py-2.5 px-4">{t('col_level')}</th>
              <th className="py-2.5 px-4">{t('ar_col_previous')}</th>
              <th className="py-2.5 px-4">{t('col_risk')}</th>
              <th className="py-2.5 px-4 text-right">{t('ar_col_decision')}</th>
            </tr>
          </thead>
          <tbody data-testid="review-rows">
            {review.rows.map((r) => (
              <tr key={r.access_id} className="border-b border-slate-800/50" data-decision={r.decision || ''}>
                <td className="py-2.5 px-4">
                  <div className="font-medium text-white">{r.employee_name || r.employee_email || '—'}</div>
                  <div className="text-[11px] text-slate-500">{[r.department && label(r.department), r.employee_status !== 'active' && enumLabel(r.employee_status)].filter(Boolean).join(' · ')}</div>
                </td>
                <td className="py-2.5 px-4 text-white">{r.tool_name}</td>
                <td className="py-2.5 px-4 text-slate-300">{enumLabel(r.access_level)}</td>
                <td className="py-2.5 px-4 text-slate-400">{r.last_reviewed_date || t('ar_never')}</td>
                <td className="py-2.5 px-4">
                  {r.risk !== 'none'
                    ? <span className={'px-2 py-0.5 rounded-full text-[10px] font-semibold ' + (r.risk === 'former_employee' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400')}>{enumLabel(r.risk)}</span>
                    : <span className="text-[10px] text-slate-500">—</span>}
                </td>
                <td className="py-2.5 px-4">
                  <div className="flex justify-end gap-1.5">
                    {canEdit ? (
                      <>
                        <button type="button" onClick={() => onDecide(r.access_id, r.decision === 'keep' ? null : 'keep')} disabled={busy}
                          className={small + (r.decision === 'keep' ? ' bg-emerald-600 text-white' : ' bg-slate-800 hover:bg-slate-700 text-slate-200')}>{t('ar_keep')}</button>
                        <button type="button" onClick={() => onDecide(r.access_id, r.decision === 'revoke' ? null : 'revoke')} disabled={busy}
                          className={small + (r.decision === 'revoke' ? ' bg-red-600 text-white' : ' bg-red-600/20 hover:bg-red-600/40 text-red-300')}>{t('ar_revoke')}</button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">{r.decision ? t(r.decision === 'keep' ? 'ar_keep' : 'ar_revoke') : '—'}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** The evidence page: white, dark type, same component on screen and on paper. */
export function PrintReview({ review, t, language, enumLabel, label, company }) {
  const s = summary(review);
  const date = (iso) => (iso ? new Date(iso).toLocaleDateString(language === 'en' ? 'en-GB' : language, { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
  return (
    <div className="bg-white text-gray-900 p-8 text-sm leading-relaxed" data-testid="print-review">
      <div className="flex items-start justify-between gap-6 border-b border-gray-300 pb-4 mb-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-600">{t('ar_print_kicker')}</div>
          <h1 className="text-xl font-bold">{review.label ? fill(t('ar_review_of'), { scope: review.label }) : t('ar_review_everyone')}</h1>
          {company && <div className="text-gray-700">{company}</div>}
        </div>
        <div className="text-right text-xs text-gray-700">
          <div>{fill(t('ar_print_started'), { date: date(review.started_at) })}</div>
          {review.signed_off && <div>{fill(t('ar_print_signed'), { name: review.signed_off.name, date: date(review.signed_off.at) })}</div>}
        </div>
      </div>
      <p className="mb-4 text-gray-800">{fill(t('ar_print_summary'), { total: s.total, keep: s.keep, revoke: s.revoke })}</p>
      <table className="w-full text-xs mb-6">
        <thead>
          <tr className="border-b border-gray-400 text-left text-gray-600">
            <th className="py-1 pr-2">{t('col_employee')}</th>
            <th className="py-1 pr-2">{t('col_tool')}</th>
            <th className="py-1 pr-2">{t('col_level')}</th>
            <th className="py-1 pr-2">{t('ar_col_previous')}</th>
            <th className="py-1 pr-2">{t('col_risk')}</th>
            <th className="py-1 text-right">{t('ar_col_decision')}</th>
          </tr>
        </thead>
        <tbody>
          {review.rows.map((r) => (
            <tr key={r.access_id} className="border-b border-gray-200">
              <td className="py-1 pr-2">{r.employee_name || r.employee_email}{r.department ? <span className="text-gray-600"> · {label(r.department)}</span> : null}</td>
              <td className="py-1 pr-2">{r.tool_name}</td>
              <td className="py-1 pr-2">{enumLabel(r.access_level)}</td>
              <td className="py-1 pr-2">{r.last_reviewed_date || t('ar_never')}</td>
              <td className="py-1 pr-2">{r.risk === 'none' ? '—' : enumLabel(r.risk)}</td>
              <td className={'py-1 text-right font-semibold ' + (r.decision === 'revoke' ? 'text-red-700' : 'text-gray-900')}>{r.decision ? t(r.decision === 'keep' ? 'ar_keep' : 'ar_revoke') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {review.signed_off && (
        <div className="border-t border-gray-300 pt-3 text-xs text-gray-700">
          {fill(t('ar_print_attest'), { name: review.signed_off.name, date: date(review.signed_off.at) })}
        </div>
      )}
      <div className="mt-6 text-[10px] text-gray-500">{t('ar_print_footer')}</div>
    </div>
  );
}

function EvidencePanel({ review, t, language, enumLabel, label, company, onClose }) {
  useEffect(() => {
    document.body.classList.add('printing-report');
    return () => document.body.classList.remove('printing-report');
  }, []);
  const doc = <PrintReview review={review} t={t} language={language} enumLabel={enumLabel} label={label} company={company} />;
  const csv = () => {
    const style = csvStyleFor(language);
    const text = reviewCsv(review, { sep: style.sep });
    downloadText(`stacklens-access-review-${review.started_at.slice(0, 10)}.csv`, (language === 'en' ? '' : CSV_BOM) + text);
  };
  return (
    <div className="rounded-2xl border border-blue-500/30 bg-slate-900/60 p-5" data-testid="review-evidence">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-base font-semibold text-white">{t('ar_evidence_title')}</h3>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> {t('ar_print')}</Button>
          <Button size="sm" variant="secondary" onClick={csv}><Download className="h-3.5 w-3.5" /> {t('ar_csv')}</Button>
          <Button size="sm" variant="ghost" onClick={onClose}>{t('audit_report_close')}</Button>
        </div>
      </div>
      <div className="rounded-xl overflow-hidden border border-slate-700 max-h-[32rem] overflow-y-auto">{doc}</div>
      {createPortal(<div id="print-report">{doc}</div>, document.body)}
    </div>
  );
}

export function AccessReviewsView({ db }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const enumLabel = useEnumLabel();
  const label = useCategoryLabel();
  const { startAccessReview, decideAccessReview, signOffAccessReview } = useDbMutations();
  const canEdit = hasRole('editor');
  const reviews = useMemo(() => sortReviews(db?.access_reviews), [db]);
  const open = reviews.filter((r) => !r.signed_off);
  const signed = reviews.filter((r) => r.signed_off);
  const [signing, setSigning] = useState(null);
  const [name, setName] = useState('');
  const [evidence, setEvidence] = useState(null);
  const busy = startAccessReview.isPending || decideAccessReview.isPending || signOffAccessReview.isPending;
  const company = db?.user?.company || (() => { try { return JSON.parse(localStorage.getItem('sg_general') || '{}').orgName || ''; } catch { return ''; } })();
  const me = db?.user?.displayName || db?.user?.email || '';

  const start = ({ scope, target }) => startAccessReview.mutate({ scope, target }, { onSuccess: () => toast.success(t('ar_started_toast')) });
  const confirmSign = () => {
    const review = signing;
    setSigning(null);
    signOffAccessReview.mutate({ id: review.id, name: name.trim() || me }, {
      onSuccess: (r) => {
        if (!r?.applied) return;
        const s = summary(r.review);
        toast.success(fill(t('ar_signed_toast'), { keep: s.keep, revoke: s.revoke }));
        setEvidence(r.review.id);
      },
    });
  };
  const shown = evidence ? reviews.find((r) => r.id === evidence) : null;

  return (
    <div className="space-y-4" data-testid="access-reviews">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-base font-semibold text-white">{t('ar_title')}</h2>
        <p className="mt-1 text-sm text-slate-400 max-w-3xl">{t('ar_intro')}</p>
      </div>

      {shown && <EvidencePanel review={shown} t={t} language={language} enumLabel={enumLabel} label={label} company={company} onClose={() => setEvidence(null)} />}

      {open.map((r) => (
        <OpenReview key={r.id} review={r} t={t} enumLabel={enumLabel} label={label} canEdit={canEdit} busy={busy}
          onDecide={(accessId, decision) => decideAccessReview.mutate({ id: r.id, accessId, decision })}
          onRemaining={(decision) => decideAccessReview.mutate({ id: r.id, remaining: decision })}
          onSign={() => { setName(me); setSigning(r); }} />
      ))}

      {canEdit && open.length === 0 && <StartReview db={db} t={t} label={label} onStart={start} busy={busy} />}

      {signed.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60" data-testid="review-history">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{fill(t('ar_history'), { n: signed.length })}</h2>
          </div>
          <ul className="divide-y divide-slate-800/70">
            {signed.map((r) => {
              const s = summary(r);
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white truncate">{r.label ? fill(t('ar_review_of'), { scope: r.label }) : t('ar_review_everyone')}</span>
                    <span className="block text-xs text-slate-500">{fill(t('ar_history_line'), { date: r.signed_off.at.slice(0, 10), name: r.signed_off.name, keep: s.keep, revoke: s.revoke })}</span>
                  </span>
                  <button type="button" onClick={() => setEvidence(r.id)} className={small + ' bg-slate-800 hover:bg-slate-700 text-slate-200'}>{t('ar_view_evidence')}</button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {signing && (
        <Modal open title={t('ar_sign_title')} subtitle={t('ar_sign_sub')} onClose={() => setSigning(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSigning(null)}>{t('ws_cancel')}</Button>
              <Button onClick={confirmSign} disabled={!name.trim()}>{t('ar_sign_confirm')}</Button>
            </div>
          }>
          <div className="space-y-3 text-sm text-slate-300" data-testid="review-sign-dialog">
            <p>{fill(t('ar_sign_body'), { keep: summary(signing).keep, revoke: summary(signing).revoke })}</p>
            <label className="block text-xs font-semibold text-slate-400" htmlFor="review-signer">{t('ar_sign_name')}</label>
            <Input id="review-signer" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
        </Modal>
      )}
    </div>
  );
}
