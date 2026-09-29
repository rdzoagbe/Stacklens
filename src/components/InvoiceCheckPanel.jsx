import React, { useMemo, useState } from 'react';
import { FileWarning, Check } from 'lucide-react';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { useDbQuery, useDbMutations } from '../hooks/useDbQuery';
import { getCurrency, displayAmount } from '../lib/currency';
import { checkInvoices, invoiceCheckSummary, vendorMatchesTool } from '../lib/invoiceCheck';
import { RoleGate } from './gates';

// ── Contrôle des factures fournisseurs (Finance → Budget) ──────────────────
//
// What lib/invoiceCheck.js found in the imported invoices, the money at stake
// per year, and the two things a finance lead does about each: say it is
// justified, or record the price that was actually agreed. Tools billed with
// no agreed price are listed underneath, since a price no one wrote down is
// a price no one can check.

function AgreedPriceEditor({ tool, t, onSave, onCancel }) {
  const [value, setValue] = useState(tool?.agreed_monthly ? String(tool.agreed_monthly) : '');
  const [basis, setBasis] = useState(tool?.agreed_basis === 'ttc' ? 'ttc' : 'ht');
  const n = Number(String(value).replace(',', '.'));
  return (
    <form className="flex flex-wrap items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); if (n > 0) onSave(Math.round(n * 100) / 100, basis); }}>
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal"
        aria-label={t('inv_check_agreed_label')} placeholder={t('inv_check_agreed_label')}
        className="w-28 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-blue-500" />
      <select value={basis} onChange={(e) => setBasis(e.target.value)} aria-label={t('inv_check_basis')}
        className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200">
        <option value="ht">{t('inv_check_ht')}</option>
        <option value="ttc">{t('inv_check_ttc')}</option>
      </select>
      <button type="submit" disabled={!(n > 0)} className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-semibold text-white">{t('inv_check_save')}</button>
      <button type="button" onClick={onCancel} className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300">{t('inv_check_cancel')}</button>
    </form>
  );
}

export function InvoiceCheckPanel() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db } = useDbQuery();
  const { updateTool, clearInvoiceFinding } = useDbMutations();
  const [editing, setEditing] = useState(null); // tool id
  const [showUnpriced, setShowUnpriced] = useState(false);

  const findings = useMemo(() => checkInvoices(db), [db]);
  const summary = useMemo(() => invoiceCheckSummary(db, findings), [db, findings]);
  const unpriced = useMemo(() => {
    const billed = new Set((db?.invoice_records || []).map((r) => r.vendor));
    return (db?.tools || []).filter((tool) => !(Number(tool.agreed_monthly) > 0)
      && [...billed].some((v) => vendorMatchesTool(v, tool.name)));
  }, [db]);

  const records = db?.invoice_records || [];
  const money = (n) => getCurrency(language) + Math.round(displayAmount(n || 0)).toLocaleString(language);
  // Invoice lines are compared to the cent, so they are shown to the cent (displayAmount rounds to the euro).
  const money2 = (n) => getCurrency(language) + (Number(n) || 0).toLocaleString(language, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const date = (d) => (d ? new Date(d).toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const fill = (key, vars) => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), t(key));
  const toolById = (id) => (db?.tools || []).find((x) => x.id === id);
  const saveAgreed = (toolId, agreed_monthly, agreed_basis) => {
    updateTool.mutate({ id: toolId, patch: { agreed_monthly, agreed_basis } });
    setEditing(null);
  };

  const describe = (f) => {
    switch (f.kind) {
      case 'duplicate': return fill('inv_check_duplicate', { amount: money2(f.amount), date: date(f.date) });
      case 'after_cancel': return fill('inv_check_after_cancel', { date: date(f.date) });
      case 'above_agreed': return fill('inv_check_above_agreed', {
        monthly: money2(f.monthly), expected: money2(f.expected),
        basis: t(f.basis === 'ttc' || f.assumedVat ? 'inv_check_ttc' : 'inv_check_ht'),
      }) + (f.assumedVat ? ` ${t('inv_check_assumed_vat')}` : '');
      default: return fill('inv_check_price_rise', { monthly: money2(f.monthly), expected: money2(f.expected), pct: f.pct });
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5" data-testid="invoice-check">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-amber-400" /> {t('inv_check_title')}
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">{t('inv_check_sub')}</p>
        </div>
        {summary.count > 0 && (
          <div className="text-right">
            <div className="text-2xl font-black text-amber-300">{money(summary.annualAtStake)}</div>
            <div className="text-xs text-slate-500">{fill('inv_check_at_stake', { n: summary.count })}</div>
          </div>
        )}
      </div>

      {records.length === 0 ? (
        <p className="text-sm text-slate-400">{t('inv_check_no_invoices')}</p>
      ) : findings.length === 0 ? (
        <p className="text-sm text-emerald-300 flex items-center gap-2"><Check className="h-4 w-4" /> {fill('inv_check_all_clear', { n: records.length })}</p>
      ) : (
        <ul className="space-y-2">
          {findings.map((f) => (
            <li key={f.invoiceId} className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3" data-testid="invoice-finding">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{f.toolName || f.vendor}
                    <span className="ml-2 text-[11px] font-semibold text-amber-300 uppercase tracking-wider">{t(`inv_check_kind_${f.kind}`)}</span>
                  </div>
                  <div className="text-sm text-slate-300 mt-0.5">{describe(f)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{[f.vendor, date(f.date), f.file].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-amber-300">+{money(f.overAnnual)}{t('inv_check_per_year')}</div>
                </div>
              </div>
              <RoleGate requires="editor">
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {editing === f.toolId && f.toolId ? (
                    <AgreedPriceEditor tool={toolById(f.toolId)} t={t} onCancel={() => setEditing(null)}
                      onSave={(v, b) => saveAgreed(f.toolId, v, b)} />
                  ) : (
                    <>
                      <button onClick={() => clearInvoiceFinding.mutate(f.invoiceId)}
                        className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold">
                        {t('inv_check_justified')}
                      </button>
                      {f.toolId && (f.kind === 'above_agreed' || f.kind === 'price_rise') && (
                        <button onClick={() => setEditing(f.toolId)}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold">
                          {t(f.kind === 'above_agreed' ? 'inv_check_edit_agreed' : 'inv_check_set_agreed')}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </RoleGate>
            </li>
          ))}
        </ul>
      )}

      {unpriced.length > 0 && (
        <div className="mt-4 border-t border-slate-800 pt-3">
          <button onClick={() => setShowUnpriced((v) => !v)} className="text-sm text-slate-400 hover:text-white transition-colors">
            {showUnpriced ? '▾' : '▸'} {fill('inv_check_unpriced', { n: unpriced.length })}
          </button>
          {showUnpriced && (
            <ul className="mt-2 space-y-1.5" data-testid="invoice-unpriced">
              {unpriced.map((tool) => (
                <li key={tool.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-slate-200">{tool.name}</span>
                  <RoleGate requires="editor">
                    {editing === tool.id ? (
                      <AgreedPriceEditor tool={tool} t={t} onCancel={() => setEditing(null)} onSave={(v, b) => saveAgreed(tool.id, v, b)} />
                    ) : (
                      <button onClick={() => setEditing(tool.id)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold">
                        {t('inv_check_set_agreed')}
                      </button>
                    )}
                  </RoleGate>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
