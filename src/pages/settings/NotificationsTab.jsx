import { useState } from 'react';
import { loadDb, saveDb, seedDbIfEmpty, saveOwnWorkspaceNow, getSharedView } from '../../lib/db';
import { Card, CardHeader, CardBody } from '../../components/ui';
import { SlackNotifications } from '../../components/SlackNotifications';
import { MonthlyReportSettings } from '../../components/MonthlyReportSettings';
import { useLang } from '../../contexts/LangContext';
import { NOTIFICATION_SWITCHES } from '../../lib/notifications';

function Toggle({ checked, onChange, label }) {
  // role/aria-checked so assistive tech reports this as a switch and announces
  // its state — a bare <button> conveys neither.
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label}
      onClick={() => onChange(!checked)} className={"relative w-11 h-6 rounded-full transition-colors " + (checked ? 'bg-emerald-500' : 'bg-slate-700')}>
      <div className={"absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform " + (checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );
}

export function NotificationsTab({ firebaseUser, qc, t }) {
  const { language } = useLang();
  const shared = !!getSharedView();
  // The account's own setting (db.user) wins; the browser copy is what the
  // in-app budget banner reads (DashboardPage, OverviewTab).
  const [values, setValues] = useState(() => {
    let local = {};
    try { local = JSON.parse(localStorage.getItem('sg_notifications') || '{}'); } catch { /* none */ }
    const user = loadDb()?.user || {};
    return Object.fromEntries(NOTIFICATION_SWITCHES.map(({ key, field }) =>
      [key, typeof user[field] === 'boolean' ? user[field] : (local[key] ?? true)]));
  });

  const setSwitch = (key, value) => {
    const next = { ...values, [key]: value };
    setValues(next);
    localStorage.setItem('sg_notifications', JSON.stringify(next));
    // In someone else's workspace the account-level switches are not theirs
    // to change from here (saveOwnWorkspaceNow refuses anyway).
    if (shared) return;
    const sw = NOTIFICATION_SWITCHES.find((n) => n.key === key);
    const cur = loadDb() || seedDbIfEmpty();
    cur.user = { ...cur.user, [sw.field]: value };
    saveDb(cur);
    saveOwnWorkspaceNow(firebaseUser?.uid, cur).catch(() => {});
    qc.invalidateQueries({ queryKey: ['db'] });
  };

  return (
    <Card>
      <CardHeader title={t('notifications_title')} subtitle={t('notifications_sub')} />
      <CardBody>
        {shared && <p className="mb-4 text-sm text-amber-300" data-testid="notif-shared-note">{t('notif_shared_note')}</p>}
        <MonthlyReportSettings firebaseUser={firebaseUser} qc={qc} t={t} language={language} />
        <div className="space-y-1" data-testid="notification-switches">
          {NOTIFICATION_SWITCHES.map(n => (
            <div key={n.key} className="flex items-center justify-between py-3.5 border-b border-slate-800 last:border-0">
              <div>
                <div className="text-sm font-medium text-slate-200">{t(n.label)}</div>
                <div className="text-xs text-slate-500 mt-0.5">{t(n.sub)}</div>
              </div>
              <Toggle checked={values[n.key]} label={t(n.label)} onChange={(v) => setSwitch(n.key, v)} />
            </div>
          ))}
        </div>
        <div className='mt-6'><SlackNotifications /></div>
      </CardBody>
    </Card>
  );
}
