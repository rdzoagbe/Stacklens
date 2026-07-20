import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { uid, loadDb, saveDb, seedDbIfEmpty } from '../lib/db';
import { getPlanLimits } from '../lib/plan';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';

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

  const setDb = (updater) => {
    const cur = seedDbIfEmpty();
    const next = typeof updater === 'function' ? updater(clone(cur)) : updater;
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
        throw new Error(`PLAN_LIMIT:You've reached your ${limits.label} plan limit of ${limits.tools} tools. Upgrade to add more.`);
      }
      setDb((db) => {
        db.tools.unshift({ ...tool, id: uid('tool') });
        return db;
      });
    },
    onSuccess: invalidate,
    onError: (err) => {
      if (err.message?.startsWith('PLAN_LIMIT:')) {
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
        throw new Error(`PLAN_LIMIT:You've reached your ${limits.label} plan limit of ${limits.employees} employees. Upgrade to add more.`);
      }
      setDb((db) => {
        db.employees.unshift({ ...emp, id: uid('emp') });
        return db;
      });
    },
    onSuccess: invalidate,
    onError: (err) => {
      if (err.message?.startsWith('PLAN_LIMIT:')) {
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
      });
    },
    onSuccess: invalidate,
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
      });
    },
    onSuccess: invalidate,
    onError: () => toast.error(t('err_add_access')),
  });

  const updateAccess = useMutation({
    mutationFn: async ({ id, patch }) => {
      setDb((db) => {
        db.access = db.access.map((a) => (a.id === id ? { ...a, ...patch } : a));
        return db;
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
      });
    },
    onSuccess: invalidate,
  });

  return {
    createTool, updateTool, deleteTool,
    createEmployee, updateEmployee, deleteEmployee,
    createAccess, updateAccess, deleteAccess,
    setPlan, setAuth, setBudgets, bulkImport,
  };
}
