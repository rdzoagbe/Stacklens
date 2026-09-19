// ── A SaaS audit from a bank export, entirely in the browser ──────────────
//
// The public /audit-saas page: drop a bank statement export, get back the
// recurring software charges hiding in it. Nothing here touches the network.
// That is not an implementation detail, it is the pitch — an accountant will
// not upload a client's bank statement to a startup they found on LinkedIn,
// and should not be asked to. The AuditPage test asserts no fetch exists.
//
// Everything is heuristic and says so. A bank line reads "PRLV SEPA NOTION
// LABS 12/03 REF 8827361"; we can tell it is Notion, that it recurs monthly,
// and what it costs. We cannot tell whether anyone still uses it. So the
// report flags CANDIDATES — duplicates, price rises, renewals about to land,
// small charges that have run for months — and never claims certainty.
//
// French exports are the primary target: ';' delimiters, decimal commas,
// day-first dates, separate Débit/Crédit columns, and windows-1252 encoding
// are all the normal case here, not edge cases.

// ── 1. Decoding ─────────────────────────────────────────────────────────────

/**
 * Decodes a file's bytes to text. UTF-8 first; if that produces replacement
 * characters the file is almost certainly windows-1252, which is what most
 * French banks still export.
 */
export function decodeBankFile(buffer) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  if (!utf8.includes('�')) return utf8;
  try {
    return new TextDecoder('windows-1252').decode(buffer);
  } catch {
    return utf8;
  }
}

// ── 2. CSV ──────────────────────────────────────────────────────────────────

const DELIMITERS = [';', ',', '\t', '|'];

/** The delimiter that splits the most lines into the same number of fields. */
export function sniffDelimiter(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 20);
  if (!lines.length) return ',';
  let best = ',';
  let bestScore = -1;
  for (const d of DELIMITERS) {
    const counts = lines.map(l => splitLine(l, d).length);
    const mode = counts.sort((a, b) => a - b)[Math.floor(counts.length / 2)];
    if (mode < 2) continue;
    const consistent = counts.filter(c => c === mode).length;
    // Consistency first, then width: a file that splits every line into the
    // same 5 fields on ';' beats one that splits into 2 on ','.
    const score = consistent * 100 + mode;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

export function splitLine(line, delimiter) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
      continue;
    }
    if (ch === delimiter && !inQ) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

// ── 3. Columns ──────────────────────────────────────────────────────────────

const COL = {
  date:   /^(date|date op[ée]ration|date de l'op[ée]ration|date valeur|date comptable|booking date|transaction date|value date|jour|posted|dated?)$/i,
  dateLoose: /date|jour|booking|posted/i,
  label:  /libell|label|description|wording|d[ée]tail|narrative|memo|payee|b[ée]n[ée]ficiaire|beneficiary|remittance|nom|name|merchant|counterparty|tiers|motif|communication|op[ée]ration/i,
  amount: /^(montant|amount|value|somme|sum|net)$/i,
  amountLoose: /montant|amount|value|somme/i,
  debit:  /d[ée]bit|sortie|withdraw|out|paid out|charge/i,
  credit: /cr[ée]dit|entr[ée]e|deposit|in$|paid in/i,
};

/**
 * Works out which column is which from the header row. Returns null when it
 * cannot find a date and either an amount or a debit column — everything
 * else can be guessed, those two cannot.
 */
export function detectColumns(headers) {
  const h = headers.map(x => String(x || '').trim());
  const find = (re, exclude = []) => h.findIndex((x, i) => re.test(x) && !exclude.includes(i));

  let date = find(COL.date);
  if (date < 0) date = find(COL.dateLoose);

  // Prefer a single signed amount column; otherwise separate debit/credit.
  let amount = find(COL.amount, [date]);
  if (amount < 0) amount = find(COL.amountLoose, [date]);
  let debit = -1, credit = -1;
  if (amount < 0 || /d[ée]bit/i.test(h[amount])) {
    debit  = find(COL.debit, [date]);
    credit = find(COL.credit, [date, debit]);
    if (debit >= 0) amount = -1;
  }

  const taken = [date, amount, debit, credit].filter(i => i >= 0);
  let label = find(COL.label, taken);
  if (label < 0) {
    // No named label column: take the widest text column that is not a
    // date or an amount.
    label = h.findIndex((_, i) => !taken.includes(i));
  }

  if (date < 0 || (amount < 0 && debit < 0)) return null;
  return { date, label, amount, debit, credit };
}

// ── 4. Values ───────────────────────────────────────────────────────────────

/** "1 234,56" → 1234.56, "-12.30" → -12.3, "(45,00)" → -45, "" → NaN. */
export function parseAmount(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return NaN;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (/^-/.test(s)) { negative = true; s = s.slice(1); }
  if (/-$/.test(s)) { negative = true; s = s.slice(0, -1); }
  s = s.replace(/[€$£\s\u00A0\u202F]/g, '').replace(/[A-Za-z]+$/, '');
  // Decide which of '.' and ',' is the decimal mark: whichever comes LAST.
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return negative ? -n : n;
}

/** Day-first for the ambiguous cases, because the primary audience is French. */
export function parseDate(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  let m;
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s))) {
    return mk(+m[1], +m[2], +m[3]);
  }
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s))) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return mk(y, +m[2], +m[1]);
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t) : null;
}

