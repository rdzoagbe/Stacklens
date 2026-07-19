import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Zap, RefreshCw, Copy } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui';
import { apiKeysList, apiKeysCreate, apiKeysRevoke, API_BASE_URL } from '../../firebase-config';

export function ApiKeysTab({ t }) {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKey, setShowNewKey] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { keys } = await apiKeysList();
        if (!cancelled) setApiKeys(keys);
      } catch {
        if (!cancelled) toast.error('Could not load API keys');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const refresh = async () => {
    try { setApiKeys((await apiKeysList()).keys); } catch { /* keep current list */ }
  };

  const generateApiKey = async () => {
    if (!newKeyName.trim() || busy) return;
    setBusy(true);
    try {
      const { key } = await apiKeysCreate(newKeyName.trim());
      setShowNewKey(key);
      setNewKeyName('');
      await refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const revokeKey = async (k) => {
    if (!window.confirm(t('set_revoke_confirm').replace('{name}', k.name))) return;
    setBusy(true);
    try {
      await apiKeysRevoke(k.keyId);
      toast.success(`Revoked ${k.name}`);
      await refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString() : '—';
  const curlExample = `curl ${API_BASE_URL}/spend \\\n  -H "Authorization: Bearer sk_live_..."`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('api_keys_title')} subtitle={t('api_keys_sub')} />
        <CardBody>
          {showNewKey && (
            <div className="mb-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="text-sm font-bold text-emerald-400 mb-1">✓ {t('set_api_new_msg')}</div>
              <div className="text-xs text-amber-400 mb-2">This key is shown only once — copy it now.</div>
              <div className="font-mono text-xs bg-slate-900 px-3 py-2 rounded-lg text-white break-all">{showNewKey}</div>
              <button onClick={() => { navigator.clipboard.writeText(showNewKey); toast.success('Copied'); }} className="text-xs text-emerald-400 mt-2 hover:underline">{t('hc_copy_to_clipboard')}</button>
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-8"><RefreshCw size={18} className="animate-spin text-slate-500" /></div>
          ) : apiKeys.length === 0 ? (
            <div className="text-sm text-slate-500 py-4 text-center">No API keys yet — generate one below.</div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map(k => (
                <div key={k.keyId} className="flex items-center gap-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <Zap className="h-4 w-4 text-slate-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm">{k.name}</div>
                    <div className="font-mono text-xs text-slate-500">{k.prefix}</div>
                  </div>
                  <div className="text-right text-xs text-slate-600">
                    <div>{t('set_created')} {fmtDate(k.created_at)}</div>
                    <div>{t('set_last_used')} {fmtDate(k.last_used_at)}</div>
                  </div>
                  <button onClick={() => revokeKey(k)} disabled={busy} className="text-xs text-rose-500 hover:text-rose-400 transition-colors flex-shrink-0 disabled:opacity-40">{t('revoke')}</button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('set_gen_new_key')} subtitle={t('set_gen_key_sub')} />
        <CardBody>
          <div className="flex gap-3">
            <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generateApiKey()}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500 transition-colors" placeholder={t('key_name_placeholder')} />
            <button onClick={generateApiKey} disabled={busy || !newKeyName.trim()}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap disabled:opacity-50">
              {busy ? '…' : t('set_gen_key_btn')}
            </button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Read-only REST API" subtitle="Pull your Stacklens data into spreadsheets, BI tools, or scripts. Requires the Enterprise plan." />
        <CardBody>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Base URL</div>
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs bg-slate-900 px-3 py-2 rounded-lg text-emerald-300 break-all flex-1">{API_BASE_URL}</code>
                <button onClick={() => { navigator.clipboard.writeText(API_BASE_URL); toast.success('Copied'); }} className="p-2 text-slate-500 hover:text-white transition-colors"><Copy size={14} /></button>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Endpoints</div>
              <div className="space-y-1.5">
                {[
                  ['GET /tools', 'All SaaS tools with cost, status, owner, and risk'],
                  ['GET /employees', 'All employees with department, role, and status'],
                  ['GET /spend', 'Monthly & annual totals plus per-category breakdown'],
                ].map(([ep, desc]) => (
                  <div key={ep} className="flex items-baseline gap-3">
                    <code className="font-mono text-xs text-blue-300 whitespace-nowrap">{ep}</code>
                    <span className="text-xs text-slate-400">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Example</div>
              <pre className="font-mono text-xs bg-slate-900 px-3 py-2 rounded-lg text-slate-300 overflow-x-auto whitespace-pre">{curlExample}</pre>
            </div>
            <div className="text-xs text-slate-500">Rate limit: 120 requests/hour. Keys are stored hashed and can be revoked at any time.</div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
