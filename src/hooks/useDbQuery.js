import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { uid, loadDb, saveDb, seedDbIfEmpty } from '../lib/db';
import { getPlanLimits } from '../lib/plan';
import { track } from '../lib/analytics';
import { appendAudit, auditActor, changedKeys, describeChange } from '../lib/audit';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';

// A plan limit is the clearest upgrade signal this product produces: it marks
// the exact moment someone wanted to do more and the plan said no. The throw
// carries the numbers so the handler can report which limit bit, rather than
// re-deriving them from a sentence written for a human.
function planLimitError(kind, plan, label, cap) {
  const err = new Error(
    `PLAN_LIMIT:You've reached your ${label} plan limit of ${cap} ${kind}. Upgrade to add more.`
  );
  err.limitKind = kind;
  err.limitPlan = plan;
  err.limitCap  = cap;
  return err;
}

export function useDbQuery() {
  return useQuery({
    queryKey: ['db'],
    queryFn: async () => seedDbIfEmpty(),
  });
}

export function useDbMutations() {
  const qc = useQueryClient();
  const { language } = useLang();
  const t = useTranslation(language);

  const clone = (obj) => {
    if (typeof structuredClone === 'function') return structuredClone(obj);
    return JSON.parse(JSON.stringify(obj));
  };

  // Every mutation in this file goes through here, which is why the audit
  // trail hangs off it: one funnel, so an action cannot be recorded in one
  // place and forgotten in another.
  //
  // `describe` is a function of (after, before) rather than a fixed object,
  // because the useful details are only knowable at one end or the other — a
  // deleted tool's name is in `before`, a created one's is in `after`, and the
  // access rows a delete cascaded through can only be counted by comparing.
  //
  // `before` is the un-cloned original. That is safe and deliberate: the
  // updater is handed a clone, so `cur` is never touched, and passing it costs
  // nothing. A second structuredClone of the whole workspace on every keystroke
  // would not be free at a few thousand access rows.
  const setDb = (updater, describe) => {
    const cur = seedDbIfEmpty();
    const next = typeof updater === 'function' ? updater(clone(cur)) : updater;
    if (typeof describe === 'function') {
      try {
        const entry = describe(next, cur);
        if (entry && entry.action) {
          next.audit_log = appendAudit(next, { ...entry, user: auditActor(next) });
        }
      } catch { /* a trail is worth having, never worth losing the edit for */ }
    }
    saveDb(next);
    return next;
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ['db'] });

  const createTool = useMutation({
    mutationFn: async (tool) => {
      const current = loadDb();
      const plan = current?.user?.is_founder ? 'scale' : (current?.user?.plan || current?.user?.subscription_plan || 'free');
      const limits = getPlanLimits(plan);
      if ((current?.tools?.length || 0) >= limits.tools) {
        throw planLimitError('tools', plan, limits.label, limits.tools);
      }
      setDb((db) => {
        db.tools.unshift({ ...tool, id: uid('tool') });
        return db;
      }, () => ({ action: 'tool.created', details: tool?.name || '(unnamed)' }));
    },
    onSuccess: () => { invalidate(); track('tool_added'); },
    onError: (err) => {
      if (err.message?.startsWith('PLAN_LIMIT:')) {
        track('plan_limit_hit', { limit: err.limitKind, plan: err.limitPlan, cap: err.limitCap });
        toast.error(err.message.replace('PLAN_LIMIT:', ''), { duration: 6000 });
      }
    },
  });

  const updateTool = useMutation({
    mutationFn: async ({ id, patch }) => {
      setDb((db) => {
        db.tools = db.tools.map((t) => (t.id === id ? { ...t, ...patch } : t));
        const tool = db.tools.find((t) => t.id === id);
        db.access = db.access.map((a) =>
          a.tool_id === id ? { ...a, tool_name: tool?.name || a.tool_name } : a
        );
        return db;
      }, (after, before) => {
        const was = (before.tools || []).find((t) => t.id === id);
        const keys = changedKeys(was, patch);
        if (!keys.length) return null;          // a form submitted unchanged
        return {
          action: 'tool.updated',
          details: describeChange(was?.name || id, keys),
        };
      });
    },
    onSuccess: invalidate,
    onError: () => toast.error(t('err_update_tool')),
  });

  const deleteTool = useMutation({
    mutationFn: async (id) => {
      setDb((db) => {
        db.tools = db.tools.filter((t) => t.id !== id);
        db.access = db.access.filter((a) => a.tool_id !== id);
        return db;
      }, (after, before) => {
        // The cascade is the part an auditor follows: deleting a tool silently
        // removes every access grant to it.
        const was = (before.tools || []).find((t) => t.id === id);
        const revoked = (before.access || []).length - (after.access || []).length;
        return {
          action: 'tool.deleted',
          details: `${was?.name || id}${revoked > 0 ? ` — ${revoked} access grant(s) removed` : ''}`,
        };
      });
    },
    onSuccess: invalidate,
    onError: () => toast.error(t('err_delete_tool')),
  });

  const createEmployee = useMutation({
    mutationFn: async (emp) => {
      const current = loadDb();
      const plan = current?.user?.is_founder ? 'scale' : (current?.user?.plan || current?.user?.subscription_plan || 'free');
      const limits = getPlanLimits(plan);
      if ((current?.employees?.length || 0) >= limits.employees) {
        throw planLimitError('employees', plan, limits.label, limits.employees);
      }
      setDb((db) => {
        db.employees.unshift({ ...emp, id: uid('emp') });
        return db;
      }, () => ({
        action: 'employee.created',
        details: emp?.full_name || emp?.email || '(unnamed)',
      }));
    },
    onSuccess: () => { invalidate(); track('employee_added'); },
    onError: (err) => {
      if (err.message?.startsWith('PLAN_LIMIT:')) {
        track('plan_limit_hit', { limit: err.limitKind, plan: err.limitPlan, cap: err.limitCap });
        toast.error(err.message.replace('PLAN_LIMIT:', ''), { duration: 6000 });
      }
    },
  });

  const updateEmployee = useMutation({
    mutationFn: async ({ id, patch }) => {
      setDb((db) => {
        const before = db.employees.find((e) => e.id === id);
        const oldEmail = (before?.email || '').toLowerCase();

        db.employees = db.employees.map((e) => (e.id === id ? { ...e, ...patch } : e));
        const after = db.employees.find((e) => e.id === id);
        const newEmail = (after?.email || '').toLowerCase();

        db.access = db.access.map((a) => {
          if (a.employee_id !== id) return a;
          return {
            ...a,
            employee_name: after?.full_name || a.employee_name,
            employee_email: after?.email || a.employee_email,
          };
        });

        if (oldEmail && newEmail && oldEmail !== newEmail) {
          db.tools = db.tools.map((t) =>
            (t.owner_email || '').toLowerCase() === oldEmail
              ? { ...t, owner_email: after.email, owner_name: after.full_name || t.owner_name }
              : t
          );
        } else if (newEmail) {
          db.tools = db.tools.map((t) =>
            (t.owner_email || '').toLowerCase() === newEmail
              ? { ...t, owner_name: after?.full_name || t.owner_name }
              : t
          );
        }

        return db;
      }, (after, before) => {
        const was = (before.employees || []).find((e) => e.id === id);
        const keys = changedKeys(was, patch);
        if (!keys.length) return null;
        const who = was?.full_name || was?.email || id;
        // Offboarding is a governance event in its own right, not a field edit.
        if (patch?.status && patch.status !== was?.status) {
          return {
            action: `employee.${patch.status === 'offboarding' ? 'offboarding_started' : 'status_changed'}`,
            details: `${who} → ${patch.status}`,
          };
        }
        return { action: 'employee.updated', details: describeChange(who, keys) };
      });
    },
    onSuccess: (_data, vars) => {
      invalidate();
      if (vars?.patch?.status === 'offboarding') track('offboarding_started');
    },
    onError: () => toast.error(t('err_update_employee')),
  });

  const deleteEmployee = useMutation({
    mutationFn: async (id) => {
      setDb((db) => {
        const emp = db.employees.find((e) => e.id === id);
        const email = (emp?.email || '').toLowerCase();
        db.employees = db.employees.filter((e) => e.id !== id);
        db.access = db.access.filter((a) => a.employee_id !== id);
        if (email) {
          db.tools = db.tools.map((t) =>
            (t.owner_email || '').toLowerCase() === email
              ? { ...t, owner_email: '', owner_name: '', status: 'orphaned' }
              : t
          );
        }
        return db;
      }, (after, before) => {
        // Two cascades worth recording: the access removed, and the tools left
        // without an owner. Both are the kind of thing someone asks about
        // months later.
        const was = (before.employees || []).find((e) => e.id === id);
        const revoked = (before.access || []).length - (after.access || []).length;
        const orphaned = (after.tools || []).filter((t) => t.status === 'orphaned').length
                       - (before.tools || []).filter((t) => t.status === 'orphaned').length;
        const parts = [];
        if (revoked > 0) parts.push(`${revoked} access grant(s) removed`);
        if (orphaned > 0) parts.push(`${orphaned} tool(s) orphaned`);
        return {
          action: 'employee.deleted',
          details: `${was?.full_name || was?.email || id}${parts.length ? ` — ${parts.join(', ')}` : ''}`,
        };
      });
    },
    onSuccess: invalidate,
    onError: () => toast.error(t('err_delete_employee')),
  });

  const createAccess = useMutation({
    mutationFn: async (row) => {
      setDb((db) => {
        db.access.unshift({ ...row, id: uid('acc') });
        return db;
      }, () => ({
        action: 'access.granted',
        details: `${row?.employee_name || row?.employee_email || '?'} → ${row?.tool_name || '?'}`
               + `${row?.access_level ? ` (${row.access_level})` : ''}`,
      }));
    },
    onSuccess: invalidate,
    onError: () => toast.error(t('err_add_access')),
  });

  const updateAccess = useMutation({
    mutationFn: async ({ id, patch }) => {
      setDb((db) => {
        db.access = db.access.map((a) => (a.id === id ? { ...a, ...patch } : a));
        return db;
      }, (after, before) => {
        const was = (before.access || []).find((a) => a.id === id);
        const keys = changedKeys(was, patch);
        if (!keys.length) return null;
        const what = `${was?.employee_name || was?.employee_email || '?'} → ${was?.tool_name || '?'}`;
        // Revocation is THE event an auditor looks for, and the README
        // promises it by name. It is not "an access row was updated".
        if (patch?.status && patch.status !== was?.status) {
          const revoked = patch.status === 'revoked' || patch.status === 'pending_revocation';
          return {
            action: revoked ? 'access.revoked' : 'access.status_changed',
            details: `${what} → ${patch.status}`,
          };
        }
        return { action: 'access.updated', details: describeChange(what, keys) };
      });
    },
    onSuccess: invalidate,
    onError: () => toast.error(t('err_update_access')),
  });

  const deleteAccess = useMutation({
    mutationFn: async (id) => {
      setDb((db) => {
        db.access = db.access.filter((a) => a.id !== id);
        return db;
      }, (after, before) => {
        const was = (before.access || []).find((a) => a.id === id);
        return {
          action: 'access.removed',
          details: `${was?.employee_name || was?.employee_email || '?'} → ${was?.tool_name || '?'}`,
        };
      });
    },
    onSuccess: invalidate,
  });

  const setPlan = useMutation({
    mutationFn: async (subscription_plan) => {
      setDb((db) => {
        db.user.subscription_plan = subscription_plan;
        return db;
      });
    },
    onSuccess: invalidate,
  });

  // Replace the full department-budget list (rows: { year, department, annual })
  const setBudgets = useMutation({
    mutationFn: async (budgets) => {
      setDb((db) => {
        db.budgets = budgets;
        return db;
      });
    },
    onSuccess: invalidate,
  });

  // Apply AI-extracted invoices: record them in db.invoice_records and
  // create/update the matching tool's recurring monthly cost by vendor name.
  const importInvoices = useMutation({
    mutationFn: async (rows) => {
      setDb((db) => {
        const stamped = rows.map((r) => ({ ...r, id: uid('inv'), imported_at: new Date().toISOString() }));
        db.invoice_records = [...stamped, ...(db.invoice_records || [])].slice(0, 1000);

        const byName = Object.fromEntries((db.tools || []).map((t) => [(t.name || '').toLowerCase().trim(), t]));
        rows.forEach((r) => {
          const monthly = Math.round((r.monthly || 0) * 100) / 100;
          const nameKey = (r.vendor || '').toLowerCase().trim();
          if (!nameKey) return;
          const existing = byName[nameKey];
          if (existing) {
            if (monthly > 0) {
              existing.cost_per_month = monthly;
              existing.cost_monthly = monthly;
              existing.cost = monthly;
            }
            if (r.period_end && (!existing.renewal_date || existing.renewal_date < r.period_end)) {
              existing.renewal_date = r.period_end;
            }
          } else if (monthly > 0) {
            const tool = {
              id: uid('tool'), name: r.vendor, category: 'other', owner_email: '', owner_name: '',
              criticality: 'medium', url: '', description: '', status: 'active',
              last_used_date: new Date().toISOString().slice(0, 10),
              cost_per_month: monthly, cost_monthly: monthly, cost: monthly,
              renewal_date: r.period_end || '', risk_score: 'low', derived_risk: 'low',
              notes: 'Created from invoice import',
            };
            db.tools = [tool, ...db.tools];
            byName[nameKey] = tool;
          }
        });
        return db;
      });
    },
    onSuccess: (_data, rows) => { invalidate(); track('invoice_import_completed', { count: Array.isArray(rows) ? rows.length : undefined }); },
  });

  const setAuth = useMutation({
    mutationFn: async (patch) => {
      setDb((db) => {
        db.user = { ...db.user, ...patch };
        return db;
      });
    },
    onSuccess: invalidate,
  });

  const bulkImport = useMutation({
    mutationFn: async ({ kind, records: initialRecords }) => {
      let records = initialRecords;
      const current = loadDb();
      const plan = current?.user?.is_founder ? 'scale' : (current?.user?.plan || current?.user?.subscription_plan || 'free');
      const limits = getPlanLimits(plan);
      const currentTools = current?.tools?.length || 0;
      const currentEmps  = current?.employees?.length || 0;

      if (kind === 'tools' && currentTools + records.length > limits.tools) {
        const allowed = limits.tools - currentTools;
        throw new Error(`PLAN_LIMIT:Importing ${records.length} tools would exceed your ${limits.label} plan limit of ${limits.tools}. You can add ${Math.max(0, allowed)} more. Upgrade for more capacity.`);
      }
      if (kind === 'employees' && currentEmps + records.length > limits.employees) {
        const allowed = Math.max(0, limits.employees - currentEmps);
        records = records.slice(0, allowed);
        if (allowed === 0) {
          throw new Error(`PLAN_LIMIT:You've already reached your ${limits.label} plan limit of ${limits.employees} employees. Upgrade to add more.`);
        }
        setTimeout(() => toast(`Imported ${allowed} of the file's employees. Free plan limit is ${limits.employees}. Upgrade to Pro to import the full file.`, { icon: '⚡', duration: 8000 }), 100);
      }
      if (kind === 'company') {
        const uniqEmails = new Set(records.map(r => (r.employee_email || '').toLowerCase().trim()).filter(Boolean));
        const uniqTools  = new Set(records.map(r => (r.tool_name || '').trim()).filter(Boolean));
        const wouldExceedEmps  = currentEmps  + uniqEmails.size > limits.employees;
        const wouldExceedTools = currentTools + uniqTools.size  > limits.tools;

        if (wouldExceedEmps || wouldExceedTools) {
          const allowedEmps  = Math.max(0, limits.employees - currentEmps);
          const allowedTools = Math.max(0, limits.tools - currentTools);

          if (allowedEmps === 0 && allowedTools === 0) {
            throw new Error(`PLAN_LIMIT:You've already reached your ${limits.label} plan limits. Upgrade to add more.`);
          }

          const allowedEmailsSet = new Set(Array.from(uniqEmails).slice(0, allowedEmps));
          const allowedToolsSet  = new Set(Array.from(uniqTools).slice(0, allowedTools));
          records = records.filter(r => {
            const e = (r.employee_email || '').toLowerCase().trim();
            const tool = (r.tool_name || '').trim();
            return (!e || allowedEmailsSet.has(e)) && (!tool || allowedToolsSet.has(tool));
          });

          const empMsg  = wouldExceedEmps  ? `${uniqEmails.size} employees (showing first ${allowedEmps})` : '';
          const toolMsg = wouldExceedTools ? `${uniqTools.size} tools (showing first ${allowedTools})` : '';
          const both = [empMsg, toolMsg].filter(Boolean).join(' and ');
          setTimeout(() => toast(`Your file has ${both}. Upgrade to Pro to import everything.`, { icon: '⚡', duration: 10000 }), 100);
        }
      }

      setDb((db) => {
        if (kind === 'company') {
          const existingEmps    = db.employees || [];
          const existingTools   = db.tools || [];
          const existingEmpsByEmail  = Object.fromEntries(existingEmps.map(e  => [(e.email || '').toLowerCase(), e]));
          const existingToolsByName  = Object.fromEntries(existingTools.map(t => [(t.name  || '').toLowerCase(), t]));

          const empMap  = {};
          const toolMap = {};
          const accessRows = [];

          records.forEach(r => {
            const email = (r.employee_email || '').toLowerCase().trim();
            if (email && !empMap[email]) {
              const existing = existingEmpsByEmail[email];
              empMap[email] = existing ? {
                ...existing,
                full_name:  r.employee_name   || existing.full_name,
                department: r.department       || existing.department,
                role:       r.role             || existing.role,
                status:     r.employee_status  || existing.status,
              } : {
                id:         uid('emp'),
                full_name:  r.employee_name   || '',
                email:      r.employee_email  || '',
                department: r.department      || 'other',
                role:       r.role            || '',
                status:     r.employee_status || 'active',
                start_date: r.start_date      || '',
                end_date:   r.end_date        || '',
              };
            }
            const toolName = (r.tool_name || '').trim();
            const toolKey  = toolName.toLowerCase();
            if (toolName && !toolMap[toolKey]) {
              const existing = existingToolsByName[toolKey];
              toolMap[toolKey] = existing ? {
                ...existing,
                category:       r.tool_category    || existing.category,
                cost_per_month: Number(r.tool_cost_monthly || existing.cost_per_month || 0),
                cost_monthly:   Number(r.tool_cost_monthly || existing.cost_monthly   || 0),
                cost:           Number(r.tool_cost_monthly || existing.cost            || 0),
                renewal_date:   r.renewal_date      || existing.renewal_date,
                criticality:    r.tool_criticality  || existing.criticality,
                status:         r.tool_status       || existing.status,
              } : {
                id:             uid('tool'),
                name:           r.tool_name        || '',
                category:       r.tool_category    || 'other',
                owner_email:    r.employee_email   || '',
                owner_name:     r.employee_name    || '',
                criticality:    r.tool_criticality || 'medium',
                url:            r.tool_url         || '',
                description:    '',
                status:         r.tool_status      || 'active',
                last_used_date: new Date().toISOString().slice(0, 10),
                cost_per_month: Number(r.tool_cost_monthly || 0),
                cost_monthly:   Number(r.tool_cost_monthly || 0),
                cost:           Number(r.tool_cost_monthly || 0),
                renewal_date:   r.renewal_date || '',
                risk_score:     'low',
                derived_risk:   'low',
                notes:          '',
              };
            }
            if (email && toolName) {
              accessRows.push({ email, toolName: toolKey, access_level: r.access_level || 'member' });
            }
          });

          const importedEmpEmails = new Set(Object.keys(empMap));
          const importedToolKeys  = new Set(Object.keys(toolMap));
          db.employees = [...Object.values(empMap), ...existingEmps.filter(e  => !importedEmpEmails.has((e.email || '').toLowerCase()))];
          db.tools     = [...Object.values(toolMap), ...existingTools.filter(t => !importedToolKeys.has((t.name  || '').toLowerCase()))];

          const importedEmpIds  = new Set(Object.values(empMap).map(e  => e.id));
          const importedToolIds = new Set(Object.values(toolMap).map(t => t.id));
          const keptAccess = (db.access || []).filter(a =>
            !(importedEmpIds.has(a.employee_id) && importedToolIds.has(a.tool_id))
          );
          const newAccess = accessRows.map(a => {
            const emp  = empMap[a.email];
            const tool = toolMap[a.toolName];
            if (!emp || !tool) return null;
            return {
              id:             uid('acc'),
              tool_id:        tool.id,
              tool_name:      tool.name,
              employee_id:    emp.id,
              employee_name:  emp.full_name,
              employee_email: emp.email,
              access_level:   a.access_level,
              granted_date:   emp.start_date || new Date().toISOString().slice(0, 10),
              status:         emp.status === 'offboarded' ? 'revoked' : 'active',
            };
          }).filter(Boolean);
          db.access = [...newAccess, ...keptAccess];
        }

        if (kind === 'tools') {
          const newTools = records.map((r) => ({
            id:             uid('tool'),
            name:           r.name           || '',
            category:       r.category       || 'other',
            owner_email:    r.owner_email     || '',
            owner_name:     r.owner_name      || '',
            criticality:    r.criticality     || 'medium',
            url:            r.url             || '',
            description:    r.description     || '',
            status:         r.status          || 'active',
            last_used_date: r.last_used_date  || new Date().toISOString().slice(0, 10),
            cost_per_month: Number(r.cost_per_month || 0),
            cost_monthly:   Number(r.cost_per_month || 0),
            cost:           Number(r.cost_per_month || 0),
            renewal_date:   r.renewal_date    || '',
            risk_score:     r.risk_score      || 'low',
            derived_risk:   r.risk_score      || 'low',
            notes:          r.notes           || '',
          }));
          db.tools = [...newTools, ...db.tools];
          if (db.employees && db.employees.length > 0) {
            const newAccess = [];
            newTools.forEach(tool => {
              const owner = db.employees.find(e => e.email === tool.owner_email);
              if (owner) newAccess.push({ id: uid('acc'), tool_id: tool.id, tool_name: tool.name, employee_id: owner.id, employee_name: owner.full_name, employee_email: owner.email, access_level: 'admin', granted_date: new Date().toISOString().slice(0, 10), status: 'active' });
            });
            db.access = [...newAccess, ...(db.access || [])];
          }
        }

        if (kind === 'employees') {
          db.employees = [
            ...records.map((r) => ({
              id:         uid('emp'),
              full_name:  r.full_name  || '',
              email:      r.email      || '',
              department: r.department || 'other',
              role:       r.role       || '',
              status:     r.status     || 'active',
              start_date: r.start_date || '',
              end_date:   r.end_date   || '',
              ...(r.github_login && { github_login: r.github_login }),
            })),
            ...db.employees,
          ];
        }

        if (kind === 'access') {
          const toolsByName = Object.fromEntries(db.tools.map((t) => [t.name.toLowerCase(), t]));
          const empByEmail  = Object.fromEntries(db.employees.map((e) => [e.email.toLowerCase(), e]));
          db.access = [
            ...records.map((r) => {
              const tool = toolsByName[(r.tool_name || '').toLowerCase()];
              const emp  = empByEmail[(r.employee_email || '').toLowerCase()];
              if (!tool || !emp) return null;
              return {
                id:                 uid('acc'),
                tool_id:            tool.id,
                tool_name:          tool.name,
                employee_id:        emp.id,
                employee_name:      emp.full_name,
                employee_email:     emp.email,
                access_level:       r.access_level       || 'viewer',
                granted_date:       r.granted_date        || '',
                last_accessed_date: r.last_accessed_date  || '',
                last_reviewed_date: r.last_reviewed_date  || '',
                status:             r.status              || 'active',
                risk_flag:          r.risk_flag           || 'none',
              };
            }).filter(Boolean),
            ...db.access,
          ];
        }

        return db;
      }, (after, before) => {
        // One row for the whole import, with the net effect. A row per record
        // would bury everything else in the log the first time somebody
        // uploads a real directory — and the counts are what gets questioned
        // ("where did these 200 people come from?"), not the individual adds.
        const delta = (key) => (after[key] || []).length - (before[key] || []).length;
        const parts = [
          ['employee', delta('employees')],
          ['tool', delta('tools')],
          ['access grant', delta('access')],
        ].filter(([, n]) => n > 0).map(([label, n]) => `${n} ${label}${n === 1 ? '' : 's'}`);
        return {
          action: `import.${kind}`,
          details: parts.length ? `added ${parts.join(', ')}` : 'no new records',
        };
      });
    },
    onSuccess: (_data, vars) => { invalidate(); track('csv_import_completed', { kind: vars?.kind }); },
  });

  return {
    createTool, updateTool, deleteTool,
    createEmployee, updateEmployee, deleteEmployee,
    createAccess, updateAccess, deleteAccess,
    setPlan, setAuth, setBudgets, importInvoices, bulkImport,
  };
}
