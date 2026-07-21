import React, { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Upload, FileText, TrendingUp, AlertTriangle, CheckCircle2, X, Printer, FileSpreadsheet } from 'lucide-react';
import { downloadText } from '../../lib/dataUtils';
import { buildBudgetCsv, buildBudgetPdfBlob, buildBudgetXlsxBlob, downloadBlob } from '../../lib/budget-report';
import { useDbQuery, useDbMutations } from '../../hooks/useDbQuery';
import { useLang } from '../../contexts/LangContext';
import { useTranslation } from '../../translations';
import { getCurrency, convertCurrency } from '../../lib/currency';
import { callAI, invoiceInboxAddress, invoiceInboxList, invoiceInboxAck, bankInstitutions, bankConnect, bankStatus, bankSync } from '../../firebase-config';
import { Landmark } from 'lucide-react';
import { UNALLOCATED, allocateSpendByDepartment, parseBudgetCsv, monthlyAmountFromInvoice } from '../../lib/budget';

function yearElapsedFraction(year) {
  const now = new Date();
  if (year < now.getFullYear()) return 1;
  if (year > now.getFullYear()) return 0;
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  return (now - start) / (end - start);
}

const INVOICE_PROMPT_HEAD = `You are an invoice data extractor. Below are one or more supplier invoices (raw text). For EACH invoice, extract the fields and return ONLY a JSON array (no markdown, no commentary):
[{"file_index": 1, "vendor": "supplier name", "amount": 123.45, "currency": "EUR", "invoice_date": "YYYY-MM-DD", "period_start": "YYYY-MM-DD or null", "period_end": "YYYY-MM-DD or null", "billing_cycle": "monthly" | "yearly" | "quarterly" | "one_time"}]
Rules: amount is the total including tax. billing_cycle is your best inference from the service period or wording (a 12-month period = yearly). Use null when a field is not present. vendor is the company SELLING the service.`;

