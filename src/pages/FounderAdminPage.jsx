import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Users, Clock, Shield, ChevronDown, ChevronUp, Search,
  Zap, Crown, RefreshCw, Pencil, Check, X, ArrowLeft,
} from 'lucide-react';
import { loadAllUsersAdmin, founderExtendTrial, founderSetPlan } from '../firebase-config';
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

function timeAgo(date) {
  if (!date) return '—';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
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

function UserRow({ u, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(u.plan || 'free');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(u.displayName || '');
  const [editEmail, setEditEmail] = useState(u.email || '');

  const created = toDate(u.created_at || u.trial_started_at);
  const trialStart = toDate(u.trial_started_at);
  const trialEnd = trialStart ? new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
  const isTrialExpired = trialEnd && trialEnd < new Date();
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

  async function handleSetPlan() {
    if (selectedPlan === plan) return;
    setBusy(true);
    try {
      await founderSetPlan(u.uid, selectedPlan);
      toast.success(`Plan set to ${selectedPlan} for ${u.email || u.uid}`);
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
      toast.success(`Trial extended by ${days} days for ${u.email || u.uid}`);
      onAction();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-slate-700/50 rounded-xl bg-slate-800/40 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-slate-700/30 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">
              {u.displayName || u.email || `User ${u.uid.slice(0, 8)}…`}
            </span>
            {u.is_founder && <Crown size={13} className="text-amber-400 shrink-0" />}
            {!hasProfile && <span className="text-[10px] text-slate-600 italic">click to add info</span>}
          </div>
          <div className="text-xs text-slate-500 truncate">{u.email || `UID: ${u.uid.slice(0, 12)}…`}</div>
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${PLAN_COLORS[plan] || PLAN_COLORS.free}`}>
          {plan.replace('_', ' ')}
        </span>
        <span className="text-xs text-slate-500 hidden sm:block w-20 text-right">
          {created ? timeAgo(created) : '—'}
        </span>
        {expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-700/50 p-4 bg-slate-900/30 space-y-3">
          {editing ? (
            <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-700/30">
              <input
                type="text"
                placeholder="Display name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5 w-40"
              />
              <input
                type="email"
                placeholder="Email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5 w-52"
              />
              <button onClick={handleSaveProfile} disabled={busy} className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg">
                <Check size={13} />
              </button>
              <button onClick={() => setEditing(false)} className="p-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-400 rounded-lg">
                <X size={13} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pb-2 border-b border-slate-700/30">
              <span className="text-xs text-slate-400">
                {u.displayName ? `${u.displayName}` : ''}{u.displayName && u.email ? ' · ' : ''}{u.email || ''}
                {!hasProfile ? 'No profile info yet' : ''}
              </span>
              <button onClick={() => setEditing(true)} className="p-1 hover:bg-slate-700/50 rounded text-slate-500 hover:text-slate-300 transition-colors">
                <Pencil size={12} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500">UID:</span>
              <div className="text-slate-300 font-mono text-[11px] truncate">{u.uid}</div>
            </div>
            <div>
              <span className="text-slate-500">Registered:</span>
              <div className="text-slate-300">{created ? created.toLocaleDateString() : '—'}</div>
            </div>
            <div>
              <span className="text-slate-500">Trial started:</span>
              <div className="text-slate-300">{trialStart ? trialStart.toLocaleDateString() : '—'}</div>
            </div>
            <div>
              <span className="text-slate-500">Trial status:</span>
              <div className={isTrialExpired ? 'text-red-400' : 'text-emerald-400'}>
                {!trialStart ? '—' : isTrialExpired ? 'Expired' : `Ends ${trialEnd.toLocaleDateString()}`}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-700/30">
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-slate-300 text-xs rounded-lg px-2 py-1.5"
              disabled={busy}
            >
              {VALID_PLANS.map(p => (
                <option key={p} value={p}>{p.replace('_', ' ')}</option>
              ))}
            </select>
            <button
              onClick={handleSetPlan}
              disabled={busy || selectedPlan === plan}
              className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors"
            >
              Set plan
            </button>
            <div className="w-px h-5 bg-slate-700 mx-1 hidden sm:block" />
            <button
              onClick={() => handleExtendTrial(7)}
              disabled={busy}
              className="px-3 py-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg transition-colors"
            >
              +7 days trial
            </button>
            <button
              onClick={() => handleExtendTrial(14)}
              disabled={busy}
              className="px-3 py-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg transition-colors"
            >
              +14 days
            </button>
          </div>
        </div>
      )}
    </div>
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
        if (!cancelled) setUsers(data);
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
        <button
          onClick={loadUsers}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-sm transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
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
        <div className="space-y-2">
          {filtered.map(u => (
            <UserRow key={u.uid} u={u} onAction={loadUsers} />
          ))}
        </div>
      )}
    </div>
  );
}
