import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Upload, ShieldCheck, Download, Copy, TrendingUp, CalendarClock, Eye, Layers,
  ArrowRight, RefreshCw, FileSpreadsheet, AlertTriangle, CheckCircle2,
  Check, X, Pencil, Undo2, Printer, Mail, FileText,
} from 'lucide-react';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { PublicNav } from '../components/PublicNav';
import { track } from '../lib/analytics';
import {
  decodeBankFile, parseBankExport, auditSaas, reportToCsv, sampleBankExport,
  correctionsMailto, reviewCounts,
} from '../lib/saasAudit';

// ── /audit-saas (SaasAuditPage; AuditPage.jsx is the authenticated /audit tab) ─────────────────────────────────────────────────────────────
//
// The lead magnet for the accountant channel. Drop a bank export, get the
// recurring software charges back, download the list, and — the point — see
// the same thing offered for every client at once.
//
// EVERYTHING HAPPENS IN THE BROWSER. The file is read with FileReader, parsed
// by lib/saasAudit.js, rendered here, and never sent anywhere. That claim is
// the whole reason an accountant would try this with a client's statement, so
// it is enforced: saasAudit.test.js asserts the module has no fetch, and
// audit-page.test.js asserts this component's only network call is the
// analytics counter, which sends counts and never labels.
//
// Amounts are shown in whatever currency the statement is in. The file does
// not say; a symbol in the text is used when present, and € otherwise, since
// the pages this is linked from are French.

const CURRENCY_HINTS = [
  [/€|\bEUR\b/, '€'], [/£|\bGBP\b/, '£'], [/\$|\bUSD\b/, '$'], [/\bCHF\b/, 'CHF '],
];
function detectSymbol(text) {
  for (const [re, sym] of CURRENCY_HINTS) if (re.test(text)) return sym;
  return '€';
}

const fill = (s, vars) => Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), String(s || ''));

export function SaasAuditPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const [state, setState] = useState({ phase: 'idle' }); // idle | reading | error | done
  // The reader's corrections, keyed by normalised bank label. They live in
  // memory only, like the file, and survive a date-order flip because the
  // keys do not depend on the dates.
  const [verdicts, setVerdicts] = useState({});
  const setVerdict = useCallback((key, verdict) => {
    setVerdicts((prev) => {
      const next = { ...prev };
      if (verdict) next[key] = verdict; else delete next[key];
      return next;
    });
  }, []);
  const report = useMemo(
    () => (state.phase === 'done' ? auditSaas(state.transactions, { verdicts }) : null),
    [state, verdicts],
  );
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const runOn = useCallback((text, source, forceOrder) => {
    const parsed = parseBankExport(text, forceOrder);
    if (!parsed.columns) { setState({ phase: 'error', error: 'columns' }); return; }
    if (!parsed.transactions.length) { setState({ phase: 'error', error: 'empty' }); return; }
    const first = auditSaas(parsed.transactions);
    // Counts only. Never a label, never an amount, never the file.
    track('audit_run', { source, transactions: parsed.transactions.length, subscriptions: first.totals.subscriptionCount });
    setVerdicts({});
    setState({
      phase: 'done', transactions: parsed.transactions, symbol: detectSymbol(text),
      skipped: parsed.skipped, dateOrder: parsed.dateOrder, text,
    });
  }, []);

  // `04/03` is 4 March here and 3 April in the United States. The parser reads
  // which one off the file, but when every date falls on the 1st to the 12th
  // nothing can prove it, so the reader is told what was assumed and can flip
  // it. Silently picking one is how a US statement used to come back wrong.
  const flipDateOrder = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'done' || !prev.text) return prev;
      const next = prev.dateOrder?.order === 'mdy' ? 'dmy' : 'mdy';
      const parsed = parseBankExport(prev.text, next);
      if (!parsed.transactions.length) return prev;
      return {
        ...prev, transactions: parsed.transactions,
        skipped: parsed.skipped, dateOrder: parsed.dateOrder,
      };
    });
  }, []);

  const onFile = useCallback((file) => {
    if (!file) return;
    setState({ phase: 'reading' });
    const reader = new FileReader();
    reader.onload = () => {
      try { runOn(decodeBankFile(reader.result), 'file'); }
      catch { setState({ phase: 'error', error: 'columns' }); }
    };
    reader.onerror = () => setState({ phase: 'error', error: 'columns' });
    reader.readAsArrayBuffer(file);
  }, [runOn]);

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    onFile(e.dataTransfer?.files?.[0]);
  };

  const reset = () => { setState({ phase: 'idle' }); setVerdicts({}); if (inputRef.current) inputRef.current.value = ''; };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <PublicNav t={t} right={<Link to="/experts-comptables" className="hidden sm:inline text-slate-300 hover:text-white transition-colors">{t('audit_nav_accountants')}</Link>} />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 mb-6">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{t('audit_badge')}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
            {t('audit_title_1')} <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">{t('audit_title_2')}</span>
          </h1>
          <p className="text-xl text-slate-400 leading-relaxed max-w-2xl">{t('audit_sub')}</p>
        </div>

        {state.phase !== 'done' && (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${dragging ? 'border-blue-400 bg-blue-500/10' : 'border-slate-700 bg-slate-900/50'}`}
            >
              <FileSpreadsheet className="w-10 h-10 mx-auto text-blue-400 mb-4" />
              <div className="text-lg font-semibold mb-1">{t('audit_drop_title')}</div>
              <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">{t('audit_drop_sub')}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={() => inputRef.current?.click()} disabled={state.phase === 'reading'}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600 font-semibold text-sm transition-colors">
                  <Upload className="w-4 h-4" /> {state.phase === 'reading' ? t('audit_parsing') : t('audit_choose_file')}
                </button>
                <button onClick={() => runOn(sampleBankExport(), 'sample')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-sm text-slate-200 transition-colors">
                  <Eye className="w-4 h-4" /> {t('audit_try_sample')}
                </button>
              </div>
              <input ref={inputRef} type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])} />
            </div>

            {state.phase === 'error' && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-200">{state.error === 'empty' ? t('audit_err_empty') : t('audit_err_columns')}</p>
              </div>
            )}

            <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 flex gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-emerald-200 text-sm">{t('audit_privacy_title')}</div>
                <p className="text-sm text-emerald-200/70 mt-1">{t('audit_privacy_body')}</p>
              </div>
            </div>
          </>
        )}

        {state.phase === 'done' && report && <Report report={report} symbol={state.symbol} t={t} onReset={reset} language={language}
          skipped={state.skipped} dateOrder={state.dateOrder} onFlipDateOrder={flipDateOrder}
          verdicts={verdicts} setVerdict={setVerdict} />}
      </div>
    </div>
  );
}

// Module-scope on purpose: a component defined inside another's render is
// re-created every render, which remounts it and trips
// react-hooks/static-components.
function Kpi({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${accent || 'text-white'}`}>{value}</div>
    </div>
  );
}

