// ── Supplier invoices, checked against what was agreed ─────────────────────
//
// A finance lead answers for every euro committed in the company's name, and
// "contrôler la facturation fournisseur" is in every job description for the
// role. Stacklens already reads the invoices (PDF import, the email inbox,
// the bank connection → db.invoice_records); this checks them.
//
// Four findings, one per invoice at most, the costliest kind first:
//
//   duplicate      the same vendor, the same amount, the same date or service
//                  period, twice: billed twice
//   after_cancel   a recent invoice for a tool marked decommissioned
//   above_agreed   more per month than the price agreed with the vendor (the
//                  tool's agreed_monthly, before or after tax)
//   price_rise     more per month than the vendor's previous invoice on the
//                  same billing cycle, when no agreed price exists to say
//                  otherwise
//
// Amounts: every import path extracts the total INCLUDING tax; the PDF and
// email paths also ask for the amount excluding tax. An agreed price is
// usually quoted before tax, so it is compared with that when the invoice
// has it, and otherwise with the total after adding French standard VAT
// (20 %) — which the finding says it assumed.
//
// Nothing here edits anything. A finding someone has explained is marked
// `cleared` on the invoice record and no longer reported.

export const VAT_RATE = 0.2;
const TOLERANCE_PCT = 2;      // rounding, a currency cent, a prorated day
const TOLERANCE_EUR = 1;
const RECENT_AFTER_CANCEL_DAYS = 60;
const DAY = 86_400_000;

const PER_MONTH = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
const round2 = (n) => Math.round(n * 100) / 100;

const LEGAL = /\b(inc|llc|ltd|limited|sas|sasu|sarl|sa|gmbh|bv|nv|ag|plc|corp|corporation|co|company|srl|spa|oy|ab)\b\.?/g;
/** "Notion Labs, Inc." → "notion labs" */
export function invoiceVendorKey(name) {
  return String(name || '').toLowerCase()
    .replace(/[.,()'"]/g, ' ').replace(LEGAL, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Does this invoice's vendor name refer to this tool? Exact, or the tool's name leading the vendor's. */
export function vendorMatchesTool(vendor, toolName) {
  const v = invoiceVendorKey(vendor); const t = invoiceVendorKey(toolName);
  if (!v || !t) return false;
  return v === t || v.startsWith(t + ' ');
}

/** Per month, including tax, from one invoice record; 0 for a one-off. */
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

/**
 * The invoices worth a second look. `now` defaults to the wall clock and
 * only matters for "billed after cancellation".
 */
export function checkInvoices(db, { now = new Date() } = {}) {
  // The workspace is client-written: anything that is not a list is ignored
  // rather than allowed to throw (one bad workspace stopped the whole monthly
  // report run).
  const tools = Array.isArray(db?.tools) ? db.tools : [];
  const rejected = Array.isArray(db?.rejected_vendors) ? db.rejected_vendors : [];
  const records = (Array.isArray(db?.invoice_records) ? db.invoice_records : [])
    .filter((r) => r && r.id && r.vendor && Number(r.amount) > 0)
    // A vendor someone here said is not software (lib/toolReview.js) is not checked.
    .filter((r) => !rejected.some((name) => vendorMatchesTool(r.vendor, name)))
    .map((r) => ({ ...r, _date: Date.parse(r.invoice_date || r.period_start || r.imported_at || '') || 0 }))
    .sort((a, b) => a._date - b._date);

  // The closest tool, not the first that matches: an "Adobe Sign" invoice must
  // not be checked against the price agreed for "Adobe".
  const toolFor = (vendor) => {
    const v = invoiceVendorKey(vendor);
    let best = null; let bestLen = -1;
    for (const t of tools) {
      if (!t || !vendorMatchesTool(vendor, t.name)) continue;
      const k = invoiceVendorKey(t.name);
      const len = k === v ? Infinity : k.length;
      if (len > bestLen) { best = t; bestLen = len; }
    }
    return best;
  };
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

  // 1. Billed twice.
  const seen = new Map();
  for (const r of records) {
    const when = r.period_start || r.invoice_date;
    if (!when) continue;
    const k = `${invoiceVendorKey(r.vendor)}|${Number(r.amount).toFixed(2)}|${when}`;
    if (!seen.has(k)) { seen.set(k, r); continue; }
    const first = seen.get(k);
    // Not billed twice: two bank summaries of the same charge (a second sync
    // before the next one), or the same document imported twice.
    if ((r.source === 'bank' && first.source === 'bank') || (r.file && r.file === first.file)) continue;
    if (r.cleared) continue;
    const tool = toolFor(r.vendor);
    const monthly = monthlyTtc(r);
    add({ ...base(r, tool), kind: 'duplicate', firstInvoiceId: first.id,
      overMonthly: round2(monthly), overAnnual: round2(monthly ? monthly * 12 : Number(r.amount)) });
  }

  // 2. Billed for something cancelled.
  for (const r of records) {
    if (r.cleared || flagged.has(r.id)) continue;
    const tool = toolFor(r.vendor);
    if (tool?.status !== 'decommissioned' || !r._date) continue;
    if (now - r._date > RECENT_AFTER_CANCEL_DAYS * DAY || r._date > now) continue;
    const monthly = monthlyTtc(r);
    add({ ...base(r, tool), kind: 'after_cancel',
      overMonthly: round2(monthly), overAnnual: round2(monthly ? monthly * 12 : Number(r.amount)) });
  }

  // 3. Above the agreed price; 4. above the previous invoice.
  // One vendor billing several products (Jira and Confluence from Atlassian)
  // shows two amounts in the same month; comparing them is not a price rise.
  const amountsByMonth = new Map();
  for (const r of records) {
    if (!monthlyTtc(r)) continue;
    const mk = `${invoiceVendorKey(r.vendor)}|${r.billing_cycle}|${String(r.invoice_date || r.period_start || '').slice(0, 7)}`;
    if (!amountsByMonth.has(mk)) amountsByMonth.set(mk, new Set());
    amountsByMonth.get(mk).add(Number(r.amount).toFixed(2));
  }
  const multiProduct = new Set([...amountsByMonth]
    .filter(([, amounts]) => amounts.size > 1)
    .map(([mk]) => mk.split('|').slice(0, 2).join('|')));

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
      continue;   // an agreed price settles it: a rise up to it is what was agreed
    }

    if (prev && !multiProduct.has(key)) {
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

/** What the findings add up to, and the tools billed with no agreed price to check against. */
export function invoiceCheckSummary(db, findings = checkInvoices(db)) {
  const billed = new Set();
  for (const r of db?.invoice_records || []) {
    if (!monthlyTtc(r)) continue;
    const tool = (db?.tools || []).find((t) => vendorMatchesTool(r.vendor, t.name));
    if (tool && !(Number(tool.agreed_monthly) > 0)) billed.add(tool.id);
  }
  return {
    count: findings.length,
    annualAtStake: round2(findings.reduce((s, f) => s + (f.overAnnual || 0), 0)),
    toolsWithoutAgreedPrice: billed.size,
  };
}
