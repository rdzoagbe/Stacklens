// ── Board-ready budget report exports ────────────────────────────────────
// PDF: a print-styled standalone HTML document opened in a new window with
// the browser's print dialog (→ "Save as PDF") — no PDF library, no bundle
// weight. Excel: CSV with a UTF-8 BOM so Excel detects the encoding, and a
// semicolon separator for French locales (Excel FR splits on ; by default).

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function buildBudgetCsv({ rows, totals, unallocated, year, labels, sep = ';' }) {
  const q = (v) => {
    const s = String(v ?? '');
    return (s.includes(sep) || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [
    [labels.department, labels.annual, labels.monthly, labels.spent, labels.projected, labels.status].map(q).join(sep),
    ...rows.map(r => [
      r.dept, Math.round(r.budget) || '', Math.round(r.monthly), Math.round(r.spentYtd),
      Math.round(r.projected), r.budget > 0 ? Math.round((r.spentYtd / r.budget) * 100) + '%' : '',
    ].map(q).join(sep)),
    [labels.total, Math.round(totals.budget) || '', Math.round(totals.monthly),
      Math.round(totals.spentYtd), Math.round(totals.projected), ''].map(q).join(sep),
  ];
  if (unallocated > 0) lines.push([labels.unallocated, '', Math.round(unallocated), '', '', ''].map(q).join(sep));
  // BOM: Excel misreads accented characters without it.
  return '\uFEFF' + `${labels.title} ${year}` + '\n' + lines.join('\n');
}

export function buildBudgetReportHtml({ rows, totals, unallocated, year, cards, labels, cur, company, generatedAt }) {
  const statusColor = (r) => r.status === 'over' ? '#dc2626' : r.status === 'risk' ? '#d97706' : r.status === 'ok' ? '#059669' : '#64748b';
  const statusText = (r) => r.status === 'over' ? labels.over : r.status === 'risk' ? labels.atRisk : r.status === 'ok' ? labels.onTrack : '—';
  const tr = (r) => `<tr>
    <td style="text-transform:capitalize">${esc(r.dept)}</td>
    <td>${r.budget > 0 ? cur(r.budget) : '—'}</td>
    <td>${cur(r.monthly)}</td>
    <td>${cur(r.spentYtd)}${r.budget > 0 ? ` <span style="color:#64748b">(${Math.round((r.spentYtd / r.budget) * 100)}%)</span>` : ''}</td>
    <td>${cur(r.projected)}</td>
    <td style="color:${statusColor(r)};font-weight:600">${statusText(r)}</td>
  </tr>`;
  const card = (label, value, sub) => `<div style="flex:1;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px">${esc(label)}</div>
    <div style="font-size:22px;font-weight:800;color:#0f172a">${esc(value)}</div>
    ${sub ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${esc(sub)}</div>` : ''}
  </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(labels.title)} ${year}</title>
  <style>
    body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #0f172a; margin: 40px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #0f172a; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    tr.total td { font-weight: 800; border-top: 2px solid #0f172a; border-bottom: none; }
    @media print { body { margin: 16px; } .noprint { display: none; } }
  </style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:baseline">
    <div>
      <div style="font-size:24px;font-weight:900">Stacklens</div>
      <div style="font-size:15px;color:#334155;margin-top:2px">${esc(labels.title)} — ${year}</div>
    </div>
    <div style="text-align:right;font-size:12px;color:#64748b">
      ${company ? esc(company) + '<br>' : ''}${esc(labels.generated)} ${esc(generatedAt)}
    </div>
  </div>
  <div style="display:flex;gap:12px;margin-top:24px">
    ${card(labels.runRate, cards.runRate, cards.runRateSub)}
    ${card(labels.actuals, cards.actuals, cards.actualsSub)}
    ${card(labels.nextYear, cards.nextYear, cards.nextYearSub)}
  </div>
  <table>
    <thead><tr><th>${esc(labels.department)}</th><th>${esc(labels.annual)}</th><th>${esc(labels.monthly)}</th><th>${esc(labels.spent)}</th><th>${esc(labels.projected)}</th><th>${esc(labels.status)}</th></tr></thead>
    <tbody>
      ${rows.map(tr).join('')}
      <tr class="total"><td>${esc(labels.total)}</td><td>${totals.budget > 0 ? cur(totals.budget) : '—'}</td><td>${cur(totals.monthly)}</td><td>${cur(totals.spentYtd)}</td><td>${cur(totals.projected)}</td><td></td></tr>
    </tbody>
  </table>
  ${unallocated > 0 ? `<p style="font-size:12px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;margin-top:14px"><strong>${esc(labels.unallocated)}:</strong> ${cur(unallocated)}/mo</p>` : ''}
  <p style="font-size:11px;color:#94a3b8;margin-top:20px">${esc(labels.method)}</p>
  </body></html>`;
}

// Real .xlsx workbook (bold headers, column widths, number formats, colored
// status) — exceljs is dynamically imported so its weight only loads on click.
export async function buildBudgetXlsxBlob({ rows, totals, unallocated, year, labels }) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(String(year));
  ws.mergeCells(1, 1, 1, 6);
  const title = ws.getCell(1, 1);
  title.value = `${labels.title} — ${year}`;
  title.font = { bold: true, size: 14 };
  const header = ws.addRow([labels.department, labels.annual, labels.monthly, labels.spent, labels.projected, labels.status]);
  header.font = { bold: true };
  header.eachCell(c => {
    c.border = { bottom: { style: 'medium' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
  });
  const cap = (s) => String(s).replace(/(^|\s)\w/g, ch => ch.toUpperCase());
  rows.forEach(r => {
    const row = ws.addRow([
      cap(r.dept),
      r.budget > 0 ? Math.round(r.budget) : null,
      Math.round(r.monthly), Math.round(r.spentYtd), Math.round(r.projected),
      r.budget > 0 ? r.spentYtd / r.budget : null,
    ]);
    if (r.budget > 0) {
      const st = row.getCell(6);
      st.numFmt = '0%';
      st.font = { bold: true, color: { argb: r.status === 'over' ? 'FFDC2626' : r.status === 'risk' ? 'FFD97706' : 'FF059669' } };
    }
  });
  const totalRow = ws.addRow([labels.total, totals.budget > 0 ? Math.round(totals.budget) : null,
    Math.round(totals.monthly), Math.round(totals.spentYtd), Math.round(totals.projected), null]);
  totalRow.font = { bold: true };
  totalRow.eachCell(c => { c.border = { top: { style: 'medium' } }; });
  if (unallocated > 0) {
    ws.addRow([labels.unallocated, null, Math.round(unallocated), null, null, null]).font = { italic: true };
  }
  ws.getColumn(1).width = 26;
  [2, 3, 4, 5].forEach(i => { const col = ws.getColumn(i); col.width = 16; col.numFmt = '#,##0'; });
  ws.getColumn(6).width = 18;
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadBlob(filename, blob) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Print via a hidden same-page iframe: nothing for popup blockers to block,
// and the print dialog opens directly over the app.
export function openPrintReport(html) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  frame.onload = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } finally {
      // Chrome blocks here until the dialog closes; Firefox returns at once
      // and needs the frame alive while the dialog is open — remove late.
      setTimeout(() => frame.remove(), 60_000);
    }
  };
  frame.srcdoc = html;
}
