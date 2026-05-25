import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useDbQuery } from '../hooks/useDbQuery';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../contexts/LangContext';
import { useTour } from '../contexts/TourContext';
import { useTranslation } from '../translations';
import { resolvePlan, getPlanLimits, PLAN_TIERS } from '../lib/plan';

// ── Role-Based Access Control ──────────────────────────────────────────────

export const ROLES = {
  owner:  { level: 4, label: 'Owner',  color: 'amber',   can: ['read', 'write', 'delete', 'invite', 'manage_billing', 'manage_roles'] },
  admin:  { level: 3, label: 'Admin',  color: 'blue',    can: ['read', 'write', 'delete', 'invite'] },
  editor: { level: 2, label: 'Editor', color: 'emerald', can: ['read', 'write'] },
  viewer: { level: 1, label: 'Viewer', color: 'slate',   can: ['read'] },
};

export function getUserRole() {
  try { return (localStorage.getItem('sg_my_role') || 'owner').toLowerCase(); }
  catch { return 'owner'; }
}

export function can(action, role) {
  const r = role || getUserRole();
  return (ROLES[r] || ROLES.owner).can.includes(action);
}

export function RoleGate({ requires, children, fallback = null }) {
  const userLevel    = ROLES[getUserRole()]?.level || 4;
  const requiredLevel = ROLES[requires]?.level || 1;
  return userLevel >= requiredLevel ? children : fallback;
}

export function RoleBadge({ role }) {
  const r = ROLES[role?.toLowerCase()] || ROLES.viewer;
  const colors = {
    amber:   'bg-amber-500/15 text-amber-400 border-amber-500/20',
    blue:    'bg-blue-500/15 text-blue-400 border-blue-500/20',
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    slate:   'bg-slate-500/15 text-slate-400 border-slate-500/20',
  };
  return (
    <span className={'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ' + (colors[r.color] || colors.slate)}>
      {r.label}
    </span>
  );
}

// ── Plan limits hook ───────────────────────────────────────────────────────

export function usePlanLimits() {
  const { data: db } = useDbQuery();
  const plan    = resolvePlan(db?.user);
  const limits  = getPlanLimits(plan);
  const toolCount     = db?.tools?.length || 0;
  const employeeCount = db?.employees?.length || 0;
  return {
    plan, limits,
    usage:  { tools: toolCount, employees: employeeCount },
    canAdd: { tool: toolCount < limits.tools, employee: employeeCount < limits.employees },
    pct:    {
      tools:     Math.min(100, Math.round((toolCount     / limits.tools)     * 100)),
      employees: Math.min(100, Math.round((employeeCount / limits.employees) * 100)),
    },
  };
}

// ── Plan tier gate ─────────────────────────────────────────────────────────

export function PlanGate({ requires, children, feature = 'this feature' }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const { user } = useAuth();
  const navigate = useNavigate();
  const plan         = resolvePlan(user);
  const userTier     = PLAN_TIERS[plan]     ?? 0;
  const requiredTier = PLAN_TIERS[requires] ?? 1;
  if (userTier >= requiredTier) return children;
  const planNames = { starter: 'Starter', growth: 'Growth', scale: 'Scale', unlimited: 'Unlimited' };
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="text-3xl md:text-6xl mb-4">🔒</div>
      <h2 className="text-2xl font-black text-white mb-2">{t('upgrade_to_access')} {feature}</h2>
      <p className="text-slate-400 mb-6 max-w-md">
        This feature requires the <span className="text-blue-400 font-semibold">{planNames[requires] || requires}</span> plan or higher.
        You're currently on the <span className="text-slate-300 font-semibold">{getPlanLimits(plan).label || plan}</span> plan.
      </p>
      <button
        onClick={() => { navigate('/settings'); setTimeout(() => { document.querySelector('[data-tab="billing"]')?.click(); }, 100); }}
        className="px-4 md:px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20"
      >
        View Plans & Upgrade
      </button>
      <button onClick={() => navigate(-1)} className="mt-3 text-sm text-slate-500 hover:text-slate-300 transition-colors">
        ← Go back
      </button>
    </div>
  );
}

// ── Module gate ────────────────────────────────────────────────────────────

export const MODULE_PLANS = {
  finance:   ['hr_finance', 'pro', 'enterprise', 'scale', 'unlimited', 'growth'],
  people:    ['hr_finance', 'pro', 'enterprise', 'scale', 'unlimited', 'growth'],
  security:  ['pro', 'enterprise', 'scale', 'unlimited', 'growth'],
  ai:        ['pro', 'enterprise', 'scale', 'unlimited', 'growth'],
  analytics: ['pro', 'enterprise', 'scale', 'unlimited', 'growth'],
};

