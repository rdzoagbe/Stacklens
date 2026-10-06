import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatMoney, formatInSymbol } from './currency';
import { AUDIT_CATEGORY_LABELS, auditCategoryLabel } from './auditCategories';
import { translations } from '../translations';

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
    'src/pages/TrialPage.jsx': ['placeholder="Jane Smith"', '>or</span>', '>Terms</Link>', "t('contact_sales')"],
    // the walkthrough of 2026-10-06
    'src/pages/DashboardPage.jsx': ['getCurrency(language)'],
    'src/components/AppShell.jsx': ['"Logout"', '"Exit Demo"'],
    'src/pages/settings/BillingTab.jsx': ["'Upgrade'", "`Save ${", "label: 'Tools'", '{used} / {max}</span>'],
    'src/pages/OffboardingPage.jsx': ['`Queue (', '`History ('],
    'src/pages/finance/AnalyticsTab.jsx': ['total tracked', '>per month<', '>/mo<', '>active<', '>inactive<', "'tool' : 'tools'", 'categories by monthly cost'],
    'src/pages/finance/RenewalsTab.jsx': ['/yr</div>', '{r.renewalDate}'],
    'src/pages/ContractComparisonPage.jsx': ["label: 'Contract A'", "' chars'", '"Paste " + label'],
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

describe('the rest of the walkthrough of 2026-10-06', () => {
  it('workspace categories have a label in every language', () => {
    const ui = read('src/components/ui.jsx');
    const keys = [...ui.matchAll(/'(cat_[a-z]+)'/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(10);
    for (const lang of ['en', 'fr', 'de', 'es', 'pt']) for (const k of keys) expect(translations[lang][k], `${lang}.${k}`).toBeTruthy();
    // …and the pages that show a category go through the hook.
    for (const f of ['src/pages/ToolsPage.jsx', 'src/pages/finance/CostTab.jsx', 'src/pages/finance/LicensesTab.jsx', 'src/pages/finance/OverviewTab.jsx',
      'src/pages/finance/AnalyticsTab.jsx', 'src/pages/finance/RenewalsTab.jsx', 'src/pages/finance/ExecutiveDashboard.jsx']) {
      expect(read(f), f).toMatch(/categoryLabel\(/);
      // shown as text (a `category={…}` prop handed to an icon is fine)
      expect(read(f), f).not.toMatch(/>\{(tool|app|r|opp)\.category( \|\| '—')?\}|\{cat\.name\}<\/span>/);
    }
  });

  it('one renewal-savings figure, quoted from one constant', () => {
    for (const lang of ['en', 'fr']) {
      expect(translations[lang].ren_neg_sub).toContain('{pct}');
      expect(translations[lang].fin_save_on_renewal).toContain('{pct}');
      expect(translations[lang].ren_neg_sub).not.toMatch(/\d/);
    }
    expect(read('src/pages/finance/OverviewTab.jsx')).toMatch(/RENEWAL_SAVINGS_PCT/);
    expect(read('src/pages/finance/RenewalsTab.jsx')).toMatch(/RENEWAL_SAVINGS_PCT/);
  });

  it('the plan page sells every plan the same way, as the About page promises', () => {
    expect(translations.fr.about_principle1_body).toMatch(/sans palier/);
    expect(read('src/pages/TrialPage.jsx')).toMatch(/cta: c\.id === 'free' \? t\('start_free'\) : t\('start_trial'\)/);
  });

  it('SSO is not sold as an Enterprise feature, and the client-workspace page is named for what it is', () => {
    expect(translations.fr.set_sso_desc).toMatch(/aucun plan/);
    expect(translations.en.set_sso_desc).toMatch(/not available on any plan/);
    expect(read('src/pages/settings/SecurityTab.jsx')).not.toMatch(/set_view_enterprise/);
    expect(translations.fr.nav_clients).toBe('Espaces clients');
    expect(translations.fr.dash_former_access_title).toMatch(/^accès/);
  });
});
