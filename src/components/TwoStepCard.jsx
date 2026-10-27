import { useEffect, useState } from 'react';
import qrcode from 'qrcode-generator';
import toast from 'react-hot-toast';
import { KeyRound } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Input } from './ui';
import {
  secondFactors, startTwoStep, finishTwoStep, removeTwoStep, resendEmailVerification, refreshEmailVerified, addVerifiedEmail,
} from '../firebase-config';
import { mfaErrorText } from '../lib/secondFactor';

/** Seconds before the verification link can be sent again, as on the sign-up screen. */
const RESEND_COOLDOWN_SECONDS = 60;

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
  // Firebase refuses an authenticator for an unverified address, and the link
  // sent at sign-up may be long gone: the card sends it again and re-reads
  // the flag from the server, so nobody has to sign out to get past this.
  const [verifiedNow, setVerifiedNow] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [newEmail, setNewEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  if (!firebaseUser) return null;
  const verified = verifiedNow || firebaseUser.emailVerified !== false;
  // A Microsoft sign-in can reach Firebase with no email at all: then there
  // is no link to resend, and the account needs an address added first.
  const noEmail = !firebaseUser.email;
  const run = async (fn) => {
    setBusy(true);
    setError('');
    try { await fn(); } catch (err) { setError(mfaErrorText(err, t)); } finally { setBusy(false); }
  };
  // The email steps report their own sentence (or Firebase's), not a two-step error.
  const verifyStep = async (fn) => {
    setBusy(true);
    setError('');
    try { setError(await fn()); } catch (err) { setError(err?.message || String(err)); } finally { setBusy(false); }
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
              : (
                <div className="w-full space-y-2">
                  <p className="text-sm text-amber-400">{t(noEmail ? 'mfa_need_email' : 'mfa_need_verified')}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {noEmail ? (
                      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => {
                        e.preventDefault();
                        verifyStep(async () => {
                          const { error: err, code } = await addVerifiedEmail(newEmail);
                          if (err) return code ? mfaErrorText({ code }, t) : err;
                          setCooldown(RESEND_COOLDOWN_SECONDS);
                          setSentTo(newEmail.trim());
                          return '';
                        });
                      }}>
                        <Input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                          aria-label={t('mfa_email_label')} placeholder={t('mfa_email_label')} autoComplete="email" className="w-64" />
                        <Button type="submit" variant="secondary" disabled={busy || cooldown > 0 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail.trim())}>
                          {cooldown > 0 ? `${t('resend_in')} ${cooldown}s` : t('mfa_add_email')}
                        </Button>
                      </form>
                    ) : (
                    <Button variant="secondary" disabled={busy || cooldown > 0} onClick={() => verifyStep(async () => {
                      const { error: err } = await resendEmailVerification();
                      if (err) return err;
                      setCooldown(RESEND_COOLDOWN_SECONDS);
                      toast.success(t('verification_resent'));
                      return '';
                    })}>
                      {cooldown > 0 ? `${t('resend_in')} ${cooldown}s` : t('resend_verification')}
                    </Button>
                    )}
                    <Button variant="ghost" disabled={busy} onClick={() => verifyStep(async () => {
                      const { verified: ok, error: err } = await refreshEmailVerified();
                      if (err) return err;
                      if (!ok) return t('email_not_verified_yet');
                      setVerifiedNow(true);
                      return '';
                    })}>{t('ive_verified')}</Button>
                  </div>
                  {sentTo && noEmail && <p className="text-sm text-slate-300" role="status">{t('mfa_email_link_sent').replace('{email}', sentTo)}</p>}
                  {cooldown > 0 && <p className="text-xs text-slate-500">{t('verify_check_spam_title')}</p>}
                </div>
              )}
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
