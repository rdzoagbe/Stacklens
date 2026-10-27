import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { csvText, csvField } from './csvSafe';
import { toCsv } from './dataUtils';
import { assetsToCsv } from './assets';
import { reviewCsv } from './accessReviews';
import { buildBudgetCsv } from './budget-report';

// A tool, person or bank label is opened later in a spreadsheet: none of them
// may run there as a formula.
const HOSTILE = ['=HYPERLINK("https://evil.example","x")', '+cmd|/c calc', '-2+3', '@SUM(A1)', '\t=1+1', '\r=1+1'];

describe('csvText', () => {
  it.each(HOSTILE)('neutralises %j', (v) => {
    expect(csvText(v).startsWith("'")).toBe(true);
  });

  it('leaves plain text and numbers alone', () => {
    expect(csvText('Slack')).toBe('Slack');
    expect(csvText(-12.5)).toBe('-12.5');
    expect(csvText('+33 1 23')).toBe("'+33 1 23");
    expect(csvText(null)).toBe('');
    expect(csvText(0)).toBe('0');
  });

  it('quotes a field holding the separator, a quote or a line break', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('a;b', ';')).toBe('"a;b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('=1,2')).toBe(`"'=1,2"`);
  });
});

describe('every CSV builder uses the guard', () => {
  const name = '=HYPERLINK("https://evil.example","x")';

  it('toCsv (settings exports, licences, audit page)', () => {
    expect(toCsv([{ name }], ['name'])).not.toMatch(/\n"?=HYPERLINK/);
  });

  it('assetsToCsv', () => {
    expect(assetsToCsv([{ model: name, kind: 'laptop', status: 'in_stock' }])).not.toMatch(/(^|[,\n])"?=HYPERLINK/);
  });

  it('reviewCsv', () => {
    expect(reviewCsv({ rows: [{ tool_name: name }] })).not.toMatch(/(^|[,\n])"?=HYPERLINK/);
  });

  it('buildBudgetCsv', () => {
    const labels = { department: 'd', annual: 'a', monthly: 'm', spent: 's', projected: 'p', status: 'st', total: 't', unallocated: 'u' };
    const csv = buildBudgetCsv({
      rows: [{ dept: name, budget: 0, monthly: 0, spentYtd: 0, projected: 0 }],
      totals: { budget: 0, monthly: 0, spentYtd: 0, projected: 0 }, unallocated: 0, year: 2026, labels, sep: ',',
    });
    expect(csv).not.toMatch(/(^|[,;\n])"?=HYPERLINK/);
  });

  it('no file builds CSV cells by hand without the guard', () => {
    // The builders that write their own cells import the guard.
    for (const f of ['portfolio.js', 'saasAudit.js', 'accessReviews.js', 'budget-report.js', 'assets.js', 'dataUtils.js']) {
      expect(readFileSync(resolve(process.cwd(), 'src/lib', f), 'utf8'), f).toMatch(/from '\.\/csvSafe'/);
    }
    for (const f of ['src/pages/finance/RenewalsTab.jsx', 'src/pages/finance/AnalyticsTab.jsx']) {
      expect(readFileSync(resolve(process.cwd(), f), 'utf8'), f).toMatch(/csvField\(/);
    }
  });
});
