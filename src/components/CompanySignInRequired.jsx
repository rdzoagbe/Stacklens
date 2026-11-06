import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ShieldCheck } from 'lucide-react';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { signInWithGoogle, signInWithMicrosoft, signOutUser, authErrorMessage } from '../firebase-config';
import { clearLocalWorkspace } from '../lib/db';
import { subscribeSsoBlock, currentSsoBlock, clearSsoBlock, providerKind } from '../lib/sso';

// ── "This workspace requires company sign-in" ──────────────────────────────
//
// Shown over everything (mounted once in App, like the second-step prompt)
// when the account, or a shared workspace, requires a Google or Microsoft
// session and this one is not (lib/sso.js). The refusal already happened on
// the server; this screen only says which button to use. For the person's
// own account nothing was loaded, so the way out is one of the two buttons
// or signing out. For a shared workspace they keep their own.

const fill = (s, vars) => Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), s);

export function CompanySignInRequired() {
  const { language } = useLang();
  const t = useTranslation(language);
  const [block, setBlock] = useState(currentSsoBlock);
  const [busy, setBusy] = useState(false);
  useEffect(() => subscribeSsoBlock(setBlock), []);
  if (!block) return null;

  const signIn = async (fn) => {
    setBusy(true);
    const { user, error } = await fn();
    if (error) {
      const msg = authErrorMessage(error, t, { sso: true });
      if (msg) toast.error(msg); // '' = the popup was closed: say nothing
      setBusy(false);
      return;
    }
    // A new session: the auth hook checks it again and loads the workspace.
    // A full load, like every other sign-in path.
    if (user) { clearSsoBlock(); window.location.replace('/dashboard'); }
    setBusy(false);
  };
  const signOut = async () => {
    setBusy(true);
    await signOutUser();
    clearLocalWorkspace();
    localStorage.removeItem('sg_auth_uid');
    clearSsoBlock();
    setBusy(false);
  };

  const method = t(providerKind(block.signedInWith) === 'password' ? 'sso_block_method_password' : 'sso_block_method_other');
  const body = block.scope === 'shared'
    ? fill(t('sso_block_shared'), { owner: block.owner || t('sso_block_owner_fallback'), method })
    : fill(t('sso_block_own'), { account: block.owner || t('sso_block_owner_fallback'), method });

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="sso-block-title" data-testid="sso-block">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-blue-400 flex-shrink-0" />
          <h1 id="sso-block-title" className="text-lg font-bold text-white">{t('sso_block_title')}</h1>
        </div>
        <p className="text-sm text-slate-300">{body}</p>
        <p className="text-xs text-slate-500">{t('sso_block_hint')}</p>
        <div className="space-y-2">
          <button type="button" disabled={busy} onClick={() => signIn(signInWithGoogle)}
            className="w-full py-3 bg-white hover:bg-slate-100 rounded-xl text-slate-900 font-bold text-sm transition-all disabled:opacity-50">
            {t('lp_continue_google')}
          </button>
          <button type="button" disabled={busy} onClick={() => signIn(signInWithMicrosoft)}
            className="w-full py-3 bg-white hover:bg-slate-100 rounded-xl text-slate-900 font-bold text-sm transition-all disabled:opacity-50">
            {t('lp_continue_microsoft')}
          </button>
        </div>
        {block.scope === 'shared' ? (
          <button type="button" onClick={clearSsoBlock} className="w-full text-sm text-slate-400 hover:text-white">{t('sso_block_back')}</button>
        ) : (
          <button type="button" disabled={busy} onClick={signOut} className="w-full text-sm text-slate-400 hover:text-white">{t('logout')}</button>
        )}
      </div>
    </div>
  );
}
