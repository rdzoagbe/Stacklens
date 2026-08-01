// ── Utility functions ──────────────────────────────────────────────
// Pure functions with no React dependencies. Safe to import anywhere.

import { format, parseISO, isValid } from 'date-fns';

let _uidCounter = 0;
export function uid(prefix = "id") {
  return prefix + "_" + Date.now().toString(36) + "_" + (++_uidCounter).toString(36) + "_" + Math.random().toString(36).slice(2, 6);
}

export function cx(...args) {
  return args.filter(Boolean).join(" ");
}

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

export function safeParseISO(str) {
  if (!str) return null;
  try {
    const d = parseISO(str);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

export function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// NOTE: CSV helpers deliberately live in lib/dataUtils.js only.
// A second toCsv used to sit here with the opposite signature —
// toCsv(headers, rows) vs dataUtils' toCsv(rows, columns) — and AuditPage
// imported dataUtils' version while calling it with this one's argument
// order. The exports silently produced a file with no header row. Removed so
// there is exactly one CSV writer.

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateRequired(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}
