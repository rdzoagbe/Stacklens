// ── Money: one currency per workspace, and nothing is ever converted ────────
//
// A workspace has a single currency. Costs are entered, stored and displayed
// in it, because a customer types the amount their vendor actually bills them.
//
// The previous model treated every stored amount as US dollars and multiplied
// it by an exchange rate on display. Nothing ever told the user to enter
// dollars, so a French customer typing their real €690 HubSpot bill saw €635 —
// their headline monthly spend understated by 8%, and by 21% once the currency
// had silently become GBP (see below). Converting amounts the customer typed
// in their own currency cannot be made correct by picking better rates; the
// conversion itself was the defect.
//
// So there are no rates here any more, and no call to an exchange-rate API.
//
// The currency also used to have no way to be chosen. SettingsPage held it in
// state with no setter, rendered no control for it, and defaulted it to
// 'GBP (£)' — so pressing "Save Changes" to rename an organisation wrote
// pounds into settings, and every figure in the app switched to a currency the
// user had never been offered. There is now a real selector, and the default
// comes from the browser locale.
//
// Multi-currency estates (a customer paying some vendors in USD and others in
// EUR) need a currency per tool, not a workspace-wide rate. That is a bigger
// change and deliberately not attempted here.

export const SUPPORTED_CURRENCIES = [
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'USD', symbol: '$', label: 'US Dollar ($)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (£)' },
  { code: 'CHF', symbol: 'CHF ', label: 'Swiss Franc (CHF)' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar (C$)' },
];

const SETTINGS_KEY = 'sg_general';
const DEFAULT_CODE = 'EUR';

const BY_CODE = Object.fromEntries(SUPPORTED_CURRENCIES.map(c => [c.code, c]));

// Browser region → currency, used only to pick a sensible default the first
// time. Regions we do not bill in fall through to EUR.
const REGION_CURRENCY = {
  US: 'USD', CA: 'CAD', GB: 'GBP', CH: 'CHF',
  FR: 'EUR', BE: 'EUR', DE: 'EUR', ES: 'EUR', PT: 'EUR', IT: 'EUR',
  NL: 'EUR', IE: 'EUR', AT: 'EUR', LU: 'EUR', FI: 'EUR', GR: 'EUR',
};

// Timezones that are not the euro. Anything else under Europe/ is, and
// anything else under America/ is the dollar.
const TZ_CURRENCY = {
  'Europe/London': 'GBP', 'Europe/Belfast': 'GBP', 'Europe/Jersey': 'GBP',
  'Europe/Guernsey': 'GBP', 'Europe/Isle_of_Man': 'GBP',
  'Europe/Zurich': 'CHF', 'Europe/Bern': 'CHF', 'Europe/Vaduz': 'CHF',
  'America/Toronto': 'CAD', 'America/Vancouver': 'CAD', 'America/Edmonton': 'CAD',
  'America/Winnipeg': 'CAD', 'America/Halifax': 'CAD', 'America/St_Johns': 'CAD',
  'America/Montreal': 'CAD', 'America/Regina': 'CAD', 'America/Moncton': 'CAD',
};

/** Currency from where the browser thinks it is, or '' if it cannot say. */
function currencyFromTimeZone() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  if (!tz) return '';
  if (TZ_CURRENCY[tz]) return TZ_CURRENCY[tz];
  if (tz.startsWith('Europe/')) return 'EUR';
  if (tz.startsWith('America/')) return 'USD';
  return '';
}

/** Best guess at the currency for a new workspace, from the browser locale. */
export function detectCurrency() {
  try {
    // Timezone first, because it says where someone is; the browser's
    // language says what language they installed it in. Those disagree
    // constantly — Chrome set up in English reports en-US whoever you are,
    // so checking the language first billed a Belgian company in dollars and
    // no amount of switching the interface to French changed it. The clock
    // is the better signal, and it is the one the customer cannot get wrong.
    const fromTz = currencyFromTimeZone();
    if (fromTz) return fromTz;

    const langs = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
    for (const l of langs) {
      const region = (String(l).split('-')[1] || '').toUpperCase();
      if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region];
    }
  } catch { /* no navigator or Intl (tests, SSR) — fall through */ }
  return DEFAULT_CODE;
}

function savedCode() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}').currency || '';
    if (!raw) return '';
    // Stored as a code ('USD'). Older builds stored a label ('GBP (£)') or a
    // bare symbol, so both are still accepted on read.
    const upper = String(raw).toUpperCase();
    for (const code of Object.keys(BY_CODE)) if (upper.includes(code)) return code;
    const bySymbol = SUPPORTED_CURRENCIES.find(c => raw.includes(c.symbol.trim()));
    return bySymbol ? bySymbol.code : '';
  } catch { return ''; }
}

/** The workspace's currency code. An explicit choice always wins. */
export function getCurrencyCode() {
  return savedCode() || detectCurrency();
}

/**
 * The workspace's currency symbol.
 *
 * The `lang` parameter is accepted and ignored. Currency is a property of the
 * workspace, not of the interface language: a French finance team reporting in
 * dollars should not have their figures relabelled when someone switches the
 * UI to English. Kept in the signature because call sites pass it.
 */
export function getCurrency() {
  return (BY_CODE[getCurrencyCode()] || BY_CODE[DEFAULT_CODE]).symbol;
}

/** Format an amount for display in the workspace currency. No conversion. */
export function formatMoney(n) {
  const v = Number(n);
  return getCurrency() + (Number.isFinite(v) ? Math.round(v) : 0).toLocaleString();
}

/**
 * Round an amount for display. Named for what it does, because its predecessor
 * was called convertCurrency and silently applied an exchange rate.
 */
export function displayAmount(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v) : 0;
}