export function ModuleGate({ module, children, feature = 'this module' }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const { user } = useAuth();
  const navigate  = useNavigate();
  const plan      = resolvePlan(user);
  const hasAccess = plan === 'trial' || (MODULE_PLANS[module] || []).includes(plan);
  if (hasAccess) return children;

  const moduleNames = {
    finance: t('module_finance'), people: t('module_people'),
    security: t('module_security'), ai: t('module_ai'), analytics: t('module_analytics'),
  };
  const moduleDesc = {
    finance: t('module_desc_finance'), people: t('module_desc_people'),
    security: t('module_desc_security'), ai: t('module_desc_ai'), analytics: t('module_desc_analytics'),
  };
  const isHrFinance      = ['finance', 'people'].includes(module);
  const recommendedPlan  = isHrFinance ? 'HR & Finance Pack' : 'Pro';
  const recommendedPrice = isHrFinance ? '€49/mo' : '€79/mo';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="text-5xl mb-4">🔒</div>
      <h2 className="text-2xl font-black text-white mb-2">
        {moduleNames[module]} — {t('module_not_included')}
      </h2>
      <p className="text-slate-400 mb-2 max-w-md">{moduleDesc[module]}</p>
      <p className="text-slate-400 mb-6 max-w-md">
        {t('module_available_from')}{' '}
        <span className="text-blue-400 font-semibold">{recommendedPlan}</span>
        {' '}({recommendedPrice})
      </p>
      <button
        onClick={() => navigate('/app/settings?tab=billing')}
        className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20"
      >
        {t('view_plans_upgrade')}
      </button>
      <button onClick={() => navigate(-1)} className="mt-3 text-sm text-slate-500 hover:text-slate-300 transition-colors">
        ← {t('go_back')}
      </button>
    </div>
  );
}

// ── Plan limit banner ──────────────────────────────────────────────────────

export function PlanLimitBanner({ resource = 'tools' }) {
  const { plan, limits, usage, pct } = usePlanLimits();
  const navigate  = useNavigate();
  const { language } = useLang();
  const t = useTranslation(language);
  const isUnlimited = limits[resource] >= 99999;
  if (isUnlimited) return null;

  const usageNum = usage[resource];
  const limitNum = limits[resource];
  const percent  = pct[resource];
  const isFull   = usageNum >= limitNum;
  const isNear   = percent >= 80;
  if (!isNear && !isFull) return null;

  const tone = isFull ? 'red' : 'amber';
  return (
    <div className={'rounded-2xl border p-4 lg:p-5 flex items-center gap-4 ' + (tone === 'red' ? 'border-red-500/30 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5')}>
      <div className={'p-2 rounded-lg flex-shrink-0 ' + (tone === 'red' ? 'bg-red-500/10' : 'bg-amber-500/10')}>
        <AlertTriangle className={'h-5 w-5 ' + (tone === 'red' ? 'text-red-400' : 'text-amber-400')} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={'text-sm font-semibold ' + (tone === 'red' ? 'text-red-400' : 'text-amber-400')}>
            {isFull ? `${resource} ${t('plan_limit_reached')}` : `${t('plan_limit_approaching')} ${resource} ${t('plan_limit_reached')}`}
          </span>
          <span className="text-xs text-slate-500">— {limits.label} plan</span>
        </div>
        <div className="text-xs text-slate-400 mb-2">
          {t('plan_limit_using')} <span className="font-semibold text-white">{usageNum}</span> of <span className="font-semibold text-white">{limitNum}</span> {resource}
          {isFull ? `. ${t('plan_limit_upgrade_msg')}` : `. ${limitNum - usageNum} ${t('plan_limit_remaining')}.`}
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden max-w-md">
          <div className={'h-full transition-all ' + (tone === 'red' ? 'bg-red-500' : 'bg-amber-500')} style={{ width: `${percent}%` }} />
        </div>
      </div>
      <button
        onClick={() => navigate('/settings')}
        className={'px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex-shrink-0 ' + (tone === 'red' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white')}
      >
        {t('plan_limit_upgrade_btn')}
      </button>
    </div>
  );
}

// ── Tour helpers ───────────────────────────────────────────────────────────

export function TourEmptyState({ icon, title, subtitle, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div style={{ fontSize: 56, marginBottom: 16, filter: 'drop-shadow(0 0 20px rgba(99,102,241,0.4))' }}>{icon}</div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm max-w-xs mb-6">{subtitle}</p>
      {action && (
        <button
          onClick={onAction}
          style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

export function TourLaunchButton() {
  const { startTour } = useTour();
  return (
    <button
      onClick={startTour}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px', borderRadius: 10,
        background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
        border: 'none', color: 'white', cursor: 'pointer',
        fontSize: 13, fontWeight: 700,
        boxShadow: '0 0 20px rgba(124,58,237,0.4)', transition: 'all 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'none'}
    >
      <span style={{ fontSize: 16 }}>✨</span>
      Take the Tour
    </button>
  );
}