function mk(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// ── 5. Parsing the whole export ─────────────────────────────────────────────

/**
 * Text → { transactions, skipped, columns, delimiter }.
 * A transaction is { date, label, amount, raw } with amount POSITIVE for money
 * going out. Credits are dropped: nothing about a refund tells us about a
 * subscription, and the totals must never be reduced by them.
 */
export function parseBankExport(text) {
  const delimiter = sniffDelimiter(text);
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { transactions: [], skipped: lines.length, columns: null, delimiter };

  // Some exports start with a preamble ("Compte: FR76…", blank, then the
  // header). The header is the first line whose columns can be detected.
  let headerAt = -1;
  let columns = null;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cols = detectColumns(splitLine(lines[i], delimiter));
    if (cols) { headerAt = i; columns = cols; break; }
  }
  if (!columns) return { transactions: [], skipped: lines.length, columns: null, delimiter };

  const transactions = [];
  let skipped = headerAt;
  for (const line of lines.slice(headerAt + 1)) {
    const f = splitLine(line, delimiter);
    const date = parseDate(f[columns.date]);
    let amount;
    if (columns.amount >= 0) {
      const a = parseAmount(f[columns.amount]);
      amount = a < 0 ? -a : NaN;          // only money out
    } else {
      const d = parseAmount(f[columns.debit]);
      amount = Number.isFinite(d) && d !== 0 ? Math.abs(d) : NaN;
    }
    const label = String(f[columns.label] ?? '').trim();
    if (!date || !Number.isFinite(amount) || amount <= 0 || !label) { skipped++; continue; }
    transactions.push({ date, label, amount, raw: line });
  }
  transactions.sort((a, b) => a.date - b.date);
  return { transactions, skipped, columns, delimiter };
}

// ── 6. Labels ───────────────────────────────────────────────────────────────

