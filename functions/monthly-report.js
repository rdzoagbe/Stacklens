// ── The monthly report to management ───────────────────────────────────────
//
// "Élaboration d'un rapport mensuel des dépenses et du prévisionnel à la
// direction" is in the job description of every finance lead Stacklens sells
// to. The Budget tab could export that report; nobody sent it. This builds it
// from a workspace and renders it as an email, sent on the 1st of each month
// to the accounts that turned it on (Settings → Notifications), by
// monthlyReport in index.js.
//
// Pure: no Firestore, no network. Everything here is exercised by
// monthly-report.test.js and, for the parts that exist twice, by the parity
// tests in src/lib (invoice-parity, report-recipients-parity).

const { monthlySpend, currencySymbol } = require('./workspace-write.js');

// ── Department budgets (moved here from index.js; dailyAlerts uses them too) ─

// Server-side twin of src/lib/budget.js allocateSpendByDepartment.
function allocSpendByDept(data) {
  const empDept = {};
  // Lowercase keys — mirrors src/lib/budget.js ("Sales" and "sales" are one department)
  (data.employees || []).forEach(e => { empDept[e.id] = (e.department || '').trim().toLowerCase() || 'other'; });
  const seatsByTool = {};
  (data.access || []).filter(a => a.status === 'active').forEach(a => {
    const dept = empDept[a.employee_id];
    if (!dept) return;
    if (!seatsByTool[a.tool_id]) seatsByTool[a.tool_id] = {};
    seatsByTool[a.tool_id][dept] = (seatsByTool[a.tool_id][dept] || 0) + 1;
  });
  const byDept = {};
  (data.tools || []).filter(t => t.status !== 'archived').forEach(tool => {
    const cost = Number(tool.cost_per_month || tool.cost_monthly || tool.cost || 0);
    if (!cost) return;
    const seats = seatsByTool[tool.id];
    const totalSeats = seats ? Object.values(seats).reduce((s, n) => s + n, 0) : 0;
    if (!totalSeats) return; // unallocated spend has no department budget to breach
    Object.entries(seats).forEach(([dept, n]) => {
      byDept[dept] = (byDept[dept] || 0) + cost * (n / totalSeats);
    });
  });
  return byDept;
}

// Spent-to-date per department, matching the Budget tab: recorded monthly
// snapshots where they exist, run-rate fallback elsewhere.
function spentToDateByDept(data, byDeptMonthly, now) {
  const year = now.getFullYear();
  const hist = Object.fromEntries((data.spend_history || []).map(s => [s.month, s]));
  const completed = now.getMonth();
  const frac = (now.getDate() - 1) / new Date(year, now.getMonth() + 1, 0).getDate();
  const out = {};
  Object.entries(byDeptMonthly).forEach(([dept, monthly]) => {
    let sum = 0;
    for (let m = 0; m < completed; m++) {
      const snap = hist[`${year}-${String(m + 1).padStart(2, '0')}`];
      sum += snap?.by_department?.[dept] ?? monthly;
    }
    out[dept] = sum + monthly * frac;
  });
  return out;
}

// ── Supplier invoice check: twin of src/lib/invoiceCheck.js ────────────────
// Kept identical by src/lib/invoice-parity.test.js, which runs both on the
// same workspaces. Change one, change the other.

const VAT_RATE = 0.2;
const TOLERANCE_PCT = 2;
const TOLERANCE_EUR = 1;
const RECENT_AFTER_CANCEL_DAYS = 60;
const DAY = 86_400_000;
const PER_MONTH = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
const round2 = (n) => Math.round(n * 100) / 100;
const LEGAL = /\b(inc|llc|ltd|limited|sas|sasu|sarl|sa|gmbh|bv|nv|ag|plc|corp|corporation|co|company|srl|spa|oy|ab)\b\.?/g;

