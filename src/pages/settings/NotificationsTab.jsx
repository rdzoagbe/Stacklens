import { useState } from 'react';
import { saveUserData } from '../../firebase-config';
import { loadDb, saveDb, seedDbIfEmpty } from '../../lib/db';
import { Card, CardHeader, CardBody } from '../../components/ui';
import { SlackNotifications } from '../../components/SlackNotifications';

function Toggle({ checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)} className={"relative w-11 h-6 rounded-full transition-colors " + (checked ? 'bg-emerald-500' : 'bg-slate-700')}>
      <div className={"absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform " + (checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );
}

export function NotificationsTab({ firebaseUser, qc, t }) {
  const _savedNotifs = (() => { try { return JSON.parse(localStorage.getItem('sg_notifications') || '{}'); } catch { return {}; } })();
  const [notifRenewal,    setNotifRenewal]    = useState(_savedNotifs.renewal    ?? true);
  const [notifOrphaned,   setNotifOrphaned]   = useState(_savedNotifs.orphaned   ?? true);
  const [notifHighRisk,   setNotifHighRisk]   = useState(_savedNotifs.highRisk   ?? true);
  const [notifOffboard,   setNotifOffboard]   = useState(_savedNotifs.offboard   ?? true);
  const [notifNewTool,    setNotifNewTool]    = useState(_savedNotifs.newTool    ?? true);
  const [notifCompliance, setNotifCompliance] = useState(_savedNotifs.compliance ?? false);
  const [notifWeekly,     setNotifWeekly]     = useState(_savedNotifs.weekly     ?? true);
  const [notifInvoice,    setNotifInvoice]    = useState(_savedNotifs.invoice    ?? false);
  const [notifBudget,     setNotifBudget]     = useState(_savedNotifs.budget     ?? true);

  const saveNotifications = (patch) => {
    const next = { renewal: notifRenewal, orphaned: notifOrphaned, highRisk: notifHighRisk,
      offboard: notifOffboard, newTool: notifNewTool, compliance: notifCompliance,
      weekly: notifWeekly, invoice: notifInvoice, budget: notifBudget, ...patch };
    localStorage.setItem('sg_notifications', JSON.stringify(next));
    const backendChanged = 'renewal' in patch || 'weekly' in patch;
    if (backendChanged) {
      const cur = loadDb() || seedDbIfEmpty();
      cur.user = {
        ...cur.user,
        ...('renewal' in patch ? { renewal_alerts: patch.renewal } : {}),
        ...('weekly'  in patch ? { weekly_summary: patch.weekly  } : {}),
      };
      saveDb(cur);
      if (firebaseUser?.uid) saveUserData(firebaseUser.uid, cur).catch(() => {});
      qc.invalidateQueries({ queryKey: ['db'] });
    }
  };

  return (
    <Card>
      <CardHeader title={t('notifications_title')} subtitle={t('notifications_sub')} />
      <CardBody>
        <div className="space-y-1">
          {[
            { label: 'Renewal due in 30 days',      sub: 'SaaS contract coming up for renewal — sent by email',  val: notifRenewal,    set: setNotifRenewal,    key: 'renewal',    live: true },
            { label: 'New tool added to inventory',  sub: 'When a tool is added via import or manually',           val: notifNewTool,    set: setNotifNewTool,    key: 'newTool' },
            { label: 'Orphaned tool detected',       sub: 'Tools with no assigned owner',                          val: notifOrphaned,   set: setNotifOrphaned,   key: 'orphaned' },
            { label: 'High-risk access granted',     sub: 'Admin access given to a new user',                      val: notifHighRisk,   set: setNotifHighRisk,   key: 'highRisk' },
            { label: 'Employee offboarding initiated', sub: 'When an offboarding task is started',                 val: notifOffboard,   set: setNotifOffboard,   key: 'offboard' },
            { label: 'Compliance report ready',      sub: 'Weekly compliance digest',                              val: notifCompliance, set: setNotifCompliance, key: 'compliance' },
            { label: 'Weekly summary email',         sub: 'Overview of spend, risk and usage',                     val: notifWeekly,     set: setNotifWeekly,     key: 'weekly' },
            { label: 'Invoice approval required',    sub: 'New invoice needs sign-off',                            val: notifInvoice,    set: setNotifInvoice,    key: 'invoice' },
            { label: t('budget_limit'),              sub: 'Monthly spend passes your set limit',                   val: notifBudget,     set: setNotifBudget,     key: 'budget' },
          ].map(n => (
            <div key={n.key} className="flex items-center justify-between py-3.5 border-b border-slate-800 last:border-0">
              <div>
                <div className="text-sm font-medium text-slate-200 flex items-center gap-2">
                  {n.label}
                  {n.live && <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">Live</span>}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{n.sub}</div>
              </div>
              <Toggle checked={n.val} onChange={(v) => { n.set(v); saveNotifications({ [n.key]: v }); }} />
            </div>
          ))}
        </div>
        <div className='mt-6'><SlackNotifications /></div>
      </CardBody>
    </Card>
  );
}
