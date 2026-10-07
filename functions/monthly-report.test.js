import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const { buildMonthlyReport, renderMonthlyReport, reportRecipients } = require_('./monthly-report.js');

// ── The monthly report to management ───────────────────────────────────────

const NOW = new Date('2026-10-01T06:00:00Z');   // the 1st: the report covers September

const workspace = () => ({
  tools: [
    { id: 't1', name: 'Notion', status: 'active', owner_email: 'a@acme.fr', cost_per_month: 144, agreed_monthly: 100, agreed_basis: 'ht', renewal_date: '2026-10-20' },
    { id: 't2', name: 'HubSpot', status: 'unused', owner_email: 'k@acme.fr', cost_per_month: 690, renewal_date: '2026-10-05' },
    { id: 't3', name: 'Slack', status: 'active', owner_email: 'a@acme.fr', cost_per_month: 312, renewal_date: '2027-03-01' },
    { id: 't4', name: 'Zoom <b>Pro</b>', status: 'decommissioned', cost_per_month: 0 },
  ],
  employees: [
    { id: 'e1', department: 'Sales', status: 'active' },
    { id: 'e2', department: 'Marketing', status: 'active' },
    { id: 'e3', department: 'Sales', status: 'offboarded' },
  ],
  access: [
    { tool_id: 't2', employee_id: 'e1', status: 'active' },
    { tool_id: 't3', employee_id: 'e2', status: 'active' },
    { tool_id: 't3', employee_id: 'e3', status: 'active' },
  ],
  budgets: [{ year: 2026, department: 'sales', annual: 6000 }, { year: 2026, department: 'marketing', annual: 10000 }],
  invoice_records: [
    { id: 'i1', vendor: 'Notion Labs Inc', amount: 144, amount_excl_tax: 120, billing_cycle: 'monthly', invoice_date: '2026-09-05' },
    { id: 'i2', vendor: 'Slack Technologies', amount: 312, billing_cycle: 'monthly', invoice_date: '2026-09-10' },
    { id: 'i3', vendor: 'Slack Technologies', amount: 312, billing_cycle: 'monthly', invoice_date: '2026-09-10' },
  ],
});

describe('what the report says', () => {
  const r = buildMonthlyReport(workspace(), NOW);

  it('covers the month that just ended', () => {
    expect(r.period).toBe('2026-09');
    expect(r.preview).toBe(false);
    expect(buildMonthlyReport(workspace(), NOW, { preview: true }).period).toBe('2026-10');
  });

  it('spend: the monthly figure every screen uses, and its year', () => {
    expect(r.spend).toEqual({ monthly: 1146, annual: 13752, tools: 3 });
  });

  it('budgets: spent to date and forecast per department, the troubled ones first', () => {
    expect(r.budgets.map((b) => [b.department, b.status])).toEqual([['sales', 'over'], ['marketing', 'ok']]);
    const sales = r.budgets[0];
    expect(sales.projected).toBe(round(690 * 12 + 156 * 12));
    expect(sales.spent).toBeGreaterThan(6000);
  });

  it('invoices: the same findings as Finance → Budget, costliest first', () => {
    expect(r.invoices.count).toBe(2);
    expect(r.invoices.top.map((f) => [f.kind, f.vendor])).toEqual([['duplicate', 'Slack'], ['above_agreed', 'Notion']]);
    expect(r.invoices.annualAtStake).toBe(3744 + 240);
  });

  it('renewals: the next 30 days, soonest first, nothing decommissioned', () => {
    expect(r.renewals.map((x) => [x.name, x.days])).toEqual([['HubSpot', 4], ['Notion', 19]]);
  });

  it('three actions at most, most urgent first', () => {
    expect(r.actions.map((a) => a.kind)).toEqual(['invoices', 'budget', 'former_access']);
    expect(r.actions[1]).toMatchObject({ department: 'sales', status: 'over' });
  });

  it('an empty workspace says so rather than showing zeros', () => {
    const empty = buildMonthlyReport({}, NOW);
    expect(empty.empty).toBe(true);
    expect(renderMonthlyReport(empty, { lang: 'fr', sender: 'x@acme.fr' }).html).toContain("Aucun outil n'est encore suivi");
  });
});

const round = (n) => Math.round(n * 100) / 100;

