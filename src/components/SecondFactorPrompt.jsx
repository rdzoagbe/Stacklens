import { useEffect, useState } from 'react';
import { Modal, Button, Input } from './ui';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { subscribeSecondFactor, currentSecondFactor, submitSecondFactor, cancelSecondFactor, mfaErrorText } from '../lib/secondFactor';

// The six-digit code that finishes a sign-in on an account with two-step
// sign-in (lib/secondFactor.js). Mounted once in App, so every sign-in path
// gets it. Closing it ends that sign-in, silently.
export function SecondFactorPrompt() {
  const { language } = useLang();
  const t = useTranslation(language);
  const [pending, setPending] = useState(currentSecondFactor);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeSecondFactor((p) => { setPending(p); setCode(''); setError(''); }), []);
  if (!pending) return null;

  const submit = async (e) => {
    e?.preventDefault?.();
    setBusy(true);
    setError('');
    try { await submitSecondFactor(code); }
    catch (err) { setError(mfaErrorText(err, t)); }
    finally { setBusy(false); }
  };

  return (
    <Modal open title={t('mfa_title')} subtitle={t('mfa_prompt_body')} onClose={cancelSecondFactor}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={cancelSecondFactor}>{t('cancel')}</Button>
          <Button onClick={submit} disabled={busy || code.replace(/\s+/g, '').length < 6}>{t('mfa_verify')}</Button>
        </div>
      }>
      <form onSubmit={submit} data-testid="second-factor-prompt">
        <label className="block text-sm text-slate-300" htmlFor="second-factor-code">{t('mfa_code_label')}</label>
        <Input id="second-factor-code" value={code} onChange={(e) => setCode(e.target.value)}
          inputMode="numeric" autoComplete="one-time-code" maxLength={8} autoFocus className="mt-1 tracking-widest" />
        {error && <p className="mt-2 text-sm text-red-400" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
