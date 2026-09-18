import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { sendInviteEmail, workspaceInvite, workspaceMembers, workspaceRevoke, workspaceSetRole } from '../../firebase-config';
import { Card, CardHeader, CardBody } from '../../components/ui';

// Real team sharing: invites live in the server-only /workspace_members
// collection. The invitee signs in to Stacklens with the invited email and
// sees this workspace served through the workspace endpoint — no direct
// database access is ever granted.
//
// A member is a viewer by default and can be promoted to editor here. An
// editor's changes are written to this workspace by the endpoint, which
// re-checks the role server-side; the control below is a convenience, not the
// thing that enforces it.
export function TeamTab({ db, firebaseUser, t }) {
  const owner = {
    id: 'owner',
    email: db?.user?.email || firebaseUser?.email || '',
    name: firebaseUser?.displayName || db?.user?.email?.split('@')[0] || 'Owner',
  };
  const [members, setMembers] = useState(null); // null = loading
  const [inviteEmail, setInviteEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => workspaceMembers()
    .then(r => setMembers(r.members || []))
    .catch(() => setMembers([]));
  useEffect(() => { refresh(); }, []);

  const invite = async () => {
    const email = inviteEmail.trim();
    if (!email || busy) return;
    setBusy(true);
    try {
      await workspaceInvite(email);

      // The membership is recorded by workspaceInvite above and does not depend
      // on the email, so a failed send must not fail the invite. But it used to
      // be `.catch(() => {})` followed unconditionally by "Invitation sent" —
      // so when the email did not go out, which is now every time until email
      // is configured, the person was told it had been sent and the invitee
      // heard nothing. Awaiting it and saying which of the two happened costs
      // one round trip and is the difference between a working feature and a
      // lie.
      let emailed = false;
      try {
        await sendInviteEmail({
          inviteeEmail: email,
          inviterName: owner.name,
          orgName: (() => { try { return JSON.parse(localStorage.getItem('sg_general') || '{}').orgName || 'Stacklens'; } catch { return 'Stacklens'; } })(),
        });
        emailed = true;
      } catch { /* reported below, never fails the invite */ }

      if (emailed) toast.success(t('ws_invite_sent'));
      else toast(t('ws_invite_added_no_email'), { icon: '⚠️', duration: 8000 });
      setInviteEmail('');
      refresh();
    } catch (err) {
      toast.error(err.message || t('ws_invite_failed'));
    } finally { setBusy(false); }
  };

  const revoke = async (id) => {
    try {
      await workspaceRevoke(id);
      toast.success(t('ws_revoked'));
      refresh();
    } catch (err) { toast.error(err.message || 'Error'); }
  };

  const setRole = async (id, role) => {
    // Optimistic, because the select should not lag behind the click; the
    // refresh below reconciles with whatever the server actually stored.
    setMembers(ms => (ms || []).map(m => (m.id === id ? { ...m, role } : m)));
    try {
      await workspaceSetRole(id, role);
      toast.success(role === 'editor' ? t('ws_role_editor_set') : t('ws_role_viewer_set'));
    } catch (err) {
      toast.error(err.message || 'Error');
    } finally { refresh(); }
  };

  const row = (key, name, email, badge, badgeCls, right = null) => (
    <div key={key} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-800/50 transition-colors">
      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        {(name || email || '?')[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white text-sm truncate">{name || email.split('@')[0]}</div>
        <div className="text-xs text-slate-500 truncate">{email}</div>
      </div>
      <span className={"text-xs font-semibold px-2.5 py-1 rounded-full " + badgeCls}>{badge}</span>
      {right}
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('team_members')} subtitle={t('ws_members_sub')} />
        <CardBody>
          <div className="space-y-2">
            {row('owner', owner.name, owner.email, t('owner'), 'bg-violet-500/15 text-violet-400')}
            {members === null && <div className="text-center py-4 text-sm text-slate-500">…</div>}
            {(members || []).map(m => row(
              m.id, null, m.member_email,
              m.status === 'accepted' ? t('ws_status_active') : t('ws_status_pending'),
              m.status === 'accepted' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400',
              <div className="flex items-center gap-3">
                <select value={m.role === 'editor' ? 'editor' : 'viewer'}
                  onChange={e => setRole(m.id, e.target.value)}
                  title={t('ws_role_help')}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-emerald-500 transition-colors">
                  <option value="viewer">{t('ws_role_viewer')}</option>
                  <option value="editor">{t('ws_role_editor')}</option>
                </select>
                <button onClick={() => revoke(m.id)} className="text-xs text-rose-500 hover:text-rose-400 transition-colors">{t('remove_member')}</button>
              </div>
            ))}
            {members?.length === 0 && (
              <div className="text-center py-4 text-sm text-slate-500">{t('ws_no_members')}</div>
            )}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('invite_team')} subtitle={t('ws_invite_sub')} />
        <CardBody>
          <div className="flex gap-3 flex-wrap">
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') invite(); }}
              className="flex-1 min-w-48 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500 transition-colors"
              placeholder="colleague@company.com" />
            <button onClick={invite} disabled={busy || !inviteEmail.trim()}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap">
              {busy ? t('sending') : t('send_invite')}
            </button>
            <div className="w-full mt-1 p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-400">
              {t('ws_viewer_note')}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
