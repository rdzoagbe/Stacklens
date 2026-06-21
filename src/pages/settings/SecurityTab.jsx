import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui';

function Toggle({ checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)} className={"relative w-11 h-6 rounded-full transition-colors " + (checked ? 'bg-emerald-500' : 'bg-slate-700')}>
      <div className={"absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform " + (checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );
}

export function SecurityTab({ t }) {
  const navigate = useNavigate();
  const savedSec = JSON.parse(localStorage.getItem('sg_security') || '{}');
  const [mfaEnabled, setMfaEnabled] = useState(savedSec.mfa ?? false);
  const [sessionTimeout, setSessionTimeout] = useState(savedSec.timeout || '60');
  const [ipRestrict, setIpRestrict] = useState(savedSec.ipRestrict ?? false);
  const [auditLog, setAuditLog] = useState(savedSec.auditLog ?? true);
  const [saveMsg, setSaveMsg] = useState('');

  const save = () => {
    localStorage.setItem('sg_security', JSON.stringify({ mfa: mfaEnabled, timeout: sessionTimeout, ipRestrict, auditLog }));
    setSaveMsg(t('saved_msg'));
    setTimeout(() => setSaveMsg(''), 2000);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('security_settings')} subtitle={t('security_settings_sub')} />
        <CardBody>
          <div className="space-y-4">
            {[
              { label: t('require_mfa'), sub: t('require_mfa_sub'), key: 'mfa', val: mfaEnabled, set: setMfaEnabled },
              { label: t('ip_restriction'), sub: t('ip_restriction_sub'), key: 'ip', val: ipRestrict, set: setIpRestrict },
              { label: t('audit_logging'), sub: t('audit_logging_sub'), key: 'audit', val: auditLog, set: setAuditLog },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
                <div>
                  <div className="font-medium text-slate-200 text-sm">{item.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{item.sub}</div>
                </div>
                <Toggle checked={item.val} onChange={item.set} />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('session_timeout')}</label>
              <select value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500">
                <option value="15">{t('min_15')}</option><option value="30">{t('set_30min')}</option><option value="60">{t('set_1hr')}</option><option value="480">{t('set_8hrs')}</option><option value="0">{t('never')}</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-5">
            <button onClick={save}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm transition-colors">
              {t('set_save_security')}
            </button>
            {saveMsg && <span className="text-sm text-emerald-400 font-semibold">{saveMsg}</span>}
          </div>
        </CardBody>
      </Card>
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardBody>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white text-sm mb-1">{t('sso_enterprise')}</div>
              <p className="text-xs text-slate-400">{t('set_sso_desc')}</p>
              <button onClick={() => { navigate('/settings'); setTimeout(() => { const el = document.querySelector('[data-tab="billing"]'); if(el) el.click(); }, 100); }} className="text-xs text-amber-400 font-semibold hover:underline mt-2 inline-block">{t('set_view_enterprise')}</button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
