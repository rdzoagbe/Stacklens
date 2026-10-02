import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PAGE_SEO } from './seo';

// ── /direction-financiere: every line it claims is a screen that exists ────
//
// The page takes lines from real finance-lead job descriptions and, under
// each, names what Stacklens does and where. That is only worth printing if
// it is true, so each row is tied here to the code that makes it so. When a
// test below fails, change the row, not the test.

// eslint-disable-next-line security/detect-non-literal-fs-filename -- repo paths from literals below
const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
const page = () => read('src/pages/FinanceLeadsPage.jsx');
const tr = () => read('src/translations.js');
const block = (lang) => tr().slice(tr().indexOf(`  ${lang}: {`));
// A plain search rather than a RegExp built from the key.
const str = (lang, key) => {
  const b = block(lang);
  const at = b.indexOf(`    ${key}: "`);
  if (at < 0) return undefined;
  const start = at + key.length + 7;
  return b.slice(start, b.indexOf('",\n', start));
};

describe('the page is wired in', () => {
  it('has a public, lazily loaded route', () => {
    const app = read('src/App.jsx');
    expect(app).toMatch(/import\('\.\/pages\/FinanceLeadsPage'\)/);
    const at = app.indexOf('path="/direction-financiere"');
    expect(at).toBeGreaterThan(-1);
    expect(app.slice(at, app.indexOf('/>', at) + 2)).not.toMatch(/RequireAuth/);
  });

  it('has SEO metadata and a sitemap entry, and crawlers may read it', () => {
    expect(PAGE_SEO['/direction-financiere']?.title).toMatch(/Stacklens/);
    expect(read('public/sitemap.xml')).toContain('<loc>https://stacklens.fr/direction-financiere</loc>');
    expect(read('public/robots.txt')).not.toMatch(/^Disallow: \/direction-financiere/m);
  });

  it('is linked from the homepage footer, and links to the audit and the accountants page', () => {
    expect(read('src/pages/TrialPage.jsx')).toMatch(/to="\/direction-financiere"/);
    expect(page()).toMatch(/to="\/audit-saas"/);
    expect(page()).toMatch(/to="\/experts-comptables"/);
    expect(page()).toMatch(/to="\/\?signup=true"/);
  });

  it('renders no string that is missing in English or French', () => {
    const keys = [...new Set([...page().matchAll(/'((?:fin|lp)_[a-z0-9_]+)'/g)].map((m) => m[1]))];
    expect(keys.length).toBeGreaterThan(40);
    for (const k of keys) for (const lang of ['en', 'fr']) expect(str(lang, k), `${k} in ${lang}`).toBeTruthy();
  });
});

describe('each duty row names something the product does', () => {
  const budget = () => read('src/pages/finance/BudgetTab.jsx');

  it('budgets by department, spend to date, year-end projection, next-year suggestion', () => {
    expect(budget()).toMatch(/spentToDate/);
    expect(budget()).toMatch(/projected/);
    expect(budget()).toMatch(/suggestedNextYear/);
    expect(read('src/pages/FinancePage.jsx')).toMatch(/'budget'/);
  });

  it('the monthly report goes by email on the 1st, to the account and colleagues it allows', () => {
    const fn = read('functions/index.js');
    expect(fn).toMatch(/exports\.monthlyReport = onSchedule\(\{\s*schedule: '0 8 1 \* \*'/);
    const report = read('functions/monthly-report.js');
    expect(report).toMatch(/budgets, invoices, renewals: renewals\.slice\(0, \d+\), actions: actions\.slice\(0, 3\)/);
    expect(read('src/pages/settings/NotificationsTab.jsx')).toMatch(/<MonthlyReportSettings /);
  });

  it('the budget report exports to PDF, Excel and CSV', () => {
    expect(budget()).toMatch(/buildBudgetPdfBlob\(/);
    expect(budget()).toMatch(/buildBudgetXlsxBlob\(/);
    expect(budget()).toMatch(/buildBudgetCsv\(/);
  });

  it('supplier invoices are checked, in the Budget tab, against the agreed price and the previous invoice', () => {
    expect(budget()).toMatch(/<InvoiceCheckPanel \/>/);
    const lib = read('src/lib/invoiceCheck.js');
    for (const kind of ['duplicate', 'after_cancel', 'above_agreed', 'price_rise']) expect(lib).toContain(`kind: '${kind}'`);
    expect(lib).toMatch(/overAnnual/);
  });

  it('the page says which plan opens these screens, from the gate itself', () => {
    const page = read('src/pages/FinanceLeadsPage.jsx');
    expect(page).toMatch(/const plan = cheapestPlanFor\('finance'\);/);
    expect(page).toMatch(/data-testid="fin-plan-note"/);
    for (const lang of ['en', 'fr']) {
      const block = read('src/translations.js').slice(read('src/translations.js').indexOf(`  ${lang}: {`));
      const note = /fin_plan_note: "([^"]*)"/.exec(block)[1];
      expect(note, lang).toMatch(/\{plan\}.*\{price\}.*\{days\}/);
      expect(note.replace(/\{\w+\}/g, ''), `${lang}: a typed number`).not.toMatch(/\d/);
    }
  });

  it('renewals have their own tab', () => {
    expect(read('src/pages/FinancePage.jsx')).toMatch(/'renewals'/);
  });

  it('a tool carries an owner, a cost, an agreed price and a renewal date, and an unowned one is flagged', () => {
    const tools = read('src/pages/ToolsPage.jsx');
    for (const f of ['owner_email', 'cost_per_month', 'agreed_monthly', 'renewal_date']) expect(tools + read('src/lib/db.js')).toContain(f);
    expect(read('src/pages/DashboardPage.jsx')).toMatch(/kind: 'no_owner'/);
  });

  it('the dashboard ranks invoices to check, budget overruns, former employees\' access and idle spend', () => {
    const dash = read('src/pages/DashboardPage.jsx');
    for (const kind of ['invoice_check', 'budget', 'former_access', 'idle_spend']) expect(dash).toContain(`kind: '${kind}'`);
  });
});

describe('the answers are true', () => {
  it('invoices arrive as PDFs or by email, and the amount before tax is asked for on both paths', () => {
    expect(read('src/pages/finance/BudgetTab.jsx')).toMatch(/amount_excl_tax/);
    expect(read('functions/index.js')).toMatch(/amount_excl_tax/);
    expect(read('functions/index.js')).toMatch(/exports\.invoiceInbound/);
  });

  it('a missing amount before tax is replaced by 20% VAT, and the finding says so', () => {
    const lib = read('src/lib/invoiceCheck.js');
    expect(lib).toMatch(/VAT_RATE = 0\.2\b/);
    expect(lib).toMatch(/assumedVat = true/);
    for (const lang of ['en', 'fr']) expect(str(lang, 'fin_a2')).toMatch(/20 ?%/);
  });

  it('viewers only read, and marking an invoice justified is logged', () => {
    expect(read('src/components/InvoiceCheckPanel.jsx')).toMatch(/<RoleGate requires="editor">/);
    expect(read('src/hooks/useDbQuery.js')).toMatch(/action: 'invoice\.cleared'/);
  });

  it('export and self-service deletion exist', () => {
    expect(read('src/lib/workspace-export.js')).toMatch(/export function buildWorkspaceExport/);
    expect(read('functions/purge-account.js')).toMatch(/purgeAccount/);
  });
});
