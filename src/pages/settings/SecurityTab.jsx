import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardHeader, CardBody } from '../../components/ui';
import { useDbQuery } from '../../hooks/useDbQuery';
import { loadDb, saveDb, seedDbIfEmpty, saveOwnWorkspaceNow, getSharedView } from '../../lib/db';
import { hasRole } from '../../components/gates';
import { PROTECTION_FIELD } from '../../lib/screenProtection';
import { SSO_FIELD, isSsoProvider, signInProviderOf } from '../../lib/sso';
import { setSsoRequired } from '../../firebase-config';
import { TwoStepCard } from '../../components/TwoStepCard';
import { useLang } from '../../contexts/LangContext';

// ── Settings → Security ────────────────────────────────────────────────────
//
// This tab used to show four switches: Require MFA, IP restriction, Audit
// logging, and a session timeout. Every one of them wrote to a localStorage
// key called `sg_security` that nothing else in the codebase ever read — the
// toggles read it back only to redraw their own positions.
//
// So a customer's IT reviewer could turn on "Enforce multi-factor
// authentication", see it save, and have enforced nothing. In a product sold
// on access governance that is worse than the feature being absent: absent is
// a gap, a switch is a claim.
//
// Replaced with what is actually true. Each line below corresponds to
// something enforced in code — the Firestore rules, the per-account rate
// limits, the audit trail, the write-only credential store — and the roadmap
// card names what is not, so nobody has to infer it from an empty list. App
// Check is in the roadmap card: the client sends the token, but
// verifyAppCheck in functions/index.js lets every request through.
//
// The switches come back when they work, not before. Note that nothing here
// quotes a test count: a number in customer-facing copy goes stale silently,
// which is the drift plan-claims.test.js exists to catch in the README.

// The one switch here that does something, and it says what: a deterrent that
// makes a leak traceable, not a lock (a page cannot stop a screenshot).
function ScreenProtectionCard({ firebaseUser, qc, t }) {
  const { data: db } = useDbQuery();
  const shared = !!getSharedView();
  const on = db?.user?.[PROTECTION_FIELD] === true;
  // Owners and admins set it; in someone else's workspace it is theirs to set.
  const canChange = hasRole('admin') && !shared;
  const set = (value) => {
    const cur = loadDb() || seedDbIfEmpty();
    cur.user = { ...cur.user, [PROTECTION_FIELD]: value };
    saveDb(cur);
    saveOwnWorkspaceNow(firebaseUser?.uid, cur).catch(() => {});
    qc?.invalidateQueries({ queryKey: ['db'] });
  };
  return (
    <div data-testid="screen-protection-card"><Card>
      <CardHeader title={t('screen_prot_title')} subtitle={t('screen_prot_sub')} />
      <CardBody>
        <div className="flex items-start justify-between gap-4">
          <ul className="space-y-1.5 text-sm text-slate-300">
            <li>• {t('screen_prot_l1')}</li>
            <li>• {t('screen_prot_l2')}</li>
            <li>• {t('screen_prot_l3')}</li>
            <li>• {t('screen_prot_l4')}</li>
          </ul>
          <button type="button" role="switch" aria-checked={on} aria-label={t('screen_prot_title')}
            disabled={!canChange} onClick={() => set(!on)}
            className={'relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-40 ' + (on ? 'bg-emerald-500' : 'bg-slate-700')}>
            <div className={'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ' + (on ? 'translate-x-5' : 'translate-x-0.5')} />
          </button>
        </div>
        <p className="mt-4 text-xs text-amber-300/90" data-testid="screen-protection-limits">{t('screen_prot_limits')}</p>
        {!canChange && <p className="mt-2 text-xs text-slate-500">{t(shared ? 'screen_prot_shared' : 'screen_prot_admins')}</p>}
      </CardBody>
    </Card></div>
  );
}

