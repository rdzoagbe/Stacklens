import { useState } from 'react';
import qrcode from 'qrcode-generator';
import toast from 'react-hot-toast';
import { KeyRound } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Input } from './ui';
import { secondFactors, startTwoStep, finishTwoStep, removeTwoStep } from '../firebase-config';
import { mfaErrorText } from '../lib/secondFactor';

/** The otpauth:// address as a QR image (a data URL: nothing leaves the page). */
function qrImage(url) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  return qr.createDataURL(5, 10);
}

// Settings → Security: two-step sign-in with an authenticator app (TOTP) for
// the signed-in account. The secret is shown once, as a QR code and as text,
// and kept only in this component's state until the first code confirms it.
export function TwoStepCard({ firebaseUser, t, language }) {
  const [factors, setFactors] = useState(() => secondFactors());
  const [setup, setSetup] = useState(null); // { secret, qrUrl, key }
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!firebaseUser) return null;
  const verified = firebaseUser.emailVerified !== false;
  const run = async (fn) => {
    setBusy(true);
    setError('');
    try { await fn(); } catch (err) { setError(mfaErrorText(err, t)); } finally { setBusy(false); }
  };
  const date = (s) => { const d = new Date(s); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(language); };

  return (
    <div data-testid="two-step-card"><Card>
      <CardHeader title={t('mfa_title')} subtitle={t('mfa_card_sub')} />
      <CardBody>
        {factors.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <KeyRound className="h-5 w-5 text-emerald-400" aria-hidden="true" />
            <p className="text-sm text-slate-300">{t('mfa_on').replace('{date}', date(factors[0].enrollmentTime))}</p>
            <Button variant="secondary" disabled={busy} onClick={() => {
              if (!window.confirm(t('mfa_turn_off_confirm'))) return;
              run(async () => {
                for (const f of factors) await removeTwoStep(f.uid);
                setFactors(secondFactors());
                toast.success(t('mfa_turned_off'));
              });
            }}>{t('mfa_turn_off')}</Button>
          </div>
        ) : !setup ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-400">{t('mfa_off')}</p>
            {verified
              ? <Button disabled={busy} onClick={() => run(async () => setSetup(await startTwoStep()))}>{t('mfa_enable')}</Button>
              : <p className="text-sm text-amber-400">{t('mfa_need_verified')}</p>}
          </div>
        ) : (
          <div className="flex flex-wrap gap-6">
            <img src={qrImage(setup.qrUrl)} alt="" width="210" height="210" className="rounded-lg bg-white p-2" />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-sm text-slate-300">{t('mfa_scan')}</p>
              <p className="text-xs text-slate-500">{t('mfa_key')}: <code className="break-all text-slate-200">{setup.key}</code></p>
              <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await finishTwoStep(setup.secret, code);
                  setSetup(null);
                  setCode('');
                  setFactors(secondFactors());
                  toast.success(t('mfa_turned_on'));
                });
              }}>
                <label className="text-sm text-slate-300">{t('mfa_code_label')}
                  <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric"
                    autoComplete="one-time-code" maxLength={8} className="mt-1 w-40 tracking-widest" />
                </label>
                <Button type="submit" disabled={busy || code.replace(/\s+/g, '').length < 6}>{t('mfa_turn_on')}</Button>
                <Button variant="ghost" onClick={() => { setSetup(null); setCode(''); setError(''); }}>{t('cancel')}</Button>
              </form>
            </div>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-400" role="alert">{error}</p>}
      </CardBody>
    </Card></div>
  );
}