const NOISE = [
  /\b(prlv|prelevement|pr[ée]l[èe]vement|sepa|cb|carte|card|paiement|payment|achat|facture|invoice|vir(ement)?|transfer|dd|direct debit|pos|purchase)\b/gi,
  /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g,         // dates: 05/01/2026
  /\b\d{1,2}[/.-]\d{1,2}\b/g,                    // dates: 05/01 (two rules, not one
                                                   // optional group, which the unsafe-regex
                                                   // rule flags)
  /\b(ref|r[ée]f[ée]rence|id|no|n°|num)\b[:.]?\s*\S+/gi,
  /\b[0-9X*]{8,}\b/gi,                            // masked cards: 4974XXXXXXXX1234
  /\b\d{5,}\b/g,                                  // long numeric ids (alnum refs are caught by the ref rule)
  /\b(fr|gb|us|ie|nl|de|lu|be|ch|es|it)\b$/i,        // country at end
  /\b(sarl|sas|ltd|inc|llc|gmbh|bv|sa|limited|corp)\b/gi,
  /[*#|]/g,
  /\bwww\.|\.com\b|\.fr\b|\.io\b|\.co\b|\.net\b/gi,
  /\s{2,}/g,
];

/** "PRLV SEPA NOTION LABS INC 12/03 REF 8827361" → "NOTION LABS" */
export function normaliseLabel(label) {
  let s = String(label || '').toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');  // strip accents
  for (const re of NOISE) s = s.replace(re, ' ');
  s = s.replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  // First three tokens carry the merchant; the rest is usually noise.
  return s.split(' ').slice(0, 3).join(' ');
}

// ── 7. Vendors ──────────────────────────────────────────────────────────────

/**
 * Names we recognise. Matched against the normalised label. Deliberately a
 * plain list, not a service: it runs in the browser and it must be readable
 * by whoever adds the next vendor.
 */
export const VENDORS = [
  // Collaboration & productivity
  { re: /\bNOTION\b/, name: 'Notion', category: 'Productivity' },
  { re: /\bSLACK\b/, name: 'Slack', category: 'Communication' },
  { re: /\b(GOOGLE|GSUITE|G SUITE|WORKSPACE)\b/, name: 'Google Workspace', category: 'Productivity' },
  { re: /\b(MICROSOFT|MSFT|OFFICE 365|O365|MS 365)\b/, name: 'Microsoft 365', category: 'Productivity' },
  { re: /\bZOOM\b/, name: 'Zoom', category: 'Communication' },
  { re: /\bASANA\b/, name: 'Asana', category: 'Project management' },
  { re: /\bTRELLO\b/, name: 'Trello', category: 'Project management' },
  { re: /\bMONDAY\b/, name: 'monday.com', category: 'Project management' },
  { re: /\bCLICKUP\b/, name: 'ClickUp', category: 'Project management' },
  { re: /\b(ATLASSIAN|JIRA|CONFLUENCE)\b/, name: 'Atlassian', category: 'Project management' },
  { re: /\bMIRO\b/, name: 'Miro', category: 'Collaboration' },
  { re: /\bAIRTABLE\b/, name: 'Airtable', category: 'Productivity' },
  { re: /\bLOOM\b/, name: 'Loom', category: 'Communication' },
  { re: /\bDROPBOX\b/, name: 'Dropbox', category: 'Storage' },
  { re: /\bBOX\b/, name: 'Box', category: 'Storage' },
  { re: /\bEVERNOTE\b/, name: 'Evernote', category: 'Productivity' },
  { re: /\bCALENDLY\b/, name: 'Calendly', category: 'Scheduling' },
  { re: /\bTYPEFORM\b/, name: 'Typeform', category: 'Forms' },
  { re: /\bGRAMMARLY\b/, name: 'Grammarly', category: 'Writing' },
  // Design
  { re: /\bFIGMA\b/, name: 'Figma', category: 'Design' },
  { re: /\bCANVA\b/, name: 'Canva', category: 'Design' },
  { re: /\bADOBE\b/, name: 'Adobe', category: 'Design' },
  { re: /\bSKETCH\b/, name: 'Sketch', category: 'Design' },
  // Dev & infra
  { re: /\bGITHUB\b/, name: 'GitHub', category: 'Engineering' },
  { re: /\bGITLAB\b/, name: 'GitLab', category: 'Engineering' },
  { re: /\b(AWS|AMAZON WEB)\b/, name: 'Amazon Web Services', category: 'Infrastructure' },
  { re: /\bOVH\b/, name: 'OVHcloud', category: 'Infrastructure' },
  { re: /\bHEROKU\b/, name: 'Heroku', category: 'Infrastructure' },
  { re: /\bVERCEL\b/, name: 'Vercel', category: 'Infrastructure' },
  { re: /\bNETLIFY\b/, name: 'Netlify', category: 'Infrastructure' },
  { re: /\bCLOUDFLARE\b/, name: 'Cloudflare', category: 'Infrastructure' },
  { re: /\bDIGITALOCEAN\b/, name: 'DigitalOcean', category: 'Infrastructure' },
  { re: /\bSCALEWAY\b/, name: 'Scaleway', category: 'Infrastructure' },
  { re: /\bTWILIO\b/, name: 'Twilio', category: 'Communication API' },
  { re: /\bSENDGRID\b/, name: 'SendGrid', category: 'Email' },
  { re: /\b(BREVO|SENDINBLUE)\b/, name: 'Brevo', category: 'Email' },
  { re: /\bMAILCHIMP\b/, name: 'Mailchimp', category: 'Email' },
  { re: /\bMAILJET\b/, name: 'Mailjet', category: 'Email' },
  { re: /\bZAPIER\b/, name: 'Zapier', category: 'Automation' },
  { re: /\bMAKE\b/, name: 'Make', category: 'Automation' },
  { re: /\b(OPENAI|CHATGPT)\b/, name: 'OpenAI', category: 'AI' },
  { re: /\bANTHROPIC\b/, name: 'Anthropic', category: 'AI' },
  { re: /\bMIDJOURNEY\b/, name: 'Midjourney', category: 'AI' },
  // Sales, marketing, support
  { re: /\bHUBSPOT\b/, name: 'HubSpot', category: 'CRM' },
  { re: /\bSALESFORCE\b/, name: 'Salesforce', category: 'CRM' },
  { re: /\bPIPEDRIVE\b/, name: 'Pipedrive', category: 'CRM' },
  { re: /\bINTERCOM\b/, name: 'Intercom', category: 'Support' },
  { re: /\bZENDESK\b/, name: 'Zendesk', category: 'Support' },
  { re: /\bFRESHDESK\b/, name: 'Freshdesk', category: 'Support' },
  { re: /\bLINKEDIN\b/, name: 'LinkedIn', category: 'Sales' },
  { re: /\bLEMLIST\b/, name: 'lemlist', category: 'Sales' },
  { re: /\bWAALAXY\b/, name: 'Waalaxy', category: 'Sales' },
  { re: /\bSEMRUSH\b/, name: 'Semrush', category: 'Marketing' },
  { re: /\bAHREFS\b/, name: 'Ahrefs', category: 'Marketing' },
  { re: /\bHOOTSUITE\b/, name: 'Hootsuite', category: 'Marketing' },
  { re: /\bWEBFLOW\b/, name: 'Webflow', category: 'Website' },
  { re: /\bWIX\b/, name: 'Wix', category: 'Website' },
  { re: /\bSQUARESPACE\b/, name: 'Squarespace', category: 'Website' },
  { re: /\bSHOPIFY\b/, name: 'Shopify', category: 'E-commerce' },
  // Security & identity
  { re: /\b1PASSWORD\b/, name: '1Password', category: 'Security' },
  { re: /\bLASTPASS\b/, name: 'LastPass', category: 'Security' },
  { re: /\bDASHLANE\b/, name: 'Dashlane', category: 'Security' },
  { re: /\bOKTA\b/, name: 'Okta', category: 'Identity' },
  // Finance & HR — the French SMB stack
  { re: /\bPENNYLANE\b/, name: 'Pennylane', category: 'Finance' },
  { re: /\bPAYFIT\b/, name: 'PayFit', category: 'HR' },
  { re: /\bLUCCA\b/, name: 'Lucca', category: 'HR' },
  { re: /\bSWILE\b/, name: 'Swile', category: 'HR' },
  { re: /\bSPENDESK\b/, name: 'Spendesk', category: 'Finance' },
  { re: /\bAGICAP\b/, name: 'Agicap', category: 'Finance' },
  { re: /\bSELLSY\b/, name: 'Sellsy', category: 'CRM' },
  { re: /\bAXONAUT\b/, name: 'Axonaut', category: 'Finance' },
  { re: /\bYOUSIGN\b/, name: 'Yousign', category: 'E-signature' },
  { re: /\bDOCUSIGN\b/, name: 'DocuSign', category: 'E-signature' },
  { re: /\bDESCRIPT\b/, name: 'Descript', category: 'Media' },
  { re: /\bAPPLE\b/, name: 'Apple', category: 'Storage' },
];

// Labels that smell like software even when the vendor is unknown.
const SAAS_HINTS = /\b(SAAS|SOFTWARE|LOGICIEL|ABONNEMENT|SUBSCRIPTION|SUBSCR|LICENCE|LICENSE|CLOUD|PREMIUM|PRO PLAN|MONTHLY|MENSUEL|ANNUEL|ANNUAL|HOSTING|HEBERGEMENT|DOMAIN|DOMAINE|API|APP)\b/;

/** { name, category, confidence: 'known'|'likely' } or null. */
export function identifyVendor(normalised) {
  for (const v of VENDORS) {
    if (v.re.test(normalised)) return { name: v.name, category: v.category, confidence: 'known' };
  }
  if (SAAS_HINTS.test(normalised)) {
    return { name: titleCase(normalised), category: 'Software (unverified)', confidence: 'likely' };
  }
  return null;
}

function titleCase(s) {
  return String(s).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ── 8. Recurrence ───────────────────────────────────────────────────────────

const DAY = 86_400_000;

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function cadenceOf(dates) {
  if (dates.length < 2) return 'single';
  const gaps = [];
  for (let i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i - 1]) / DAY);
  const m = median(gaps);
  if (m >= 6 && m <= 8) return 'weekly';
  if (m >= 25 && m <= 36) return 'monthly';
  if (m >= 80 && m <= 100) return 'quarterly';
  if (m >= 340 && m <= 390) return 'annual';
  return 'irregular';
}

