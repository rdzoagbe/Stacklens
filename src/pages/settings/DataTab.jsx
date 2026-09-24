import { useState } from 'react';
import toast from 'react-hot-toast';
import { Boxes, Download, FileJson, Users } from 'lucide-react';
import { saveUserData, deleteAccount, signOutUser, createBillingPortal } from '../../firebase-config';
import { loadDb, saveDb, seedDbIfEmpty, todayISO } from '../../lib/db';
import { toCsv, downloadText } from '../../lib/dataUtils';
import { downloadWorkspaceExport } from '../../lib/workspace-export';
import { track } from '../../lib/analytics';
import { Card, CardHeader, CardBody, Modal, Button, Input } from '../../components/ui';

// ── Deleting the account ─────────────────────────────────────────────────────
//
// This button used to post a message to hello@stacklens.fr through a US
// contact-form service and delete nothing, while the DPA, the privacy policy
// and the security page all promised self-service erasure. The erasure was
// already built and tested (the workspace function's `deleteaccount` action
// and purgeAccount), with nothing calling it. It is called now.
//
// The server requires a verified email typed back exactly, and refuses while a
// Stripe subscription can still bill — purging the account would otherwise
// leave that subscription charging a deleted customer.
function DeleteAccountModal({ open, onClose, email, t }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsCancel, setNeedsCancel] = useState(false);
  const matches = !!email && typed.trim().toLowerCase() === email.toLowerCase();

  const close = () => { if (busy) return; setTyped(''); setError(''); setNeedsCancel(false); onClose(); };

  const run = async () => {
    if (!matches || busy) return;
    setBusy(true); setError(''); setNeedsCancel(false);
    try {
      await deleteAccount(typed.trim());
      toast.success(t('del_acct_done'));
      try { await signOutUser(); } catch { /* the account is already gone */ }
      window.location.assign('/');
    } catch (err) {
      if (err.code === 'subscription_active') setNeedsCancel(true);
      setError(err.message || t('del_acct_failed'));
      setBusy(false);
    }
  };

  const openPortal = async () => {
    try {
      const { url } = await createBillingPortal();
      if (url) window.location.href = url;
    } catch (err) { toast.error(err.message || t('del_acct_failed')); }
  };

  return (
    <Modal open={open} onClose={close} title={t('del_acct_title')}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={busy}>{t('cancel')}</Button>
          <Button variant="danger" onClick={run} disabled={!matches || busy}>
            {busy ? t('del_acct_working') : t('del_acct_confirm_btn')}
          </Button>
        </div>
      )}>
      <div className="space-y-4 text-sm">
        <p className="text-slate-300">{t('del_acct_body')}</p>
        <p className="text-slate-400">{t('del_acct_export_first')}</p>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            {t('del_acct_type')} <span className="text-slate-200">{email}</span>
          </label>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)}
            autoComplete="off" spellCheck={false} placeholder={email} aria-label={t('del_acct_type')} />
        </div>
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-200">
            {error}
            {needsCancel && (
              <div className="mt-2">
                <Button size="sm" variant="secondary" onClick={openPortal}>{t('del_acct_manage_sub')}</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function DataTab({ db, firebaseUser, isDemo, qc, t }) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('export_data')} subtitle={t('export_data_sub')} />
        <CardBody>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                // The whole workspace in one file. The security page promises
                // "export everything"; the CSVs below cover four lists, so this
                // is the tile that makes that sentence true.
                label: t('set_export_all'),
                desc: t('set_export_all_desc'),
                icon: FileJson,
                onClick: () => {
                  downloadWorkspaceExport({ name: db?.user?.company || 'workspace', orgId: null, data: db });
                  toast.success(t('set_export_all_done'));
                  track('report_exported', { type: 'workspace_json' });
                },
              },
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
                onClick: async () => {
                  if (isDemo) { toast.error(t('set_demo_error')); return; }
                  if (!window.confirm(t('set_del_tools_confirm'))) return;
                  const cur = loadDb() || seedDbIfEmpty();
                  cur.tools = []; cur.employees = []; cur.access = [];
                  saveDb(cur);
                  qc.invalidateQueries({ queryKey: ['db'] });
                  // Await the cloud wipe: if it fails while the local wipe
                  // succeeded, hydration can resurrect the deleted data — so
                  // never report success we did not achieve.
                  if (firebaseUser?.uid) {
                    try { await saveUserData(firebaseUser.uid, cur); }
                    catch { toast.error(t('set_del_cloud_error'), { duration: 8000 }); return; }
                  }
                  toast.success(t('set_del_tools_done'));
                },
              },
              {
                label: t('set_del_emp'),
                desc: t('set_del_emp_desc'),
                btn: t('set_del_emp_btn'),
                onClick: async () => {
                  if (isDemo) { toast.error(t('set_demo_error')); return; }
                  if (!window.confirm(t('set_del_emp_confirm'))) return;
                  const cur = loadDb() || seedDbIfEmpty();
                  cur.employees = []; cur.access = [];
                  saveDb(cur);
                  qc.invalidateQueries({ queryKey: ['db'] });
                  if (firebaseUser?.uid) {
                    try { await saveUserData(firebaseUser.uid, cur); }
                    catch { toast.error(t('set_del_cloud_error'), { duration: 8000 }); return; }
                  }
                  toast.success(t('set_del_emp_done'));
                },
              },
              {
                label: t('set_del_account'),
                desc: t('set_del_account_desc'),
                btn: t('set_del_account_btn'),
                danger: true,
                onClick: () => {
                  if (isDemo) { toast.error(t('set_demo_error')); return; }
                  setDeleting(true);
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
      <DeleteAccountModal open={deleting} onClose={() => setDeleting(false)}
        email={firebaseUser?.email || ''} t={t} />
    </div>
  );
}
