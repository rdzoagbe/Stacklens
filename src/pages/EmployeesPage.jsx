import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { todayISO } from '../lib/db';
import { EMP_DEPARTMENTS } from '../lib/constants';
import { computeToolDerivedRisk, getRiskEvidence } from '../lib/dataUtils';
import { useDbQuery, useDbMutations } from '../hooks/useDbQuery';
import { useCurrency } from '../contexts/CurrencyContext';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Button, Input, Select, Modal } from '../components/ui';
import { RoleGate } from '../components/gates';
import { AppShell } from '../components/AppShell';
import { Search, Plus, Pencil, Trash2, Check, Users, UserMinus, X } from 'lucide-react';

// ── Directory Sync Banner ─────────────────────────────────────────────────────

function DirectorySyncBanner() {
  const navigate = useNavigate();
  const { language } = useLang();
  const t = useTranslation(language);

  const connected = (() => {
    try { return JSON.parse(localStorage.getItem('sg_connected_integrations') || '[]'); }
    catch { return []; }
  })();

  const providers = [
    {
      id: 'google-workspace', name: 'Google Workspace', syncKey: 'sg_gws_last_sync',
      logo: (
        <svg viewBox="0 0 48 48" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
      ),
    },
    {
      id: 'microsoft-365', name: 'Microsoft 365', syncKey: 'sg_m365_last_sync',
      logo: (
        <svg viewBox="0 0 23 23" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
          <rect x="12" y="1" width="10" height="10" fill="#7FBA00"/>
          <rect x="1" y="12" width="10" height="10" fill="#00A4EF"/>
          <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
        </svg>
      ),
    },
    {
      id: 'okta', name: 'Okta', syncKey: 'sg_okta_last_sync',
      logo: (
        <svg viewBox="0 0 64 64" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="32" fill="#007DC1"/>
          <circle cx="32" cy="32" r="16" fill="white"/>
        </svg>
      ),
    },
  ];

  const connectedCount = providers.filter(p => connected.includes(p.id)).length;

  return (
    <div className="rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-950/40 to-slate-900/40 px-4 py-3 flex items-center gap-4 mb-4">
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs font-bold uppercase tracking-widest text-blue-400">{t('dir_sync')}</span>
        {connectedCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
            {connectedCount} Connected
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-1 overflow-x-auto">
        {providers.map(p => {
          const isConnected = connected.includes(p.id);
          const lastSync = p.syncKey ? localStorage.getItem(p.syncKey) : null;
          return (
            <button key={p.id} onClick={() => navigate('/import?tab=integrations')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex-shrink-0 ${
                isConnected
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-700/60'
              }`}>
              {p.logo}
              <span>{p.name}</span>
              {isConnected && lastSync
                ? <span className="text-emerald-500 hidden sm:inline">· {new Date(lastSync).toLocaleDateString()}</span>
                : isConnected
                  ? <span className="text-emerald-500">✓</span>
                  : <span className="text-slate-600">{t('st_not_connected')}</span>
              }
            </button>
          );
        })}
      </div>
      <button onClick={() => navigate('/import?tab=integrations')}
        className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 font-semibold flex-shrink-0 transition-colors">
        {t('manage_all_integrations')}
      </button>
    </div>
  );
}

// ── Employee Form ─────────────────────────────────────────────────────────────

export function EmployeeForm({ initial, onSubmit, onClose }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const [form, setForm] = useState(
    initial || {
      full_name: '', email: '', department: 'engineering',
      role: '', status: 'active', start_date: todayISO(), end_date: '',
    }
  );

  const canSubmit = form.full_name.trim() && form.email.trim();

  return (
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (!canSubmit) return; onSubmit({ ...form }); onClose(); }}>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('full_name')}</div>
          <Input value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('col_email')}</div>
          <Input value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('department')}</div>
          <Select value={form.department} onChange={(e) => setForm(f => ({ ...f, department: e.target.value }))}>
            {EMP_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('col_role')}</div>
          <Input value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))} />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('col_status')}</div>
          <Select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}>
            {['active','offboarding','offboarded'].map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('start_date')}</div>
          <Input type="date" value={form.start_date} onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))} />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-400">{t('hc_end_date')}</div>
          <Input type="date" value={form.end_date} onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>{t('act_cancel')}</Button>
        <Button type="submit" disabled={!canSubmit}><Check className="h-4 w-4" />{t('act_save')}</Button>
      </div>
    </form>
  );
}

// ── Employees Page ────────────────────────────────────────────────────────────

export function EmployeesPage() {
  useCurrency();
  const { data: db, isLoading } = useDbQuery();
  const { language } = useLang();
  const t = useTranslation(language);
  const muts = useDbMutations();

  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const toolCounts = useMemo(() => {
    const m = new Map();
    (db?.access || []).forEach(a => {
      if (a.status !== 'active') return;
      m.set(a.employee_id, (m.get(a.employee_id) || 0) + 1);
    });
    return m;
  }, [db]);

  const employeeCost = useMemo(() => {
    const m = new Map();
    (db?.access || []).filter(a => a.status === 'active').forEach(a => {
      const tool = (db?.tools || []).find(t => t.id === a.tool_id || t.name === a.tool_name);
      const cost = tool?.cost_per_month || 0;
      m.set(a.employee_id, (m.get(a.employee_id) || 0) + cost);
    });
    return m;
  }, [db]);

  const getEmployeeTools = (employeeId) => {
    const accessRecords = (db?.access || []).filter(a => a.employee_id === employeeId && a.status === 'active');
    return accessRecords.map(a => {
      const tool = (db?.tools || []).find(t => t.id === a.tool_id || t.name === a.tool_name);
      return {
        ...a,
        tool_name: a.tool_name || tool?.name || 'Unknown',
        cost: tool?.cost_per_month || 0,
        risk: tool?.derived_risk || computeToolDerivedRisk(tool || {}),
        last_used: tool?.last_used_date || a.last_used_date || null,
        mfa: tool?.mfa_required || tool?.mfa_enabled || false,
        toolObj: tool,
      };
    });
  };

  const employees = useMemo(() =>
    (db?.employees || []).slice().sort((a, b) => a.full_name.localeCompare(b.full_name)),
  [db]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return employees.filter(e => {
      if (s && !`${e.full_name} ${e.email} ${e.role}`.toLowerCase().includes(s)) return false;
      if (dept && e.department !== dept) return false;
      if (status && e.status !== status) return false;
      return true;
    });
  }, [employees, q, dept, status]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => { setPage(0); }, [q, dept, status]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const deptStats = useMemo(() => {
    const m = {};
    employees.forEach(e => {
      const d = e.department || 'other';
      if (!m[d]) m[d] = { active: 0, total: 0 };
      m[d].total++;
      if (e.status === 'active') m[d].active++;
    });
    return Object.entries(m).sort((a, b) => b[1].total - a[1].total);
  }, [employees]);

  const activeCount = employees.filter(e => e.status === 'active').length;
  const offboardingCount = employees.filter(e => e.status === 'offboarding').length;

  const selected = employees.find(e => e.id === selectedId) || null;
  const selectedTools = selected ? getEmployeeTools(selected.id) : [];

  const tenure = (emp) => {
    if (!emp?.start_date) return null;
    // eslint-disable-next-line react-hooks/purity
    const ms = Date.now() - new Date(emp.start_date).getTime();
    const yrs = Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
    const mos = Math.floor((ms % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
    if (yrs > 0) return `${yrs} yr${yrs > 1 ? 's' : ''} ${mos} mo`;
    return `${mos} mo`;
  };

  return (
    <AppShell
      title={t('nav_employees')}
      right={
        <div className="flex gap-2">
          <RoleGate requires="editor">
            <Button variant="secondary" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-4 w-4" />{t('add_employee') || 'Add Employee'}
            </Button>
          </RoleGate>
        </div>
      }
    >
      {/* ── KPI compact strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: t('kpi_total'), value: employees.length, color: 'border-l-blue-500', vcolor: 'text-white', sub: t('sub_all_employees') },
          { label: t('kpi_active'), value: activeCount, color: 'border-l-emerald-500', vcolor: 'text-emerald-400', sub: t('sub_currently_working') },
          { label: t('kpi_offboarding'), value: offboardingCount, color: 'border-l-amber-500', vcolor: 'text-amber-400', sub: t('sub_in_transition') },
          { label: t('kpi_departments'), value: deptStats.length, color: 'border-l-purple-500', vcolor: 'text-purple-400', sub: t('sub_distinct_teams') },
        ].map((kpi, i) => (
          <div key={i} className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-4 border-l-4 ${kpi.color}`}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{kpi.label}</div>
            <div className={`text-2xl font-black ${kpi.vcolor}`}>{kpi.value}</div>
            <div className="text-xs text-slate-500">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Directory Sync Banner ── */}
      <DirectorySyncBanner />

      {/* ── SPLIT VIEW ── */}
      <div className="flex rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>

        {/* LEFT — Employee List */}
        <div className="w-full md:w-[38%] flex-shrink-0 border-r border-slate-800 flex flex-col">

          {/* Search + filters */}
          <div className="p-3 border-b border-slate-800 space-y-2 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
              <input
                className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"
                placeholder={t('search_placeholder_employees')}
                value={q} onChange={e => setQ(e.target.value)} />
            </div>

            {/* Dept chips */}
            {deptStats.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setDept('')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${!dept ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                  {t('lbl_all_count')} ({employees.length})
                </button>
                {deptStats.map(([name, stats]) => (
                  <button key={name} onClick={() => setDept(name)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors capitalize ${dept === name ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                    {name} ({stats.active})
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 outline-none">
                <option value="">{t('all_status')}</option>
                <option value="active">{t('st_active')}</option>
                <option value="offboarding">{t('st_offboarding')}</option>
                <option value="offboarded">{t('st_offboarded')}</option>
              </select>
              <span className="text-[11px] text-slate-500 whitespace-nowrap">{filtered.length} found</span>
            </div>
          </div>

          {/* Employee list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl bg-slate-800/40 animate-pulse" />)}
              </div>
            ) : paginated.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-sm text-slate-500">
                <Users className="h-8 w-8 mb-2 opacity-30" />
                {t('empty_no_employees')}
              </div>
            ) : (
              paginated.map(e => {
                const isSelected = e.id === selectedId;
                const cost = employeeCost.get(e.id) || 0;
                const appCount = toolCounts.get(e.id) || 0;
                return (
                  <button key={e.id} onClick={() => setSelectedId(isSelected ? null : e.id)}
                    className={`w-full flex items-center gap-3 p-3.5 border-b border-slate-800/50 transition-colors text-left ${
                      isSelected
                        ? 'bg-blue-500/8 border-l-2 border-l-blue-500'
                        : 'hover:bg-slate-800/30'
                    }`}>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {(e.full_name || '?').charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">{e.full_name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border flex-shrink-0 ${
                          e.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                          e.status === 'offboarding' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                          'bg-slate-700 text-slate-400 border-slate-600'
                        }`}>{e.status}</span>
                      </div>
                      <div className="text-xs text-slate-400 truncate capitalize">{e.department || '—'}{e.role ? ` · ${e.role}` : ''}</div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-xs font-bold text-blue-400">{appCount} app{appCount !== 1 ? 's' : ''}</div>
                      {cost > 0 && <div className="text-[10px] text-slate-500">€{cost.toLocaleString()}/mo</div>}
                    </div>
                  </button>
                );
              })
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 p-3 border-t border-slate-800">
                <span className="text-[11px] text-slate-500">{page * PAGE_SIZE + 1}–{Math.min((page+1)*PAGE_SIZE, filtered.length)} of {filtered.length}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}
                    className="px-2 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 disabled:opacity-30">‹</button>
                  <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page >= totalPages-1}
                    className="px-2 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 disabled:opacity-30">›</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Employee Profile */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3 py-20">
              <Users className="h-12 w-12 opacity-20" />
              <div className="text-sm font-medium">{t('empty_select_employee')}</div>
              <div className="text-xs opacity-60">{employees.length} employee{employees.length !== 1 ? 's' : ''} in directory</div>
            </div>
          ) : (
            <div>
              {/* Profile header */}
              <div className="p-6 border-b border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-black text-2xl flex-shrink-0">
                      {(selected.full_name || '?').charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">{selected.full_name}</h2>
                      <p className="text-sm text-slate-400 mt-0.5">{selected.email}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold border uppercase tracking-wider ${
                          selected.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                          selected.status === 'offboarding' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                          'bg-slate-700 text-slate-400 border-slate-600'
                        }`}>{selected.status}</span>
                        {selected.department && (
                          <span className="text-[10px] px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30 capitalize">{selected.department}</span>
                        )}
                        {selected.role && (
                          <span className="text-[10px] px-2 py-1 rounded-full bg-slate-700 text-slate-300 font-semibold">{selected.role}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <RoleGate requires="editor">
                      <button onClick={() => { setEditing(selected); setOpen(true); }}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" title={t('act_edit')}>
                        <Pencil className="h-4 w-4" />
                      </button>
                    </RoleGate>
                    <Link to={`/offboarding?employee=${encodeURIComponent(selected.id)}`}>
                      <button className="p-2 rounded-xl bg-slate-800 hover:bg-amber-900/30 text-slate-400 hover:text-amber-400 transition-colors" title={t('act_offboard')}>
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </Link>
                    <RoleGate requires="editor">
                      <button onClick={() => { if (window.confirm(`Delete ${selected.full_name}?`)) { muts.deleteEmployee.mutate(selected.id); setSelectedId(null); } }}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 transition-colors" title={t('act_delete')}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </RoleGate>
                  </div>
                </div>

                {/* Detail row */}
                <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-3">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">{t('fld_start_date')}</div>
                    <div className="text-sm font-semibold text-white">
                      {selected.start_date ? new Date(selected.start_date).toLocaleDateString() : '—'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-3">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">{t('fld_tenure')}</div>
                    <div className="text-sm font-semibold text-white">{tenure(selected) || '—'}</div>
                  </div>
                  <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">{t('fld_active_apps')}</div>
                    <div className="text-sm font-bold text-blue-400">{toolCounts.get(selected.id) || 0}</div>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">{t('fld_total_cost')}</div>
                    <div className="text-sm font-bold text-emerald-400">
                      {(employeeCost.get(selected.id) || 0) > 0
                        ? `€${(employeeCost.get(selected.id) || 0).toLocaleString()}/mo`
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Apps section */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-white">Apps &amp; Access</h3>
                  <span className="text-xs text-slate-500">
                    {selectedTools.length} app{selectedTools.length !== 1 ? 's' : ''}
                    {(employeeCost.get(selected.id) || 0) > 0 && ` · €${(employeeCost.get(selected.id) || 0).toLocaleString()}/mo`}
                  </span>
                </div>

                {selectedTools.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    {t('empty_no_apps_employee')}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedTools.map((tool, i) => {
                      const evidence = tool.toolObj ? getRiskEvidence(tool.toolObj) : [];
                      return (
                        <div key={i} className={`rounded-xl border p-4 ${
                          tool.risk === 'high' ? 'border-red-500/20 bg-red-500/5' :
                          tool.risk === 'medium' ? 'border-amber-500/20 bg-amber-500/5' :
                          'border-slate-800 bg-slate-950/40'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-300 flex-shrink-0">
                              {(tool.tool_name || '?')[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-white">{tool.tool_name}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                                  tool.risk === 'high' ? 'bg-red-500/20 text-red-400' :
                                  tool.risk === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-emerald-500/20 text-emerald-400'
                                }`}>{tool.risk || 'low'}</span>
                                {tool.mfa && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-semibold">{t('col_mfa')}</span>}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                <span>{tool.last_used ? `Last used: ${tool.last_used}` : 'No usage data'}</span>
                                {tool.cost > 0 && <><span>·</span><span>€{tool.cost}/mo</span></>}
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              <RoleGate requires="editor">
                                <button
                                  onClick={() => { if (window.confirm(`Revoke ${selected.full_name}'s access to ${tool.tool_name}?`)) muts.deleteAccess.mutate(tool.id); }}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-600/20 text-slate-500 hover:text-red-400 transition-colors" title={t('act_revoke_access')}>
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </RoleGate>
                            </div>
                          </div>
                          {evidence.length > 0 && (tool.risk === 'high' || tool.risk === 'medium') && (
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {evidence.map((r, j) => (
                                <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 border border-slate-700">
                                  {t(r.key) || r.fallback}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal open={open} title={editing ? 'Edit employee' : 'Add employee'} subtitle={t('employee_directory_sub')} onClose={() => setOpen(false)}>
        <EmployeeForm
          initial={editing}
          onClose={() => setOpen(false)}
          onSubmit={(emp) => {
            if (editing) muts.updateEmployee.mutate({ id: editing.id, patch: emp });
            else muts.createEmployee.mutate(emp);
          }}
        />
      </Modal>
    </AppShell>
  );
}
