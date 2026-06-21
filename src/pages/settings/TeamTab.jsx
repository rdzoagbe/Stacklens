import { useState } from 'react';
import toast from 'react-hot-toast';
import { sendInviteEmail } from '../../firebase-config';
import { resolvePlan, getPlanLimits } from '../../lib/plan';
import { Card, CardHeader, CardBody } from '../../components/ui';
import { can } from '../../components/gates';

export function TeamTab({ db, firebaseUser, t }) {
  const _mdb = JSON.parse(localStorage.getItem('accessguard_v1') || '{}')?.user;
  const _ownerMember = {
    id: 'owner',
    name: _mdb?.displayName || _mdb?.email?.split('@')[0] || 'Owner',
    email: _mdb?.email || '',
    role: 'Owner',
    joined: new Date().toISOString().slice(0, 10),
    avatar: (_mdb?.displayName || _mdb?.email || 'O')[0].toUpperCase(),
  };
  const _savedMembers = (() => {
    try { return JSON.parse(localStorage.getItem('sg_team_members') || '[]'); } catch { return []; }
  })();
  const [members, setMembers] = useState([_ownerMember, ..._savedMembers]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);

  const saveMembers = (next) => {
    const withoutOwner = next.filter(m => m.id !== 'owner');
    localStorage.setItem('sg_team_members', JSON.stringify(withoutOwner));
    setMembers([_ownerMember, ...withoutOwner]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('team_members')} subtitle={`${members.length} ${t('set_seats_used').replace('{max}', getPlanLimits(resolvePlan(db?.user)).teamMembers)}`} />
        <CardBody>
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-800/50 transition-colors">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{m.avatar}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-sm">{m.name}</div>
                  <div className="text-xs text-slate-500">{m.email}</div>
                </div>
                <span className={"text-xs font-semibold px-2.5 py-1 rounded-full " + (m.role === 'Owner' ? 'bg-violet-500/15 text-violet-400' : m.role === 'Admin' ? 'bg-blue-500/15 text-blue-400' : 'bg-slate-700 text-slate-400')}>{m.role}</span>
                <div className="text-xs text-slate-600">{t('set_joined')} {m.joined}</div>
                {m.role !== 'Owner' && can('invite') && (
                  <button onClick={() => saveMembers(members.filter(x => x.id !== m.id))} className="text-xs text-rose-500 hover:text-rose-400 transition-colors">{t('remove_member')}</button>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("invite_team")} subtitle={t('invite_sub')} />
        <CardBody>
          {inviteSent ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-2">📧</div>
              <div className="font-bold text-white mb-1">{t('invite_sent_to')} {inviteEmail}</div>
              <button onClick={() => { setInviteSent(false); setInviteEmail(''); }} className="text-sm text-emerald-400 hover:underline mt-2">{t('invite_another')}</button>
            </div>
          ) : (
            <div className="flex gap-3 flex-wrap">
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                className="flex-1 min-w-48 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="colleague@company.com" />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none">
                <option value="admin">{t('set_admin_desc')}</option>
                <option value="editor">{t('set_editor_desc')}</option>
                <option value="viewer">{t('set_viewer_desc')}</option>
              </select>
              <div className="w-full mt-2 p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1.5">
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"></span><span><span className="text-amber-400 font-semibold">{t('owner')}</span> — {t('set_owner_perms')}</span></div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0"></span><span><span className="text-blue-400 font-semibold">Admin</span> — {t('set_admin_perms')}</span></div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></span><span><span className="text-emerald-400 font-semibold">{t('editor')}</span> — {t('set_editor_perms')}</span></div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0"></span><span><span className="text-slate-300 font-semibold">{t('viewer')}</span> — {t('set_viewer_perms')}</span></div>
              </div>
              <button onClick={async () => {
                if (!inviteEmail || inviteSending) return;
                const limit = getPlanLimits(resolvePlan(db?.user)).teamMembers;
                if (members.length >= limit) {
                  toast.error(t('set_plan_limit').replace('{plan}', getPlanLimits(resolvePlan(db?.user)).label).replace('{limit}', limit));
                  return;
                }
                const newMember = {
                  id: 'invite_' + Date.now(),
                  name: inviteEmail.split('@')[0],
                  email: inviteEmail,
                  role: inviteRole.charAt(0).toUpperCase() + inviteRole.slice(1),
                  joined: new Date().toISOString().slice(0, 10),
                  avatar: inviteEmail[0].toUpperCase(),
                };
                saveMembers([...members, newMember]);
                setInviteSending(true);
                try {
                  await sendInviteEmail({
                    inviteeEmail: inviteEmail,
                    inviterName: firebaseUser?.displayName || db?.user?.email?.split('@')[0],
                    orgName: localStorage.getItem('sg_general') ? JSON.parse(localStorage.getItem('sg_general') || '{}').orgName : 'Stacklens',
                  });
                  toast.success(t('set_invite_success'));
                } catch {
                  window.open('mailto:' + inviteEmail
                    + '?subject=' + encodeURIComponent(t('set_invite_subject'))
                    + '&body=' + encodeURIComponent(t('set_invite_body')));
                } finally {
                  setInviteSending(false);
                }
                setInviteSent(true);
              }}
                disabled={inviteSending}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap">
                {inviteSending ? t('sending') : t('send_invite')}
              </button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
