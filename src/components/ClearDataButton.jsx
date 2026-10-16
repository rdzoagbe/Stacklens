import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, Button } from './ui';
import { hasRole } from './gates';
import { getSharedView } from '../lib/db';
import { clearCounts, clearWorkspaceData } from '../lib/clearData';

// ── Dashboard → "Clear data" ───────────────────────────────────────────────
//
// It used to sit next to Import for everyone, on empty accounts too, and wipe
// on one browser confirm. It is back for the people who may delete (owner or
// admin), in their own workspace, when there is something to delete, behind a
// dialog that says what goes and offers the export first. The deletion itself
// is Settings → Data's (lib/clearData.js): audit entry, cloud copy awaited.

export function ClearDataButton({ db, uid, t }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const counts = clearCounts(db, 'all');
  const total = counts.tools + counts.employees + counts.access;
  if (db?.user?.is_demo || getSharedView() || !hasRole('admin') || total === 0) return null;

  const clear = async () => {
    setBusy(true);
    const r = await clearWorkspaceData({ uid, scope: 'all' });
    qc.invalidateQueries({ queryKey: ['db'] });
    setBusy(false);
    setOpen(false);
    if (r.cloudFailed) toast.error(t('set_del_cloud_error'), { duration: 8000 });
    else toast.success(t('dash_clear_done'));
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="h-3.5 w-3.5" />{t('dash_clear_data')}
      </Button>
      <Modal open={open} title={t('dash_clear_title')} onClose={() => !busy && setOpen(false)}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>{t('ws_cancel')}</Button>
            <Button variant="danger" onClick={clear} disabled={busy}>{busy ? t('dash_clear_busy') : t('dash_clear_confirm')}</Button>
          </div>
        }>
        <div className="space-y-3 text-sm text-slate-300" data-testid="clear-data-dialog">
          <p>{t('dash_clear_body').replace('{tools}', counts.tools).replace('{people}', counts.employees).replace('{access}', counts.access)}</p>
          <p className="text-xs text-slate-400">
            {t('dash_clear_export')}{' '}
            <Link to="/settings?tab=data" className="underline text-blue-300 hover:text-blue-200" onClick={() => setOpen(false)}>{t('dash_clear_export_link')}</Link>
          </p>
        </div>
      </Modal>
    </>
  );
}