describe('the report on the 1st of January closes December', () => {
  const ws = () => ({ ...workspace(), budgets: [
    { year: 2026, department: 'sales', annual: 6000 }, { year: 2027, department: 'sales', annual: 20000 },
  ] });

  it('uses the budgets of the year it reports, counted through the end of December', () => {
    const r = buildMonthlyReport(ws(), new Date('2027-01-01T07:00:00Z'));
    expect(r.period).toBe('2026-12');
    expect(r.budgets).toHaveLength(1);
    expect(r.budgets[0]).toMatchObject({ department: 'sales', annual: 6000, status: 'over' });
    expect(r.budgets[0].spent).toBeCloseTo((690 + 156) * 12, 0);   // twelve full months, no snapshots
  });

  it('a preview still reads the year it is sent in', () => {
    const r = buildMonthlyReport(ws(), new Date('2027-01-20T10:00:00Z'), { preview: true });
    expect(r.budgets[0].annual).toBe(20000);
  });

  it('the status follows the Budget tab: spent over budget but no longer heading over is fine', () => {
    // Sales now costs 100/month (projected 1,200), but spent 1,000 a month Jan–Aug.
    const data = { ...workspace(), tools: workspace().tools.map((t) => ({ ...t, cost_per_month: t.id === 't2' ? 100 : 0 })),
      budgets: [{ year: 2026, department: 'sales', annual: 6000 }],
      spend_history: Array.from({ length: 8 }, (_, i) => ({ month: `2026-0${i + 1}`, by_department: { sales: 1000 } })) };
    const r = buildMonthlyReport(data, NOW);
    expect(r.budgets[0].spent).toBeGreaterThan(6000);
    expect(r.budgets[0]).toMatchObject({ status: 'ok' });
  });
});

describe('a malformed workspace', () => {
  it('builds a report instead of throwing, and drops dates that are not dates', () => {
    // '2026-10-1x' sorts inside the 30-day window but is not a date: it used to print "dans NaN j".
    const bad = { tools: [{ id: 'x', name: 'Odd', renewal_date: '2026-10-1x', cost_per_month: 10 }, null, 'str'],
      budgets: 'x', invoice_records: { a: 1 }, spend_history: { a: 1 }, employees: 3, access: null };
    const r = buildMonthlyReport(bad, NOW);
    expect(r.renewals).toEqual([]);
    expect(renderMonthlyReport(r, { sender: 'x@acme.fr' }).html).not.toContain('NaN');
  });
});