function Finding({ icon: Icon, title, sub, items, render }) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-start gap-3 mb-3">
        <Icon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-xs text-slate-500">{sub}</div>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">{items.map((it, i) => <li key={i} className="flex justify-between gap-4 text-slate-300">{render(it)}</li>)}</ul>
    </div>
  );
}

// A static map rather than a key built by string concatenation: the
// translation-key scanner reads t() calls statically, and a partial key
// looks like a missing one.
const CADENCE_KEY = {
  monthly: 'audit_cadence_monthly', annual: 'audit_cadence_annual', quarterly: 'audit_cadence_quarterly',
  weekly: 'audit_cadence_weekly', irregular: 'audit_cadence_irregular', single: 'audit_cadence_single',
};

// The label under each review action. Static keys for the translation-key
// scanner, as with CADENCE_KEY.
const REVIEWED_KEY = {
  confirmed: 'audit_review_confirmed', renamed: 'audit_review_renamed',
  added: 'audit_review_added', rejected: 'audit_review_rejected',
};

// One line's review controls. Unreviewed: Correct / Not software / Rename.
// Reviewed: what the reader said, and Undo.
function ReviewCell({ row, t, onVerdict, onRename }) {
  const btn = 'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors';
  if (row.reviewed) {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className={`text-[11px] font-semibold ${row.reviewed === 'rejected' ? 'text-red-300' : 'text-emerald-300'}`}>
          {t(REVIEWED_KEY[row.reviewed])}
        </span>
        <button onClick={() => onVerdict(null)} className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-300`}>
          <Undo2 className="w-3 h-3" /> {t('audit_review_undo')}
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-end gap-1.5 flex-wrap">
      <button onClick={() => onVerdict({ kind: 'confirm' })} className={`${btn} bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300`}>
        <Check className="w-3 h-3" /> {t('audit_review_ok')}
      </button>
      <button onClick={() => onVerdict({ kind: 'reject' })} className={`${btn} bg-red-500/10 hover:bg-red-500/20 text-red-300`}>
        <X className="w-3 h-3" /> {t('audit_review_no')}
      </button>
      <button onClick={onRename} className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-300`}>
        <Pencil className="w-3 h-3" /> {t('audit_review_rename')}
      </button>
    </div>
  );
}

