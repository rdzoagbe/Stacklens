import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useDbMutations } from '../hooks/useDbQuery';
import { todayISO } from '../lib/db';
import { loadGIS } from '../lib/gws-usage';
import {
  fetchCustomerId, fetchLicenceAssignments, groupBySku, toolForSku, reconcileSku, requestLicensingToken,
} from '../lib/googleLicences';

// ── Access → Eligibility → "Google licences" ───────────────────────────────
//
// Reads who holds which Google licence (lib/googleLicences.js) and compares it
// with what Stacklens has recorded. Nothing is read until an editor clicks,
// nothing is written to Google ever, and what comes back lives in this
// component's state: leaving the page forgets it.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const fill = (s, vars) => Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), s);
const small = 'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40';

/** `deps` lets a test stand in for Google: { token, read }. */
export function GoogleLicencesCard({ db, canEdit, t, deps = null }) {
  const isDemo = db?.user?.is_demo === true;
  const { createTool, updateTool, createAccess, updateAccess } = useDbMutations();
  const [state, setState] = useState({ phase: 'idle' });

  const read = async () => {
    setState({ phase: 'reading' });
    try {
      let token;
      if (deps?.token) token = await deps.token();
      else { await loadGIS(); token = await requestLicensingToken(CLIENT_ID); }
      const run = deps?.read || (async (tk) => {
        const customerId = await fetchCustomerId(tk);
        return fetchLicenceAssignments(tk, customerId);
      });
      const { assignments } = await run(token);
      setState({ phase: 'done', skus: groupBySku(assignments) });
    } catch (err) {
      setState({ phase: 'error', message: err?.message || String(err) });
    }
  };

  const link = (sku, value) => {
    const google_sku = { productId: sku.productId, skuId: sku.skuId, skuName: sku.skuName };
    if (value === '__new') {
      createTool.mutate({ name: sku.skuName, category: 'other', status: 'active', cost_per_month: 0, google_sku, owner_email: '' });
      return;
    }
    // One tool per SKU: unlink whichever tool held it before.
    for (const tool of db.tools || []) {
      if (tool.google_sku?.skuId === sku.skuId && tool.google_sku?.productId === sku.productId && tool.id !== value) {
        updateTool.mutate({ id: tool.id, patch: { google_sku: null } });
      }
    }
    if (value) updateTool.mutate({ id: value, patch: { google_sku } });
  };
  const record = (tool, emps) => {
    for (const emp of emps) {
      createAccess.mutate({
        tool_id: tool.id, tool_name: tool.name,
        employee_id: emp.id, employee_name: emp.full_name || '', employee_email: emp.email || '',
        access_level: 'viewer', status: 'active', risk_flag: 'none',
        granted_date: todayISO(), last_reviewed_date: todayISO(), origin: 'google-licensing',
      });
    }
    toast.success(fill(t('gl_recorded'), { n: emps.length, tool: tool.name }));
  };
  const remove = (rows) => {
    for (const a of rows) updateAccess.mutate({ id: a.id, patch: { status: 'revoked' } });
    toast.success(fill(t('gl_removed'), { n: rows.length }));
  };

  const unavailable = isDemo ? t('gl_demo') : !deps && !CLIENT_ID ? t('gl_not_configured') : null;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5" data-testid="google-licences">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h2 className="text-base font-semibold text-white">{t('gl_title')}</h2>
          <p className="mt-1 text-sm text-slate-400">{t('gl_intro')}</p>
          <p className="mt-2 text-xs text-slate-500" data-testid="gl-readonly">{t('gl_readonly')}</p>
        </div>
        {canEdit && !unavailable && (
          <button type="button" onClick={read} disabled={state.phase === 'reading'}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white disabled:opacity-50">
            {state.phase === 'reading' ? t('gl_reading') : state.phase === 'done' ? t('gl_read_again') : t('gl_read')}
          </button>
        )}
      </div>
      {unavailable && <p className="mt-3 text-xs text-amber-300">{unavailable}</p>}
      {state.phase === 'error' && <p className="mt-3 text-sm text-red-300" role="alert">{state.message}</p>}

      {state.phase === 'done' && (
        state.skus.length === 0 ? <p className="mt-4 text-sm text-slate-400">{t('gl_none')}</p> : (
          <ul className="mt-4 space-y-3" data-testid="gl-skus">
            {state.skus.map((sku) => {
              const tool = toolForSku(db.tools, sku);
              const r = tool ? reconcileSku(db, sku, tool) : null;
              return (
                <li key={`${sku.productId}|${sku.skuId}`} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4" data-testid="gl-sku">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{sku.skuName}</div>
                      <div className="text-xs text-slate-500">{fill(t('gl_holders'), { n: sku.emails.length, product: sku.productName })}</div>
                    </div>
                    {canEdit && (
                      <label className="text-xs text-slate-400 flex items-center gap-2">
                        {t('gl_tool')}
                        <select value={tool?.id || ''} onChange={(e) => link(sku, e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200">
                          <option value="">{t('gl_pick_tool')}</option>
                          {(db.tools || []).filter((x) => x.status !== 'decommissioned').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                          <option value="__new">{fill(t('gl_create_tool'), { name: sku.skuName })}</option>
                        </select>
                      </label>
                    )}
                  </div>
                  {!tool && <p className="mt-2 text-xs text-slate-500">{t('gl_link_first')}</p>}
                  {r && (
                    <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
                      <div data-testid="gl-to-record">
                        <div className="font-semibold text-blue-200">{fill(t('gl_to_record'), { n: r.toRecord.length })}</div>
                        <p className="text-xs text-slate-500 mb-1">{t('gl_to_record_sub')}</p>
                        {r.toRecord.slice(0, 8).map((e) => <div key={e.id} className="text-xs text-slate-300 truncate">{e.full_name || e.email}</div>)}
                        {r.toRecord.length > 8 && <div className="text-xs text-slate-500">{fill(t('gl_and_more'), { n: r.toRecord.length - 8 })}</div>}
                        {canEdit && r.toRecord.length > 0 && (
                          <button type="button" onClick={() => record(tool, r.toRecord)} className={small + ' mt-2 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200'}>{t('gl_record_all')}</button>
                        )}
                      </div>
                      <div data-testid="gl-not-in-google">
                        <div className="font-semibold text-amber-200">{fill(t('gl_not_in_google'), { n: r.notInGoogle.length })}</div>
                        <p className="text-xs text-slate-500 mb-1">{t('gl_not_in_google_sub')}</p>
                        {r.notInGoogle.slice(0, 8).map((a) => <div key={a.id} className="text-xs text-slate-300 truncate">{a.employee_name || a.employee_email}</div>)}
                        {r.notInGoogle.length > 8 && <div className="text-xs text-slate-500">{fill(t('gl_and_more'), { n: r.notInGoogle.length - 8 })}</div>}
                        {canEdit && r.notInGoogle.length > 0 && (
                          <button type="button" onClick={() => remove(r.notInGoogle)} className={small + ' mt-2 bg-red-600/30 hover:bg-red-600/50 text-red-300'}>{t('gl_mark_removed')}</button>
                        )}
                      </div>
                      <div data-testid="gl-unknown">
                        <div className="font-semibold text-slate-200">{fill(t('gl_unknown'), { n: r.unknown.length })}</div>
                        <p className="text-xs text-slate-500 mb-1">{t('gl_unknown_sub')}</p>
                        {r.unknown.slice(0, 8).map((email) => <div key={email} className="text-xs text-slate-400 truncate">{email}</div>)}
                        {r.unknown.length > 8 && <div className="text-xs text-slate-500">{fill(t('gl_and_more'), { n: r.unknown.length - 8 })}</div>}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )
      )}
    </section>
  );
}
