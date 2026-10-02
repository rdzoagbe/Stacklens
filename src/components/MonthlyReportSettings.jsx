import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { FileBarChart2, Send } from 'lucide-react';
import { sendMonthlyReportNow } from '../firebase-config';
import { loadDb, saveDb, seedDbIfEmpty, saveOwnWorkspaceNow, getSharedView } from '../lib/db';
import { reportRecipients, canAddColleagues, MAX_EXTRA_RECIPIENTS } from '../lib/reportRecipients';
import { track } from '../lib/analytics';

// ── Settings → Notifications: the monthly report to management ─────────────
//
// On the 1st of each month functions/index.js monthlyReport sends last
// month's report (spend and forecast, budgets by department, supplier
// invoices to check, renewals in the next 30 days, three priority actions)
// to the accounts that turned it on here. Off by default. The settings live
// on the workspace's user record, like the weekly summary's, and the server
// checks every recipient again: this screen only says in advance which ones
// it will refuse.

export function MonthlyReportSettings({ firebaseUser, qc, t, language }) {
  const saved = loadDb()?.user?.monthly_report || {};
  const [enabled, setEnabled] = useState(saved.enabled === true);
  const [extra, setExtra] = useState((saved.recipients || []).join(', '));
  const [sending, setSending] = useState(false);
  const account = firebaseUser?.email || loadDb()?.user?.email || '';

  // Inside a shared or client workspace these are the viewer's own account
  // settings, not that workspace's: they are changed from the viewer's own.
  const shared = getSharedView();

  const parsed = extra.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
  const { to, rejected } = reportRecipients(account, parsed);
  const colleagues = canAddColleagues(account);

  const persist = (next) => {
    const cur = loadDb() || seedDbIfEmpty();
    cur.user = { ...cur.user, monthly_report: next };
    saveDb(cur);
    saveOwnWorkspaceNow(firebaseUser?.uid, cur).catch(() => {});
    qc?.invalidateQueries({ queryKey: ['db'] });
  };
  const current = (patch = {}) => ({
    enabled, recipients: to.slice(1), lang: language === 'fr' ? 'fr' : 'en', ...patch,
  });

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    persist(current({ enabled: next }));
    track('monthly_report_toggled', { enabled: next });
  };
  const saveRecipients = () => {
    persist(current());
    toast.success(t('mr_saved'));
  };
  const sendTest = async () => {
    setSending(true);
    try {
      const out = await sendMonthlyReportNow(language);
      toast.success(t('mr_test_sent').replace('{email}', out.to || account));
      track('monthly_report_test_sent');
    } catch (err) {
      // Say why, when the server knows: "try again later" was false for both.
      const why = { 'Not authenticated': 'mr_test_signin', no_email: 'mr_test_unverified', mail_not_configured: 'mr_test_mail_off' }[err.message];
      toast.error(t(why || 'mr_test_failed'));
    } finally {
      setSending(false);
    }
  };

  if (shared) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 mb-6 text-sm text-slate-400" data-testid="monthly-report-settings">
        <div className="font-semibold text-slate-200 mb-1">{t('mr_title')}</div>
        {t('notif_shared_note')}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 mb-6" data-testid="monthly-report-settings">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <FileBarChart2 className="h-4 w-4 text-emerald-400" /> {t('mr_title')}
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">{t('mr_badge')}</span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">{t('mr_sub')}</p>
        </div>
        <button type="button" role="switch" aria-checked={enabled} aria-label={t('mr_title')} onClick={toggle}
          className={'relative w-11 h-6 shrink-0 rounded-full transition-colors ' + (enabled ? 'bg-emerald-500' : 'bg-slate-700')}>
          <div className={'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ' + (enabled ? 'translate-x-5' : 'translate-x-0.5')} />
        </button>
      </div>

      {enabled && (
        <div className="mt-4 space-y-3">
          <div className="text-xs text-slate-400">{t('mr_to_you').replace('{email}', account || '—')}</div>
          {colleagues ? (
            <div>
              <label className="block text-xs font-medium text-slate-400">
                {t('mr_extra_label').replace('{n}', MAX_EXTRA_RECIPIENTS).replace('{domain}', account.split('@')[1] || '')}
                <div className="mt-1 flex gap-2">
                  <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={`dg@${account.split('@')[1] || 'entreprise.fr'}`}
                    className="flex-1 h-9 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                  <button type="button" onClick={saveRecipients}
                    className="px-3 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-200">{t('mr_save')}</button>
                </div>
              </label>
              {rejected.length > 0 && (
                <p className="mt-1 text-xs text-amber-300" role="status">{t('mr_rejected').replace('{list}', rejected.join(', '))}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">{t('mr_extra_public')}</p>
          )}
          <button type="button" onClick={sendTest} disabled={sending}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-semibold text-white">
            <Send className="h-4 w-4" /> {t('mr_test')}
          </button>
        </div>
      )}
    </div>
  );
}
