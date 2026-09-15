import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui';

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
// something enforced in code — the Firestore rules, the App Check token, the
// per-account rate limits, the audit trail, the write-only credential store —
// and the roadmap card names the three that are not, so nobody has to infer
// it from an empty list.
//
// The switches come back when they work, not before. Note that nothing here
// quotes a test count: a number in customer-facing copy goes stale silently,
// which is the drift plan-claims.test.js exists to catch in the README.

export function SecurityTab({ t }) {
  const navigate = useNavigate();

  const enforced = [
    t('sec_real_isolation'),
    t('sec_real_appcheck'),
    t('sec_real_creds'),
    t('sec_real_ratelimit'),
    t('sec_real_audit'),
  ];

  return (
    <div className="space-y-4">
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
