import React from 'react';
import toast from 'react-hot-toast';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';

export function SlackNotifications() {
  const { language } = useLang();
  const t = useTranslation(language);
  const [webhook, setWebhook] = React.useState(localStorage.getItem('slack_webhook') || '');
  const [saved, setSaved] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  const save = () => {
    localStorage.setItem('slack_webhook', webhook);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const test = async () => {
    if (!webhook) return;
    setTesting(true);
    try {
      await fetch(webhook, {
        method: 'POST',
        body: JSON.stringify({ text: '✅ Stacklens connected! You will receive alerts for security risks, renewals and offboarding.' })
      });
      toast.success(t('slack_test_sent'));
    } catch {
      toast.error(t('slack_test_failed'));
    } finally { setTesting(false); }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-emerald-500/20 rounded-xl text-xl">💬</div>
        <div>
          <h3 className="text-base font-bold text-white">{t('slack_title')}</h3>
          <p className="text-xs text-slate-400">{t('slack_sub')}</p>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">{t('slack_webhook_label')}</label>
          <input
            value={webhook}
            onChange={e => setWebhook(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 transition-colors"
          />
          <p className="text-xs text-slate-500 mt-1">
            <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">{t('slack_create_app')}</a> → Incoming Webhooks → Add New Webhook
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={save} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors">
            {saved ? '✓ Saved!' : 'Save'}
          </button>
          {webhook && (
            <button onClick={test} disabled={testing} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-xl transition-colors">
              {testing ? 'Sending...' : 'Test Connection'}
            </button>
          )}
        </div>
        <div className="pt-2 border-t border-slate-800">
          <p className="text-xs text-slate-500 mb-2">{t('slack_you_will_receive')}</p>
          <div className="grid grid-cols-2 gap-1">
            {[`🚨 ${t('slack_alert_high_risk')}`, `👤 ${t('slack_alert_former')}`, `🔔 ${t('slack_alert_renewals')}`, `⚡ ${t('slack_alert_offboarding')}`].map(a => (
              <div key={a} className="text-xs text-slate-400 flex items-center gap-1">{a}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
