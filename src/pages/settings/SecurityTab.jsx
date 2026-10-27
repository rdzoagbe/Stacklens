import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui';
import { useDbQuery } from '../../hooks/useDbQuery';
import { loadDb, saveDb, seedDbIfEmpty, saveOwnWorkspaceNow, getSharedView } from '../../lib/db';
import { hasRole } from '../../components/gates';
import { PROTECTION_FIELD } from '../../lib/screenProtection';
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

export function SecurityTab({ t, firebaseUser, qc }) {
  const navigate = useNavigate();
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

      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardBody>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white text-sm mb-1">{t('sso_enterprise')}</div>
              <p className="text-xs text-slate-400">{t('set_sso_desc')}</p>
              {/* This pointed at the Enterprise plan, which does not include
                  SSO either: no plan does. Directory sync is in Integrations. */}
              <button onClick={() => navigate('/settings?tab=integrations')} className="text-xs text-amber-400 font-semibold hover:underline mt-2 inline-block">{t('set_view_integrations')}</button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
