import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, ChevronUp,
  Wrench, Sparkles, Activity, Briefcase, CreditCard, Users, Building2,
  Lock, ExternalLink, Boxes,
  BadgeCheck, BadgeX, AlertTriangle, CalendarClock, RefreshCw, Info,
  Pencil, UserMinus,
} from 'lucide-react';
import { cx } from '../lib/utils';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';

// ── Logo ───────────────────────────────────────────────────────────────────

export function RDLogo({ size = 'md', onClick }) {
  const s = { sm: 'h-9 w-9', md: 'h-12 w-12', lg: 'h-16 w-16' }[size] || 'h-12 w-12';
  return (
    <button onClick={onClick} className={cx('relative group cursor-pointer transition-all duration-300 hover:scale-105 flex-shrink-0', s)}>
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-700 via-blue-600 to-blue-800 opacity-60 blur-md group-hover:opacity-90 transition-opacity duration-300" />
      <div className="relative flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 via-blue-600 to-blue-900 shadow-xl overflow-hidden h-full w-full border border-blue-400/30">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        <svg viewBox="0 0 32 32" fill="none" style={{ width: '72%', height: '72%' }} className="relative z-10">
          <path d="M16 2L5 7v8c0 6.5 4.7 12.6 11 14 6.3-1.4 11-7.5 11-14V7L16 2z"
            fill="url(#shieldGrad)" stroke="#60a5fa" strokeWidth="0.5" />
          <circle cx="16" cy="13" r="3.5" fill="none" stroke="white" strokeWidth="1.5" opacity="0.9" />
          <rect x="14.5" y="15.5" width="3" height="4" rx="0.5" fill="white" opacity="0.9" />
          <line x1="22" y1="11" x2="26" y2="11" stroke="#93c5fd" strokeWidth="1" opacity="0.8" />
          <circle cx="27" cy="11" r="1" fill="#93c5fd" opacity="0.8" />
          <line x1="22" y1="14" x2="25" y2="14" stroke="#93c5fd" strokeWidth="1" opacity="0.6" />
          <circle cx="26" cy="14" r="1" fill="#93c5fd" opacity="0.6" />
          <line x1="22" y1="17" x2="24" y2="17" stroke="#93c5fd" strokeWidth="1" opacity="0.4" />
          <circle cx="25" cy="17" r="1" fill="#93c5fd" opacity="0.4" />
          <defs>
            <linearGradient id="shieldGrad" x1="5" y1="2" x2="27" y2="30" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.95" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </button>
  );
}

export function ScrollToTop() {
  const { language } = useLang();
  const t = useTranslation(language);
  const [show, setShow] = useState(false);
  useEffect(() => {
    // The cookie banner is a full-width bottom overlay (z-9999) that sits on
    // top of this button — while consent is undecided the button looks
    // clickable but isn't. Hide it until the visitor has made a choice.
    const handle = () => setShow(window.scrollY > 500 && !!localStorage.getItem('cookie_consent_v2'));
    window.addEventListener('scroll', handle);
    return () => window.removeEventListener('scroll', handle);
  }, []);
  if (!show) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-8 right-8 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-full shadow-2xl transition-all z-50 hover:scale-110"
      aria-label={t('aria_scroll_top')}
    >
      <ChevronUp className="w-6 h-6 text-white" />
    </button>
  );
}

// ── Layout primitives ──────────────────────────────────────────────────────

export function Card({ className, children }) {
  return (
    <div className={cx('rounded-2xl border border-slate-800 bg-slate-900/60 shadow-sm', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ className, title, subtitle, right }) {
  return (
    <div className={cx('flex items-start justify-between gap-4 p-5', className)}>
      <div>
        <div className="text-lg font-semibold text-slate-100">{title}</div>
        {subtitle ? <div className="mt-1 text-sm text-slate-400">{subtitle}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cx('p-5 pt-0', className)}>{children}</div>;
}

export function Divider() {
  return <div className="my-4 h-px bg-slate-800" />;
}

// ── Form controls ──────────────────────────────────────────────────────────

export function Button({ className, variant = 'primary', size = 'md', disabled, onClick, type = 'button', children }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-60';
  const sizes    = { sm: 'h-9 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-11 px-5 text-sm' };
  const variants = {
    primary:   'bg-blue-600 text-white hover:bg-blue-500',
    secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700',
    ghost:     'bg-transparent text-slate-200 hover:bg-slate-800',
    danger:    'bg-rose-600 text-white hover:bg-rose-500',
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={cx(base, sizes[size], variants[variant], className)}>
      {children}
    </button>
  );
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cx('h-10 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40', className)}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }) {
  return (
    <select
      className={cx('h-10 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40', className)}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cx('w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40', className)}
      {...props}
    />
  );
}

