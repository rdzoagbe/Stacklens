import { useState } from 'react';
import toast from 'react-hot-toast';
import { Card, CardHeader, CardBody, Button } from './ui';
import { loadUserData, workspaceRead } from '../firebase-config';
import { loadDb, saveDb, saveOwnWorkspaceNow, adoptCloudCopy } from '../lib/db';
import { compareCopies, fetchStoredCopy } from '../lib/reconcile';

// ── Settings → Data → "Compare with the stored copy" ───────────────────────
//
// The browser's copy against the server's, collection by collection, by
// record id (lib/reconcile.js). Reads both, changes nothing until one of the
// two buttons is pressed: Save now writes this copy (the usual revision-
// checked save), Use the stored copy replaces this browser's and reloads.

const fill = (s, vars) => Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), s);
const when = (ms, language) => (ms ? new Date(ms).toLocaleString(language === 'en' ? 'en-GB' : language) : '—');

export function ReconcilePanel({ db, firebaseUser, isDemo, t, language = 'en', deps = null }) {
  const [state, setState] = useState({ phase: 'idle' });
  const readers = deps || { loadUserData, workspaceRead };
  const shared = !!db?._shared_view;
  const canWrite = shared ? db?._shared_view?.role === 'editor' : !!firebaseUser?.uid;

  const compare = async () => {
    setState({ phase: 'running' });
    try {
      const here = loadDb() || db;
      const stored = await fetchStoredCopy(here, firebaseUser?.uid, readers);
      setState({ phase: 'done', result: compareCopies(here, stored) });
    } catch (err) {
      setState({ phase: 'error', message: err?.message || String(err) });
    }
  };
  const saveNow = async () => {
    try {
      const here = loadDb();
      if (shared) saveDb(here); else await saveOwnWorkspaceNow(firebaseUser.uid, here);
      toast.success(t('rc_saved'));
      await compare();
    } catch (err) { toast.error(err?.message || t('rc_failed')); }
  };
  const useStored = async () => {
    try { await adoptCloudCopy(firebaseUser.uid); }
    catch (err) { toast.error(err?.message || t('rc_failed')); }
  };

  const r = state.result;
  return (
    <Card>
      <CardHeader title={t('rc_title')} subtitle={t('rc_sub')} />
      <CardBody>
        <div data-testid="reconcile">
          {isDemo ? <p className="text-sm text-slate-500">{t('rc_demo')}</p> : (
            <Button onClick={compare} disabled={state.phase === 'running'}>{state.phase === 'running' ? t('rc_comparing') : t('rc_compare')}</Button>
          )}
          {state.phase === 'error' && <p className="mt-3 text-sm text-red-300" role="alert">{t('rc_failed')} {state.message}</p>}
          {r && (
            <div className="mt-4 space-y-3">
              <p className={'text-sm font-semibold ' + (r.same ? 'text-emerald-300' : 'text-amber-300')} data-testid="reconcile-verdict">
                {!r.stored ? t('rc_none_stored') : r.same ? t('rc_same') : fill(t('rc_drift'), { missing: r.missingHere, unsaved: r.unsaved })}
              </p>
              <p className="text-xs text-slate-500">
                {fill(t('rc_rev'), { here: r.rev.here ?? '—', stored: r.rev.stored ?? '—' })} · {fill(t('rc_stored_at'), { when: when(r.storedAt, language) })}
              </p>
              <table className="w-full text-sm" data-testid="reconcile-table">
                <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="py-1 pr-3">{t('rc_col_collection')}</th><th className="py-1 pr-3 text-right">{t('rc_col_here')}</th><th className="py-1 pr-3 text-right">{t('rc_col_stored')}</th><th className="py-1">{t('rc_col_status')}</th>
                </tr></thead>
                <tbody>
                  {r.collections.map((c) => (
                    <tr key={c.key} className="border-t border-slate-800">
                      <td className="py-1.5 pr-3 text-slate-300">{t(`rc_c_${c.key}`)}</td>
                      <td className="py-1.5 pr-3 text-right text-slate-300">{c.here}</td>
                      <td className="py-1.5 pr-3 text-right text-slate-300">{c.stored}</td>
                      <td className={'py-1.5 text-xs ' + (c.same ? 'text-emerald-300' : 'text-amber-300')}>
                        {c.same ? t('rc_status_same') : [c.missingHere ? fill(t('rc_missing_here'), { n: c.missingHere }) : '', c.unsaved ? fill(t('rc_unsaved'), { n: c.unsaved }) : ''].filter(Boolean).join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!r.same && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {canWrite && r.unsaved > 0 && <Button onClick={saveNow}>{t('rc_save_now')}</Button>}
                  {!shared && r.stored && r.missingHere > 0 && <Button variant="secondary" onClick={useStored}>{t('rc_use_stored')}</Button>}
                  {shared && r.missingHere > 0 && <p className="text-xs text-slate-500 self-center">{t('rc_reopen_shared')}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
