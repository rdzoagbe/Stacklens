import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle, ArrowDown, ArrowUp, BarChart3, Boxes, Calendar,
  CalendarClock, Check, CheckCircle, CreditCard, DollarSign, Download,
  Filter, Mail, Search, Sparkles, Target, TrendingDown, TrendingUp,
  Upload, Users, X,
} from 'lucide-react';
import { saveUserData } from '../../firebase-config';
import { loadDb, saveDb, seedDbIfEmpty } from '../../lib/db';
import {
  buildRiskAlerts, computeToolDerivedRisk, convertCurrency,
  formatMoney, getCurrency,
} from '../../lib/dataUtils';
import { useDbQuery } from '../../hooks/useDbQuery';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useLang } from '../../contexts/LangContext';
import { useTranslation } from '../../translations';
import { Card } from '../../components/ui';

function SpendTrendChart({ monthlyTrend, byCategory }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const maxSpend = Math.max(...monthlyTrend.map(m => m.spend), 1);
  const colors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444'];
  const totalMonthly = byCategory.reduce((s, c) => s + c.spend, 0);
  const maxCatSpend = Math.max(...byCategory.map(c => c.spend), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-5 mb-6">
      
      {/* Left: Trend chart — 3 cols */}
      <div className="lg:col-span-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-white">{t('monthly_spend_trend_title') || 'Monthly Spend Trend'}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{t('last_6_months') || 'Last 6 months'}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-white">{getCurrency(language)}{convertCurrency(Math.round(monthlyTrend[monthlyTrend.length-1]?.spend || 0), language).toLocaleString()}</div>
            <div className="text-xs text-slate-500">this month</div>
          </div>
        </div>

        {/* Area-style bar chart */}
        <div className="flex items-end gap-2 md:gap-3" style={{height: '160px'}}>
          {monthlyTrend.map((m, idx) => {
            const isLast = idx === monthlyTrend.length - 1;
            const prev = idx > 0 ? monthlyTrend[idx-1].spend : m.spend;
            const change = m.spend - prev;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0 group">
                <div className="text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  {getCurrency(language)}{convertCurrency(Math.round(m.spend), language).toLocaleString()}
                </div>
                <div 
                  className={`w-full rounded-t-lg transition-all duration-300 ${isLast ? 'bg-gradient-to-t from-blue-600 to-blue-400' : 'bg-blue-500/40 hover:bg-blue-500/60'}`}
                  style={{height: Math.max(8, (m.spend / maxSpend) * 140) + 'px'}} 
                />
                <span className={`text-xs font-medium ${isLast ? 'text-blue-400' : 'text-slate-500'}`}>{m.month}</span>
              </div>
            );
          })}
        </div>

        {/* Trend line indicator */}
        {monthlyTrend.length >= 2 && (() => {
          const first = monthlyTrend[0].spend;
          const last = monthlyTrend[monthlyTrend.length-1].spend;
          if (first <= 0 || last <= 0) return null;
          const pctChange = ((last - first) / first * 100).toFixed(1);
          const up = last >= first;
          return (
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800">
              <span className={`text-sm font-semibold ${up ? 'text-amber-400' : 'text-emerald-400'}`}>
                {up ? '↑' : '↓'} {Math.abs(pctChange)}%
              </span>
              <span className="text-sm text-slate-500">vs 6 months ago</span>
            </div>
          );
        })()}
      </div>

      {/* Right: Category breakdown — 2 cols */}
      <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{t('spend_by_category_title') || 'Spend by Category'}</h2>
          <span className="text-sm text-slate-500">{byCategory.length} categories</span>
        </div>

        <div className="space-y-4">
          {byCategory.slice(0,5).map((cat, i) => {
            const pct = Math.round((cat.spend / totalMonthly) * 100);
            return (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background: colors[i]}} />
                    <span className="text-sm font-medium text-slate-200 capitalize">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-white">{getCurrency(language)}{convertCurrency(cat.spend, language).toLocaleString()}</span>
                    <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{width: pct + '%', background: colors[i]}} />
                </div>
                <div className="text-xs text-slate-600 mt-1">{cat.count} tools · {getCurrency(language)}{convertCurrency(Math.round(cat.spend / Math.max(cat.count, 1)), language).toLocaleString()}/tool avg</div>
              </div>
            );
          })}
        </div>

        {totalMonthly > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-sm text-slate-400">Total monthly</span>
            <span className="text-lg font-black text-white">{getCurrency(language)}{convertCurrency(totalMonthly, language).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BudgetModal({ current, totalSpend, language, onSave, onClear, onClose }) {
  const t = useTranslation(language);
  const [value, setValue] = useState(current > 0 ? String(current) : '');
  const curr = getCurrency(language);
  const num = Number(value) || 0;
  const utilization = num > 0 ? Math.round(totalSpend / num * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-white">{t('budget_modal_title')}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{t('budget_modal_sub')}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{t('budget_modal_cap_label')} ({curr}/month)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">{curr}</span>
            <input
              type="number"
              min="0"
              step="100"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={t('budget_modal_placeholder')}
              className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl px-3 py-2.5 pl-8 text-white text-sm outline-none transition-colors"
              autoFocus
            />
          </div>
          {num > 0 && (
            <p className={`text-xs mt-1.5 ${utilization > 100 ? 'text-red-400' : utilization > 75 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {t('budget_modal_current_spend')} {curr}{convertCurrency(totalSpend, language).toLocaleString()} — {utilization}% {t('budget_modal_of_cap')}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={() => num > 0 && onSave(num)}
            disabled={num <= 0}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors">
            {t('budget_modal_save')}
          </button>
          {current > 0 && (
            <button onClick={onClear} className="px-4 py-2.5 rounded-xl border border-slate-700 hover:border-red-500/50 text-slate-400 hover:text-red-400 text-sm font-semibold transition-colors">
              {t('remove')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function FinanceOverviewTab({ financialData, showBudgetModal, setShowBudgetModal, budgetCap, setBudgetCap, selectedBill, setSelectedBill, showReclaimModal, setShowReclaimModal, categoryFilter, setCategoryFilter, setFinTab }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const navigate = useNavigate();
  const { user: firebaseUser } = useAuth();
  const qc = useQueryClient();
  const budgetSet = financialData.budgetLimit > 0;
  const budgetUtilization = budgetSet ? (financialData.totalMonthlySpend / financialData.budgetLimit * 100) : 0;
  const overBudget = budgetSet && financialData.totalMonthlySpend > financialData.budgetLimit;
  const _savedNotifs = (() => { try { return JSON.parse(localStorage.getItem('sg_notifications') || '{}'); } catch { return {}; } })();
  const notifBudget = _savedNotifs.budget ?? true;

  const saveBudgetCap = (cap) => {
    const numCap = Number(cap) || 0;
    localStorage.setItem('sg_budget_cap', String(numCap));
    setBudgetCap(numCap);
    const cur = loadDb() || seedDbIfEmpty();
    cur.user = { ...cur.user, budget_cap: numCap };
    saveDb(cur);
    if (firebaseUser?.uid) saveUserData(firebaseUser.uid, cur).catch(() => {});
    qc.invalidateQueries({ queryKey: ['db'] });
  };
  const savingsVsLastMonth = financialData.lastMonthSpend - financialData.totalMonthlySpend;
  const annualSpend = financialData.totalMonthlySpend * 12;
  const hasRealComparison = financialData.lastMonthSpend > 0 && financialData.totalMonthlySpend > 0;
  const monthlyChange = hasRealComparison ? ((financialData.totalMonthlySpend / financialData.lastMonthSpend - 1) * 100) : 0;
  const upcomingTotal = financialData.upcomingBills.reduce((s, b) => s + b.amount, 0);
  const topCategory = financialData.byCategory.length > 0 ? [...financialData.byCategory].sort((a,b) => b.spend - a.spend)[0] : null;
  const potentialSavings = Math.round(financialData.totalMonthlySpend * 0.14);

  // Empty state for real users with no tools yet
  if (financialData.isReal && financialData.toolCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-5">
          <DollarSign className="h-8 w-8 text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{t('finance_no_data_title')}</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-6">{t('finance_no_data_body')}</p>
        <Link to="/tools" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold text-white transition-colors">
          {t('finance_add_tools')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Budget modal */}
      {showBudgetModal && (
        <BudgetModal
          current={budgetCap}
          totalSpend={financialData.totalMonthlySpend}
          language={language}
          onSave={(cap) => { saveBudgetCap(cap); setShowBudgetModal(false); toast.success('Budget cap saved'); }}
          onClear={() => { saveBudgetCap(0); setShowBudgetModal(false); toast.success('Budget cap removed'); }}
          onClose={() => setShowBudgetModal(false)}
        />
      )}

      {/* Over-budget alert */}
      {overBudget && notifBudget && (
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl border border-red-500/40 bg-red-500/10">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-red-300">Monthly spend exceeds your budget cap — </span>
            <span className="text-sm text-red-400">{getCurrency(language)}{convertCurrency(financialData.totalMonthlySpend, language).toLocaleString()} vs {getCurrency(language)}{convertCurrency(financialData.budgetLimit, language).toLocaleString()} limit ({(budgetUtilization - 100).toFixed(0)}% over)</span>
          </div>
          <button onClick={() => setShowBudgetModal(true)} className="text-xs text-red-300 hover:text-red-200 font-semibold flex-shrink-0 underline underline-offset-2">Adjust limit</button>
        </div>
      )}

      {/* ── Row 1: Hero Metric (Monthly Spend) + Budget Health ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">

        {/* Hero — Total Monthly Spend */}
        <div className="lg:col-span-2 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-900 to-blue-950/20 p-6 lg:p-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-2">{t("finance_monthly_spend")}</div>
          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-5xl font-black text-white">{getCurrency(language)}{convertCurrency(financialData.totalMonthlySpend, language).toLocaleString()}</span>
            {hasRealComparison && (
              <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${monthlyChange > 0 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {monthlyChange > 0 ? '↑' : '↓'} {Math.abs(monthlyChange).toFixed(1)}%
              </span>
            )}
          </div>
          <div className="text-sm text-slate-400 mb-5">
            {getCurrency(language)}{convertCurrency(annualSpend, language).toLocaleString()}/year{hasRealComparison ? ' · ' + getCurrency(language) + convertCurrency(financialData.lastMonthSpend, language).toLocaleString() + ' last month' : ''}
          </div>

          {/* Budget bar */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("finance_budget_util")}</span>
            {budgetSet ? (
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${budgetUtilization > 100 ? 'text-red-400' : budgetUtilization > 75 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {budgetUtilization.toFixed(0)}% of {getCurrency(language)}{convertCurrency(financialData.budgetLimit, language).toLocaleString()}
                </span>
                <button onClick={() => setShowBudgetModal(true)} className="text-xs text-slate-500 hover:text-blue-400 underline underline-offset-2 transition-colors">Edit</button>
              </div>
            ) : (
              <button onClick={() => setShowBudgetModal(true)} className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors">+ Set budget cap</button>
            )}
          </div>
          {budgetSet ? (
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${budgetUtilization > 100 ? 'bg-red-500' : budgetUtilization > 75 ? 'bg-amber-500' : 'bg-gradient-to-r from-blue-500 to-emerald-500'}`}
                style={{width: `${Math.min(budgetUtilization, 100)}%`}} />
            </div>
          ) : (
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full w-0 rounded-full bg-slate-700" />
            </div>
          )}
        </div>

        {/* Side Card — Quick wins */}
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-slate-900 to-emerald-950/20 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{t("finance_potential_savings")}</span>
          </div>
          <div className="text-4xl font-black text-emerald-400 mb-1">{getCurrency(language)}{convertCurrency(potentialSavings, language).toLocaleString()}</div>
          <div className="text-sm text-slate-400 mb-5">{t("finance_potential_sub")}</div>
          <button onClick={() => setFinTab && setFinTab('cost')} className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm text-white transition-colors">
            {t("finance_view_optimizations")} →
          </button>
        </div>
      </div>

      {/* ── Row 2: Spend Trend + Category Breakdown ── */}
      <SpendTrendChart monthlyTrend={financialData.monthlyTrend} byCategory={financialData.byCategory} />

      {/* ── Row 3: Upcoming Bills (full width) ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">{t("finance_upcoming_bills")}</h2>
            <p className="text-sm text-slate-500">{financialData.upcomingBills.length} bills · {getCurrency(language)}{convertCurrency(upcomingTotal, language).toLocaleString()} total</p>
          </div>
        </div>
        {financialData.upcomingBills.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-500">{t("finance_no_upcoming")}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {financialData.upcomingBills.slice(0, 6).map((bill, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950/40 hover:border-slate-700 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/30 to-indigo-600/30 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">
                  {(bill.app || '?').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{bill.app}</div>
                  <div className="text-xs text-slate-500 truncate">Due {bill.dueDate}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-white">{getCurrency(language)}{convertCurrency(bill.amount, language).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Row 4: Quick Stats Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("finance_top_category")}</div>
          <div className="text-base font-bold text-white capitalize truncate">{topCategory?.name || '—'}</div>
          <div className="text-xs text-slate-500 mt-1">{topCategory ? getCurrency(language) + convertCurrency(topCategory.spend, language).toLocaleString() + '/mo' : 'No data'}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("kpi_total_tools")}</div>
          <div className="text-base font-bold text-white">{financialData.toolCount || financialData.byCategory.reduce((s,c) => s+c.count, 0)}</div>
          <div className="text-xs text-slate-500 mt-1">{financialData.byCategory.length} categories</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("finance_avg_per_tool")}</div>
          <div className="text-base font-bold text-white">{getCurrency(language)}{convertCurrency(Math.round(financialData.totalMonthlySpend / Math.max(financialData.toolCount || financialData.byCategory.reduce((s,c) => s+c.count, 1), 1)), language).toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">monthly average</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t("finance_vs_last_month")}</div>
          {hasRealComparison ? (
            <>
              <div className={`text-base font-bold ${savingsVsLastMonth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {savingsVsLastMonth >= 0 ? '−' : '+'}{getCurrency(language)}{convertCurrency(Math.abs(savingsVsLastMonth), language).toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">{savingsVsLastMonth >= 0 ? 'saved' : 'increase'}</div>
            </>
          ) : (
            <>
              <div className="text-base font-bold text-slate-500">—</div>
              <div className="text-xs text-slate-500 mt-1">{t("finance_no_comparison")}</div>
            </>
          )}
        </div>
      </div>

      {/* ── Row 5: Smart Recommendations ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-purple-400" />
          <h2 className="text-base font-semibold text-white">{t("finance_smart_recs")}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-800 bg-slate-950/40">
            <div className="p-2 rounded-lg bg-emerald-500/10 flex-shrink-0">
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white mb-1">{t("finance_reclaim_unused")}</div>
              <div className="text-xs text-slate-500 mb-2">{financialData.toolCount} tools have idle seats</div>
              <div className="text-xs text-emerald-400 font-semibold">Potential: {getCurrency(language)}{convertCurrency(potentialSavings, language).toLocaleString()}/mo</div>
            </div>
            <button onClick={() => setFinTab && setFinTab('licenses')} className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex-shrink-0">Review →</button>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-800 bg-slate-950/40">
            <div className="p-2 rounded-lg bg-amber-500/10 flex-shrink-0">
              <CalendarClock className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white mb-1">{t("finance_negotiate_renewals")}</div>
              <div className="text-xs text-slate-500 mb-2">{financialData.upcomingBills.length} contracts renewing soon</div>
              <div className="text-xs text-amber-400 font-semibold">Save up to 20% on renewal</div>
            </div>
            <button onClick={() => setFinTab && setFinTab('renewals')} className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex-shrink-0">View →</button>
          </div>
        </div>
      </div>
    </div>
  );
}