export function BudgetTabContent() {
  const { data: db } = useDbQuery();
  const { setBudgets, importInvoices } = useDbMutations();
  const { language } = useLang();
  const t = useTranslation(language);
  const cur = (n) => getCurrency(language) + Math.round(convertCurrency(n, language)).toLocaleString();
  const fileRef = useRef(null);
  const invoiceRef = useRef(null);

  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState(nowYear);
  const [drafts, setDrafts] = useState({}); // department -> input string while editing

  // Invoice import modal state
  const [importState, setImportState] = useState(null); // null | {phase:'working',done,total} | {phase:'review',rows,errors,inboxIds?}

  // Email-in inbox: unique address + invoices that arrived by email
  const [inboxAddress, setInboxAddress] = useState('');
  const [inboxItems, setInboxItems] = useState([]);
  React.useEffect(() => {
    let alive = true;
    invoiceInboxAddress().then(r => { if (alive) setInboxAddress(r.address || ''); }).catch(() => {});
    invoiceInboxList().then(r => { if (alive) setInboxItems(r.items || []); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Bank feed: connection status + institution picker + recurring-charge sync
  const [bank, setBank] = useState({ checked: false, connected: false });
  const [bankPicker, setBankPicker] = useState(null); // null | {list, q, loading}
  React.useEffect(() => {
    let alive = true;
    bankStatus().then(r => { if (alive) setBank({ checked: true, connected: !!r.connected }); })
      .catch(() => { if (alive) setBank({ checked: true, connected: false }); });
    return () => { alive = false; };
  }, []);

  const openBankPicker = async () => {
    setBankPicker({ list: [], q: '', loading: true });
    try {
      const { institutions } = await bankInstitutions('FR');
      setBankPicker({ list: institutions || [], q: '', loading: false });
    } catch (err) {
      setBankPicker(null);
      toast.error(err.message || t('bank_failed'));
    }
  };
  const startBankConnect = async (institutionId) => {
    try {
      const { link } = await bankConnect(institutionId);
      window.location.assign(link); // GoCardless-hosted bank authorization
    } catch (err) { toast.error(err.message || t('bank_failed')); }
  };
  const runBankSync = async () => {
    setImportState({ phase: 'working', done: 0, total: 1 });
    try {
      const { candidates } = await bankSync();
      setImportState({
        phase: 'review', errors: [],
        rows: (candidates || []).map(c => ({ ...c, file: `${c.occurrences}× ${t('bank_seen')}`, include: true })),
      });
    } catch (err) {
      setImportState(null);
      toast.error(err.message || t('bank_failed'));
    }
  };

  const reviewInboxItems = () => {
    setImportState({
      phase: 'review',
      errors: [],
      inboxIds: inboxItems.map(i => i.id),
      rows: inboxItems.map(i => ({ ...i, monthly: monthlyAmountFromInvoice(i), include: true })),
    });
  };

  const budgets = useMemo(() => (db?.budgets || []).filter(b => b.year === year), [db, year]);
  // All department keys are matched case-insensitively — "Sales" from an
  // import and "sales" typed by hand are the same department.
  const budgetByDept = useMemo(() => Object.fromEntries(budgets.map(b => [(b.department || '').toLowerCase(), b.annual])), [budgets]);

  const monthlyByDept = useMemo(
    () => allocateSpendByDepartment({ tools: db?.tools, employees: db?.employees, access: db?.access }),
    [db]
  );

  const departments = useMemo(() => {
    const set = new Set();
    (db?.employees || []).forEach(e => { const d = (e.department || '').trim().toLowerCase(); if (d) set.add(d); });
    Object.keys(monthlyByDept).forEach(d => { if (d !== UNALLOCATED) set.add(d); });
    budgets.forEach(b => { const d = (b.department || '').toLowerCase(); if (d) set.add(d); });
    return Array.from(set).sort((a, b) => (monthlyByDept[b] || 0) - (monthlyByDept[a] || 0));
  }, [db, monthlyByDept, budgets]);

  const elapsed = yearElapsedFraction(year);

  // Monthly snapshots recorded by the Finance shell — past months use the real
  // recorded figure; months without a snapshot fall back to today's run-rate.
  const histByMonth = useMemo(
    () => Object.fromEntries((db?.spend_history || []).map(s => [s.month, s])), [db]);
  const now = new Date();
  const completedMonths = year < now.getFullYear() ? 12 : year > now.getFullYear() ? 0 : now.getMonth();
  const currentMonthFraction = year === now.getFullYear()
    ? (now.getDate() - 1) / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() : 0;
  const spentToDate = (dept, monthly) => {
    let sum = 0;
    for (let m = 0; m < completedMonths; m++) {
      const snap = histByMonth[`${year}-${String(m + 1).padStart(2, '0')}`];
      sum += snap?.by_department?.[dept] ?? monthly;
    }
    return sum + monthly * currentMonthFraction;
  };

  // Last-12-months actuals from imported invoices → next-year suggestion
  const invoiceActuals12m = useMemo(() => {
    const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 1);
    return (db?.invoice_records || [])
      .filter(r => r.invoice_date && new Date(r.invoice_date) >= cutoff)
      .reduce((s, r) => s + Number(r.amount || 0), 0);
  }, [db]);

  const saveBudget = (department, value) => {
    const annual = Math.round(Number(String(value).replace(/[^0-9.]/g, '')) || 0);
    const others = (db?.budgets || []).filter(b => !(b.year === year && (b.department || '').toLowerCase() === department));
    const next = annual > 0 ? [...others, { year, department, annual }] : others;
    setBudgets.mutate(next);
  };

  const importCsv = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseBudgetCsv(String(reader.result || ''));
      if (!rows.length) { toast.error(t('budget_csv_empty')); return; }
      const imported = new Set(rows.map(r => r.department.toLowerCase()));
      const others = (db?.budgets || []).filter(b =>
        !(b.year === year && imported.has(b.department.toLowerCase())));
      setBudgets.mutate([...others, ...rows.map(r => ({ year, ...r }))]);
      toast.success(`${rows.length} ${t('budget_csv_imported')}`);
    };
    reader.readAsText(file);
  };

  // ── Invoice import: extract text from each PDF, batch through the AI, review, apply ──
  const runInvoiceImport = async (files) => {
    const list = Array.from(files).slice(0, 15);
    if (Array.from(files).length > 15) toast(t('budget_inv_capped'), { icon: '⚡' });
    setImportState({ phase: 'working', done: 0, total: list.length });
    const errors = [];
    const texts = [];
    const { extractContractText } = await import('../ContractComparisonPage');
    for (const f of list) {
      try {
        const text = await extractContractText(f);
        if (text && text.trim().length > 40) texts.push({ name: f.name, text: text.slice(0, 3000) });
        else errors.push(`${f.name}: ${t('budget_inv_no_text')}`);
      } catch {
        errors.push(`${f.name}: ${t('budget_inv_no_text')}`);
      }
      setImportState(s => s?.phase === 'working' ? { ...s, done: s.done + 1 } : s);
    }
    const rows = [];
    for (let i = 0; i < texts.length; i += 5) {
      const batch = texts.slice(i, i + 5);
      const content = INVOICE_PROMPT_HEAD + '\n\n' +
        batch.map((b, j) => `--- INVOICE ${j + 1} (${b.name}) ---\n${b.text}`).join('\n\n');
      try {
        const data = await callAI({ messages: [{ role: 'user', content }], max_tokens: 2000 });
        const raw = (data.content?.[0]?.text || '[]').replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(raw);
        (Array.isArray(parsed) ? parsed : []).forEach(p => {
          const src = batch[(p.file_index || 1) - 1];
          const row = {
            vendor: String(p.vendor || '').trim(),
            amount: Number(p.amount || 0),
            currency: p.currency || 'EUR',
            invoice_date: p.invoice_date || null,
            period_start: p.period_start || null,
            period_end: p.period_end || null,
            billing_cycle: p.billing_cycle || 'one_time',
            file: src?.name || '',
            source: 'invoice',
          };
          row.monthly = monthlyAmountFromInvoice(row);
          if (row.vendor && row.amount > 0) rows.push({ ...row, include: true });
        });
      } catch {
        errors.push(batch.map(b => b.name).join(', ') + ': ' + t('budget_inv_ai_failed'));
      }
    }
    setImportState({ phase: 'review', rows, errors });
  };

  const applyInvoices = () => {
    const selected = (importState?.rows || []).filter(r => r.include).map(({ include: _i, id: _id, ...r }) => r);
    const inboxIds = importState?.inboxIds;
    if (selected.length) {
      importInvoices.mutate(selected, {
        onSuccess: () => toast.success(`${selected.length} ${t('budget_inv_applied')}`),
      });
    }
    // Reviewed email invoices leave the staging inbox whether applied or unticked.
    if (inboxIds?.length) {
      invoiceInboxAck(inboxIds).then(() => setInboxItems([])).catch(() => {});
    }
    setImportState(null);
  };

  const rows = departments.map(dept => {
    const monthly = monthlyByDept[dept] || 0;
    const spentYtd = spentToDate(dept, monthly);
    const projected = monthly * 12;
    const budget = budgetByDept[dept] || 0;
    let status = 'none';
    if (budget > 0) {
      if (projected > budget) status = spentYtd > budget ? 'over' : 'risk';
      else status = 'ok';
    }
    return { dept, monthly, spentYtd, projected, budget, status };
  });
  const totals = rows.reduce((s, r) => ({
    monthly: s.monthly + r.monthly, spentYtd: s.spentYtd + r.spentYtd,
    projected: s.projected + r.projected, budget: s.budget + r.budget,
  }), { monthly: 0, spentYtd: 0, projected: 0, budget: 0 });
  const unallocated = monthlyByDept[UNALLOCATED] || 0;
  const runRateAnnual = (totals.monthly + unallocated) * 12;
  const suggestedNextYear = Math.max(runRateAnnual, invoiceActuals12m);

  const STATUS = {
    ok:   { icon: CheckCircle2,  cls: 'text-emerald-400', label: t('budget_on_track') },
    risk: { icon: TrendingUp,    cls: 'text-amber-400',   label: t('budget_at_risk') },
    over: { icon: AlertTriangle, cls: 'text-red-400',     label: t('budget_over') },
  };

  // ── Board-ready exports ──
  const exportLabels = {
    title: t('budget_report_title'), department: t('budget_department'), annual: t('budget_annual'),
    monthly: t('budget_monthly_burn'), spent: t('budget_spent_ytd'), projected: t('budget_projected'),
    status: t('budget_consumption'), total: t('budget_total'), unallocated: t('budget_unallocated'),
    onTrack: t('budget_on_track'), atRisk: t('budget_at_risk'), over: t('budget_over'),
    runRate: t('budget_run_rate'), actuals: t('budget_actuals_12m'), nextYear: t('budget_next_year'),
    generated: t('budget_report_generated'), method: t('budget_estimate_note'),
  };
  const exportPdf = async () => {
    try {
      const blob = await buildBudgetPdfBlob({
        rows, totals, unallocated, year,
        cards: {
          runRate: cur(runRateAnnual), runRateSub: cur(totals.monthly + unallocated) + '/mo',
          actuals: invoiceActuals12m > 0 ? cur(invoiceActuals12m) : '—', actualsSub: invoiceActuals12m > 0 ? t('budget_from_invoices') : '',
          nextYear: cur(suggestedNextYear), nextYearSub: t('budget_next_year_hint'),
        },
        labels: exportLabels, cur,
        company: db?.user?.company || db?.user?.email || '',
        generatedAt: new Date().toLocaleDateString(language),
      });
      downloadBlob(`stacklens-budget-${year}.pdf`, blob);
    } catch (err) { toast.error(t('budget_export_failed') + ': ' + (err.message || '')); }
  };
  const exportExcel = async () => {
    try {
      const blob = await buildBudgetXlsxBlob({ rows, totals, unallocated, year, labels: exportLabels });
      downloadBlob(`stacklens-budget-${year}.xlsx`, blob);
    } catch {
      // exceljs failed to load (offline, blocked chunk) — fall back to CSV
      downloadText(`stacklens-budget-${year}.csv`,
        buildBudgetCsv({ rows, totals, unallocated, year, labels: exportLabels, sep: language === 'en' ? ',' : ';' }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">{t('budget_title')}</h2>
          <p className="text-sm text-slate-500">{t('budget_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
            {[nowYear - 1, nowYear, nowYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => invoiceRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors">
            <FileText size={15} /> {t('budget_import_invoices')}
          </button>
          <input ref={invoiceRef} type="file" accept=".pdf,.docx,.txt" multiple className="hidden"
            onChange={e => { if (e.target.files?.length) runInvoiceImport(e.target.files); e.target.value = ''; }} />
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
            <Upload size={15} /> {t('budget_import_csv')}
          </button>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ''; }} />
          <button onClick={bank.connected ? runBankSync : openBankPicker} title={t(bank.connected ? 'bank_sync_title' : 'bank_connect_title')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors">
            <Landmark size={15} /> {t(bank.connected ? 'bank_sync_btn' : 'bank_connect_btn')}
          </button>
          <button onClick={exportPdf} title={t('budget_export_pdf')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors">
            <Printer size={15} /> PDF
          </button>
          <button onClick={exportExcel} title={t('budget_export_csv')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors">
            <FileSpreadsheet size={15} /> Excel
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-600">{t('budget_csv_hint')} · {t('budget_estimate_note')}</p>

      {inboxAddress && (
        <p className="text-xs text-slate-500">
          📧 {t('budget_inbox_hint')}{' '}
          <button onClick={() => { navigator.clipboard?.writeText(inboxAddress); toast.success(t('budget_inbox_copied')); }}
            className="font-mono text-indigo-400 hover:text-indigo-300 underline decoration-dotted" title={t('budget_inbox_copy')}>
            {inboxAddress}
          </button>
        </p>
      )}

      {inboxItems.length > 0 && (
        <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-4 flex items-center justify-between gap-3">
          <div className="text-sm text-emerald-300 font-semibold">
            📬 {inboxItems.length} {t('budget_inbox_pending')}
          </div>
          <button onClick={reviewInboxItems}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors shrink-0">
            {t('budget_inbox_review')}
          </button>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{t('budget_run_rate')}</div>
          <div className="text-2xl font-black text-white">{cur(runRateAnnual)}</div>
          <div className="text-xs text-slate-500 mt-0.5">{cur(totals.monthly + unallocated)}/mo</div>
        </div>
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{t('budget_actuals_12m')}</div>
          <div className="text-2xl font-black text-white">{invoiceActuals12m > 0 ? cur(invoiceActuals12m) : '—'}</div>
          <div className="text-xs text-slate-500 mt-0.5">{invoiceActuals12m > 0 ? t('budget_from_invoices') : t('budget_no_invoices_yet')}</div>
        </div>
        <div className="rounded-2xl bg-indigo-500/5 border border-indigo-500/20 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">{t('budget_next_year')}</div>
          <div className="text-2xl font-black text-white">{cur(suggestedNextYear)}</div>
          <div className="text-xs text-slate-500 mt-0.5">{t('budget_next_year_hint')}</div>
        </div>
      </div>

      {departments.length === 0 ? (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-10 text-center text-slate-500 text-sm">
          {t('budget_empty')}
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-4 py-3">{t('budget_department')}</th>
                <th className="px-4 py-3">{t('budget_annual')}</th>
                <th className="px-4 py-3">{t('budget_monthly_burn')}</th>
                <th className="px-4 py-3">{t('budget_spent_ytd')}</th>
                <th className="px-4 py-3">{t('budget_projected')}</th>
                <th className="px-4 py-3 w-52">{t('budget_consumption')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const pct = r.budget > 0 ? Math.min(150, (r.spentYtd / r.budget) * 100) : 0;
                const S = STATUS[r.status];
                return (
                  <tr key={r.dept} className="border-b border-slate-800/60 last:border-0">
                    <td className="px-4 py-3 font-semibold text-white capitalize">{r.dept}</td>
                    <td className="px-4 py-3">
                      <input
                        value={drafts[r.dept] ?? (r.budget || '')}
                        placeholder={t('budget_no_budget')}
                        onChange={e => setDrafts(d => ({ ...d, [r.dept]: e.target.value }))}
                        onBlur={e => {
                          if (drafts[r.dept] === undefined) return;
                          saveBudget(r.dept, e.target.value);
                          setDrafts(d => { const n = { ...d }; delete n[r.dept]; return n; });
                        }}
                        className="w-28 bg-slate-800/70 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-sm placeholder:text-slate-600"
                        inputMode="numeric" />
                    </td>
                    <td className="px-4 py-3 text-slate-300">{cur(r.monthly)}</td>
                    <td className="px-4 py-3 text-slate-300">{cur(r.spentYtd)}</td>
                    <td className="px-4 py-3 text-slate-300">{cur(r.projected)}</td>
                    <td className="px-4 py-3">
                      {r.budget > 0 ? (
                        <div>
                          <div className="relative h-2.5 rounded-full bg-slate-800 overflow-hidden">
                            <div className={"h-full rounded-full " + (r.status === 'over' ? 'bg-red-500' : r.status === 'risk' ? 'bg-amber-500' : 'bg-emerald-500')}
                              style={{ width: Math.min(100, pct) + '%' }} />
                            {/* marker: where spend "should" be if consumed linearly */}
                            <div className="absolute top-0 h-full w-0.5 bg-white/60" style={{ left: (elapsed * 100) + '%' }} />
                          </div>
                          {S && <div className={"flex items-center gap-1 mt-1 text-xs font-semibold " + S.cls}><S.icon size={12} /> {S.label} · {Math.round((r.spentYtd / r.budget) * 100)}%</div>}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">{t('budget_no_budget')}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-slate-800/40 font-bold text-white">
                <td className="px-4 py-3">{t('budget_total')}</td>
                <td className="px-4 py-3">{totals.budget > 0 ? cur(totals.budget) : '—'}</td>
                <td className="px-4 py-3">{cur(totals.monthly)}</td>
                <td className="px-4 py-3">{cur(totals.spentYtd)}</td>
                <td className="px-4 py-3">{cur(totals.projected)}</td>
                <td className="px-4 py-3" />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {unallocated > 0 && (
        <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-amber-300">{t('budget_unallocated')}: {cur(unallocated)}/mo</span>
            <span className="text-slate-400"> — {t('budget_unallocated_hint')}</span>
          </div>
        </div>
      )}

      {bankPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setBankPicker(null)}>
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-1">{t('bank_pick_title')}</h3>
            <p className="text-xs text-slate-500 mb-3">{t('bank_pick_sub')}</p>
            {bankPicker.loading ? (
              <div className="py-10 text-center"><div className="w-7 h-7 mx-auto border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <>
                <input autoFocus value={bankPicker.q} onChange={e => setBankPicker(s => ({ ...s, q: e.target.value }))}
                  placeholder={t('bank_search')} className="mb-3 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
                <div className="overflow-y-auto space-y-1 pr-1">
                  {bankPicker.list
                    .filter(i => i.name.toLowerCase().includes(bankPicker.q.toLowerCase()))
                    .slice(0, 40)
                    .map(i => (
                      <button key={i.id} onClick={() => startBankConnect(i.id)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/40 hover:bg-slate-800 border border-slate-800 text-left transition-colors">
                        {i.logo && <img src={i.logo} alt="" className="w-6 h-6 rounded" />}
                        <span className="text-sm font-semibold text-white truncate">{i.name}</span>
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {importState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">{t('budget_import_invoices')}</h3>
              <button onClick={() => setImportState(null)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            {importState.phase === 'working' ? (
              <div className="py-10 text-center">
                <div className="w-8 h-8 mx-auto mb-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-sm text-slate-400">{t('budget_inv_working')} {importState.done}/{importState.total}</div>
              </div>
            ) : (
              <div>
                {importState.errors.length > 0 && (
                  <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-300 space-y-1">
                    {importState.errors.map((e, i) => <div key={i}>{e}</div>)}
                  </div>
                )}
                {importState.rows.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">{t('budget_inv_none')}</div>
                ) : (
                  <table className="w-full text-sm mb-4">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
                        <th className="px-2 py-2" />
                        <th className="px-2 py-2">{t('budget_inv_vendor')}</th>
                        <th className="px-2 py-2">{t('budget_inv_amount')}</th>
                        <th className="px-2 py-2">{t('budget_inv_cycle')}</th>
                        <th className="px-2 py-2">{t('budget_inv_monthly')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importState.rows.map((r, i) => (
                        <tr key={i} className="border-b border-slate-800/60 last:border-0">
                          <td className="px-2 py-2">
                            <input type="checkbox" checked={r.include} className="accent-emerald-500"
                              onChange={e => setImportState(s => ({ ...s, rows: s.rows.map((x, j) => j === i ? { ...x, include: e.target.checked } : x) }))} />
                          </td>
                          <td className="px-2 py-2 text-white font-semibold">{r.vendor}<div className="text-xs text-slate-600 font-normal">{r.file}{r.invoice_date ? ` · ${r.invoice_date}` : ''}</div></td>
                          <td className="px-2 py-2 text-slate-300">{r.amount.toLocaleString()} {r.currency}</td>
                          <td className="px-2 py-2 text-slate-400">{r.billing_cycle}</td>
                          <td className="px-2 py-2 text-slate-300">{r.monthly > 0 ? cur(r.monthly) + '/mo' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setImportState(null)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700">{t('cancel')}</button>
                  {importState.rows.length > 0 && (
                    <button onClick={applyInvoices}
                      className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500">
                      {t('budget_inv_apply')} ({importState.rows.filter(r => r.include).length})
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
