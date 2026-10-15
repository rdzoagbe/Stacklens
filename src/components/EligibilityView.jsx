import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useDbMutations } from '../hooks/useDbQuery';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Modal, Button, Input, useCategoryLabel } from './ui';
import { hasRole } from './gates';
import { todayISO } from '../lib/db';
import { formatMoney } from '../lib/currency';
import {
  cleanRule, parseTitleWords, eligibilityGaps, departmentsInUse, isEligible, jobTitleOf,
} from '../lib/eligibility';
import { openPeopleChanges } from '../lib/peopleChanges';

// ── Access → Eligibility ───────────────────────────────────────────────────
//
// One rule per tool (lib/eligibility.js), and the two lists it produces. The
// buttons record what was done in the tool's own console; nothing here grants
// or removes a licence anywhere else, and the page says so.

const fill = (s, vars) => Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), s);

function RuleSummary({ rule, t, label }) {
  if (!rule) return <span className="text-slate-500">{t('elig_no_rule')}</span>;
  if (rule.mode === 'all') return <span>{t('elig_everyone')}</span>;
  const parts = [
    ...rule.departments.map(label),
    ...rule.titles.map((w) => fill(t('elig_title_contains'), { word: w })),
  ];
  return <span>{parts.length ? parts.join(' · ') : t('elig_nobody')}</span>;
}

