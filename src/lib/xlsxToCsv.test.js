import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { xlsxToCsv, cellText } from './xlsxToCsv';

describe('reading an Excel file in the import wizard', () => {
  it('turns the first sheet into CSV the import already reads', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Outils');
    ws.addRow(['name', 'cost_per_month', 'renewal_date', 'notes']);
    ws.addRow(['Slack', 120.5, new Date('2026-12-01T00:00:00Z'), 'team, "core"']);
    ws.addRow(['Notion', { formula: 'B2*2', result: 241 }, null, { richText: [{ text: 'a' }, { text: 'b' }] }]);
    wb.addWorksheet('Other').addRow(['ignored']);
    const buf = await wb.xlsx.writeBuffer();
    const csv = await xlsxToCsv(buf);
    expect(csv.split('\n')).toEqual([
      'name,cost_per_month,renewal_date,notes',
      'Slack,120.5,2026-12-01,"team, ""core"""',
      'Notion,241,,ab',
    ]);
  });

  it('shows a hyperlink by its text and an error as empty', () => {
    expect(cellText({ text: 'Site', hyperlink: 'https://x.example' })).toBe('Site');
    expect(cellText({ error: '#REF!' })).toBe('');
  });

  it('loads nothing from another host', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/ImportWizard.jsx'), 'utf8');
    expect(src).not.toMatch(/cdnjs|xlsx\.full|createElement\('script'\)/);
    const csp = readFileSync(resolve(process.cwd(), 'firebase.json'), 'utf8');
    expect(csp).not.toMatch(/cdnjs\.cloudflare\.com/);
  });
});
