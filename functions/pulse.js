// ── The anonymous visit counter ─────────────────────────────────────────────
//
// Google Analytics sees only the visitors who accept its cookies, which is
// almost nobody, so it could not say whether an email campaign brought anyone
// to the site. This counts instead, with nothing that identifies a person:
// the browser sends an event name, a campaign tag read from the link it
// arrived by (`?c=nl`) and, for a visit, which public page. The server adds
// one to a counter for that day. No cookie, nothing kept in the browser, no
// IP address, no user agent, no identifier: two visits by the same person are
// two visits, and nothing can tell them apart.
//
// Everything a browser sends is checked against these lists; anything else is
// dropped, so the counters cannot be filled with arbitrary text.

/** Events counted. Anything else is ignored. */
const PULSE_EVENTS = [
  'visit',                // a public page was loaded (once per page load)
  'audit_run',            // the free audit read a file
  'audit_portfolio_run',  // the free audit read several files
  'cta_click',            // a call to action on a public page
  'sign_up',              // an account was created
  'trial_started',
  'checkout_started',
  'checkout_completed',
];

/** Public pages a visit can name; any other path counts as `other`. */
const PULSE_PAGES = {
  '/': 'home',
  '/audit-saas': 'audit',
  '/experts-comptables': 'accountants',
  '/direction-financiere': 'finance',
  '/fonctionnalites': 'features',
  '/note-donnees': 'data_note',
  '/contact': 'contact',
  '/about': 'about',
  '/security-info': 'security',
};

/**
 * The campaign tags counted by name: the ones put on outreach links. Any other
 * tag counts as `other`, so a stranger sending a new tag on every request
 * cannot grow the day's document without bound (every field is then one of
 * PULSE_EVENTS × PULSE_PAGES × these). Add a tag here before using it on a
 * link; the counter then needs the functions deployed.
 */
const PULSE_CAMPAIGNS = [
  'fr', 'fr-relance', 'be-lu', 'pt', 'uk-ie', 'us', 'ch', 'nl', 'qc',
  'linkedin', 'newsletter',
];

/** A campaign tag from the list, `other` for any other tag, `direct` for none. */
function cleanCampaign(c) {
  const s = String(c ?? '').trim().toLowerCase();
  if (!s) return 'direct';
  return PULSE_CAMPAIGNS.includes(s) ? s : 'other';
}

/**
 * The `&c=` to add to the address Stripe sends a buyer back to, so the payment
 * is counted under the campaign the checkout began with. Only a listed tag.
 */
function campaignReturnParam(c) {
  const s = cleanCampaign(c);
  return s === 'direct' || s === 'other' ? '' : `&c=${s}`;
}

function pageOf(path) {
  const p = String(path ?? '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return PULSE_PAGES[p] || 'other';
}

/**
 * The counter field a report adds one to, or null when the report is not one
 * we count. `visit` carries its page: `visit__accountants__nl`.
 */
function pulseField(body) {
  const b = body && typeof body === 'object' ? body : {};
  const e = String(b.e ?? '');
  if (!PULSE_EVENTS.includes(e)) return null;
  const c = cleanCampaign(b.c);
  return e === 'visit' ? `visit__${pageOf(b.p)}__${c}` : `${e}__${c}`;
}

/** The day a count is filed under, in UTC: `2026-11-12`. */
function pulseDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** Days of counter documents turned into rows for the founder's screen. */
function pulseRows(days) {
  const rows = [];
  for (const { day, counts } of days) {
    for (const [field, n] of Object.entries(counts || {})) {
      const parts = field.split('__');
      const event = parts[0];
      const page = event === 'visit' ? parts[1] : '';
      const campaign = event === 'visit' ? parts[2] : parts[1];
      rows.push({ day, event, page, campaign, count: Number(n) || 0 });
    }
  }
  return rows.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

module.exports = { PULSE_EVENTS, PULSE_PAGES, PULSE_CAMPAIGNS, cleanCampaign, campaignReturnParam, pageOf, pulseField, pulseDay, pulseRows };
