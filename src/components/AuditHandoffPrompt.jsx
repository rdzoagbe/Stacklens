import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Modal, Button, Input } from './ui';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { useDbQuery, useDbMutations } from '../hooks/useDbQuery';
import { useAuth } from '../hooks/useAuth';
import { loadHandoff, clearHandoff, planHandoffImport } from '../lib/auditHandoff';
import { getPlanLimits, resolvePlan } from '../lib/plan';
import { RoleGate } from './gates';
import { useClientWorkspaces, invalidateWorkspaceCaches } from '../hooks/useClientWorkspaces';

// ── "Import the subscriptions from your free audit?" ───────────────────────
//
// Shown once someone is signed in, on any page of the app, when the free
// audit left a list for them (lib/auditHandoff.js). Nothing is written to
// the workspace until they press Import. Close keeps the list until the page
// is reloaded or it expires; Ignore deletes it. Never in the demo, whose
// workspace is not theirs.

let closedThisPage = false;

export function AuditHandoffPrompt() {
  const { language } = useLang();
  const t = useTranslation(language);
  const navigate = useNavigate();
  const { isDemo } = useAuth();
  const { data: db } = useDbQuery();
  const { importAuditTools, createClientFromAudit } = useDbMutations();
  // An accountant on a paid plan can land the list in a client workspace of
  // its own instead of their firm's. The name is typed here, after sign-in:
  // the audit page keeps nothing about the client.
  const { canManageClients } = useClientWorkspaces();
  const [dest, setDest] = useState('mine');
  const [clientName, setClientName] = useState('');
  const [handoff, setHandoff] = useState(() => (closedThisPage ? null : loadHandoff()));
  const plan = useMemo(() => (handoff && db ? planHandoffImport(handoff, db) : null), [handoff, db]);
  // null until the reader touches a box: then the plan's room decides which
  // lines start ticked (the costliest), instead of the import silently
  // dropping the tail and saying so afterwards.
  const [manual, setManual] = useState(null);

  if (!handoff || !plan || isDemo || db?.user?.is_demo) return null;

  const limit = getPlanLimits(resolvePlan(db?.user)).tools;
  const room = Math.max(0, (Number.isFinite(limit) ? limit : Infinity) - (db?.tools?.length || 0));
  const byCost = [...plan.toAdd].sort((a, b) => b.cost_per_month - a.cost_per_month);
  const fits = new Set(byCost.slice(0, room).map((r) => r.name));
  const unticked = manual ?? new Set(plan.toAdd.filter((r) => !fits.has(r.name)).map((r) => r.name));
  const doesNotFit = plan.toAdd.length > room;
  // What is imported is what is ticked, costliest first, up to the room.
  const chosen = byCost.filter((r) => !unticked.has(r.name)).slice(0, room);
  const close = () => { closedThisPage = true; setHandoff(null); };
  const ignore = () => { clearHandoff(); setHandoff(null); };
  const toClient = canManageClients && dest === 'client';
  const busy = importAuditTools.isPending || createClientFromAudit.isPending;
  const importNow = () => {
    if (toClient) {
      createClientFromAudit.mutate({ name: clientName.trim(), records: chosen }, {
        onSuccess: ({ org, added, left }) => {
          clearHandoff();
          setHandoff(null);
          invalidateWorkspaceCaches();
          toast.success(t('handoff_client_done').replace('{name}', org.name).replace('{n}', added)
            + (left ? ` ${t('handoff_limit').replace('{n}', left)}` : ''), { duration: 6000 });
          navigate('/clients');
        },
        onError: (err) => toast.error(err?.message || t('handoff_client_failed')),
      });
      return;
    }
    importAuditTools.mutate(chosen, {
      onSuccess: ({ added, left }) => {
        clearHandoff();
        setHandoff(null);
        toast.success(t('handoff_done').replace('{n}', added)
          + (left ? ` ${t('handoff_limit').replace('{n}', left)}` : ''), { duration: 6000 });
        navigate('/tools');
      },
    });
  };
  const toggle = (name) => setManual(() => {
    const n = new Set(unticked);
    if (n.has(name)) n.delete(name); else n.add(name);
    return n;
  });
  const money = (n) => Number(n || 0).toLocaleString(language, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  return (
    <Modal
      open
      title={t('handoff_title')}
      subtitle={t('handoff_body').replace('{n}', plan.toAdd.length + plan.existing.length + plan.skipped.length)}
      onClose={close}
      footer={
        <div className="flex flex-wrap justify-end gap-2" data-testid="handoff-actions">
          <Button variant="secondary" onClick={ignore}>{t('handoff_ignore')}</Button>
          <RoleGate requires="editor">
            <Button onClick={importNow} disabled={!chosen.length || busy || (toClient && !clientName.trim())}>
              {toClient ? t('handoff_create_client').replace('{n}', chosen.length) : t('handoff_import').replace('{n}', chosen.length)}
            </Button>
          </RoleGate>
        </div>
      }
    >
      {canManageClients && (
        <fieldset className="mb-3 space-y-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm" data-testid="handoff-destination">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="handoff-dest" checked={dest === 'mine'} onChange={() => setDest('mine')} className="accent-blue-500" />
            <span className="text-slate-200">{t('handoff_dest_mine')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="handoff-dest" checked={dest === 'client'} onChange={() => setDest('client')} className="accent-blue-500" />
            <span className="text-slate-200">{t('handoff_dest_client')}</span>
          </label>
          {dest === 'client' && (
            <div className="pl-6">
              <label className="block text-xs font-semibold text-slate-400 mb-1" htmlFor="handoff-client-name">{t('handoff_client_name')}</label>
              <Input id="handoff-client-name" value={clientName} maxLength={120} placeholder={t('handoff_client_name_ph')} onChange={(e) => setClientName(e.target.value)} autoFocus />
            </div>
          )}
        </fieldset>
      )}
      {doesNotFit && (
        <p className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200" data-testid="handoff-room">
          {t('handoff_room').replace('{room}', room).replace('{n}', plan.toAdd.length)}
        </p>
      )}
      <ul className="space-y-1.5 text-sm" data-testid="handoff-list">
        {plan.toAdd.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
            <label className="flex items-center gap-3 cursor-pointer min-w-0">
              <input type="checkbox" checked={!unticked.has(r.name)} onChange={() => toggle(r.name)} className="accent-blue-500" />
              <span className="font-medium text-slate-100 truncate">{r.name}</span>
            </label>
            <span className="text-xs text-slate-400 whitespace-nowrap">{money(r.cost_per_month)}{t('handoff_per_month')}</span>
          </li>
        ))}
        {plan.existing.map((name) => (
          <li key={`e-${name}`} className="flex items-center justify-between gap-3 px-3 py-1.5 text-slate-500">
            <span className="truncate">{name}</span><span className="text-xs">{t('handoff_existing')}</span>
          </li>
        ))}
        {plan.skipped.map((name) => (
          <li key={`s-${name}`} className="flex items-center justify-between gap-3 px-3 py-1.5 text-slate-500">
            <span className="truncate">{name}</span><span className="text-xs">{t('handoff_not_software')}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
