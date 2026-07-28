import toast from 'react-hot-toast';
import { Boxes, Download, Users } from 'lucide-react';
import { saveUserData } from '../../firebase-config';
import { loadDb, saveDb, seedDbIfEmpty, todayISO } from '../../lib/db';
import { toCsv, downloadText } from '../../lib/dataUtils';
import { track } from '../../lib/analytics';
import { submitContactForm } from '../../lib/contact';
import { Card, CardHeader, CardBody } from '../../components/ui';

export function DataTab({ db, firebaseUser, isDemo, qc, t }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('export_data')} subtitle={t('export_data_sub')} />
        <CardBody>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              {
                label: t('set_tools_licenses'),
                desc: t('set_tools_desc'),
                icon: Boxes,
                onClick: () => {
                  downloadText(`stacklens_tools_${todayISO()}.csv`, toCsv(db?.tools || [],
                    ["name","category","owner_email","criticality","url","derived_status","last_used_date","cost_per_month","derived_risk","notes"]
                  ));
                  toast.success(t('set_tools_exported'));
                  track('report_exported', { type: 'tools' });
                },
              },
              {
                label: t('set_emp_access'),
                desc: t('set_emp_desc'),
                icon: Users,
                onClick: () => {
                  downloadText(`stacklens_employees_${todayISO()}.csv`, toCsv(db?.employees || [],
                    ["full_name","email","department","role","status","start_date","end_date"]
                  ));
                  setTimeout(() => downloadText(`stacklens_access_${todayISO()}.csv`, toCsv(db?.access || [],
                    ["tool_name","employee_name","employee_email","access_level","granted_date","last_accessed_date","last_reviewed_date","status","derived_risk_flag"]
                  )), 300);
                  toast.success(t('set_emp_exported'));
                  track('report_exported', { type: 'employees_access' });
                },
              },
              {
                label: t('set_audit_log'),
                desc: t('set_audit_desc'),
                icon: Download,
                onClick: () => {
                  downloadText(`stacklens_audit_${todayISO()}.csv`, toCsv(db?.audit_log || [],
                    ["action","user","timestamp","details"]
                  ));
                  toast.success(t('set_audit_exported'));
                  track('report_exported', { type: 'audit_log' });
                },
              },
            ].map(({ label, desc, icon: Icon, onClick }) => (
              <button key={label} onClick={onClick}
                className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/60 border border-slate-800 hover:border-emerald-500/30 hover:bg-slate-800 transition-all text-left">
                <Icon className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white text-sm">{label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>
      <Card className="border-rose-500/20 bg-rose-500/5">
        <CardHeader title={t('danger_zone')} subtitle={t('danger_zone_sub')} />
        <CardBody>
          <div className="space-y-3">
            {[
              {
                label: t('set_del_tools'),
                desc: t('set_del_tools_desc'),
                btn: t('set_del_tools_btn'),
                onClick: () => {
                  if (isDemo) { toast.error(t('set_demo_error')); return; }
                  if (!window.confirm(t('set_del_tools_confirm'))) return;
                  const cur = loadDb() || seedDbIfEmpty();
                  cur.tools = []; cur.employees = []; cur.access = [];
                  saveDb(cur);
                  if (firebaseUser?.uid) saveUserData(firebaseUser.uid, cur).catch(() => {});
                  qc.invalidateQueries({ queryKey: ['db'] });
                  toast.success(t('set_del_tools_done'));
                },
              },
              {
                label: t('set_del_emp'),
                desc: t('set_del_emp_desc'),
                btn: t('set_del_emp_btn'),
                onClick: () => {
                  if (isDemo) { toast.error(t('set_demo_error')); return; }
                  if (!window.confirm(t('set_del_emp_confirm'))) return;
                  const cur = loadDb() || seedDbIfEmpty();
                  cur.employees = []; cur.access = [];
                  saveDb(cur);
                  if (firebaseUser?.uid) saveUserData(firebaseUser.uid, cur).catch(() => {});
                  qc.invalidateQueries({ queryKey: ['db'] });
                  toast.success(t('set_del_emp_done'));
                },
              },
              {
                label: t('set_del_account'),
                desc: t('set_del_account_desc'),
                btn: t('set_del_account_btn'),
                danger: true,
                onClick: async () => {
                  if (isDemo) { toast.error(t('set_demo_error')); return; }
                  try {
                    const email = firebaseUser?.email || '';
                    await submitContactForm({ name: email, email, subject: 'account-deletion', message: 'Please delete my Stacklens account.\n\nEmail: ' + email });
                    toast.success(t('contact_sent_title'));
                  } catch { toast.error(t('contact_error')); }
                },
              },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-3 border-b border-rose-500/10 last:border-0">
                <div>
                  <div className="font-medium text-slate-200 text-sm">{item.label}</div>
                  <div className="text-xs text-slate-500">{item.desc}</div>
                </div>
                <button onClick={item.onClick}
                  className={"text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors " + (item.danger ? 'border-rose-500/40 text-rose-400 hover:bg-rose-500/10' : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600')}>
                  {item.btn}
                </button>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