// ── Display atoms ──────────────────────────────────────────────────────────

export function Pill({ tone = 'slate', icon: Icon, children }) {
  const tones = {
    slate:  'bg-slate-800/70 text-slate-200 border-slate-700',
    blue:   'bg-blue-600/15 text-blue-200 border-blue-600/30',
    green:  'bg-emerald-600/15 text-emerald-200 border-emerald-600/30',
    amber:  'bg-amber-500/15 text-amber-200 border-amber-500/30',
    rose:   'bg-rose-600/15 text-rose-200 border-rose-600/30',
    purple: 'bg-violet-600/15 text-violet-200 border-violet-600/30',
  };
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs', tones[tone])}>
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}

export function Modal({ open, title, subtitle, onClose, children, footer }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur" onClick={onClose} />
          <motion.div
            className="relative z-10 w-[92vw] max-w-2xl max-h-[90vh] flex flex-col"
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
          >
            <Card className="overflow-hidden flex flex-col min-h-0">
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5 flex-shrink-0">
                <div>
                  <div className="text-lg font-semibold text-slate-100">{title}</div>
                  {subtitle ? <div className="mt-1 text-sm text-slate-400">{subtitle}</div> : null}
                </div>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="h-4 w-4" /> Close
                </Button>
              </div>
              <div className="p-5 overflow-y-auto flex-1 min-h-0">{children}</div>
              {footer ? (
                <div className="border-t border-slate-800 bg-slate-950/80 backdrop-blur p-4 flex-shrink-0 sticky bottom-0">
                  {footer}
                </div>
              ) : null}
            </Card>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function SkeletonRow({ cols = 6 }) {
  return (
    <div className="grid grid-cols-12 gap-3 py-2">
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className={cx('col-span-2 h-6 animate-pulse rounded-lg bg-slate-800/70', i === 0 ? 'col-span-3' : '')} />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }) {
  const { language } = useLang();
  const t = useTranslation(language); // eslint-disable-line no-unused-vars
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-10 text-center">
      {Icon ? (
        <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
          <Icon className="h-6 w-6 text-slate-200" />
        </div>
      ) : null}
      <div className="text-base font-semibold text-slate-100">{title}</div>
      <div className="mt-1 max-w-md text-sm text-slate-400">{body}</div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function DataTable({ columns, rows, rowKey, emptyIcon, emptyTitle, emptyBody }) {
  if (!rows.length) return <EmptyState icon={emptyIcon} title={emptyTitle} body={emptyBody} />;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800">
      <div className="hidden md:grid grid-cols-12 gap-3 border-b border-slate-800 bg-slate-950/30 px-4 py-3 text-xs font-semibold text-slate-400">
        {columns.map((c) => <div key={c.key} className={c.className}>{c.header}</div>)}
      </div>
      <div className="divide-y divide-slate-800">
        {rows.map((r) => (
          <div key={rowKey(r)} className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 text-sm">
            {columns.map((c) => <div key={c.key} className={cx('min-w-0', c.className)}>{c.cell(r)}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stat widgets ───────────────────────────────────────────────────────────

export function LiveStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
      <div className="text-xs font-semibold text-slate-400">{label}</div>
      <motion.div
        className="mt-1 text-xl sm:text-2xl font-semibold"
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      >
        {Number(value || 0).toLocaleString()}
        <span className="text-sm font-normal text-slate-500">+</span>
      </motion.div>
    </div>
  );
}

export function MiniStat({ label, value, tone = 'blue' }) {
  const tones = {
    blue:  'border-blue-600/30 bg-blue-600/10',
    amber: 'border-amber-500/30 bg-amber-500/10',
    rose:  'border-rose-600/30 bg-rose-600/10',
    slate: 'border-slate-800 bg-slate-950/30',
  };
  return (
    <div className={cx('rounded-2xl border p-4', tones[tone] || tones.slate)}>
      <div className="text-xs font-semibold text-slate-400">{label}</div>
      <div className="mt-1 text-xl sm:text-2xl font-semibold">{value}</div>
    </div>
  );
}

export function ProgressRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-100">{label}</div>
        <div className="text-xs text-slate-400">{value}%</div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-800">
        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

// ── Domain badge components ────────────────────────────────────────────────

export function CategoryIcon({ category }) {
  const map = {
    engineering: Wrench, design: Sparkles, marketing: Activity, sales: Briefcase,
    finance: CreditCard, hr: Users, operations: Building2, security: Lock,
    communication: ExternalLink, other: Boxes,
  };
  const Icon = map[category] || Boxes;
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/40">
      <Icon className="h-4 w-4 text-slate-200" />
    </div>
  );
}

export function StatusBadge({ status }) {
  const m = {
    active:             { tone: 'green',  icon: BadgeCheck,    label: 'Active' },
    orphaned:           { tone: 'rose',   icon: AlertTriangle, label: 'Orphaned' },
    unused:             { tone: 'amber',  icon: CalendarClock, label: 'Unused' },
    decommissioned:     { tone: 'slate',  icon: BadgeX,        label: 'Decommissioned' },
    revoked:            { tone: 'slate',  icon: BadgeX,        label: 'Revoked' },
    pending_revocation: { tone: 'amber',  icon: RefreshCw,     label: 'Pending' },
    offboarding:        { tone: 'amber',  icon: RefreshCw,     label: 'Offboarding' },
    offboarded:         { tone: 'slate',  icon: BadgeX,        label: 'Offboarded' },
  };
  const v = m[status] || { tone: 'slate', icon: Info, label: String(status || '-') };
  return <Pill tone={v.tone} icon={v.icon}>{v.label}</Pill>;
}

export function RiskBadge({ risk }) {
  const m = {
    low:      { tone: 'green', icon: BadgeCheck,    label: 'Low' },
    medium:   { tone: 'amber', icon: AlertTriangle, label: 'Medium' },
    high:     { tone: 'rose',  icon: AlertTriangle, label: 'High' },
    critical: { tone: 'rose',  icon: AlertTriangle, label: 'Critical' },
  };
  const v = m[risk] || { tone: 'slate', icon: Info, label: String(risk || '-') };
  return <Pill tone={v.tone} icon={v.icon}>{v.label}</Pill>;
}

export function AccessLevelBadge({ level }) {
  const m = {
    admin:   { tone: 'rose',   icon: Lock,      label: 'Admin' },
    editor:  { tone: 'blue',   icon: Pencil,    label: 'Editor' },
    viewer:  { tone: 'slate',  icon: BadgeCheck, label: 'Viewer' },
    billing: { tone: 'purple', icon: CreditCard, label: 'Billing' },
  };
  const v = m[level] || { tone: 'slate', icon: Info, label: String(level || '-') };
  return <Pill tone={v.tone} icon={v.icon}>{v.label}</Pill>;
}

export function RiskFlagBadge({ flag }) {
  const m = {
    none:             { tone: 'green', icon: BadgeCheck,    label: 'OK' },
    orphaned:         { tone: 'rose',  icon: AlertTriangle, label: 'Orphaned tool' },
    unused:           { tone: 'amber', icon: CalendarClock, label: 'Unused tool' },
    former_employee:  { tone: 'rose',  icon: UserMinus,     label: 'Former employee' },
    excessive_admin:  { tone: 'amber', icon: Lock,          label: 'Admin' },
    needs_review:     { tone: 'blue',  icon: RefreshCw,     label: 'Needs review' },
  };
  const v = m[flag] || { tone: 'slate', icon: Info, label: String(flag || '-') };
  return <Pill tone={v.tone} icon={v.icon}>{v.label}</Pill>;
}
