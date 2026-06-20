import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle, Bell, Boxes, CreditCard,
  Download, Plug, Shield, Users, Wrench, Zap,
} from 'lucide-react';
import {
  getUserPlanFromFirestore, saveUserData, sendInviteEmail, syncClaimsFromServer,
} from '../firebase-config';
import { loadDb, saveDb, seedDbIfEmpty, todayISO } from '../lib/db';
import { toCsv, downloadText } from '../lib/dataUtils';
import { resolvePlan, getPlanLimits } from '../lib/plan';
import { submitContactForm } from '../lib/contact';
import { useDbQuery } from '../hooks/useDbQuery';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Card, CardHeader, CardBody } from '../components/ui';
import { RoleGate, can } from '../components/gates';
import { AppShell } from '../components/AppShell';
import { SlackNotifications } from '../components/SlackNotifications';

// ── Tab-level code splitting ────────────────────────────────────────────
const LazyBillingPage          = React.lazy(() => import('./settings/BillingTab').then(m => ({ default: m.BillingPage })));
const LazyIntegrationConnectors = React.lazy(() => import('./settings/IntegrationsTab').then(m => ({ default: m.IntegrationConnectors })));

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function SettingsPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const navigate = useNavigate();
  const { data: db } = useDbQuery();
  const qc = useQueryClient();
  const { isDemo, firebaseUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('general');
  const [saveMsg, setSaveMsg] = useState('');
  const [stripeMsg, setStripeMsg] = useState('');

  // Handle Stripe redirect-back: ?success=true or ?cancelled=true
  useEffect(() => {
    const success = searchParams.get('success');
    const cancelled = searchParams.get('cancelled');
    if (success === 'true') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab('billing');
      setStripeMsg('success');
      // Sync plan: refresh custom claims from server, then pull Firestore plan into localStorage
      if (firebaseUser?.uid) {
        syncClaimsFromServer().then(() =>
          getUserPlanFromFirestore(firebaseUser.uid)
        ).then((planData) => {
          if (planData) {
            const cur = loadDb() || seedDbIfEmpty();
            cur.user = { ...cur.user, ...planData };
            saveDb(cur);
            qc.invalidateQueries({ queryKey: ['db'] });
          }
        }).catch(() => {});
      }
      setSearchParams({}, { replace: true });
    } else if (cancelled === 'true') {
      setActiveTab('billing');
      setStripeMsg('cancelled');
      setSearchParams({}, { replace: true });
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const saved = JSON.parse(localStorage.getItem('sg_general') || '{}');
  const [orgName, setOrgName] = useState(saved.orgName || 'My Organisation');
  const [timezone, setTimezone] = useState(saved.timezone || 'Europe/London');
  const [currency] = useState(saved.currency || 'GBP (£)');
  const [dateFormat, setDateFormat] = useState(saved.dateFormat || 'DD/MM/YYYY');

  const savedSec = JSON.parse(localStorage.getItem('sg_security') || '{}');
  const [mfaEnabled, setMfaEnabled] = useState(savedSec.mfa ?? false);
  const [sessionTimeout, setSessionTimeout] = useState(savedSec.timeout || '60');
  const [ipRestrict, setIpRestrict] = useState(savedSec.ipRestrict ?? false);
  const [auditLog, setAuditLog] = useState(savedSec.auditLog ?? true);

  const _savedApiKeys = (() => { try { return JSON.parse(localStorage.getItem('sg_api_keys') || '[]'); } catch { return []; } })();
  const [apiKeys, setApiKeys] = useState(_savedApiKeys);
  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKey, setShowNewKey] = useState(null);

  const saveApiKeys = (next) => { localStorage.setItem('sg_api_keys', JSON.stringify(next)); setApiKeys(next); };

  const _savedNotifs = (() => { try { return JSON.parse(localStorage.getItem('sg_notifications') || '{}'); } catch { return {}; } })();
  const [notifRenewal,    setNotifRenewal]    = useState(_savedNotifs.renewal    ?? true);
  const [notifOrphaned,   setNotifOrphaned]   = useState(_savedNotifs.orphaned   ?? true);
  const [notifHighRisk,   setNotifHighRisk]   = useState(_savedNotifs.highRisk   ?? true);
  const [notifOffboard,   setNotifOffboard]   = useState(_savedNotifs.offboard   ?? true);
  const [notifNewTool,    setNotifNewTool]    = useState(_savedNotifs.newTool    ?? true);
  const [notifCompliance, setNotifCompliance] = useState(_savedNotifs.compliance ?? false);
  const [notifWeekly,     setNotifWeekly]     = useState(_savedNotifs.weekly     ?? true);
  const [notifInvoice,    setNotifInvoice]    = useState(_savedNotifs.invoice    ?? false);
  const [notifBudget,     setNotifBudget]     = useState(_savedNotifs.budget     ?? true);

  const saveNotifications = (patch) => {
    const next = { renewal: notifRenewal, orphaned: notifOrphaned, highRisk: notifHighRisk,
      offboard: notifOffboard, newTool: notifNewTool, compliance: notifCompliance,
      weekly: notifWeekly, invoice: notifInvoice, budget: notifBudget, ...patch };
    localStorage.setItem('sg_notifications', JSON.stringify(next));
    const backendChanged = 'renewal' in patch || 'weekly' in patch;
    if (backendChanged) {
      const cur = loadDb() || seedDbIfEmpty();
      cur.user = {
        ...cur.user,
        ...('renewal' in patch ? { renewal_alerts: patch.renewal } : {}),
        ...('weekly'  in patch ? { weekly_summary: patch.weekly  } : {}),
      };
      saveDb(cur);
      if (firebaseUser?.uid) saveUserData(firebaseUser.uid, cur).catch(() => {});
      qc.invalidateQueries({ queryKey: ['db'] });
    }
  };

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

  const save = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
    setSaveMsg(t('saved_msg'));
    setTimeout(() => setSaveMsg(''), 2000);
  };

  const generateApiKey = () => {
    if (!newKeyName.trim()) return;
    const key = 'sg_live_' + Math.random().toString(36).slice(2, 18) + Math.random().toString(36).slice(2, 18);
    const newK = { id: 'key_' + Date.now(), name: newKeyName, created: new Date().toISOString().slice(0,10), lastUsed: 'Never', prefix: key.slice(0,16) + '••••' };
    saveApiKeys([...apiKeys, newK]);
    setShowNewKey(key);
    setNewKeyName('');
  };

  const tabs = [
    { id: 'general',       label: t('settings_general'),       icon: Wrench, group: 'core' },
    { id: 'team',          label: t('settings_team'),          icon: Users,  group: 'core' },
    { id: 'billing',       label: t('nav_billing') || 'Billing', icon: CreditCard, group: 'core' },
    { id: 'notifications', label: t('settings_notifications'), icon: Bell,   group: 'core' },
    { id: 'integrations',  label: t('nav_integrations') || 'Integrations', icon: Plug, group: 'advanced' },
    { id: 'security',      label: t('settings_security'),      icon: Shield, group: 'advanced' },
    { id: 'api',           label: t('settings_api'),           icon: Zap,    group: 'advanced' },
    { id: 'data',          label: t('settings_data'),          icon: Download, group: 'advanced' },
  ];
  const coreTabs = tabs.filter(t => t.group === 'core');
  const advancedTabs = tabs.filter(t => t.group === 'advanced');

  const Toggle = ({ checked, onChange }) => (
    <button onClick={() => onChange(!checked)} className={"relative w-11 h-6 rounded-full transition-colors " + (checked ? 'bg-emerald-500' : 'bg-slate-700')}>
      <div className={"absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform " + (checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );

  return (
    <AppShell title={t('settings_title')} right={
      <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
        {coreTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} data-tab={tab.id}
              className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap " + (activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}>
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
        <div className="w-px h-5 bg-slate-700 mx-1" />
        {advancedTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} data-tab={tab.id}
              className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap " + (activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}>
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>
    }>
      <div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* ── GENERAL ── */}
          {activeTab === 'general' && (
            <Card>
              <CardHeader title={t('general_settings')} subtitle={t('general_settings_sub')} />
              <CardBody>
                <div className="space-y-5 max-w-2xl">
                  {[
                    { label: t('org_name_label'), el: <input value={orgName} onChange={e=>setOrgName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="Acme Corp" /> },

                    { label: t('time_zone_label'), el: <select value={timezone} onChange={e=>setTimezone(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none"><option>Europe/London</option><option>UTC</option><option>America/New_York</option><option>America/Los_Angeles</option><option>Europe/Paris</option><option>Asia/Tokyo</option></select> },
                    { label: t('date_format_label'), el: <select value={dateFormat} onChange={e=>setDateFormat(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none"><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></select> },

                  ].map(({ label, el }) => (
                    <div key={label}>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
                      {el}
                    </div>
                  ))}
                  <div className="flex items-center gap-3 pt-2">
                    <button onClick={() => save('sg_general', { orgName, timezone, currency, dateFormat })}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm transition-colors">
                      Save Changes
                    </button>
                    {saveMsg && <span className="text-sm text-emerald-400 font-semibold">{saveMsg}</span>}
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* ── TEAM ── */}
          {activeTab === 'team' && (
            <div className="space-y-4">
              <Card>
                <CardHeader title={t('team_members')} subtitle={`${members.length} of ${getPlanLimits(resolvePlan(db?.user)).teamMembers} seats used`} />
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
                        <div className="text-xs text-slate-600">Joined {m.joined}</div>
                        {m.role !== 'Owner' && can('invite') && (
                          <button onClick={() => saveMembers(members.filter(x => x.id !== m.id))} className="text-xs text-rose-500 hover:text-rose-400 transition-colors">{t('remove_member')}</button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title={t("invite_team") || "Invite Team Member"} subtitle={t('invite_sub')} />
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
                        <option value="admin">Admin — Manage tools, employees & access</option>
                        <option value="editor">Editor — View & edit data</option>
                        <option value="viewer">Viewer — Read-only access</option>
                      </select>
                      <div className="w-full mt-2 p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1.5">
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"></span><span><span className="text-amber-400 font-semibold">Owner</span> — Full access + billing + roles</span></div>
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0"></span><span><span className="text-blue-400 font-semibold">Admin</span> — Manage tools, employees, access & offboarding</span></div>
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></span><span><span className="text-emerald-400 font-semibold">Editor</span> — View & edit data, cannot delete</span></div>
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0"></span><span><span className="text-slate-300 font-semibold">Viewer</span> — Read-only, no edits</span></div>
                      </div>
                      <button onClick={async () => {
                        if (!inviteEmail || inviteSending) return;
                        const limit = getPlanLimits(resolvePlan(db?.user)).teamMembers;
                        if (members.length >= limit) {
                          toast.error(`Your ${getPlanLimits(resolvePlan(db?.user)).label} plan allows ${limit} team members. Upgrade to add more.`);
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
                          toast.success('Invite sent!');
                        } catch {
                          // Fallback: open mailto if Cloud Function is unavailable
                          window.open('mailto:' + inviteEmail
                            + '?subject=' + encodeURIComponent('You\'ve been invited to Stacklens')
                            + '&body=' + encodeURIComponent('Hi,\n\nYou\'ve been invited to join Stacklens.\n\nSign in at: https://stacklens.fr\n\nStacklens Team'));
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
          )}

          {/* ── NOTIFICATIONS ── */}
          {activeTab === 'notifications' && (
            <Card>
              <CardHeader title={t('notifications_title')} subtitle={t('notifications_sub')} />
              <CardBody>
                <div className="space-y-1">
                  {[
                    { label: 'Renewal due in 30 days',      sub: 'SaaS contract coming up for renewal — sent by email',  val: notifRenewal,    set: setNotifRenewal,    key: 'renewal',    live: true },
                    { label: 'New tool added to inventory',  sub: 'When a tool is added via import or manually',           val: notifNewTool,    set: setNotifNewTool,    key: 'newTool' },
                    { label: 'Orphaned tool detected',       sub: 'Tools with no assigned owner',                          val: notifOrphaned,   set: setNotifOrphaned,   key: 'orphaned' },
                    { label: 'High-risk access granted',     sub: 'Admin access given to a new user',                      val: notifHighRisk,   set: setNotifHighRisk,   key: 'highRisk' },
                    { label: 'Employee offboarding initiated', sub: 'When an offboarding task is started',                 val: notifOffboard,   set: setNotifOffboard,   key: 'offboard' },
                    { label: 'Compliance report ready',      sub: 'Weekly compliance digest',                              val: notifCompliance, set: setNotifCompliance, key: 'compliance' },
                    { label: 'Weekly summary email',         sub: 'Overview of spend, risk and usage',                     val: notifWeekly,     set: setNotifWeekly,     key: 'weekly' },
                    { label: 'Invoice approval required',    sub: 'New invoice needs sign-off',                            val: notifInvoice,    set: setNotifInvoice,    key: 'invoice' },
                    { label: t('budget_limit'),              sub: 'Monthly spend passes your set limit',                   val: notifBudget,     set: setNotifBudget,     key: 'budget' },
                  ].map(n => (
                    <div key={n.key} className="flex items-center justify-between py-3.5 border-b border-slate-800 last:border-0">
                      <div>
                        <div className="text-sm font-medium text-slate-200 flex items-center gap-2">
                          {n.label}
                          {n.live && <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">Live</span>}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{n.sub}</div>
                      </div>
                      <Toggle checked={n.val} onChange={(v) => { n.set(v); saveNotifications({ [n.key]: v }); }} />
                    </div>
                  ))}
                </div>
                <div className='mt-6'><SlackNotifications /></div>
              </CardBody>
            </Card>
          )}

          {/* ── SECURITY ── */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <Card>
                <CardHeader title={t('security_settings')} subtitle={t('security_settings_sub')} />
                <CardBody>
                  <div className="space-y-4">
                    {[
                      { label: t('require_mfa'), sub: t('require_mfa_sub'), key: 'mfa', val: mfaEnabled, set: setMfaEnabled },
                      { label: t('ip_restriction'), sub: t('ip_restriction_sub'), key: 'ip', val: ipRestrict, set: setIpRestrict },
                      { label: t('audit_logging'), sub: t('audit_logging_sub'), key: 'audit', val: auditLog, set: setAuditLog },
                    ].map(item => (
                      <div key={item.key} className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
                        <div>
                          <div className="font-medium text-slate-200 text-sm">{item.label}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{item.sub}</div>
                        </div>
                        <Toggle checked={item.val} onChange={item.set} />
                      </div>
                    ))}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('session_timeout')}</label>
                      <select value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500">
                        <option value="15">{t('min_15')}</option><option value="30">{'30 min'}</option><option value="60">{'1 hr'}</option><option value="480">{'8 hrs'}</option><option value="0">{t('never')}</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-5">
                    <button onClick={() => save('sg_security', { mfa: mfaEnabled, timeout: sessionTimeout, ipRestrict, auditLog })}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm transition-colors">
                      Save Security Settings
                    </button>
                    {saveMsg && <span className="text-sm text-emerald-400 font-semibold">{saveMsg}</span>}
                  </div>
                </CardBody>
              </Card>
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardBody>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white text-sm mb-1">{t('sso_enterprise')}</div>
                      <p className="text-xs text-slate-400">Connect your Okta, Azure AD, or Google Workspace SSO to enforce centralised authentication.</p>
                      <button onClick={() => { navigate('/settings'); setTimeout(() => { const el = document.querySelector('[data-tab="billing"]'); if(el) el.click(); }, 100); }} className="text-xs text-amber-400 font-semibold hover:underline mt-2 inline-block">View Enterprise Plan →</button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ── API KEYS ── */}
          {activeTab === 'api' && (
            <div className="space-y-4">
              <Card>
                <CardHeader title={t('api_keys_title')} subtitle={t('api_keys_sub')} />
                <CardBody>
                  {showNewKey && (
                    <div className="mb-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <div className="text-sm font-bold text-emerald-400 mb-1">✓ New API key generated — copy it now, it won&apos;t be shown again</div>
                      <div className="font-mono text-xs bg-slate-900 px-3 py-2 rounded-lg text-white break-all">{showNewKey}</div>
                      <button onClick={() => { navigator.clipboard.writeText(showNewKey); }} className="text-xs text-emerald-400 mt-2 hover:underline">{t("hc_copy_to_clipboard")}</button>
                    </div>
                  )}
                  <div className="space-y-3">
                    {apiKeys.map(k => (
                      <div key={k.id} className="flex items-center gap-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                        <Zap className="h-4 w-4 text-slate-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white text-sm">{k.name}</div>
                          <div className="font-mono text-xs text-slate-500">{k.prefix}</div>
                        </div>
                        <div className="text-right text-xs text-slate-600">
                          <div>Created {k.created}</div>
                          <div>Last used: {k.lastUsed}</div>
                        </div>
                        <button onClick={() => { if (window.confirm(`Revoke key "${k.name}"? This cannot be undone.`)) saveApiKeys(apiKeys.filter(x => x.id !== k.id)); }} className="text-xs text-rose-500 hover:text-rose-400 transition-colors flex-shrink-0">{t('revoke')}</button>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Generate New Key" subtitle="Name it so you remember what it's for" />
                <CardBody>
                  <div className="flex gap-3">
                    <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500 transition-colors" placeholder={t('key_name_placeholder')} />
                    <button onClick={generateApiKey}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap">
                      Generate Key
                    </button>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ── DATA & PRIVACY ── */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              <Card>
                <CardHeader title={t('export_data')} subtitle={t('export_data_sub')
} />
                <CardBody>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      {
                        label: 'Tools & Licenses',
                        desc: 'All tool records, costs, owners',
                        icon: Boxes,
                        onClick: () => {
                          downloadText(`stacklens_tools_${todayISO()}.csv`, toCsv(db?.tools || [],
                            ["name","category","owner_email","criticality","url","derived_status","last_used_date","cost_per_month","derived_risk","notes"]
                          ));
                          toast.success('Tools exported');
                        },
                      },
                      {
                        label: 'Employees & Access',
                        desc: 'Employee directory and access map',
                        icon: Users,
                        onClick: () => {
                          downloadText(`stacklens_employees_${todayISO()}.csv`, toCsv(db?.employees || [],
                            ["full_name","email","department","role","status","start_date","end_date"]
                          ));
                          setTimeout(() => downloadText(`stacklens_access_${todayISO()}.csv`, toCsv(db?.access || [],
                            ["tool_name","employee_name","employee_email","access_level","granted_date","last_accessed_date","last_reviewed_date","status","derived_risk_flag"]
                          )), 300);
                          toast.success('Employees & access exported');
                        },
                      },
                      {
                        label: 'Audit Log',
                        desc: 'Full history of all actions',
                        icon: Download,
                        onClick: () => {
                          downloadText(`stacklens_audit_${todayISO()}.csv`, toCsv(db?.audit_log || [],
                            ["action","user","timestamp","details"]
                          ));
                          toast.success('Audit log exported');
                        },
                      },
                    ].map(({ label, desc, icon: Icon, onClick }) => (
                      <button key={label} onClick={onClick}
                        className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/60 border border-slate-800 hover:border-emerald-500/30 hover:bg-slate-800 transition-all text-left">
                        <Icon className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-white text-sm">{label}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardBody>
              </Card>
              <Card className="border-rose-500/20 bg-rose-500/5">
                <CardHeader title={t('danger_zone')} subtitle={t('danger_zone_sub')} />
                <CardBody>
                  <div className="space-y-3">
                    {[
                      {
                        label: 'Delete all tool data',
                        desc: 'Removes all tools, employees and access records',
                        btn: 'Delete Tools',
                        onClick: () => {
                          if (isDemo) { toast.error('Not available in demo mode.'); return; }
                          if (!window.confirm('Delete ALL tools, employees and access records? This cannot be undone.')) return;
                          const cur = loadDb() || seedDbIfEmpty();
                          cur.tools = []; cur.employees = []; cur.access = [];
                          saveDb(cur);
                          if (firebaseUser?.uid) saveUserData(firebaseUser.uid, cur).catch(() => {});
                          qc.invalidateQueries({ queryKey: ['db'] });
                          toast.success('All tool data deleted');
                        },
                      },
                      {
                        label: 'Delete all employee data',
                        desc: 'Removes all employee and access records',
                        btn: 'Delete Employees',
                        onClick: () => {
                          if (isDemo) { toast.error('Not available in demo mode.'); return; }
                          if (!window.confirm('Delete ALL employees and access records? This cannot be undone.')) return;
                          const cur = loadDb() || seedDbIfEmpty();
                          cur.employees = []; cur.access = [];
                          saveDb(cur);
                          if (firebaseUser?.uid) saveUserData(firebaseUser.uid, cur).catch(() => {});
                          qc.invalidateQueries({ queryKey: ['db'] });
                          toast.success('All employee data deleted');
                        },
                      },
                      {
                        label: 'Delete account',
                        desc: 'Permanently deletes your Stacklens account and all data',
                        btn: 'Delete Account',
                        danger: true,
                        onClick: async () => {
                          if (isDemo) { toast.error('Not available in demo mode.'); return; }
                          try {
                            const email = firebaseUser?.email || '';
                            await submitContactForm({ name: email, email, subject: 'account-deletion', message: 'Please delete my Stacklens account.\n\nEmail: ' + email });
                            toast.success(t('contact_sent_title') || 'Request sent');
                          } catch { toast.error(t('contact_error') || 'Could not send. Please try again.'); }
                        },
                      },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between py-3 border-b border-rose-500/10 last:border-0">
                        <div>
                          <div className="font-medium text-slate-200 text-sm">{item.label}</div>
                          <div className="text-xs text-slate-500">{item.desc}</div>
                        </div>
                        <button onClick={item.onClick}
                          className={"text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors " + (item.danger ? 'border-rose-500/40 text-rose-400 hover:bg-rose-500/10' : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600')}>
                          {item.btn}
                        </button>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ── BILLING ── */}
          {activeTab === 'billing' && (
            <div className="space-y-4">
              {stripeMsg === 'success' && (
                <div className="flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3">
                  <span className="text-lg mt-0.5">🎉</span>
                  <div>
                    <p className="text-sm font-semibold text-green-400">{t('stripe_success_title') || 'Subscription activated!'}</p>
                    <p className="text-xs text-green-300/80 mt-0.5">{t('stripe_success_sub') || 'Your plan is now active. Welcome aboard — your full stack is unlocked.'}</p>
                  </div>
                  <button onClick={() => setStripeMsg('')} className="ml-auto text-green-400/60 hover:text-green-400 text-lg leading-none">×</button>
                </div>
              )}
              {stripeMsg === 'cancelled' && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                  <span className="text-lg mt-0.5">💡</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-400">{t('stripe_cancelled_title') || 'Checkout cancelled'}</p>
                    <p className="text-xs text-amber-300/80 mt-0.5">{t('stripe_cancelled_sub') || "No charge was made. Upgrade whenever you're ready."}</p>
                  </div>
                  <button onClick={() => setStripeMsg('')} className="ml-auto text-amber-400/60 hover:text-amber-400 text-lg leading-none">×</button>
                </div>
              )}
              <RoleGate requires="owner" fallback={
                <Card><CardBody>
                  <div className="text-center py-8">
                    <div className="text-3xl mb-3">🔒</div>
                    <h3 className="text-lg font-semibold text-white mb-1">Owner Access Required</h3>
                    <p className="text-slate-400 text-sm">Only the account owner can manage billing and subscriptions.</p>
                  </div>
                </CardBody></Card>
              }>
                <React.Suspense fallback={<TabLoader />}><LazyBillingPage noShell={true} /></React.Suspense>
              </RoleGate>
            </div>
          )}

          {/* ── INTEGRATIONS ── */}
          {activeTab === 'integrations' && (
            <div className="space-y-4">
              <Card>
                <CardHeader title={t('nav_integrations') || 'Integrations'} subtitle="Connect Stacklens to your tools for automatic discovery and user sync" />
                <CardBody>
                  <React.Suspense fallback={<TabLoader />}><LazyIntegrationConnectors /></React.Suspense>
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
