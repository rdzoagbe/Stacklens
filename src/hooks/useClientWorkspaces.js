// ── One source of client-workspace state and actions ───────────────────────
//
// Two surfaces need this: the bar at the top of the app, which exists to say
// whose data you are looking at and let you switch, and the Clients page,
// which exists to create, export, delete and restore. Those are different
// jobs, and the temptation is to give each its own copy of the fetching and
// the handlers.
//
// This repository has been bitten by that four times — toCsv, getCurrency,
// the security metrics, and six separate definitions of "potential savings".
// So the logic lives here once and both surfaces call it.

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  workspaceMine, workspaceRead, workspaceListOrgs,
  workspaceCreateOrg, workspaceDeleteOrg, workspaceRestoreOrg,
} from '../firebase-config';
import { downloadWorkspaceExport } from '../lib/workspace-export';
import { track } from '../lib/analytics';
import { enterSharedView, getSharedView } from '../lib/db';
import { resolvePlan } from '../lib/plan';
import { useAuth } from './useAuth';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';

// Module-level so the lists are fetched once per page load rather than on
// every navigation — AppShell remounts per page.
let _workspacesPromise = null;
let _orgsPromise = null;

/** Drop the caches so the next read hits the server. */
export function invalidateWorkspaceCaches() {
  _workspacesPromise = null;
  _orgsPromise = null;
}

export function useClientWorkspaces() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { firebaseUser, isDemo, user } = useAuth();
  const qc = useQueryClient();

  const [workspaces, setWorkspaces] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [deletedOrgs, setDeletedOrgs] = useState([]);
  const [retentionDays, setRetentionDays] = useState(90);
  const [busy, setBusy] = useState(false);
  const [fetched, setFetched] = useState(false);

  // Demo mode and a signed-out tab have nothing to fetch, so the list is as
  // loaded as it is ever going to get. Treating them as "still loading" left
  // /clients showing "Loading…" forever for anyone who reached the page by
  // URL, waiting on a request that was never going to be made. Derived rather
  // than set from the effect, which would cascade a render.
  const nothingToFetch = !firebaseUser || isDemo;
  const loaded = fetched || nothingToFetch;

  // createorg refuses a free plan, so the controls are offered to exactly the
  // people the server would let through. resolvePlan applies trial expiry, so
  // an expired trial correctly loses them.
  const canManageClients = !isDemo && !!firebaseUser && resolvePlan(user) !== 'free';

  useEffect(() => {
    if (!firebaseUser || isDemo) return;
    if (!_workspacesPromise) _workspacesPromise = workspaceMine().catch(() => ({ workspaces: [] }));
    if (!_orgsPromise) _orgsPromise = workspaceListOrgs().catch(() => ({ orgs: [] }));
    let alive = true;
    _workspacesPromise.then(r => { if (alive) setWorkspaces(r.workspaces || []); });
    _orgsPromise.then(r => {
      if (!alive) return;
      setOrgs(r.orgs || []);
      setDeletedOrgs(r.deleted || []);
      if (r.retention_days) setRetentionDays(r.retention_days);
      setFetched(true);
    });
    return () => { alive = false; };
  }, [firebaseUser, isDemo]);

  const refresh = useCallback(async () => {
    invalidateWorkspaceCaches();
    const r = await workspaceListOrgs().catch(() => null);
    if (!r) return;
    setOrgs(r.orgs || []);
    setDeletedOrgs(r.deleted || []);
    if (r.retention_days) setRetentionDays(r.retention_days);
  }, []);

  const openWorkspace = useCallback(async (w) => {
    if (busy) return;
    setBusy(true);
    try {
      // Trust the role the server returns with the data over the one listed
      // earlier: `mine` may have been cached before the owner changed it.
      const { data, role } = await workspaceRead(w.owner_uid);
      enterSharedView(data, {
        owner_uid: w.owner_uid, owner_email: w.owner_email, role: role || w.role,
      });
      qc.invalidateQueries({ queryKey: ['db'] });
      toast.success(t('ws_opened'));
    } catch (err) {
      toast.error(t('ws_open_failed') + ': ' + (err.message || ''));
    } finally { setBusy(false); }
  }, [busy, qc, t]);

  /** Open a client org through the same path — the server resolves ownership. */
  const openClient = useCallback((org) =>
    openWorkspace({ owner_uid: org.org_id, owner_email: org.name }), [openWorkspace]);

  const addClient = useCallback(async () => {
    const name = window.prompt(t('ws_client_prompt'));
    if (!name || busy) return;
    setBusy(true);
    try {
      const { org } = await workspaceCreateOrg(name);
      // Count only — a client workspace name is a customer's customer.
      track('client_workspace_created', { total: orgs.length + 1 });
      setOrgs(o => [...o, org]);
      invalidateWorkspaceCaches();
      toast.success(t('ws_client_created'));
    } catch (err) {
      toast.error(err.message || t('ws_client_failed'));
    } finally { setBusy(false); }
  }, [busy, orgs.length, t]);

  // Export runs from the list without entering the workspace: the point is to
  // have the file before deleting, and a deleted workspace stays readable for
  // exactly this.
  const exportClient = useCallback(async (org) => {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await workspaceRead(org.org_id);
      const payload = downloadWorkspaceExport({ name: org.name, orgId: org.org_id, data });
      track('client_workspace_exported', {
        tools: payload.counts.tools, employees: payload.counts.employees,
      });
      toast.success(t('ws_exported'));
    } catch (err) {
      toast.error(t('ws_export_failed') + ': ' + (err.message || ''));
    } finally { setBusy(false); }
  }, [busy, t]);

  const deleteClient = useCallback(async (org) => {
    if (busy) return;
    const msg = t('ws_delete_confirm')
      .replace('{name}', org.name)
      .replace('{days}', String(retentionDays));
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      const r = await workspaceDeleteOrg(org.org_id);
      track('client_workspace_deleted');
      await refresh();
      toast.success(t('ws_deleted_kept').replace('{days}', String(r?.days_left ?? retentionDays)));
    } catch (err) {
      toast.error(err.message || t('ws_delete_failed'));
    } finally { setBusy(false); }
  }, [busy, refresh, retentionDays, t]);

  const restoreClient = useCallback(async (org) => {
    if (busy) return;
    setBusy(true);
    try {
      await workspaceRestoreOrg(org.org_id);
      await refresh();
      toast.success(t('ws_restored'));
    } catch (err) {
      toast.error(err.message || t('ws_restore_failed'));
    } finally { setBusy(false); }
  }, [busy, refresh, t]);

  return {
    // state
    workspaces, orgs, deletedOrgs, retentionDays, busy, loaded,
    canManageClients,
    // Whether the Clients entry belongs in the sidebar. Anyone the server
    // would let create one, plus anyone who already has clients live or
    // deleted — a downgraded plan must still be able to export and restore
    // what it created while it was paying.
    showClients: canManageClients || orgs.length > 0 || deletedOrgs.length > 0,
    sharedView: getSharedView(),
    // actions
    refresh, openWorkspace, openClient, addClient, exportClient, deleteClient, restoreClient,
  };
}
