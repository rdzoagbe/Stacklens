import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Users, Clock, Shield, Search,
  Zap, Crown, RefreshCw, Pencil, Check, X, ArrowLeft, Trash2, Mail,
} from 'lucide-react';
import { loadAllUsersAdmin, founderExtendTrial, founderSetPlan, founderEnrichProfiles, founderDeleteUser, founderTestEmail, founderSetBankCreds, founderBankCredsStatus, founderListErrors } from '../firebase-config';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { isFounderUser } from '../lib/plan';

const PLAN_COLORS = {
  free: 'bg-slate-700 text-slate-300',
  trial: 'bg-blue-600/20 text-blue-400 border border-blue-500/30',
  starter: 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30',
  hr_finance: 'bg-violet-600/20 text-violet-400 border border-violet-500/30',
  pro: 'bg-amber-600/20 text-amber-400 border border-amber-500/30',
  enterprise: 'bg-rose-600/20 text-rose-400 border border-rose-500/30',
  scale: 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30',
};

const VALID_PLANS = ['free', 'trial', 'starter', 'hr_finance', 'pro', 'enterprise', 'scale'];

// ISO country code → flag emoji (regional-indicator letters).
function flagEmoji(code) {
  if (!code || code.length !== 2) return '📍';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function timeAgo(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return `${d}d ago`;
}

function toDate(v) {
  if (!v) return null;
  if (v.toDate) return v.toDate();
  if (v.seconds) return new Date(v.seconds * 1000);
  if (typeof v === 'number') return new Date(v);
  return new Date(v);
}

function KpiCard({ icon: Icon, label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
        <Icon size={14} />
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function UserTableRow({ u, onAction }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(u.displayName || '');
  const [editEmail, setEditEmail] = useState(u.email || '');

  const created = toDate(u.created_at || u.trial_started_at);
  const trialStart = toDate(u.trial_started_at);
  const trialEnd = trialStart ? new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
  const isTrialExpired = trialEnd && trialEnd < new Date();
  const subEnd = toDate(u.subscription_current_period_end);
  const plan = u.plan || 'free';
  const hasProfile = u.displayName || u.email;

  async function handleSaveProfile() {
    setBusy(true);
    try {
      const db = getFirestore();
      const updates = {};
      if (editName.trim()) updates.displayName = editName.trim();
      if (editEmail.trim()) updates.email = editEmail.trim();
      if (Object.keys(updates).length === 0) { setEditing(false); return; }
      updates.updatedAt = Date.now();
      await updateDoc(doc(db, 'users', u.uid), updates);
      toast.success('Profile updated');
      setEditing(false);
      onAction();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePlanChange(newPlan) {
    if (newPlan === plan) return;
    setBusy(true);
    try {
      await founderSetPlan(u.uid, newPlan);
      toast.success(`Plan set to ${newPlan.replace('_', ' ')} for ${u.displayName || u.email || u.uid.slice(0, 8)}`);
      onAction();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleExtendTrial(days) {
    setBusy(true);
    try {
      await founderExtendTrial(u.uid, days);
      toast.success(`Trial extended by ${days} days for ${u.displayName || u.email || u.uid.slice(0, 8)}`);
      onAction();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const who = u.displayName || u.email || `user ${u.uid.slice(0, 8)}…`;
    if (!window.confirm(`Delete ${who}?\n\nThis permanently removes their sign-in account and ALL their data. This cannot be undone.`)) return;
    setBusy(true);
    try {
      await founderDeleteUser(u.uid);
      toast.success(`Deleted ${who}`);
      onAction();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Expiry: trial end date for trials, Stripe period end for paid plans.
  let expiryCell;
  if (plan === 'trial' && trialEnd) {
    expiryCell = isTrialExpired
      ? <span className="text-red-400">Expired {trialEnd.toLocaleDateString()}</span>
      : <span className="text-emerald-400">{trialEnd.toLocaleDateString()}</span>;
  } else if (subEnd) {
    expiryCell = <span className="text-slate-300">{subEnd.toLocaleDateString()}</span>;
  } else {
    expiryCell = <span className="text-slate-600">—</span>;
  }

  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
      <td className="px-4 py-3 align-middle">
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5 w-36"
            />
            <input
              type="email"
              placeholder="Email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5 w-48"
            />
            <button onClick={handleSaveProfile} disabled={busy} className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg">
              <Check size={13} />
            </button>
            <button onClick={() => setEditing(false)} className="p-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-400 rounded-lg">
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-white truncate">
                  {u.displayName || (hasProfile ? '' : `User ${u.uid.slice(0, 8)}…`)}
                  {!u.displayName && u.email ? u.email : ''}
                </span>
                {u.is_founder && <Crown size={13} className="text-amber-400 shrink-0" />}
              </div>
              <div className="text-xs text-slate-500 truncate">{u.displayName ? (u.email || '') : (hasProfile ? '' : 'no profile yet')}</div>
            </div>
            <button
              onClick={() => setEditing(true)}
              title="Edit name/email"
              className="p-1 hover:bg-slate-700/50 rounded text-slate-600 hover:text-slate-300 transition-colors shrink-0"
            >
              <Pencil size={12} />
            </button>
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap align-middle">
        {created ? created.toLocaleDateString() : '—'}
      </td>
      <td className="px-4 py-3 align-middle">
        <select
          value={plan}
          onChange={(e) => handlePlanChange(e.target.value)}
          disabled={busy}
          className={`text-xs font-semibold rounded-lg px-2 py-1.5 border cursor-pointer disabled:opacity-50 bg-slate-800 border-slate-600 ${(PLAN_COLORS[plan] || '').includes('text-') ? PLAN_COLORS[plan].split(' ').find(c => c.startsWith('text-')) : 'text-slate-300'}`}
        >
          {VALID_PLANS.map(p => (
            <option key={p} value={p}>{p.replace('_', ' ')}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 text-sm whitespace-nowrap align-middle">
        {u.last_country ? (
          <div className="min-w-0">
            <div className="text-slate-200 truncate">
              {flagEmoji(u.last_country_code)} {[u.last_city, u.last_country].filter(Boolean).join(', ')}
            </div>
            {u.last_seen_at && <div className="text-[11px] text-slate-500">{timeAgo(u.last_seen_at)}</div>}
          </div>
        ) : (
          <span className="text-xs text-slate-600">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm whitespace-nowrap align-middle">
        <div className="flex items-center gap-2">
          {expiryCell}
          {plan === 'trial' && (
            <button
              onClick={() => handleExtendTrial(7)}
              disabled={busy}
              title="Extend trial by 7 days"
              className="px-2 py-0.5 text-[10px] bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-md transition-colors"
            >
              +7d
            </button>
          )}
          {!u.is_founder && (
            <button
              onClick={handleDelete}
              disabled={busy}
              title="Delete user permanently"
              className="p-1 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-40"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function FounderAdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [filterPlan, setFilterPlan] = useState('all');
  const [testingEmail, setTestingEmail] = useState(false);
  const [bankCfg, setBankCfg] = useState({ configured: false, id: '', secret: '', saving: false });
  const [errors, setErrors] = useState({ loading: false, open: false, items: null });
  const enrichedRef = useRef(false);

  const loadErrors = async () => {
    setErrors(e => ({ ...e, loading: true, open: true }));
    try {
      const r = await founderListErrors();
      setErrors({ loading: false, open: true, items: r.errors || [] });
    } catch (err) {
      toast.error('Could not load errors: ' + err.message);
      setErrors({ loading: false, open: true, items: [] });
    }
  };

  useEffect(() => {
    founderBankCredsStatus().then(r => setBankCfg(c => ({ ...c, configured: !!r.configured }))).catch(() => {});
  }, []);

  async function saveBankCreds() {
    if (!bankCfg.id.trim() || !bankCfg.secret.trim() || bankCfg.saving) return;
    setBankCfg(c => ({ ...c, saving: true }));
    try {
      await founderSetBankCreds(bankCfg.id.trim(), bankCfg.secret.trim());
      toast.success('Bank (Bridge) credentials saved.', { duration: 6000 });
      setBankCfg({ configured: true, id: '', secret: '', saving: false });
    } catch (err) {
      toast.error('Save failed: ' + err.message);
      setBankCfg(c => ({ ...c, saving: false }));
    }
  }

  async function sendTestEmail() {
    setTestingEmail(true);
    try {
      const r = await founderTestEmail();
      if (r.ok) {
        toast.success(`Test email sent to ${r.sent_to} — check your inbox (and spam).`, { duration: 8000 });
      } else {
        toast.error(`SendGrid refused it: ${r.sendgrid_error}`, { duration: 12000 });
      }
    } catch (err) {
      toast.error('Test email failed: ' + err.message, { duration: 10000 });
    } finally {
      setTestingEmail(false);
    }
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await loadAllUsersAdmin();
      setUsers(data);
    } catch (err) {
      toast.error('Failed to load users: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isFounderUser(user)) {
      navigate('/dashboard', { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await loadAllUsersAdmin();
        if (cancelled) return;
        setUsers(data);
        // Once per visit: if any account is missing its name/email, ask the
        // server to backfill from Firebase Auth, then reload the list.
        if (!enrichedRef.current && data.some(u => !u.displayName || !u.email)) {
          enrichedRef.current = true;
          try {
            const r = await founderEnrichProfiles();
            if (!cancelled && r.updated > 0) {
              const fresh = await loadAllUsersAdmin();
              if (!cancelled) setUsers(fresh);
            }
          } catch { /* best-effort — table still renders with UIDs */ }
        }
      } catch (err) {
        if (!cancelled) toast.error('Failed to load users: ' + err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, navigate]);

  const filtered = useMemo(() => {
    let list = [...users];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        (u.email || '').toLowerCase().includes(q) ||
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.uid || '').toLowerCase().includes(q)
      );
    }
    if (filterPlan !== 'all') {
      list = list.filter(u => (u.plan || 'free') === filterPlan);
    }
    if (sortBy === 'recent') {
      list.sort((a, b) => {
        const da = toDate(a.trial_started_at || a.created_at);
        const db = toDate(b.trial_started_at || b.created_at);
        return (db?.getTime() || 0) - (da?.getTime() || 0);
      });
    } else if (sortBy === 'email') {
      list.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
    }
    return list;
  }, [users, search, sortBy, filterPlan]);

  const stats = useMemo(() => {
    const now = new Date();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const planCounts = {};
    let activeTrial = 0;
    let recentSignups = 0;
    let weeklySignups = 0;

    users.forEach(u => {
      const plan = u.plan || 'free';
      planCounts[plan] = (planCounts[plan] || 0) + 1;
      const trialStart = toDate(u.trial_started_at);
      if (trialStart && plan === 'trial') {
        const trialEnd = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (trialEnd > now) activeTrial++;
      }
      const created = toDate(u.trial_started_at || u.created_at);
      if (created && created > dayAgo) recentSignups++;
      if (created && created > weekAgo) weeklySignups++;
    });

    return { planCounts, activeTrial, recentSignups, weeklySignups };
  }, [users]);

  if (!isFounderUser(user)) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Shield size={24} className="text-amber-400" />
              Founder Admin
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {users.length} registered users · Real-time analytics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={sendTestEmail}
            disabled={testingEmail}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            <Mail size={14} className={testingEmail ? 'animate-pulse' : ''} />
            {testingEmail ? 'Sending…' : 'Send test email'}
          </button>
          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-sm transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="Total Users" value={users.length} color="text-white" />
        <KpiCard
          icon={Zap}
          label="Last 24h"
          value={stats.recentSignups}
          sub={`${stats.weeklySignups} this week`}
          color="text-emerald-400"
        />
        <KpiCard
          icon={Clock}
          label="Active Trials"
          value={stats.activeTrial}
          sub={`${stats.planCounts.trial || 0} total trial`}
          color="text-blue-400"
        />
        <KpiCard
          icon={Crown}
          label="Paid Users"
          value={(stats.planCounts.starter || 0) + (stats.planCounts.hr_finance || 0) + (stats.planCounts.pro || 0) + (stats.planCounts.enterprise || 0) + (stats.planCounts.scale || 0)}
          sub={Object.entries(stats.planCounts)
            .filter(([k]) => !['free', 'trial'].includes(k))
            .map(([k, v]) => `${v} ${k.replace('_', ' ')}`)
            .join(', ') || 'none'}
          color="text-amber-400"
        />
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-white">🏦 Bank feed credentials (Bridge)</span>
          {bankCfg.configured && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Configured</span>}
        </div>
        <p className="text-xs text-slate-500 mb-3">Paste your Bridge <b>Client ID</b> and <b>Client Secret</b> here to enable the Budget-tab bank connection. Stored server-side, never shown again.</p>
        <div className="flex flex-wrap gap-2">
          <input type="text" value={bankCfg.id} onChange={e => setBankCfg(c => ({ ...c, id: e.target.value }))}
            placeholder="Bridge Client ID" className="flex-1 min-w-[180px] bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-indigo-500" />
          <input type="password" value={bankCfg.secret} onChange={e => setBankCfg(c => ({ ...c, secret: e.target.value }))}
            placeholder="Bridge Client Secret" className="flex-1 min-w-[180px] bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-indigo-500" />
          <button onClick={saveBankCreds} disabled={bankCfg.saving || !bankCfg.id.trim() || !bankCfg.secret.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {bankCfg.saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">🐛 Recent client errors</span>
            {errors.items && <span className="text-[11px] text-slate-500">{errors.items.length} shown</span>}
          </div>
          <button onClick={loadErrors} disabled={errors.loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-lg text-xs transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={errors.loading ? 'animate-spin' : ''} />
            {errors.items ? 'Refresh' : 'Load errors'}
          </button>
        </div>
        {errors.open && errors.items && (
          errors.items.length === 0 ? (
            <div className="text-xs text-emerald-400 mt-3">No crashes reported — clean. 🎉</div>
          ) : (
            <div className="mt-3 space-y-1.5 max-h-72 overflow-y-auto">
              {errors.items.map((e, i) => (
                <div key={i} className="text-xs bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2">
                  <div className="text-rose-300 font-mono break-words">{e.message}</div>
                  <div className="text-slate-600 mt-0.5">{e.url || '—'} · {e.at ? new Date(e.at).toLocaleString() : ''}</div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by email, name, or UID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
        <select
          value={filterPlan}
          onChange={(e) => setFilterPlan(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-xl px-3 py-2"
        >
          <option value="all">All plans</option>
          {VALID_PLANS.map(p => (
            <option key={p} value={p}>{p.replace('_', ' ')}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-xl px-3 py-2"
        >
          <option value="recent">Most recent</option>
          <option value="email">Email A→Z</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-slate-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Users size={32} className="mx-auto mb-2 opacity-40" />
          <p>No users found</p>
        </div>
      ) : (
        <div className="border border-slate-700/50 rounded-xl bg-slate-800/40 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-900/40">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">User Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Registered</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Plan</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Location</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Expiry</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <UserTableRow key={u.uid} u={u} onAction={loadUsers} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