const PER_MONTH = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, annual: 1 / 12 };

/**
 * Groups transactions by normalised label and describes each group. Everything
 * with two or more charges is returned; the caller decides what to show.
 */
export function detectRecurring(transactions) {
  const groups = new Map();
  for (const tx of transactions) {
    const key = normaliseLabel(tx.label);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tx);
  }

  const out = [];
  for (const [key, txs] of groups) {
    if (txs.length < 2) continue;
    txs.sort((a, b) => a.date - b.date);
    const dates = txs.map(t => t.date.getTime());
    const amounts = txs.map(t => t.amount);
    const cadence = cadenceOf(dates);
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const vendor = identifyVendor(key);
    // A known cadence converts by its factor. An irregular one — Figma billed
    // on the 5th and the 21st, several seats on one card — used to get null
    // here and so contributed NOTHING to the monthly total, while the finding
    // two lines up flagged it as "several charges a month". The number at the
    // top of the page was quietly missing the thing the page was pointing at.
    // Irregular now estimates from the span: everything paid, divided by the
    // months it was paid over.
    const perMonth = PER_MONTH[cadence] ?? null;
    const spanMonths = Math.max(1, (dates[dates.length - 1] - dates[0]) / DAY / 30.44);
    const monthlyEquivalent = perMonth !== null
      ? round2(avg * perMonth)
      : (cadence === 'irregular' ? round2(amounts.reduce((a, b) => a + b, 0) / spanMonths) : null);

    out.push({
      key,
      vendor: vendor?.name || titleCase(key),
      category: vendor?.category || 'Unclassified',
      confidence: vendor?.confidence || 'none',
      saas: !!vendor,
      cadence,
      charges: txs.length,
      first: txs[0].date,
      last: txs[txs.length - 1].date,
      firstAmount: amounts[0],
      lastAmount: amounts[amounts.length - 1],
      avgAmount: round2(avg),
      monthlyEquivalent,
      transactions: txs,
    });
  }
  return out.sort((a, b) => (b.monthlyEquivalent ?? 0) - (a.monthlyEquivalent ?? 0));
}

