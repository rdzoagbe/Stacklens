// ── UI Components ─────────────────────────────────────────────────
// Shared UI primitives used across all pages.
// These are extracted from App.jsx for reuse in the modular architecture.

import React from 'react';
import { X } from 'lucide-react';

const cx = (...xs) => xs.filter(Boolean).join(" ");

export function Card({ className, children }) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-slate-800 bg-slate-900/60 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, title, subtitle, right }) {
  return (
    <div className={cx("flex items-start justify-between gap-4 p-5", className)}>
      <div>
        <div className="text-lg font-semibold text-slate-100">{title}</div>
        {subtitle ? <div className="mt-1 text-sm text-slate-400">{subtitle}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cx("p-5 pt-0", className)}>{children}</div>;
}

export function Divider() {
  return <div className="my-4 h-px bg-slate-800" />;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  disabled,
  onClick,
  type = "button",
  children,
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-60";
  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-sm",
  };
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-500",
    secondary:
      "bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700",
    ghost: "bg-transparent text-slate-200 hover:bg-slate-800",
    danger: "bg-rose-600 text-white hover:bg-rose-500",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cx(base, sizes[size], variants[variant], className)}
    >
      {children}
    </button>
  );
}

export function Pill({ tone = "slate", icon: Icon, children }) {
  const tones = {
    slate: "bg-slate-800/70 text-slate-200 border-slate-700",
    blue: "bg-blue-600/15 text-blue-200 border-blue-600/30",
    green: "bg-emerald-600/15 text-emerald-200 border-emerald-600/30",
    amber: "bg-amber-500/15 text-amber-200 border-amber-500/30",
    rose: "bg-rose-600/15 text-rose-200 border-rose-600/30",
    purple: "bg-violet-600/15 text-violet-200 border-violet-600/30",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        tones[tone]
      )}
    >
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur"
            onClick={onClose}
          />
          <motion.div
            className="relative z-10 w-[92vw] max-w-2xl"
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
          >
            <Card className="overflow-hidden">
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
                <div>
                  <div className="text-lg font-semibold text-slate-100">{title}</div>
                  {subtitle ? (
                    <div className="mt-1 text-sm text-slate-400">{subtitle}</div>
                  ) : null}
                </div>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="h-4 w-4" />
                  Close
                </Button>
              </div>
              <div className="p-5">{children}</div>
              {footer ? (
                <div className="border-t border-slate-800 bg-slate-950/30 p-4">
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
        <div
          key={i}
          className={cx(
            "col-span-2 h-6 animate-pulse rounded-lg bg-slate-800/70",
            i === 0 ? "col-span-3" : ""
          )}
        />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }) {
  const { language } = useLang();
  const t = useTranslation(language);
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