function RenameField({ initial, t, onSave, onCancel }) {
  const [name, setName] = useState(initial || '');
  return (
    <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name.trim()); }}>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('audit_review_name_ph')}
        aria-label={t('audit_review_name_ph')}
        className="h-8 w-40 rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
      <button type="submit" disabled={!name.trim()} className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-[11px] font-semibold">{t('audit_review_save')}</button>
      <button type="button" onClick={onCancel} className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300">{t('audit_review_cancel')}</button>
    </form>
  );
}

function Report({ report, symbol, t, onReset, language, skipped, dateOrder, onFlipDateOrder, verdicts, setVerdict }) {
  const money = useCallback((n) => symbol + Number(n ?? 0).toLocaleString(language, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), [symbol, language]);
  const date = (d) => d instanceof Date ? d.toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const f = report.findings;
  const flagged = f.duplicates.length + f.multiPerMonth.length + f.priceIncreases.length + f.upcomingAnnual.length + f.forgotten.length;
  const [showOther, setShowOther] = useState(false);
  const [copied, setCopied] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [showClientReport, setShowClientReport] = useState(false);

  const counts = reviewCounts(verdicts);
  const reviewed = counts.confirmed + counts.rejected + counts.renamed + counts.added;
  const corrections = counts.rejected + counts.renamed + counts.added;

  // Rejected lines stay in the table, struck through, so the reader can undo.
  const rows = useMemo(
    () => [...report.subscriptions, ...report.rejected]
      .sort((a, b) => (b.monthlyEquivalent ?? 0) - (a.monthlyEquivalent ?? 0)),
    [report],
  );
  const others = report.otherRecurring.filter((o) => o.reviewed !== 'rejected');

  const saveName = (key, name) => {
    // Naming a line the reader added keeps it an addition; naming one the
    // engine found is a correction of the vendor.
    setVerdict(key, verdicts[key]?.kind === 'add' ? { kind: 'add', name } : { kind: 'rename', name });
    setRenaming(null);
  };

  const csv = useMemo(() => reportToCsv(report), [report]);
  const download = () => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'stacklens-saas-audit.csv'; a.click();
    URL.revokeObjectURL(url);
    track('audit_download');
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(csv); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: the download still works */ }
  };
  // The corrections leave only as an email the reader writes: their own mail
  // app opens with the labels listed, and nothing goes unless they press send.
  // Analytics gets the counts, as everywhere on this page.
  const emailCorrections = () => {
    const { href } = correctionsMailto(verdicts, { intro: t('audit_send_intro') });
    track('audit_review_sent', counts);
    window.location.href = href;
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between gap-4 mb-2">
          <h2 className="text-2xl font-bold">{t('audit_result_title')}</h2>
          <button onClick={onReset} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"><RefreshCw className="w-4 h-4" /> {t('audit_reset')}</button>
        </div>
        <p className="text-sm text-slate-500">{fill(t('audit_span'), { n: report.transactionCount, days: report.spanDays, date: date(report.asOf) })}</p>

        {/* How the dates were read, and how many lines did not parse. Both
            used to be invisible: a US export lost every row past the 12th
            into the skipped count and had the rest silently transposed. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>
            {/* Two separate calls, not one key built from an expression:
                translation-keys.test.js scans statically for quoted keys and
                reads a computed one as missing. */}
            {dateOrder?.order === 'mdy' ? t('audit_dates_mdy') : t('audit_dates_dmy')}
            {dateOrder?.evidence !== 'proven' && <span className="text-amber-400/80"> · {t('audit_dates_guess')}</span>}
          </span>
          <button onClick={onFlipDateOrder} className="underline decoration-dotted hover:text-slate-300 transition-colors">
            {t('audit_dates_flip')}
          </button>
          {skipped > 0 && <span>· {fill(t('audit_skipped'), { n: skipped })}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label={t('audit_kpi_monthly')} value={money(report.totals.monthlySaas)} accent="text-blue-300" />
        <Kpi label={t('audit_kpi_annual')} value={money(report.totals.annualisedSaas)} />
        <Kpi label={t('audit_kpi_subs')} value={report.totals.subscriptionCount} />
        <Kpi label={t('audit_kpi_known')} value={report.totals.knownVendors} />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">{t('audit_findings_title')}</h3>
        {flagged === 0 ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 flex gap-3 text-sm text-emerald-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> {t('audit_none')}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            <Finding icon={Layers} title={t('audit_f_duplicates')} sub={t('audit_f_duplicates_sub')} items={f.duplicates}
              render={(d) => <><span>{d.vendor} · {d.lines}×</span><span className="text-slate-400">{money(d.monthlyEquivalent)}{t('audit_per_mo')}</span></>} />
            <Finding icon={Layers} title={t('audit_f_multi')} sub={t('audit_f_multi_sub')} items={f.multiPerMonth}
              render={(d) => <><span>{d.vendor}</span><span className="text-slate-400">{money(d.monthlyEquivalent)}{t('audit_per_mo')}</span></>} />
            <Finding icon={TrendingUp} title={t('audit_f_price')} sub={t('audit_f_price_sub')} items={f.priceIncreases}
              render={(p) => <><span>{p.vendor}</span><span className="text-slate-400">{money(p.from)} → {money(p.to)} (+{p.pct}%)</span></>} />
            <Finding icon={CalendarClock} title={t('audit_f_upcoming')} sub={t('audit_f_upcoming_sub')} items={f.upcomingAnnual}
              render={(u) => <><span>{u.vendor} · {date(u.renewsOn)}</span><span className="text-slate-400">{money(u.amount)}</span></>} />
            <Finding icon={Eye} title={t('audit_f_forgotten')} sub={fill(t('audit_f_forgotten_sub'), { amount: money(30) })} items={f.forgotten}
              render={(g) => <><span>{g.vendor} · {g.charges}×</span><span className="text-slate-400">{money(g.monthlyEquivalent)}{t('audit_per_mo')}</span></>} />
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
          <h3 className="text-lg font-semibold">{t('audit_subs_title')}</h3>
          <div className="flex gap-2 flex-wrap">
            <button onClick={copy} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors">
              <Copy className="w-3.5 h-3.5" /> {copied ? t('audit_copied') : t('audit_copy')}
            </button>
            <button onClick={download} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors">
              <Download className="w-3.5 h-3.5" /> {t('audit_download')}
            </button>
            <button onClick={() => setShowClientReport(true)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold transition-colors">
              <FileText className="w-3.5 h-3.5" /> {t('audit_report_btn')}
            </button>
          </div>
        </div>

        <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <span className="font-semibold">{t('audit_review_title')}</span>
            <span className="text-slate-400"> — {t('audit_review_hint')}</span>
          </div>
          {reviewed > 0 && <span className="text-xs text-emerald-300 font-semibold">{fill(t('audit_review_done'), { n: reviewed })}</span>}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">{t('audit_col_vendor')}</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">{t('audit_col_cadence')}</th>
                <th className="text-right px-4 py-3">{t('audit_col_per_month')}</th>
                <th className="text-right px-4 py-3 hidden lg:table-cell">{t('audit_col_last')}</th>
                <th className="text-right px-4 py-3">{t('audit_col_review')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((s) => {
                const out = s.reviewed === 'rejected';
                return (
                  <tr key={s.key} className={out ? 'bg-slate-950/40' : 'hover:bg-slate-900/40'}>
                    <td className="px-4 py-3">
                      {renaming === s.key ? (
                        <RenameField initial={s.vendor} t={t} onSave={(name) => saveName(s.key, name)} onCancel={() => setRenaming(null)} />
                      ) : (
                        <>
                          <div className={`font-medium ${out ? 'line-through text-slate-500' : ''}`}>{s.vendor}</div>
                          <div className="text-[11px] text-slate-500">{s.category} · {s.key}</div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{t(CADENCE_KEY[s.cadence] || 'audit_cadence_irregular')} · {s.charges}×</td>
                    <td className={`px-4 py-3 text-right font-medium ${out ? 'line-through text-slate-500' : ''}`}>{s.monthlyEquivalent == null ? '—' : money(s.monthlyEquivalent)}</td>
                    <td className="px-4 py-3 text-right text-slate-500 hidden lg:table-cell">{date(s.last)}</td>
                    <td className="px-4 py-3">
                      <ReviewCell row={s} t={t} onVerdict={(v) => setVerdict(s.key, v)} onRename={() => setRenaming(s.key)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {others.length > 0 && (
          <div className="mt-3">
            <button onClick={() => setShowOther(v => !v)} className="text-sm text-slate-400 hover:text-white transition-colors">
              {showOther ? '▾' : '▸'} {fill(t('audit_other_title'), { n: others.length })}
            </button>
            {showOther && (
              <div className="mt-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs text-slate-500 mb-3">{t('audit_other_sub')}</p>
                <ul className="text-sm space-y-1.5">
                  {others.map((o) => (
                    <li key={o.key} className="flex justify-between items-center gap-4 text-slate-400">
                      <span>{o.key}</span>
                      <span className="flex items-center gap-3">
                        <span>{t(CADENCE_KEY[o.cadence] || 'audit_cadence_irregular')} · {o.charges}×</span>
                        {/* The engine's misses: a line it passed over that
                            the reader knows is software. */}
                        <button onClick={() => setVerdict(o.key, { kind: 'add' })}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold transition-colors">
                          <Check className="w-3 h-3" /> {t('audit_review_add')}
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <p className="text-xs text-slate-500 mt-4">{t('audit_disclaimer')}</p>
      </div>

      {corrections > 0 && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <Mail className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-emerald-200 text-sm">{t('audit_send_title')}</div>
            <p className="text-sm text-emerald-200/70 mt-1">{t('audit_send_body')}</p>
          </div>
          <button onClick={emailCorrections} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold shrink-0 transition-colors">
            <Mail className="w-4 h-4" /> {t('audit_send_btn')}
          </button>
        </div>
      )}

      {showClientReport && (
        <ClientReportPanel report={report} money={money} language={language} t={t} onClose={() => setShowClientReport(false)} counts={counts} />
      )}

      <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 p-6 md:p-8">
        <h3 className="text-xl md:text-2xl font-bold mb-2">{t('audit_cta_title')}</h3>
        <p className="text-slate-300 mb-6 max-w-xl">{t('audit_cta_body')}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link to="/experts-comptables" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-sm transition-colors">
            {t('audit_cta_accountants')} <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/?signup=true" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-sm text-slate-200 transition-colors">
            {t('audit_cta_signup')}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── The client report ───────────────────────────────────────────────────────
//
// What an accountant actually hands a client: one printable page with the
// firm's name on it. It is printed by the browser ("Save as PDF"), so no PDF
// library, no upload and no server: the report is rendered into a node on
// <body> and the print stylesheet in index.css shows only that node while the
// body carries .printing-report. The firm and client names live in this
// component's state and nowhere else.

function ClientReportPanel({ report, money, language, t, onClose, counts }) {
  const [firm, setFirm] = useState('');
  const [client, setClient] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    document.body.classList.add('printing-report');
    return () => document.body.classList.remove('printing-report');
  }, []);

  const print = () => {
    track('audit_print', counts);
    window.print();
  };

  const field = 'w-full h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40';
  const doc = <PrintReport report={report} money={money} language={language} t={t} firm={firm} client={client} note={note} />;

  return (
    <div className="rounded-2xl border border-blue-500/30 bg-slate-900/60 p-5 md:p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold">{t('audit_report_panel_title')}</h3>
          <p className="text-sm text-slate-400 mt-1">{t('audit_report_panel_sub')}</p>
        </div>
        <button onClick={onClose} className="text-sm text-slate-400 hover:text-white transition-colors">{t('audit_report_close')}</button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <label className="text-xs text-slate-400">{t('audit_report_firm')}
          <input value={firm} onChange={(e) => setFirm(e.target.value)} className={field + ' mt-1'} />
        </label>
        <label className="text-xs text-slate-400">{t('audit_report_client')}
          <input value={client} onChange={(e) => setClient(e.target.value)} className={field + ' mt-1'} />
        </label>
      </div>
      <label className="block text-xs text-slate-400 mb-4">{t('audit_report_note')}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
      </label>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <button onClick={print} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-semibold transition-colors">
          <Printer className="w-4 h-4" /> {t('audit_report_print')}
        </button>
        <span className="text-xs text-slate-500">{t('audit_report_print_hint')}</span>
      </div>
      {/* The on-screen preview is the same component the printer gets. */}
      <div className="rounded-xl overflow-hidden border border-slate-700 max-h-[32rem] overflow-y-auto">{doc}</div>
      {createPortal(<div id="print-report">{doc}</div>, document.body)}
    </div>
  );
}

// A white page, dark type. The screen palette's greys are tuned for a dark
// background (design-tokens.test.js); on paper they would be too faint, so
// this surface uses gray-600 and darker, which read at 7:1 or better on white.
export function PrintReport({ report, money, language, t, firm, client, note }) {
  const f = report.findings;
  const date = (d) => d instanceof Date ? d.toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const checks = [
    ...f.duplicates.map((d) => [t('audit_f_duplicates'), `${d.vendor} · ${d.lines}×`, `${money(d.monthlyEquivalent)}${t('audit_per_mo')}`]),
    ...f.multiPerMonth.map((d) => [t('audit_f_multi'), d.vendor, `${money(d.monthlyEquivalent)}${t('audit_per_mo')}`]),
    ...f.priceIncreases.map((p) => [t('audit_f_price'), p.vendor, `${money(p.from)} → ${money(p.to)} (+${p.pct}%)`]),
    ...f.upcomingAnnual.map((u) => [t('audit_f_upcoming'), `${u.vendor} · ${date(u.renewsOn)}`, money(u.amount)]),
    ...f.forgotten.map((g) => [t('audit_f_forgotten'), `${g.vendor} · ${g.charges}×`, `${money(g.monthlyEquivalent)}${t('audit_per_mo')}`]),
  ];
  return (
    <div className="bg-white text-gray-900 p-8 text-sm leading-relaxed" data-testid="print-report">
      <div className="flex items-start justify-between gap-6 border-b border-gray-300 pb-4 mb-5">
        <div>
          {firm && <div className="text-xl font-bold">{firm}</div>}
          <div className={firm ? 'text-base font-semibold text-gray-700 mt-1' : 'text-xl font-bold'}>{t('audit_report_heading')}</div>
          {client && <div className="text-gray-700">{fill(t('audit_report_for'), { client })}</div>}
        </div>
        <div className="text-right text-gray-600 text-xs shrink-0">{date(new Date())}</div>
      </div>
      <p className="text-gray-600 text-xs mb-4">{fill(t('audit_report_period'), { days: report.spanDays, date: date(report.asOf) })}</p>
      {note && <p className="mb-5 border-l-4 border-gray-300 pl-3 whitespace-pre-line">{note}</p>}

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[[t('audit_kpi_monthly'), money(report.totals.monthlySaas)], [t('audit_kpi_annual'), money(report.totals.annualisedSaas)], [t('audit_kpi_subs'), report.totals.subscriptionCount]].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-gray-300 p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-600">{label}</div>
            <div className="text-lg font-bold">{value}</div>
          </div>
        ))}
      </div>

      <h4 className="font-bold mb-2">{t('audit_report_to_check')}</h4>
      {checks.length === 0 ? (
        <p className="mb-6 text-gray-700">{t('audit_none')}</p>
      ) : (
        <table className="w-full mb-6 text-xs">
          <tbody>
            {checks.map(([kind, what, value], i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-1.5 pr-3 text-gray-600">{kind}</td>
                <td className="py-1.5 pr-3 font-medium">{what}</td>
                <td className="py-1.5 text-right">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h4 className="font-bold mb-2">{t('audit_report_list')}</h4>
      <table className="w-full text-xs mb-3">
        <thead>
          <tr className="border-b border-gray-400 text-gray-600 text-left">
            <th className="py-1.5 pr-3 font-semibold">{t('audit_col_vendor')}</th>
            <th className="py-1.5 pr-3 font-semibold">{t('audit_col_cadence')}</th>
            <th className="py-1.5 pr-3 font-semibold text-right">{t('audit_col_per_month')}</th>
            <th className="py-1.5 font-semibold text-right">{t('audit_col_last')}</th>
          </tr>
        </thead>
        <tbody>
          {report.subscriptions.map((s) => (
            <tr key={s.key} className="border-b border-gray-200">
              <td className="py-1.5 pr-3 font-medium">{s.vendor}</td>
              <td className="py-1.5 pr-3 text-gray-700">{t(CADENCE_KEY[s.cadence] || 'audit_cadence_irregular')}</td>
              <td className="py-1.5 pr-3 text-right">{s.monthlyEquivalent == null ? '—' : money(s.monthlyEquivalent)}</td>
              <td className="py-1.5 text-right text-gray-700">{date(s.last)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {report.rejected.length > 0 && (
        <p className="text-xs text-gray-600 mb-3">{fill(t('audit_report_excluded'), { n: report.rejected.length })}</p>
      )}
      <p className="text-[10px] text-gray-600 border-t border-gray-300 pt-3 mt-6">{t('audit_report_footer')}</p>
    </div>
  );
}