function round2(n) { return Math.round(n * 100) / 100; }

// ── 9. The report ───────────────────────────────────────────────────────────

const UPCOMING_WINDOW_DAYS = 60;
const FORGOTTEN_MAX_MONTHLY = 30;
const FORGOTTEN_MIN_CHARGES = 6;
const PRICE_RISE_PCT = 5;

/**
 * The audit. `now` defaults to the LATEST transaction in the file, not the
 * wall clock: a statement from last year must not report every annual
 * subscription as overdue for renewal.
 */
export function auditSaas(transactions, { now } = {}) {
  const recurring = detectRecurring(transactions);
  const subscriptions = recurring.filter(r => r.saas);
  const otherRecurring = recurring.filter(r => !r.saas);

  const asOf = now instanceof Date
    ? now
    : (transactions.length ? new Date(Math.max(...transactions.map(t => t.date.getTime()))) : new Date());

  const monthlySaas = round2(subscriptions.reduce((s, r) => s + (r.monthlyEquivalent ?? 0), 0));

  // The same vendor reached through two different labels — "NOTION LABS" and
  // "NOTION" — is usually two workspaces or two cards paying for one product.
  const byVendor = new Map();
  for (const s of subscriptions) {
    if (!byVendor.has(s.vendor)) byVendor.set(s.vendor, []);
    byVendor.get(s.vendor).push(s);
  }
  const duplicates = [...byVendor.entries()]
    .filter(([, rs]) => rs.length > 1)
    .map(([vendor, rs]) => ({
      vendor,
      lines: rs.length,
      monthlyEquivalent: round2(rs.reduce((a, r) => a + (r.monthlyEquivalent ?? 0), 0)),
    }));

  // Also: one label charged more than once in the same month, repeatedly —
  // several seats or several accounts on one card.
  const multiPerMonth = subscriptions.filter(s => {
    if (s.cadence !== 'monthly' && s.cadence !== 'irregular') return false;
    const months = new Map();
    for (const t of s.transactions) {
      const k = t.date.getUTCFullYear() * 12 + t.date.getUTCMonth();
      months.set(k, (months.get(k) || 0) + 1);
    }
    const doubled = [...months.values()].filter(n => n >= 2).length;
    return doubled >= 2;
  }).map(s => ({ vendor: s.vendor, key: s.key, monthlyEquivalent: s.monthlyEquivalent }));

  const priceIncreases = subscriptions
    .filter(s => s.charges >= 3 && s.firstAmount > 0 &&
      (s.lastAmount - s.firstAmount) / s.firstAmount * 100 >= PRICE_RISE_PCT)
    .map(s => ({
      vendor: s.vendor,
      from: s.firstAmount,
      to: s.lastAmount,
      pct: Math.round((s.lastAmount - s.firstAmount) / s.firstAmount * 100),
    }));

  const upcomingAnnual = subscriptions
    .filter(s => s.cadence === 'annual')
    .map(s => {
      const next = new Date(s.last.getTime() + 365 * DAY);
      const days = Math.round((next - asOf) / DAY);
      return { vendor: s.vendor, amount: s.lastAmount, renewsOn: next, inDays: days };
    })
    .filter(u => u.inDays >= -7 && u.inDays <= UPCOMING_WINDOW_DAYS)
    .sort((a, b) => a.inDays - b.inDays);

  // Small, long-running, easy to stop noticing. Candidates only.
  const forgotten = subscriptions
    .filter(s => s.cadence === 'monthly' && s.charges >= FORGOTTEN_MIN_CHARGES &&
      (s.monthlyEquivalent ?? 0) <= FORGOTTEN_MAX_MONTHLY)
    .map(s => ({ vendor: s.vendor, monthlyEquivalent: s.monthlyEquivalent, charges: s.charges }));

  const span = transactions.length
    ? Math.max(1, Math.round((asOf - transactions[0].date) / DAY))
    : 0;

  return {
    asOf,
    spanDays: span,
    transactionCount: transactions.length,
    totals: {
      monthlySaas,
      annualisedSaas: round2(monthlySaas * 12),
      subscriptionCount: subscriptions.length,
      recurringCount: recurring.length,
      knownVendors: subscriptions.filter(s => s.confidence === 'known').length,
    },
    findings: { duplicates, multiPerMonth, priceIncreases, upcomingAnnual, forgotten },
    subscriptions,
    otherRecurring,
  };
}