function RuleEditor({ tool, employees, onSave, onClose, t, label }) {
  const start = cleanRule(tool.eligibility) || { mode: 'match', departments: [], titles: [], excluded_ids: [] };
  const [mode, setMode] = useState(start.mode);
  const [departments, setDepartments] = useState(start.departments);
  const [titleText, setTitleText] = useState(start.titles.join(', '));
  const depts = useMemo(() => departmentsInUse(employees), [employees]);
  const draft = { mode, departments, titles: parseTitleWords(titleText), excluded_ids: start.excluded_ids };
  const active = employees.filter((e) => e.status === 'active').length;
  const covered = employees.filter((e) => isEligible(e, draft)).length;
  const toggle = (value) => setDepartments((d) => (d.includes(value) ? d.filter((x) => x !== value) : [...d, value]));

  return (
    <Modal open title={fill(t('elig_rule_for'), { tool: tool.name })} subtitle={t('elig_rule_sub')} onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-400" data-testid="elig-preview">{fill(t('elig_preview'), { n: covered, of: active })}</span>
          <div className="flex gap-2">
            {tool.eligibility && <Button variant="ghost" onClick={() => onSave(null)}>{t('elig_remove_rule')}</Button>}
            <Button variant="secondary" onClick={onClose}>{t('ws_cancel')}</Button>
            <Button onClick={() => onSave(draft)}>{t('elig_save')}</Button>
          </div>
        </div>
      }>
      <div className="space-y-4 text-sm">
        <fieldset className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="elig-mode" checked={mode === 'all'} onChange={() => setMode('all')} className="accent-blue-500" />
            <span className="text-slate-200">{t('elig_mode_all')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="elig-mode" checked={mode === 'match'} onChange={() => setMode('match')} className="accent-blue-500" />
            <span className="text-slate-200">{t('elig_mode_match')}</span>
          </label>
        </fieldset>
        {mode === 'match' && (
          <>
            <div>
              <div className="mb-1.5 text-xs font-semibold text-slate-400">{t('elig_departments')}</div>
              {depts.length === 0 ? (
                <p className="text-xs text-slate-500">{t('elig_no_departments')}</p>
              ) : (
                <div className="flex flex-wrap gap-2" data-testid="elig-departments">
                  {depts.map((d) => (
                    <label key={d.value} className={'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 cursor-pointer text-xs ' + (departments.includes(d.value) ? 'border-blue-500/60 bg-blue-500/10 text-blue-200' : 'border-slate-700 text-slate-300')}>
                      <input type="checkbox" checked={departments.includes(d.value)} onChange={() => toggle(d.value)} className="accent-blue-500" />
                      {label(d.value)} <span className="text-slate-500">({d.count})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400" htmlFor="elig-titles">{t('elig_titles')}</label>
              <Input id="elig-titles" value={titleText} onChange={(e) => setTitleText(e.target.value)} placeholder={t('elig_titles_ph')} />
              <p className="mt-1 text-xs text-slate-500">{t('elig_titles_hint')}</p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function Person({ emp, label, children }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-100 truncate">{emp.full_name || emp.email}</span>
        <span className="block text-xs text-slate-500 truncate">
          {[emp.department && label(emp.department), jobTitleOf(emp)].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="flex gap-1.5">{children}</span>
    </li>
  );
}

const small = 'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40';

/** The four answers, shared by the per-tool lists and the joiner/mover to-dos. */
function useLicenceActions(t) {
  const { updateTool, createAccess, updateAccess, updateEmployee } = useDbMutations();
  const grant = (tool, emps) => {
    for (const emp of emps) {
      createAccess.mutate({
        tool_id: tool.id, tool_name: tool.name,
        employee_id: emp.id, employee_name: emp.full_name || '', employee_email: emp.email || '',
        access_level: 'viewer', status: 'active', risk_flag: 'none',
        granted_date: todayISO(), last_reviewed_date: todayISO(), origin: 'eligibility',
      });
    }
    toast.success(fill(t('elig_granted'), { n: emps.length, tool: tool.name }));
  };
  const notNeeded = (tool, emp) => {
    const rule = cleanRule(tool.eligibility);
    updateTool.mutate({ id: tool.id, patch: { eligibility: { ...rule, excluded_ids: [...rule.excluded_ids, emp.id] } } });
  };
  const revoke = (accessRow) => updateAccess.mutate({ id: accessRow.id, patch: { status: 'revoked' } },
    { onSuccess: () => toast.success(t('revoked')) });
  const keep = (accessRow) => updateAccess.mutate({ id: accessRow.id, patch: { eligibility_exception: { at: todayISO() } } });
  const done = (emp) => updateEmployee.mutate({ id: emp.id, patch: { people_change: { ...emp.people_change, done_at: new Date().toISOString() } } });
  return { updateTool, grant, notNeeded, revoke, keep, done };
}

function PeopleChanges({ db, canEdit, actions, t, label, language }) {
  const changes = useMemo(() => openPeopleChanges(db), [db]);
  if (changes.length === 0) return null;
  const when = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(language === 'en' ? 'en-GB' : language); };
  const describe = (c) => {
    if (c.change.kind === 'joiner') return fill(t('jm_joined'), { date: when(c.change.at) });
    const { from = {}, to = {} } = c.change;
    const parts = [];
    if ((from.department || '') !== (to.department || '')) parts.push(`${label(from.department) || '—'} → ${label(to.department) || '—'}`);
    if ((from.title || '') !== (to.title || '')) parts.push(`${from.title || '—'} → ${to.title || '—'}`);
    return `${parts.join(' · ')} · ${when(c.change.at)}`;
  };
  return (
    <section className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-5" data-testid="people-changes">
      <h2 className="text-base font-semibold text-white">{fill(t('jm_title'), { n: changes.length })}</h2>
      <p className="mt-1 mb-4 text-sm text-slate-400 max-w-3xl">{t('jm_intro')}</p>
      <ul className="space-y-3">
        {changes.map((c) => (
          <li key={c.employee.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4" data-testid="people-change">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">{c.employee.full_name || c.employee.email}</span>
                  <span className={'rounded-full px-2 py-0.5 text-[11px] font-semibold ' + (c.change.kind === 'joiner' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300')}>
                    {c.change.kind === 'joiner' ? t('jm_joiner') : t('jm_mover')}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{describe(c)}</div>
              </div>
              {canEdit && (
                <button type="button" onClick={() => actions.done(c.employee)} className={small + ' bg-slate-800 hover:bg-slate-700 text-slate-200'}>
                  {c.pending ? t('jm_done_anyway') : t('jm_done')}
                </button>
              )}
            </div>
            {c.pending === 0 && <p className="mt-2 text-xs text-slate-500">{t('jm_nothing_left')}</p>}
            {(c.grants.length > 0 || c.removals.length > 0) && (
              <ul className="mt-3 space-y-1.5">
                {c.grants.map((tool) => (
                  <li key={'g' + tool.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-blue-200">{fill(t('jm_grant'), { tool: tool.name })}</span>
                    {canEdit && <span className="flex gap-1.5">
                      <button type="button" onClick={() => actions.grant(tool, [c.employee])} className={small + ' bg-blue-600/30 hover:bg-blue-600/50 text-blue-200'}>{t('elig_mark_granted')}</button>
                      <button type="button" onClick={() => actions.notNeeded(tool, c.employee)} className={small + ' bg-slate-800 hover:bg-slate-700 text-slate-300'}>{t('elig_not_needed')}</button>
                    </span>}
                  </li>
                ))}
                {c.removals.map(({ tool, access }) => (
                  <li key={'r' + tool.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-amber-200">{fill(t('jm_remove'), { tool: tool.name })}</span>
                    {canEdit && <span className="flex gap-1.5">
                      <button type="button" onClick={() => actions.revoke(access)} className={small + ' bg-red-600/30 hover:bg-red-600/50 text-red-300'}>{t('elig_mark_removed')}</button>
                      <button type="button" onClick={() => actions.keep(access)} className={small + ' bg-slate-800 hover:bg-slate-700 text-slate-300'}>{t('elig_keep')}</button>
                    </span>}
                  </li>
                ))}
              </ul>
            )}
            {c.unruled.length > 0 && (
              <p className="mt-2 text-xs text-slate-400">{fill(t('jm_unruled'), { tools: c.unruled.map((x) => x.name).join(', ') })}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function EligibilityView({ db }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const label = useCategoryLabel();
  const actions = useLicenceActions(t);
  const { updateTool } = actions;
  const canEdit = hasRole('editor');
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);

  const tools = useMemo(() => (db?.tools || []).filter((x) => x.status !== 'decommissioned'), [db]);
  const items = useMemo(() => tools.map((tool) => ({ tool, ...eligibilityGaps(db, tool) })), [db, tools]);
  const withRule = items.filter((i) => i.rule);
  const totals = {
    toGrant: withRule.reduce((s, i) => s + i.toGrant.length, 0),
    outside: withRule.reduce((s, i) => s + i.outsideRule.length, 0),
  };
  const money = (n) => formatMoney(n, language);
  const open = items.find((i) => i.tool.id === openId) || null;

  const saveRule = (rule) => {
    const tool = editing;
    updateTool.mutate({ id: tool.id, patch: { eligibility: rule ? cleanRule(rule) : null } },
      { onSuccess: () => toast.success(rule ? t('elig_rule_saved') : t('elig_rule_removed')) });
    setEditing(null);
    if (rule) setOpenId(tool.id);
  };
  const grant = actions.grant;
  const notNeeded = actions.notNeeded;
  const revoke = (row) => actions.revoke(row.access);
  const keep = (row) => actions.keep(row.access);

  return (
    <div className="space-y-4" data-testid="eligibility-view">
      <PeopleChanges db={db} canEdit={canEdit} actions={actions} t={t} label={label} language={language} />
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-base font-semibold text-white">{t('elig_title')}</h2>
        <p className="mt-1 text-sm text-slate-400 max-w-3xl">{t('elig_intro')}</p>
        {withRule.length > 0 && (
          <p className="mt-3 text-sm text-slate-300" data-testid="elig-totals">
            {fill(t('elig_totals'), { grant: totals.toGrant, outside: totals.outside, tools: withRule.length })}
          </p>
        )}
      </div>

      {tools.length === 0 ? (
        <p className="text-sm text-slate-500">{t('elig_no_tools')}</p>
      ) : (
        <ul className="space-y-2" data-testid="elig-tools">
          {items.map((i) => (
            <li key={i.tool.id} className="rounded-2xl border border-slate-800 bg-slate-900/60">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <button type="button" onClick={() => setOpenId(openId === i.tool.id ? null : i.tool.id)} className="min-w-0 text-left">
                  <span className="block text-sm font-semibold text-white truncate">{i.tool.name}</span>
                  <span className="block text-xs text-slate-400"><RuleSummary rule={i.rule} t={t} label={label} /></span>
                </button>
                <span className="flex flex-wrap items-center gap-2">
                  {i.rule && i.toGrant.length > 0 && <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-300">{fill(t('elig_badge_grant'), { n: i.toGrant.length })}</span>}
                  {i.rule && i.outsideRule.length > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">{fill(t('elig_badge_outside'), { n: i.outsideRule.length })}</span>}
                  {i.rule && !i.toGrant.length && !i.outsideRule.length && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">{t('elig_badge_ok')}</span>}
                  {canEdit && (
                    <button type="button" onClick={() => setEditing(i.tool)} className={small + ' bg-slate-800 hover:bg-slate-700 text-slate-200'}>
                      {i.rule ? t('elig_edit_rule') : t('elig_set_rule')}
                    </button>
                  )}
                </span>
              </div>

              {open && open.tool.id === i.tool.id && i.rule && (
                <div className="grid gap-4 border-t border-slate-800 px-4 py-4 lg:grid-cols-2" data-testid="elig-detail">
                  <section>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-blue-200">{fill(t('elig_to_grant'), { n: i.toGrant.length })}</h3>
                      {canEdit && i.toGrant.length > 1 && (
                        <button type="button" onClick={() => grant(i.tool, i.toGrant)} className={small + ' bg-blue-600/30 hover:bg-blue-600/50 text-blue-200'}>{t('elig_grant_all')}</button>
                      )}
                    </div>
                    {i.grantCost != null && i.toGrant.length > 0 && <p className="mb-2 text-xs text-slate-500">{fill(t('elig_grant_cost'), { amount: money(i.grantCost) })}</p>}
                    {i.toGrant.length === 0 ? <p className="text-xs text-slate-500">{t('elig_none_to_grant')}</p> : (
                      <ul className="space-y-1.5" data-testid="elig-to-grant">
                        {i.toGrant.map((emp) => (
                          <Person key={emp.id} emp={emp} label={label}>
                            {canEdit && <>
                              <button type="button" onClick={() => grant(i.tool, [emp])} className={small + ' bg-blue-600/30 hover:bg-blue-600/50 text-blue-200'}>{t('elig_mark_granted')}</button>
                              <button type="button" onClick={() => notNeeded(i.tool, emp)} className={small + ' bg-slate-800 hover:bg-slate-700 text-slate-300'}>{t('elig_not_needed')}</button>
                            </>}
                          </Person>
                        ))}
                      </ul>
                    )}
                  </section>
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-amber-200">{fill(t('elig_outside'), { n: i.outsideRule.length })}</h3>
                    {i.recoverable != null && i.outsideRule.length > 0 && <p className="mb-2 text-xs text-slate-500">{fill(t('elig_recoverable'), { amount: money(i.recoverable) })}</p>}
                    {i.outsideRule.length === 0 ? <p className="text-xs text-slate-500">{t('elig_none_outside')}</p> : (
                      <ul className="space-y-1.5" data-testid="elig-outside">
                        {i.outsideRule.map((row) => (
                          <Person key={row.access.id} emp={row.employee} label={label}>
                            {canEdit && <>
                              <button type="button" onClick={() => revoke(row)} className={small + ' bg-red-600/30 hover:bg-red-600/50 text-red-300'}>{t('elig_mark_removed')}</button>
                              <button type="button" onClick={() => keep(row)} className={small + ' bg-slate-800 hover:bg-slate-700 text-slate-300'}>{t('elig_keep')}</button>
                            </>}
                          </Person>
                        ))}
                      </ul>
                    )}
                    {(i.exceptions.length > 0 || i.notNeeded.length > 0) && (
                      <p className="mt-3 text-xs text-slate-500">{fill(t('elig_set_aside'), { kept: i.exceptions.length, skipped: i.notNeeded.length })}</p>
                    )}
                  </section>
                  <p className="text-xs text-slate-500 lg:col-span-2">{t('elig_console_note')}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <RuleEditor tool={editing} employees={db?.employees || []} onSave={saveRule} onClose={() => setEditing(null)} t={t} label={label} />
      )}
    </div>
  );
}