function invoiceVendorKey(name) {
  return String(name || '').toLowerCase()
    .replace(/[.,()'"]/g, ' ').replace(LEGAL, ' ')
    .replace(/\s+/g, ' ').trim();
}
function vendorMatchesTool(vendor, toolName) {
  const v = invoiceVendorKey(vendor); const t = invoiceVendorKey(toolName);
  if (!v || !t) return false;
  return v === t || v.startsWith(t + ' ');
}
function monthlyTtc(r) {
  const per = PER_MONTH[r.billing_cycle];
  const amount = Number(r.amount) || 0;
  return per && amount > 0 ? amount * per : 0;
}
function monthlyHt(r) {
  const per = PER_MONTH[r.billing_cycle];
  const ht = Number(r.amount_excl_tax) || 0;
  return per && ht > 0 ? ht * per : null;
}
const over = (actual, expected) => actual - expected > Math.max(TOLERANCE_EUR, expected * TOLERANCE_PCT / 100);

function checkInvoices(db, { now = new Date() } = {}) {
  const tools = db?.tools || [];
  const records = (db?.invoice_records || [])
    .filter((r) => r && r.id && r.vendor && Number(r.amount) > 0)
    .map((r) => ({ ...r, _date: Date.parse(r.invoice_date || r.period_start || r.imported_at || '') || 0 }))
    .sort((a, b) => a._date - b._date);

  const toolFor = (vendor) => tools.find((t) => vendorMatchesTool(vendor, t.name)) || null;
  const findings = [];
  const flagged = new Set();
  const add = (f) => {
    if (flagged.has(f.invoiceId)) return;
    flagged.add(f.invoiceId);
    findings.push(f);
  };
  const base = (r, tool) => ({
    invoiceId: r.id, vendor: r.vendor, toolId: tool?.id || null, toolName: tool?.name || null,
    date: r.invoice_date || r.period_start || null, amount: Number(r.amount), currency: r.currency || 'EUR',
    file: r.file || '', source: r.source || '',
  });

  const seen = new Map();
  for (const r of records) {
    const when = r.period_start || r.invoice_date;
    if (!when) continue;
    const k = `${invoiceVendorKey(r.vendor)}|${Number(r.amount).toFixed(2)}|${when}`;
    if (!seen.has(k)) { seen.set(k, r); continue; }
    if (r.cleared) continue;
    const tool = toolFor(r.vendor);
    const monthly = monthlyTtc(r);
    add({ ...base(r, tool), kind: 'duplicate', firstInvoiceId: seen.get(k).id,
      overMonthly: round2(monthly), overAnnual: round2(monthly ? monthly * 12 : Number(r.amount)) });
  }

  for (const r of records) {
    if (r.cleared || flagged.has(r.id)) continue;
    const tool = toolFor(r.vendor);
    if (tool?.status !== 'decommissioned' || !r._date) continue;
    if (now - r._date > RECENT_AFTER_CANCEL_DAYS * DAY || r._date > now) continue;
    const monthly = monthlyTtc(r);
    add({ ...base(r, tool), kind: 'after_cancel',
      overMonthly: round2(monthly), overAnnual: round2(monthly ? monthly * 12 : Number(r.amount)) });
  }

  const previous = new Map();
  for (const r of records) {
    const monthly = monthlyTtc(r);
    const key = `${invoiceVendorKey(r.vendor)}|${r.billing_cycle}`;
    const prev = previous.get(key);
    if (monthly > 0) previous.set(key, r);
    if (!monthly || r.cleared || flagged.has(r.id)) continue;
    const tool = toolFor(r.vendor);
    const agreed = Number(tool?.agreed_monthly) || 0;

    if (agreed > 0) {
      const basis = tool.agreed_basis === 'ttc' ? 'ttc' : 'ht';
      let actual = monthly; let expected = agreed; let assumedVat = false;
      if (basis === 'ht') {
        const ht = monthlyHt(r);
        if (ht != null) actual = ht;
        else { expected = agreed * (1 + VAT_RATE); assumedVat = true; }
      }
      if (over(actual, expected)) {
        const diff = actual - expected;
        add({ ...base(r, tool), kind: 'above_agreed', basis, assumedVat,
          monthly: round2(actual), expected: round2(expected), agreed,
          overMonthly: round2(diff), overAnnual: round2(diff * 12) });
      }
      continue;
    }

    if (prev) {
      const before = monthlyTtc(prev);
      if (before > 0 && over(monthly, before)) {
        const diff = monthly - before;
        add({ ...base(r, tool), kind: 'price_rise', previousInvoiceId: prev.id,
          monthly: round2(monthly), expected: round2(before),
          pct: Math.round(diff / before * 100),
          overMonthly: round2(diff), overAnnual: round2(diff * 12) });
      }
    }
  }

  return findings.sort((a, b) => b.overAnnual - a.overAnnual);
}

// ── Who receives it ─────────────────────────────────────────────────────────
//
// /userdata is written by the client, so a recipient list stored there is
// untrusted: without a rule, anyone could make Stacklens send branded mail to
// any address once a month. The account's own address comes from Firebase
// Auth (the caller passes it). Extra recipients are accepted only on that
// address's domain, never on a public mail domain, three at most — a finance
// lead copying their manager, not a mailing list. Twin: src/lib/reportRecipients.js.

const MAX_EXTRA_RECIPIENTS = 3;
const PUBLIC_MAIL = /^(gmail\.com|googlemail\.com|yahoo\.[a-z.]+|ymail\.com|hotmail\.[a-z.]+|outlook\.[a-z.]+|live\.[a-z.]+|msn\.com|icloud\.com|me\.com|mac\.com|aol\.com|proton\.me|protonmail\.com|pm\.me|gmx\.[a-z.]+|mail\.com|zoho\.com|yandex\.[a-z.]+|laposte\.net|orange\.fr|wanadoo\.fr|free\.fr|sfr\.fr|bbox\.fr|neuf\.fr|numericable\.fr|web\.de|t-online\.de)$/;
// No nested quantifier (security/detect-unsafe-regex): split, then check each part.
const isEmail = (s) => { const [local, domain, ...rest] = String(s).split('@'); const labels = String(domain || '').split('.'); return !rest.length && /^[^\s@<>(),;:"]+$/.test(local || '') && labels.length >= 2 && labels.every((l) => /^[a-z0-9-]+$/.test(l)) && /^[a-z]{2,}$/.test(labels[labels.length - 1]); };

function reportRecipients(accountEmail, extras) {
  const own = String(accountEmail || '').trim().toLowerCase();
  if (!isEmail(own)) return { to: [], rejected: [] };
  const domain = own.split('@')[1];
  const allowExtras = !PUBLIC_MAIL.test(domain);
  const to = [own]; const rejected = [];
  for (const raw of Array.isArray(extras) ? extras : []) {
    const e = String(raw || '').trim().toLowerCase();
    if (!e || to.includes(e)) continue;
    if (!allowExtras || !isEmail(e) || e.split('@')[1] !== domain || to.length > MAX_EXTRA_RECIPIENTS) {
      rejected.push(e);
      continue;
    }
    to.push(e);
  }
  return { to, rejected };
}

// ── The report ──────────────────────────────────────────────────────────────

const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/**
 * Everything the email says, as data. `now` is the send time; the report
 * covers the month that just ended (or, for a preview, the month so far).
 */
function buildMonthlyReport(data, now = new Date(), { preview = false } = {}) {
  const periodDate = preview ? now : new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const tools = data?.tools || [];
  const monthly = monthlySpend(data || {});

  // Budgets: the same figures as Finance → Budget (spent to date, run rate × 12).
  const year = now.getFullYear();
  const byDept = allocSpendByDept(data || {});
  const spent = spentToDateByDept(data || {}, byDept, now);
  const budgets = (data?.budgets || [])
    .filter((b) => b.year === year && Number(b.annual) > 0)
    .map((b) => {
      const key = String(b.department || '').toLowerCase();
      const spentToDate = spent[key] || 0;
      const projected = (byDept[key] || 0) * 12;
      const status = spentToDate > b.annual ? 'over' : projected > b.annual ? 'risk' : 'ok';
      return {
        department: b.department, annual: Number(b.annual),
        spent: round2(spentToDate), projected: round2(projected),
        pct: Math.round((spentToDate / b.annual) * 100), status,
      };
    })
    .sort((a, b) => ({ over: 0, risk: 1, ok: 2 }[a.status] - { over: 0, risk: 1, ok: 2 }[b.status]) || b.pct - a.pct);

  const findings = checkInvoices(data, { now });
  const invoices = {
    count: findings.length,
    annualAtStake: round2(findings.reduce((s, f) => s + (f.overAnnual || 0), 0)),
    top: findings.slice(0, 5).map((f) => ({ kind: f.kind, vendor: f.toolName || f.vendor, date: f.date, overAnnual: f.overAnnual })),
  };

  const todayStr = now.toISOString().slice(0, 10);
  const in30Str = new Date(now.getTime() + 30 * DAY).toISOString().slice(0, 10);
  const renewals = tools
    .filter((t) => t.renewal_date && t.renewal_date >= todayStr && t.renewal_date <= in30Str && t.status !== 'decommissioned')
    .sort((a, b) => a.renewal_date.localeCompare(b.renewal_date))
    .map((t) => ({
      name: t.name, date: t.renewal_date,
      days: Math.max(0, Math.round((Date.parse(t.renewal_date) - Date.parse(todayStr)) / DAY)),
      annual: round2((Number(t.cost_per_month) || 0) * 12),
    }));

  // Former employees who still hold access; spend on tools nobody uses or owns.
  const inactive = new Set((data?.employees || []).filter((e) => e.status && e.status !== 'active').map((e) => e.id));
  const formerWithAccess = new Set((data?.access || [])
    .filter((a) => a.status !== 'revoked' && inactive.has(a.employee_id)).map((a) => a.employee_id)).size;
  const idle = tools.filter((t) => (t.status === 'unused' || t.status === 'orphaned') && Number(t.cost_per_month) > 0);
  const idleMonthly = round2(idle.reduce((s, t) => s + Number(t.cost_per_month), 0));

  // The three actions, most urgent first; only what applies.
  const actions = [];
  if (invoices.count) actions.push({ kind: 'invoices', n: invoices.count, amount: invoices.annualAtStake });
  const overBudget = budgets.filter((b) => b.status !== 'ok');
  if (overBudget.length) actions.push({ kind: 'budget', department: overBudget[0].department, pct: overBudget[0].pct, status: overBudget[0].status });
  if (formerWithAccess) actions.push({ kind: 'former_access', n: formerWithAccess });
  if (idleMonthly > 0) actions.push({ kind: 'idle', n: idle.length, amount: idleMonthly });
  if (renewals.length) actions.push({ kind: 'renewals', n: renewals.length, name: renewals[0].name, days: renewals[0].days });

  return {
    period: monthKeyOf(periodDate), preview,
    spend: { monthly: round2(monthly), annual: round2(monthly * 12), tools: tools.filter((t) => t.status !== 'decommissioned').length },
    budgets, invoices, renewals: renewals.slice(0, 8), actions: actions.slice(0, 3),
    empty: !tools.length,
  };
}

// ── The email ───────────────────────────────────────────────────────────────

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const COPY = {
  fr: {
    months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    subject: (p, spend, n) => `Rapport mensuel des dépenses logicielles — ${p} · ${spend}/mois${n ? ` · ${n} point(s) d'attention` : ''}`,
    preview: 'Aperçu',
    title: (p) => `Rapport mensuel — ${p}`,
    intro: 'Les dépenses logicielles de votre entreprise, le prévisionnel et ce qui demande une décision.',
    spend: 'Dépense mensuelle', annual: "Sur l'année, au rythme actuel", tools: 'Outils suivis',
    actions: 'Les actions prioritaires',
    a_invoices: (a, m) => `${a.n} facture(s) fournisseur à vérifier : ${m(a.amount)} par an en jeu.`,
    a_budget: (a) => a.status === 'over' ? `Budget ${a.department} : ${a.pct} % déjà consommé, dépassement constaté.` : `Budget ${a.department} : dépassement prévu au rythme actuel (${a.pct} % consommé).`,
    a_former_access: (a) => `${a.n} ancien(s) salarié(s) ont encore des accès actifs.`,
    a_idle: (a, m) => `${m(a.amount)} par mois sur ${a.n} outil(s) inutilisé(s) ou sans responsable.`,
    a_renewals: (a) => `${a.n} renouvellement(s) dans les 30 jours, dont ${a.name} dans ${a.days} jour(s).`,
    none: "Rien d'urgent ce mois-ci.",
    budgets: 'Budgets par service', b_dept: 'Service', b_budget: 'Budget annuel', b_spent: 'Réalisé à date', b_proj: 'Prévisionnel annuel',
    st: { over: 'Dépassé', risk: 'À risque', ok: 'Dans le budget' },
    no_budgets: "Aucun budget saisi pour cette année. Finance → Budget pour les fixer par service.",
    invoices: 'Factures fournisseurs à vérifier',
    kinds: { duplicate: 'facturé deux fois', after_cancel: 'facturé après résiliation', above_agreed: 'au-dessus du prix convenu', price_rise: 'hausse de prix' },
    per_year: '/an',
    renewals: 'Renouvellements dans les 30 jours', in_days: (d) => `dans ${d} j`,
    cta: 'Ouvrir Stacklens',
    footer: (sender) => `Envoyé le 1er de chaque mois à la demande de ${sender}. Pour ne plus le recevoir, désactivez « Rapport mensuel à la direction » dans Paramètres → Notifications, ou demandez-le à ${sender}.`,
    empty: "Aucun outil n'est encore suivi dans cet espace : le rapport se remplira dès les premiers imports.",
  },
  en: {
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    subject: (p, spend, n) => `Monthly software spend report — ${p} · ${spend}/mo${n ? ` · ${n} item(s) to act on` : ''}`,
    preview: 'Preview',
    title: (p) => `Monthly report — ${p}`,
    intro: "Your company's software spend, the forecast, and what needs a decision.",
    spend: 'Monthly spend', annual: 'Over the year, at the current rate', tools: 'Tools tracked',
    actions: 'Priority actions',
    a_invoices: (a, m) => `${a.n} supplier invoice(s) to check: ${m(a.amount)} a year at stake.`,
    a_budget: (a) => a.status === 'over' ? `${a.department} budget: ${a.pct}% already spent, over budget.` : `${a.department} budget: on course to overrun at the current rate (${a.pct}% spent).`,
    a_former_access: (a) => `${a.n} former employee(s) still have active access.`,
    a_idle: (a, m) => `${m(a.amount)} a month on ${a.n} unused or unowned tool(s).`,
    a_renewals: (a) => `${a.n} renewal(s) in the next 30 days, ${a.name} in ${a.days} day(s).`,
    none: 'Nothing urgent this month.',
    budgets: 'Budgets by department', b_dept: 'Department', b_budget: 'Annual budget', b_spent: 'Spent to date', b_proj: 'Annual forecast',
    st: { over: 'Over', risk: 'At risk', ok: 'On budget' },
    no_budgets: 'No budget set for this year. Finance → Budget to set one per department.',
    invoices: 'Supplier invoices to check',
    kinds: { duplicate: 'billed twice', after_cancel: 'billed after cancellation', above_agreed: 'above the agreed price', price_rise: 'price rise' },
    per_year: '/yr',
    renewals: 'Renewals in the next 30 days', in_days: (d) => `in ${d}d`,
    cta: 'Open Stacklens',
    footer: (sender) => `Sent on the 1st of each month at the request of ${sender}. To stop receiving it, turn off "Monthly report to management" in Settings → Notifications, or ask ${sender}.`,
    empty: 'No tools are tracked in this workspace yet: the report fills in with the first imports.',
  },
};

function renderMonthlyReport(report, { lang = 'fr', data = null, sender = '' } = {}) {
  const c = COPY[lang] || COPY.fr;
  const cur = currencySymbol(data || {});
  const money = (n) => `${cur}${Math.round(Number(n) || 0).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')}`;
  const [y, m] = report.period.split('-').map(Number);
  const periodLabel = `${c.months[m - 1]} ${y}${report.preview ? ` (${c.preview})` : ''}`;

  const card = (label, value) => `<td style="width:33%;padding:0 5px"><div style="background:#1e293b;border-radius:10px;padding:14px 8px;text-align:center">
    <div style="font-size:22px;font-weight:800;color:#e2e8f0">${value}</div><div style="font-size:11px;color:#94a3b8;margin-top:4px">${label}</div></div></td>`;
  const h = (t) => `<h3 style="color:#34d399;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:26px 0 10px">${t}</h3>`;
  const td = (t, extra = '') => `<td style="padding:8px;border-bottom:1px solid #1e293b;font-size:13px;color:#e2e8f0;${extra}">${t}</td>`;
  const stColor = { over: '#ef4444', risk: '#f59e0b', ok: '#10b981' };

  const actions = report.actions.length
    ? report.actions.map((a) => `<div style="padding:10px 14px;background:#1e293b;border-left:3px solid #f59e0b;border-radius:6px;margin-bottom:8px;font-size:13px;color:#e2e8f0">${esc(c[`a_${a.kind}`](a, money))}</div>`).join('')
    : `<p style="color:#94a3b8;font-size:13px">${c.none}</p>`;

  const budgets = report.budgets.length ? `<table style="width:100%;border-collapse:collapse">
      <tr>${[c.b_dept, c.b_budget, c.b_spent, c.b_proj, ''].map((x) => `<th style="padding:6px 8px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase">${x}</th>`).join('')}</tr>
      ${report.budgets.map((b) => `<tr>${td(esc(b.department))}${td(money(b.annual))}${td(`${money(b.spent)} (${b.pct} %)`)}${td(money(b.projected))}${td(c.st[b.status], `color:${stColor[b.status]};font-weight:700`)}</tr>`).join('')}
    </table>` : `<p style="color:#94a3b8;font-size:13px">${c.no_budgets}</p>`;

  const invoices = report.invoices.count ? h(c.invoices) + `<table style="width:100%;border-collapse:collapse">
      ${report.invoices.top.map((f) => `<tr>${td(esc(f.vendor))}${td(c.kinds[f.kind] || '', 'color:#f59e0b')}${td(esc(f.date || ''), 'color:#94a3b8')}${td(`+${money(f.overAnnual)}${c.per_year}`, 'font-weight:700;text-align:right')}</tr>`).join('')}
    </table>` : '';

  const renewals = report.renewals.length ? h(c.renewals) + `<table style="width:100%;border-collapse:collapse">
      ${report.renewals.map((r) => `<tr>${td(esc(r.name))}${td(esc(r.date), 'color:#94a3b8')}${td(c.in_days(r.days), `color:${r.days <= 7 ? '#ef4444' : '#f59e0b'};font-weight:700`)}${td(r.annual ? `${money(r.annual)}${c.per_year}` : '—', 'text-align:right')}</tr>`).join('')}
    </table>` : '';

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;background:#0f172a;border-radius:14px;overflow:hidden">
  <div style="padding:24px 28px;background:#1e293b"><div style="color:#34d399;font-size:12px;font-weight:700">Stacklens</div>
    <h1 style="color:white;margin:4px 0 4px;font-size:20px">${c.title(periodLabel)}</h1>
    <p style="color:#94a3b8;margin:0;font-size:13px">${c.intro}</p></div>
  <div style="padding:24px 28px">
    ${report.empty ? `<p style="color:#94a3b8;font-size:13px">${c.empty}</p>` : `
    <table style="width:100%;border-collapse:collapse"><tr>${card(c.spend, money(report.spend.monthly))}${card(c.annual, money(report.spend.annual))}${card(c.tools, report.spend.tools)}</tr></table>
    ${h(c.actions)}${actions}
    ${h(c.budgets)}${budgets}
    ${invoices}
    ${renewals}`}
    <div style="text-align:center;margin-top:28px"><a href="https://stacklens.fr/finance?tab=budget" style="display:inline-block;background:#059669;color:white;padding:12px 30px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">${c.cta} →</a></div>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #1e293b"><p style="color:#64748b;font-size:11px;margin:0;line-height:1.5">${esc(c.footer(sender))}</p></div>
</div>`;

  return { subject: c.subject(periodLabel, money(report.spend.monthly), report.actions.length), html };
}

module.exports = {
  allocSpendByDept, spentToDateByDept,
  checkInvoices, invoiceVendorKey, vendorMatchesTool, VAT_RATE,
  reportRecipients, MAX_EXTRA_RECIPIENTS,
  buildMonthlyReport, renderMonthlyReport,
};
