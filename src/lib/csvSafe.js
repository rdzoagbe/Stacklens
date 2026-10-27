// ── CSV cells a spreadsheet will not run ───────────────────────────────────
//
// Every CSV the app writes is opened in Excel, LibreOffice or Google Sheets,
// and a cell starting with = + - @ (or a tab or carriage return before one) is
// read there as a formula. Tool names, people, bank labels and audit details
// come from imports, directories and teammates, so a name like
// =HYPERLINK("https://…") would run on the reader's machine. The usual guard
// (OWASP "CSV injection") is a leading apostrophe: the spreadsheet shows the
// text and runs nothing. Only text is guarded: a value the code holds as a
// number (an amount, a count) is written as it is.
//
// No imports: the free audit's modules use it and must stay self-contained.

const FORMULA_START = /^[=+\-@\t\r]/;

/** The text of a cell, with a leading ' when a spreadsheet would run it. */
export function csvText(v) {
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  return FORMULA_START.test(s) ? `'${s}` : s;
}

/** A complete cell: guarded, then quoted when it holds the separator, a quote or a line break. */
export function csvField(v, sep = ',') {
  const s = csvText(v);
  return /["\n\r]/.test(s) || s.includes(sep) ? `"${s.replaceAll('"', '""')}"` : s;
}
