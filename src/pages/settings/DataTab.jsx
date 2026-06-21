import toast from 'react-hot-toast';
import { Boxes, Download, Users } from 'lucide-react';
import { saveUserData } from '../../firebase-config';
import { loadDb, saveDb, seedDbIfEmpty, todayISO } from '../../lib/db';
import { toCsv, downloadText } from '../../lib/dataUtils';
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
                label: 'Tools & Licenses',
                desc: 'All tool records, costs, owners',
                icon: Boxes,
                onClick: () => {
                  downloadText(`stacklens_tools_${todayISO()}.csv`, toCsv(db?.tools || [],
                    ["name","category","owner_email","criticality","url","derived_status","last_used_date","cost_per_month","derived_risk","notes"]
                  ));
                  toast.success('Tools exported');
                },
              },
              {
                label: 'Employees & Access',
                desc: 'Employee directory and access map',
                icon: Users,
                onClick: () => {
                  downloadText(`stacklens_employees_${todayISO()}.csv`, toCsv(db?.employees || [],
                    ["full_name","email","department","role","status","start_date","end_date"]
                  ));
                  setTimeout(() => downloadText(`stacklens_access_${todayISO()}.csv`, toCsv(db?.access || [],
                    ["tool_name","employee_name","employee_email","access_level","granted_date","last_accessed_date","last_reviewed_date","status","derived_risk_flag"]
                  )), 300);
                  toast.success('Employees & access exported');
                },
              },
              {
                label: 'Audit Log',
                desc: 'Full history of all actions',
                icon: Download,
                onClick: () => {
                  downloadText(`stacklens_audit_${todayISO()}.csv`, toCsv(db?.audit_log || [],
                    ["action","user","timestamp","details"]
                  ));
                  toast.success('Audit log exported');
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
                label: 'Delete all tool data',
                desc: 'Removes all tools, employees and access records',
                btn: 'Delete Tools',
                onClick: () => {
                  if (isDemo) { toast.error('Not available in demo mode.'); return; }
                  if (!window.confirm('Delete ALL tools, employees and access records? This cannot be undone.')) return;
                  const cur = loadDb() || seedDbIfEmpty();
                  cur.tools = []; cur.employees = []; cur.access = [];
                  saveDb(cur);
                  if (firebaseUser?.uid) saveUserData(firebaseUser.uid, cur).catch(() => {});
                  qc.invalidateQueries({ queryKey: ['db'] });
                  toast.success('All tool data deleted');
                },
              },
              {
                label: 'Delete all employee data',
                desc: 'Removes all employee and access records',
                btn: 'Delete Employees',
                onClick: () => {
                  if (isDemo) { toast.error('Not available in demo mode.'); return; }
                  if (!window.confirm('Delete ALL employees and access records? This cannot be undone.')) return;
                  const cur = loadDb() || seedDbIfEmpty();
                  cur.employees = []; cur.access = [];
                  saveDb(cur);
                  if (firebaseUser?.uid) saveUserData(firebaseUser.uid, cur).catch(() => {});
                  qc.invalidateQueries({ queryKey: ['db'] });
                  toast.success('All employee data deleted');
                },
              },
              {
                label: 'Delete account',
                desc: 'Permanently deletes your Stacklens account and all data',
                btn: 'Delete Account',
                danger: true,
                onClick: async () => {
                  if (isDemo) { toast.error('Not available in demo mode.'); return; }
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
