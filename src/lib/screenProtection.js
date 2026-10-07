// ── Screen protection: a deterrent, not a lock ─────────────────────────────
//
// A web page cannot stop a screenshot or a recording: the browser and the
// operating system do those, and a second phone filming the screen is beyond
// any software. A bank app can block them because it is a native app and the
// phone enforces it. What a page can do is raise the cost and make a leak
// traceable, and that is all this does, and all it says it does:
//
//   - a faint watermark of the viewer's email and the time over every screen,
//     so an image that leaks says who it came from (works against a camera);
//   - the screen blurs while the window is not in front, which is when most
//     capture tools take over;
//   - copy, cut, right-click, drag and print are refused outside text fields
//     (the client report, which is meant to be printed, is left alone);
//   - the Print Screen key and the usual capture shortcuts blur the screen
//     for a moment and empty the clipboard.
//
// It is off until an owner or admin turns it on (db.user.screen_protection),
// and it never applies to the founder or in the demo. Nothing here is sent
// anywhere: the watermark is drawn in the browser from the signed-in email.

import { isFounderUser } from './plan';

export const PROTECTION_FIELD = 'screen_protection';
export const PRINT_NOTICE_FALLBACK = 'Printing is turned off for this workspace.';
export const BLUR_AFTER_CAPTURE_MS = 1500;

/**
 * Does protection apply to this viewer right now?
 *   workspace: the loaded db.user (the owner's setting, also in a shared view)
 *   viewerEmail: the signed-in person's own email (never the owner's)
 *   isFounderFlag: the account's own is_founder, only meaningful outside a shared view
 */
export function protectionActive({ workspaceUser, viewerEmail, isFounderFlag = false, isDemo = false } = {}) {
  if (isDemo || workspaceUser?.is_demo) return false;
  if (workspaceUser?.[PROTECTION_FIELD] !== true) return false;
  if (isFounderFlag || isFounderUser({ email: viewerEmail })) return false;
  return true;
}

/** "claire@acme.fr · 2026-10-07 15:42" — what the watermark repeats. */
export function watermarkText(email, now = new Date()) {
  const e = String(email || '').trim() || 'workspace member';
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `${e} · ${stamp}`;
}

/** Print Screen, the macOS Shift+Cmd+3/4/5 family, and Windows' Win+Shift+S. */
export function isCaptureShortcut(e) {
  if (!e) return false;
  if (e.key === 'PrintScreen') return true;
  if (e.metaKey && e.shiftKey && ['3', '4', '5', '#', '$', '%'].includes(e.key)) return true;
  if (e.metaKey && e.shiftKey && String(e.key).toLowerCase() === 's') return true;
  return false;
}

/** Text fields keep working: nobody can fill in a form without copy and paste. */
export function isEditableTarget(el) {
  if (!el || typeof el.closest !== 'function') return false;
  return !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}
