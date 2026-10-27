// ── An Excel file read as CSV, in the browser ──────────────────────────────
//
// The import wizard used to load SheetJS 0.18.5 from cdnjs at the moment a
// spreadsheet was dropped. That version has two published advisories for
// reading untrusted files (prototype pollution, CVE-2023-30533, fixed in
// 0.19.3; a ReDoS, CVE-2024-22363, fixed in 0.20.2), later versions are no
// longer on npm or cdnjs, and the script came from a third-party host the CSP
// had to allow. exceljs is already a dependency (the budget export) and is
// bundled, so nothing is fetched from elsewhere. It reads .xlsx only: an old
// binary .xls is refused with a sentence asking for .xlsx or CSV.

/** The CSV text of the first worksheet of an .xlsx file. */
export async function xlsxToCsv(arrayBuffer) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return '';
  const lines = [];
  const width = ws.columnCount;
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells = [];
    for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c).value));
    lines.push(cells.map(quote).join(','));
  });
  return lines.join('\n');
}

/** What a cell shows, whatever exceljs holds for it. */
export function cellText(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('result' in v) return cellText(v.result);          // a formula: its last value
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('');
    if ('text' in v) return String(v.text);                // a hyperlink
    if ('error' in v) return '';
    return '';
  }
  return String(v);
}

const quote = (s) => (/[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);
