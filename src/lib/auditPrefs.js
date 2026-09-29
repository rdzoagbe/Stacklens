// ── The one thing the free audit remembers: the accountant's firm name ─────
//
// The audit page keeps nothing — no file, no figure, no client name
// (accountant-channel.test.js). An accountant printing a report for each
// client retyped their own firm's name every time, so this keeps that one
// field, on this device, and only when they tick "remember". It is their own
// business name, not their client's data, and it never leaves the browser.
// Unticking deletes it.
//
// accountant-channel.test.js checks this module stores nothing else.

const KEY = 'stacklens_audit_firm';
const MAX = 120;

export function loadFirmName() {
  try {
    return String(localStorage.getItem(KEY) || '').slice(0, MAX);
  } catch {
    return '';                      // storage blocked: the field just starts empty
  }
}

/** Remember `name` on this device, or forget it when `name` is empty. */
export function saveFirmName(name) {
  const value = String(name || '').trim().slice(0, MAX);
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch { /* storage blocked: nothing is remembered, nothing breaks */ }
}

export const forgetFirmName = () => saveFirmName('');
