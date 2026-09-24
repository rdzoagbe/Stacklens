import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload, ShieldCheck, Download, Copy, TrendingUp, CalendarClock, Eye, Layers,
  ArrowRight, RefreshCw, FileSpreadsheet, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { PublicNav } from '../components/PublicNav';
import { track } from '../lib/analytics';
import { decodeBankFile, parseBankExport, auditSaas, reportToCsv, sampleBankExport } from '../lib/saasAudit';

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
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const runOn = useCallback((text, source, forceOrder) => {
    const parsed = parseBankExport(text, forceOrder);
    if (!parsed.columns) { setState({ phase: 'error', error: 'columns' }); return; }
    if (!parsed.transactions.length) { setState({ phase: 'error', error: 'empty' }); return; }
    const report = auditSaas(parsed.transactions);
    // Counts only. Never a label, never an amount, never the file.
    track('audit_run', { source, transactions: parsed.transactions.length, subscriptions: report.totals.subscriptionCount });
    setState({
      phase: 'done', report, symbol: detectSymbol(text),
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
        ...prev, report: auditSaas(parsed.transactions),
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

  const reset = () => { setState({ phase: 'idle' }); if (inputRef.current) inputRef.current.value = ''; };

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

        {state.phase === 'done' && <Report report={state.report} symbol={state.symbol} t={t} onReset={reset} language={language}
          skipped={state.skipped} dateOrder={state.dateOrder} onFlipDateOrder={flipDateOrder} />}
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

function Report({ report, symbol, t, onReset, language, skipped, dateOrder, onFlipDateOrder }) {
  const money = useCallback((n) => symbol + Number(n ?? 0).toLocaleString(language, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), [symbol, language]);
  const date = (d) => d instanceof Date ? d.toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const f = report.findings;
  const flagged = f.duplicates.length + f.multiPerMonth.length + f.priceIncreases.length + f.upcomingAnnual.length + f.forgotten.length;
  const [showOther, setShowOther] = useState(false);
  const [copied, setCopied] = useState(false);

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
              render={(d) => <><span>{d.vendor} · {d.lines}×</span><span className="text-slate-400">{money(d.monthlyEquivalent)}/mo</span></>} />
            <Finding icon={Layers} title={t('audit_f_multi')} sub={t('audit_f_multi_sub')} items={f.multiPerMonth}
              render={(d) => <><span>{d.vendor}</span><span className="text-slate-400">{money(d.monthlyEquivalent)}/mo</span></>} />
            <Finding icon={TrendingUp} title={t('audit_f_price')} sub={t('audit_f_price_sub')} items={f.priceIncreases}
              render={(p) => <><span>{p.vendor}</span><span className="text-slate-400">{money(p.from)} → {money(p.to)} (+{p.pct}%)</span></>} />
            <Finding icon={CalendarClock} title={t('audit_f_upcoming')} sub={t('audit_f_upcoming_sub')} items={f.upcomingAnnual}
              render={(u) => <><span>{u.vendor} · {date(u.renewsOn)}</span><span className="text-slate-400">{money(u.amount)}</span></>} />
            <Finding icon={Eye} title={t('audit_f_forgotten')} sub={fill(t('audit_f_forgotten_sub'), { amount: money(30) })} items={f.forgotten}
              render={(g) => <><span>{g.vendor} · {g.charges}×</span><span className="text-slate-400">{money(g.monthlyEquivalent)}/mo</span></>} />
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-4 mb-3">
          <h3 className="text-lg font-semibold">{t('audit_subs_title')}</h3>
          <div className="flex gap-2">
            <button onClick={copy} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors">
              <Copy className="w-3.5 h-3.5" /> {copied ? t('audit_copied') : t('audit_copy')}
            </button>
            <button onClick={download} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold transition-colors">
              <Download className="w-3.5 h-3.5" /> {t('audit_download')}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">{t('audit_col_vendor')}</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">{t('audit_col_category')}</th>
                <th className="text-left px-4 py-3">{t('audit_col_cadence')}</th>
                <th className="text-right px-4 py-3">{t('audit_col_charges')}</th>
                <th className="text-right px-4 py-3">{t('audit_col_per_month')}</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">{t('audit_col_last')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {report.subscriptions.map((s) => (
                <tr key={s.key} className="hover:bg-slate-900/40">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.vendor}</div>
                    {s.confidence !== 'known' && <div className="text-[11px] text-slate-500">{s.key}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{s.category}</td>
                  <td className="px-4 py-3 text-slate-400">{t(CADENCE_KEY[s.cadence] || 'audit_cadence_irregular')}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{s.charges}</td>
                  <td className="px-4 py-3 text-right font-medium">{s.monthlyEquivalent == null ? '—' : money(s.monthlyEquivalent)}</td>
                  <td className="px-4 py-3 text-right text-slate-500 hidden md:table-cell">{date(s.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.otherRecurring.length > 0 && (
          <div className="mt-3">
            <button onClick={() => setShowOther(v => !v)} className="text-sm text-slate-400 hover:text-white transition-colors">
              {showOther ? '▾' : '▸'} {fill(t('audit_other_title'), { n: report.otherRecurring.length })}
            </button>
            {showOther && (
              <div className="mt-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs text-slate-500 mb-3">{t('audit_other_sub')}</p>
                <ul className="text-sm space-y-1">
                  {report.otherRecurring.map((o) => (
                    <li key={o.key} className="flex justify-between gap-4 text-slate-400"><span>{o.key}</span><span>{t(CADENCE_KEY[o.cadence] || 'audit_cadence_irregular')} · {o.charges}×</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <p className="text-xs text-slate-500 mt-4">{t('audit_disclaimer')}</p>
      </div>

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
