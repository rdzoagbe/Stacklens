import React, { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Upload, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useDbQuery, useDbMutations } from '../../hooks/useDbQuery';
import { useLang } from '../../contexts/LangContext';
import { useTranslation } from '../../translations';
import { getCurrency, convertCurrency } from '../../lib/currency';

const UNALLOCATED = '__unallocated__';

// Seat-weighted cost allocation: each active tool's monthly cost is split
// across departments in proportion to how many of its active seats belong to
// each department. Tools with no active seats land in the Unallocated bucket.
export function allocateSpendByDepartment({ tools = [], employees = [], access = [] }) {
  const empDept = {};
  employees.forEach(e => { empDept[e.id] = (e.department || '').trim() || 'other'; });

  const seatsByTool = {};
  access.filter(a => a.status === 'active').forEach(a => {
    const dept = empDept[a.employee_id];
    if (!dept) return;
    if (!seatsByTool[a.tool_id]) seatsByTool[a.tool_id] = {};
    seatsByTool[a.tool_id][dept] = (seatsByTool[a.tool_id][dept] || 0) + 1;
  });

  const monthlyByDept = {};
  tools.filter(t => t.status !== 'archived').forEach(tool => {
    const cost = Number(tool.cost_per_month || tool.cost_monthly || tool.cost || 0);
    if (!cost) return;
    const seats = seatsByTool[tool.id];
    const totalSeats = seats ? Object.values(seats).reduce((s, n) => s + n, 0) : 0;
    if (!totalSeats) {
      monthlyByDept[UNALLOCATED] = (monthlyByDept[UNALLOCATED] || 0) + cost;
      return;
    }
    Object.entries(seats).forEach(([dept, n]) => {
      monthlyByDept[dept] = (monthlyByDept[dept] || 0) + cost * (n / totalSeats);
    });
  });
  return monthlyByDept;
}

// Tolerant CSV parser for "Department, Annual budget" files. Accepts comma or
// semicolon separators (French Excel exports use ;), an optional header row,
// and currency symbols / spaces / French decimal commas inside amounts.
export function parseBudgetCsv(text) {
  const rows = [];
  text.split(/\r?\n/).forEach(line => {
    if (!line.trim()) return;
    const sep = line.includes(';') ? ';' : ',';
    const parts = line.split(sep).map(p => p.trim().replace(/^"|"$/g, ''));
    if (parts.length < 2) return;
    const dept = parts[0];
    const raw = parts.slice(1).find(p => /\d/.test(p)) || '';
    const amount = Number(raw.replace(/[^0-9.,-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    if (!dept || !Number.isFinite(amount) || amount <= 0) return;
    if (/^(department|d[ée]partement|service)$/i.test(dept)) return; // header row
    rows.push({ department: dept, annual: Math.round(amount) });
  });
  return rows;
}

function yearElapsedFraction(year) {
  const now = new Date();
  if (year < now.getFullYear()) return 1;
  if (year > now.getFullYear()) return 0;
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  return (now - start) / (end - start);
}

export function BudgetTabContent() {
  const { data: db } = useDbQuery();
  const { setBudgets } = useDbMutations();
  const { language } = useLang();
  const t = useTranslation(language);
  const cur = (n) => getCurrency(language) + Math.round(convertCurrency(n, language)).toLocaleString();
  const fileRef = useRef(null);

  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState(nowYear);
  const [drafts, setDrafts] = useState({}); // department -> input string while editing

  const budgets = useMemo(() => (db?.budgets || []).filter(b => b.year === year), [db, year]);
  const budgetByDept = useMemo(() => Object.fromEntries(budgets.map(b => [b.department, b.annual])), [budgets]);

  const monthlyByDept = useMemo(
    () => allocateSpendByDepartment({ tools: db?.tools, employees: db?.employees, access: db?.access }),
    [db]
  );

  const departments = useMemo(() => {
    const set = new Set();
    (db?.employees || []).forEach(e => { const d = (e.department || '').trim(); if (d) set.add(d); });
    Object.keys(monthlyByDept).forEach(d => { if (d !== UNALLOCATED) set.add(d); });
    budgets.forEach(b => set.add(b.department));
    return Array.from(set).sort((a, b) => (monthlyByDept[b] || 0) - (monthlyByDept[a] || 0));
  }, [db, monthlyByDept, budgets]);

  const elapsed = yearElapsedFraction(year);

  const saveBudget = (department, value) => {
    const annual = Math.round(Number(String(value).replace(/[^0-9.]/g, '')) || 0);
    const others = (db?.budgets || []).filter(b => !(b.year === year && b.department === department));
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

  const rows = departments.map(dept => {
    const monthly = monthlyByDept[dept] || 0;
    const spentYtd = monthly * 12 * elapsed;
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

  const STATUS = {
    ok:   { icon: CheckCircle2,  cls: 'text-emerald-400', label: t('budget_on_track') },
    risk: { icon: TrendingUp,    cls: 'text-amber-400',   label: t('budget_at_risk') },
    over: { icon: AlertTriangle, cls: 'text-red-400',     label: t('budget_over') },
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
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
            <Upload size={15} /> {t('budget_import_csv')}
          </button>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ''; }} />
        </div>
      </div>
      <p className="text-xs text-slate-600">{t('budget_csv_hint')} · {t('budget_estimate_note')}</p>

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
    </div>
  );
}
