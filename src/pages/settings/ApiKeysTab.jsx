import { useState } from 'react';
import { Zap } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui';

export function ApiKeysTab({ t }) {
  const _savedApiKeys = (() => { try { return JSON.parse(localStorage.getItem('sg_api_keys') || '[]'); } catch { return []; } })();
  const [apiKeys, setApiKeys] = useState(_savedApiKeys);
  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKey, setShowNewKey] = useState(null);

  const saveApiKeys = (next) => { localStorage.setItem('sg_api_keys', JSON.stringify(next)); setApiKeys(next); };

  const generateApiKey = () => {
    if (!newKeyName.trim()) return;
    const key = 'sg_live_' + Math.random().toString(36).slice(2, 18) + Math.random().toString(36).slice(2, 18);
    const newK = { id: 'key_' + Date.now(), name: newKeyName, created: new Date().toISOString().slice(0,10), lastUsed: 'Never', prefix: key.slice(0,16) + '••••' };
    saveApiKeys([...apiKeys, newK]);
    setShowNewKey(key);
    setNewKeyName('');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('api_keys_title')} subtitle={t('api_keys_sub')} />
        <CardBody>
          {showNewKey && (
            <div className="mb-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="text-sm font-bold text-emerald-400 mb-1">✓ {t('set_api_new_msg')}</div>
              <div className="font-mono text-xs bg-slate-900 px-3 py-2 rounded-lg text-white break-all">{showNewKey}</div>
              <button onClick={() => { navigator.clipboard.writeText(showNewKey); }} className="text-xs text-emerald-400 mt-2 hover:underline">{t("hc_copy_to_clipboard")}</button>
            </div>
          )}
          <div className="space-y-3">
            {apiKeys.map(k => (
              <div key={k.id} className="flex items-center gap-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <Zap className="h-4 w-4 text-slate-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-sm">{k.name}</div>
                  <div className="font-mono text-xs text-slate-500">{k.prefix}</div>
                </div>
                <div className="text-right text-xs text-slate-600">
                  <div>{t('set_created')} {k.created}</div>
                  <div>{t('set_last_used')} {k.lastUsed}</div>
                </div>
                <button onClick={() => { if (window.confirm(t('set_revoke_confirm').replace('{name}', k.name))) saveApiKeys(apiKeys.filter(x => x.id !== k.id)); }} className="text-xs text-rose-500 hover:text-rose-400 transition-colors flex-shrink-0">{t('revoke')}</button>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('set_gen_new_key')} subtitle={t('set_gen_key_sub')} />
        <CardBody>
          <div className="flex gap-3">
            <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500 transition-colors" placeholder={t('key_name_placeholder')} />
            <button onClick={generateApiKey}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap">
              {t('set_gen_key_btn')}
            </button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