// ── 10. Export ──────────────────────────────────────────────────────────────

const fmtDate = (d) => d instanceof Date ? d.toISOString().slice(0, 10) : '';

export function reportToCsv(report) {
  const cols = ['vendor', 'category', 'confidence', 'cadence', 'charges', 'first', 'last',
    'avg_amount', 'monthly_equivalent', 'annualised', 'bank_label'];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const rows = [...report.subscriptions, ...report.otherRecurring].map(s => [
    s.vendor, s.category, s.confidence, s.cadence, s.charges, fmtDate(s.first), fmtDate(s.last),
    s.avgAmount, s.monthlyEquivalent ?? '', s.monthlyEquivalent == null ? '' : round2(s.monthlyEquivalent * 12),
    s.key,
  ]);
  return [cols.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n') + '\n';
}

// ── 11. Sample data ─────────────────────────────────────────────────────────
//
// A statement that looks like a real one, so the audit page can show its
// output before anyone hands over a file. Built from a list rather than pasted
// so it stays readable, and exported so the test executes it rather than
// scraping it out of the page with the Function constructor.
export function sampleBankExport() {
  const rows = [];
  const line = (d, m, label, debit, credit = '') =>
    rows.push(`${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/2026;${label};${debit};${credit}`);
  for (let m = 1; m <= 6; m++) {
    line(5, m, `PRLV SEPA NOTION LABS INC 05/0${m} REF 88273${60 + m}`, m <= 3 ? '96,00' : '112,00');
    line(10, m, `CB SLACK TECHNOLOGIES 09/0${m} CARTE 4974XXXXXXXX1234`, '1 250,00');
    line(3, m, 'PRLV GOOGLE GSUITE_STACKLENS', '345,60');
    line(7, m, 'CB FIGMA INC', '45,00');
    line(21, m, 'CB FIGMA INC', '45,00');
    line(12, m, 'CB CALENDLY LLC', '10,00');
    line(2, m, `CB CARREFOUR MARKET 01/0${m}`, `${60 + m * 7},10`);
    line(28, m, `VIR SEPA SALAIRES ${m}/2026`, '', '14 800,00');
  }
  line(15, 3, 'CB ADOBE SYSTEMS ABONNEMENT ANNUEL', '719,88');
  line(9, 1, 'CB ZOOM VIDEO COMM', '149,90');
  line(9, 2, 'CB ZOOM VIDEO COMM', '149,90');
  line(9, 3, 'CB ZOOM VIDEO COMM', '149,90');
  return 'Date;Libellé;Débit;Crédit\n' + rows.join('\n') + '\n';
}