// Mandatory company sign-in (lib/sso.js). The switch lives on /users/{uid},
// which only a Google or Microsoft session may change (firestore.rules), so
// the card asks the session which provider started it before offering it.
function CompanySignInCard({ firebaseUser, qc, t }) {
  const navigate = useNavigate();
  const { data: db } = useDbQuery();
  const shared = !!getSharedView();
  const isDemo = db?.user?.is_demo === true;
  const on = db?.user?.[SSO_FIELD] === true;
  const [provider, setProvider] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.resolve(firebaseUser?.getIdTokenResult?.()).then((r) => { if (live) setProvider(signInProviderOf(r)); }).catch(() => {});
    return () => { live = false; };
  }, [firebaseUser]);
  const sessionIsSso = isSsoProvider(provider);
  const canChange = hasRole('admin') && !shared && !isDemo && sessionIsSso && !!firebaseUser?.uid;
  const why = shared ? t('screen_prot_shared')
    : isDemo ? t('sso_req_demo')
    : !hasRole('admin') ? t('screen_prot_admins')
    : !sessionIsSso ? t('sso_req_need_sso') : '';

  const set = async (value) => {
    if (!canChange || busy) return;
    setBusy(true);
    try {
      await setSsoRequired(firebaseUser.uid, value);
      // The truth is /users; the copy in the workspace is what the card shows.
      const cur = loadDb() || seedDbIfEmpty();
      cur.user = { ...cur.user, [SSO_FIELD]: value };
      saveDb(cur, { cloudSync: false });
      qc?.invalidateQueries({ queryKey: ['db'] });
      toast.success(t(value ? 'sso_req_on' : 'sso_req_off'));
    } catch {
      toast.error(t('sso_req_failed'));
    } finally { setBusy(false); }
  };
  return (
    <div data-testid="company-signin-card"><Card>
      <CardHeader title={t('sso_req_title')} subtitle={t('sso_req_sub')} />
      <CardBody>
        <div className="flex items-start justify-between gap-4">
          <ul className="space-y-1.5 text-sm text-slate-300">
            <li>• {t('sso_req_l1')}</li>
            <li>• {t('sso_req_l2')}</li>
            <li>• {t('sso_req_l3')}</li>
          </ul>
          <button type="button" role="switch" aria-checked={on} aria-label={t('sso_req_title')}
            disabled={!canChange || busy} onClick={() => set(!on)}
            className={'relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-40 ' + (on ? 'bg-emerald-500' : 'bg-slate-700')}>
            <div className={'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ' + (on ? 'translate-x-5' : 'translate-x-0.5')} />
          </button>
        </div>
        {why && <p className="mt-3 text-xs text-slate-500" data-testid="company-signin-why">{why}</p>}
        <p className="mt-4 text-xs text-slate-400">{t('set_sso_desc')}</p>
        <button onClick={() => navigate('/settings?tab=integrations')} className="text-xs text-blue-300 font-semibold hover:underline mt-2 inline-block">{t('set_view_integrations')}</button>
      </CardBody>
    </Card></div>
  );
}

export function SecurityTab({ t, firebaseUser, qc }) {
  const { language } = useLang();

  const enforced = [
    t('sec_real_isolation'),
    t('sec_real_creds'),
    t('sec_real_ratelimit'),
    t('sec_real_audit'),
  ];

  return (
    <div className="space-y-4">
      <TwoStepCard firebaseUser={firebaseUser} t={t} language={language} />
      <CompanySignInCard firebaseUser={firebaseUser} qc={qc} t={t} />
      <ScreenProtectionCard firebaseUser={firebaseUser} qc={qc} t={t} />
      <Card>
        <CardHeader title={t('sec_real_title')} subtitle={t('sec_real_sub')} />
        <CardBody>
          <ul className="space-y-3">
            {enforced.map((line) => (
              <li key={line} className="flex items-start gap-3">
                <Check className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-300">{line}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card className="border-slate-700/50">
        <CardBody>
          <div className="font-bold text-white text-sm mb-1">{t('sec_roadmap_title')}</div>
          <p className="text-xs text-slate-400">{t('sec_roadmap_body')}</p>
          <p className="text-xs text-slate-400 mt-2">{t('sec_real_appcheck')}</p>
        </CardBody>
      </Card>
    </div>
  );
}