describe('the email', () => {
  const r = buildMonthlyReport(workspace(), NOW);

  it('French by default, with the month, the spend and the count of actions in the subject', () => {
    const { subject, html } = renderMonthlyReport(r, { sender: 'daf@acme.fr' });
    // French groups thousands with a narrow no-break space.
    expect(subject.replace(/\s/g, ' ')).toBe("Rapport mensuel des dépenses logicielles — septembre 2026 · €1 146/mois · 3 point(s) d'attention");
    expect(html).toContain('2 facture(s) fournisseur à vérifier');
    expect(html).toContain('Budget sales : 1');     // pct follows
    expect(html).toContain('à la demande de daf@acme.fr');
    expect(html).toContain('https://stacklens.fr/finance?tab=budget');
  });

  it('English when asked', () => {
    const { subject, html } = renderMonthlyReport(r, { lang: 'en', sender: 'cfo@acme.com' });
    expect(subject).toMatch(/^Monthly software spend report — September 2026 · €1,146\/mo · 3 item\(s\)/);
    expect(html).toContain('Supplier invoices to check');
  });

  it('a preview says it is one', () => {
    const p = buildMonthlyReport(workspace(), NOW, { preview: true });
    expect(renderMonthlyReport(p, { sender: 'x@acme.fr' }).subject).toContain('octobre 2026 (Aperçu)');
  });

  it('names typed into the workspace cannot inject markup', () => {
    const ws = workspace();
    ws.tools.push({ id: 't9', name: '<img src=x onerror=alert(1)>', status: 'active', cost_per_month: 10, renewal_date: '2026-10-10' });
    const { html } = renderMonthlyReport(buildMonthlyReport(ws, NOW), { sender: 'x@acme.fr' });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('who receives it', () => {
  it('the account, plus colleagues on the same company domain, three at most', () => {
    const { to, rejected } = reportRecipients('DAF@Acme.fr', ['dg@acme.fr', 'compta@acme.fr', 'rh@acme.fr', 'extra@acme.fr']);
    expect(to).toEqual(['daf@acme.fr', 'dg@acme.fr', 'compta@acme.fr', 'rh@acme.fr']);
    expect(rejected).toEqual(['extra@acme.fr']);
  });

  it('never an address on another domain', () => {
    expect(reportRecipients('daf@acme.fr', ['someone@other.fr', 'dg@acme.fr.evil.com']).to).toEqual(['daf@acme.fr']);
  });

  it('no extra recipient at all when the account is on a public mail domain', () => {
    expect(reportRecipients('roland@gmail.com', ['friend@gmail.com']).to).toEqual(['roland@gmail.com']);
    expect(reportRecipients('x@orange.fr', ['y@orange.fr']).to).toEqual(['x@orange.fr']);
  });

  it('nothing without a valid account address; junk and duplicates are dropped', () => {
    expect(reportRecipients('', ['dg@acme.fr']).to).toEqual([]);
    expect(reportRecipients('daf@acme.fr', 'dg@acme.fr').to).toEqual(['daf@acme.fr']);
    expect(reportRecipients('daf@acme.fr', ['daf@acme.fr', 'not an email', 'dg@acme.fr', 'DG@acme.fr']).to).toEqual(['daf@acme.fr', 'dg@acme.fr']);
  });
});

describe('the scheduled send and the example keep their promises', () => {
  // index.js needs Firestore and SendGrid, so its rules are held to the source.
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed path
  const src = require_('node:fs').readFileSync(require_('node:path').resolve(__dirname, 'index.js'), 'utf8');
  const monthly = src.slice(src.indexOf('exports.monthlyReport'), src.indexOf('exports.reportnow'));
  const example = src.slice(src.indexOf('exports.reportnow'));

  it('only accounts that turned it on, checked before their workspace is read', () => {
    expect(monthly).toMatch(/const settings = docSnap\.data\(\)\?\.user\?\.monthly_report;\s*if \(!settings \|\| settings\.enabled !== true\) continue;/);
    expect(monthly.indexOf('settings.enabled !== true')).toBeLessThan(monthly.indexOf('assembleUserdata('));
  });

  it('one account failing cannot stop the run, and the run has time to finish', () => {
    const loop = monthly.slice(monthly.indexOf('for (const docSnap of snapshot.docs)'));
    expect(loop.indexOf('try {')).toBeLessThan(loop.indexOf('buildMonthlyReport('));
    expect(loop.indexOf('try {')).toBeLessThan(loop.indexOf('assembleUserdata('));
    expect(monthly).toMatch(/timeoutSeconds: 540/);
  });

  it('only to a verified address', () => {
    const fn = src.slice(src.indexOf('async function verifiedEmailForUid'), src.indexOf('async function verifiedEmailForUid') + 300);
    expect(fn).toMatch(/return user\?\.emailVerified \? \(user\.email \|\| ''\) : '';/);
  });

  it('to the Auth address and the colleagues the rule accepts, never a raw stored list', () => {
    expect(monthly).toMatch(/const email = await verifiedEmailForUid\(uid\);\s*const \{ to \} = reportRecipients\(email, settings\.recipients\);/);
    expect(monthly).toMatch(/sendMail\(BREVO_API_KEY\.value\(\), \{\s*to, from/);
  });

  it('once per month, remembered only after a delivered send', () => {
    expect(monthly).toMatch(/last_period === report\.period\) continue;/);
    const sentCheck = monthly.indexOf('if (!mail.sent)');
    const remember = monthly.indexOf('stateRef.set({ last_period');
    expect(sentCheck).toBeGreaterThan(-1);
    expect(remember).toBeGreaterThan(sentCheck);
  });

  it('the example goes to the caller alone, signed in and rate-limited', () => {
    expect(example).toMatch(/const decoded = await verifyAuth\(req, res\); if \(!decoded\) return;/);
    expect(example).toMatch(/checkRateLimit\(decoded\.uid, res, REPORT_TEST_LIMIT, 'reportnow'\)/);
    expect(example).toMatch(/reportRecipients\(email, \[\]\)/);
    expect(example).not.toMatch(/settings\.recipients|monthly_report\.recipients/);
  });
});
