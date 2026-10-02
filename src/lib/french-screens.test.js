import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatMoney, formatInSymbol } from './currency';
import { AUDIT_CATEGORY_LABELS, auditCategoryLabel } from './auditCategories';

// ── French screens read as French ──────────────────────────────────────────
//
// The review of 2026-10-02 found English typed into the JSX of screens a
// French customer uses every day (Finance, Access, Security, API keys, Slack,
// the assistant), amounts written "€5,364" in French, and the free audit's
// categories in English.

// eslint-disable-next-line security/detect-non-literal-fs-filename -- repo paths from literals below
const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
const nbsp = (s) => s.replace(/[\u00a0\u202f]/g, ' ');

describe('money is written the way the language writes it', () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem('sg_general', JSON.stringify({ currency: 'EUR' })); });

  it('French puts the symbol after, English before', () => {
    expect(nbsp(formatMoney(5364, 'fr'))).toBe('5 364 €');
    expect(formatMoney(5364, 'en')).toBe('€5,364');
    expect(nbsp(formatMoney(12.5, 'fr', { decimals: 2 }))).toBe('12,50 €');
  });

  it('the audit keeps the statement’s own currency', () => {
    expect(formatInSymbol(1200, '£', 'en')).toBe('£1,200');
    expect(nbsp(formatInSymbol(1200, '$', 'fr'))).toBe('1 200 $');
    expect(nbsp(formatInSymbol(1200, 'CHF ', 'fr'))).toBe('1 200 CHF');
  });

  it('no finance screen glues the symbol to the front of a number any more', () => {
    for (const f of ['src/pages/finance/OverviewTab.jsx', 'src/pages/finance/CostTab.jsx', 'src/pages/finance/LicensesTab.jsx',
      'src/pages/finance/ExecutiveDashboard.jsx', 'src/pages/finance/AnalyticsTab.jsx', 'src/pages/finance/BudgetTab.jsx',
      'src/pages/ToolsPage.jsx', 'src/components/InvoiceCheckPanel.jsx', 'src/lib/dataUtils.js']) {
      expect(read(f), f).not.toMatch(/getCurrency\(language\)\s*\+|\{getCurrency\(language\)\}\{/);
    }
  });
});

describe('the free audit’s categories', () => {
  it('every category the engine can give has a French label', () => {
    const engine = read('src/lib/saasAudit.js');
    const cats = new Set([...engine.matchAll(/category: '([^']+)'/g)].map((m) => m[1]));
    for (const m of engine.matchAll(/'(Unclassified|Software \([^)]+\))'/g)) cats.add(m[1]);
    expect(cats.size).toBeGreaterThan(20);
    for (const c of cats) expect(AUDIT_CATEGORY_LABELS.fr[c], c).toBeTruthy();
    expect(auditCategoryLabel('Project management', 'fr')).toBe('Gestion de projet');
    expect(auditCategoryLabel('Project management', 'en')).toBe('Project management');
  });

  it('the page shows the label, the CSV keeps the English value', () => {
    expect(read('src/pages/SaasAuditPage.jsx')).toMatch(/\{auditCategoryLabel\(s\.category, language\)\}/);
    expect(read('src/lib/saasAudit.js')).not.toMatch(/auditCategoryLabel/);
  });
});

describe('English that was typed into French screens stays out', () => {
  const gone = {
    'src/pages/finance/ExecutiveDashboard.jsx': ['Export Report', "trend: '+12%'", '>Spending <', "'Other'"],
    'src/pages/finance/OverviewTab.jsx': ['this month</div>', 'vs 6 months ago', 'tools have idle seats</div>', "'No data'", 'Monthly spend exceeds'],
    'src/pages/finance/CostTab.jsx': ['Reclaim Licenses', 'Sort: Cost', '‹ Prev', 'tools well-utilized'],
    'src/pages/finance/LicensesTab.jsx': ['Sort: Cost', "'app' : 'apps'", 'Hi team'],
    'src/pages/AccessPage.jsx': ["'Unknown'", 'Change to Viewer', 'Showing 25 of'],
    'src/pages/SecurityCompliancePage.jsx': ["'Needs Work'", 'active alerts across', "'Not supported'"],
    'src/pages/settings/ApiKeysTab.jsx': ['This key is shown only once', 'Rate limit: 120'],
    'src/components/SlackNotifications.jsx': ["'Test Connection'", "'Save'"],
    'src/components/FloatingChatbot.jsx': ['> Online', "'Sorry, I could not respond"],
    'src/lib/auditReport.js': ['<h2>Recommendations</h2>', 'Schedule quarterly access reviews'],
    'src/pages/TrialPage.jsx': ['placeholder="Jane Smith"', '>or</span>', '>Terms</Link>'],
  };
  for (const [file, strings] of Object.entries(gone)) {
    it(file, () => {
      const src = read(file);
      for (const s of strings) expect(src, s).not.toContain(s);
    });
  }

  it('the API rate limit the tab quotes is the one the endpoint applies', () => {
    const fn = read('functions/index.js');
    const server = Number(/const API_RATE_LIMIT = \{ maxCalls: (\d+)/.exec(fn)[1]);
    expect(read('src/pages/settings/ApiKeysTab.jsx')).toContain(`export const API_CALLS_PER_HOUR = ${server};`);
  });
});
