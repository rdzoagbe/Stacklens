import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useDbMutations } from '../hooks/useDbQuery';
import { holderFields } from '../lib/assets';
import { INTUNE_SCOPE, fetchManagedDevices, reconcileIntune, toIntuneDevice } from '../lib/intuneDevices';

// ── Devices → "Microsoft Intune" ────────────────────────────────────────────
//
// Reads the devices Intune manages (lib/intuneDevices.js) and compares them
// with the register. Nothing is read until an editor clicks, nothing is ever
// sent to Microsoft or to a device, and what comes back lives in this
// component's state until the editor records it: leaving the page forgets it.

const CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID;
const fill = (s, vars) => Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), s);
const small = 'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40';

/** `deps` lets a test stand in for Microsoft: { token, read }. */
export function IntuneDevicesCard({ db, canEdit, t, deps = null }) {
  const isDemo = db?.user?.is_demo === true;
  const { recordIntuneDevices, updateAsset } = useDbMutations();
  const [state, setState] = useState({ phase: 'idle' });

  const read = async () => {
    setState({ phase: 'reading' });
    try {
      let token;
      if (deps?.token) token = await deps.token();
      else {
        // Asked for here, on this click, and only this permission: a customer
        // who syncs their directory is never asked for device access.
        const { acquireMSToken } = await import('../pages/settings/IntegrationsTab');
        token = await acquireMSToken([INTUNE_SCOPE]);
      }
      const raw = await (deps?.read || fetchManagedDevices)(token);
      setState({ phase: 'done', devices: raw.map(toIntuneDevice) });
    } catch (err) {
      setState({ phase: 'error', message: err?.message || String(err) });
    }
  };

  const r = useMemo(() => (state.phase === 'done' ? reconcileIntune(db, state.devices) : null), [db, state]);

  const record = () => {
    recordIntuneDevices.mutate(state.devices, {
      onSuccess: (res) => toast.success(fill(t('itn_recorded'), { created: res?.created || 0, updated: res?.updated || 0 })),
    });
  };
  const takeIntuneHolder = ({ asset, device, person }) => {
    const patch = person
      ? { ...holderFields(person), status: 'in_use' }
      : { assigned_to: '', assigned_email: device.email, assigned_name: device.holderName, status: 'in_use' };
    updateAsset.mutate({ id: asset.id, patch });
  };

  const unavailable = isDemo ? t('itn_demo') : !deps && !CLIENT_ID ? t('itn_not_configured') : null;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5" data-testid="intune-devices">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h2 className="text-base font-semibold text-white">{t('itn_title')}</h2>
          <p className="mt-1 text-sm text-slate-400">{t('itn_intro')}</p>
          <p className="mt-2 text-xs text-slate-500" data-testid="itn-readonly">{t('itn_readonly')}</p>
        </div>
        {canEdit && !unavailable && (
          <button type="button" onClick={read} disabled={state.phase === 'reading'}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white disabled:opacity-50">
            {state.phase === 'reading' ? t('itn_reading') : state.phase === 'done' ? t('itn_read_again') : t('itn_read')}
          </button>
        )}
      </div>
      {unavailable && <p className="mt-3 text-xs text-amber-300">{unavailable}</p>}
      {state.phase === 'error' && <p className="mt-3 text-sm text-red-300" role="alert">{state.message}</p>}

      {r && (
        state.devices.length === 0 ? <p className="mt-4 text-sm text-slate-400">{t('itn_none')}</p> : (
          <div className="mt-4 space-y-4" data-testid="itn-result">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm text-slate-300" data-testid="itn-summary">
                {fill(t('itn_summary'), { n: state.devices.length, add: r.toAdd.length, known: r.matched.length })}
              </p>
              {canEdit && (r.toAdd.length > 0 || r.matched.length > 0) && (
                <button type="button" onClick={record} disabled={recordIntuneDevices.isPending}
                  className={small + ' bg-blue-600/30 hover:bg-blue-600/50 text-blue-200'}>
                  {fill(t('itn_record'), { add: r.toAdd.length, known: r.matched.length })}
                </button>
              )}
            </div>

            {r.holderDiffers.length > 0 && (
              <div data-testid="itn-holder-differs">
                <div className="text-sm font-semibold text-amber-200">{fill(t('itn_holder_title'), { n: r.holderDiffers.length })}</div>
                <p className="text-xs text-slate-500 mb-2">{t('itn_holder_sub')}</p>
                <ul className="space-y-1.5">
                  {r.holderDiffers.map((d) => (
                    <li key={d.asset.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                      <span className="font-semibold text-white">{d.asset.name || d.asset.serial}</span>
                      <span className="text-slate-500">
                        {fill(t('itn_holder_row'), {
                          intune: d.person?.full_name || d.device.email,
                          register: d.asset.assigned_name || d.asset.assigned_email || t('dev_nobody'),
                        })}
                      </span>
                      {canEdit && (
                        <button type="button" onClick={() => takeIntuneHolder(d)} className={small + ' bg-slate-800 hover:bg-slate-700 text-slate-200'}>
                          {t('itn_use_intune')}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {r.notInIntune.length > 0 && (
              <div data-testid="itn-not-in-intune">
                <div className="text-sm font-semibold text-slate-200">{fill(t('itn_missing_title'), { n: r.notInIntune.length })}</div>
                <p className="text-xs text-slate-500 mb-1">{t('itn_missing_sub')}</p>
                {r.notInIntune.slice(0, 10).map((a) => <div key={a.id} className="text-xs text-slate-400 truncate">{a.name || a.serial}</div>)}
              </div>
            )}
          </div>
        )
      )}
    </section>
  );
}
