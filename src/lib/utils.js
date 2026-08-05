// ── Utility functions ──────────────────────────────────────────────
// Pure functions with no React dependencies. Safe to import anywhere.
//
// This file used to also export uid, todayISO, safeParseISO, downloadText,
// validateEmail, validateRequired and toCsv — every one a second copy of a
// function that already lived in lib/db.js or lib/dataUtils.js, and every one
// dead: `cx` is the only symbol anything ever imported from here.
//
// They were not harmless. The copies had drifted:
//
//   toCsv           opposite argument order to dataUtils'. AuditPage imported
//                   one and called it like the other, shipping a CSV export
//                   with no header row and rows of ",,,".
//   todayISO        local time here, UTC in db.js — different dates after
//                   ~22:00 for a European user.
//   uid             a counter that resets on reload, so IDs could repeat
//                   across sessions.
//   validateRequired  silent boolean here, toast side-effect in dataUtils.
//   downloadText    different default MIME type.
//
// Dead duplicates are worse than no code: they are a trap for whoever
// autocompletes the wrong import path. src/lib/no-duplicate-exports.test.js
// now fails the build if a name is defined in two modules under src/lib.

export function cx(...args) {
  return args.filter(Boolean).join(" ");
}
