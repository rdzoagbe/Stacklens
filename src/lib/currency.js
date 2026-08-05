// ── Currency functions ─────────────────────────────────────────────
// Handles currency display, conversion, and exchange rate fetching.

const CURRENCY_CACHE_KEY = 'accessguard_fx_rates';
const CACHE_TTL = 3600000; // 1 hour

export function formatMoney(n, currency, lang) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return (currency || getCurrency(lang)) + '0';
  const cur = currency || getCurrency(lang);
  const converted = convertCurrency(v, lang);
  return cur + converted.toLocaleString();
}

// Languages whose speakers are billed in euros. Stacklens sells to European
// SMBs, so every European language defaults to EUR — German and Portuguese
// used to fall through to "$", which is simply wrong for those markets.
// An explicit choice in Settings > General always wins over the language.
const EURO_LANGUAGES = new Set(['fr', 'es', 'de', 'pt']);

function activeLanguage(lang) {
  try { return lang || localStorage.getItem('language') || 'en'; }
  catch { return lang || 'en'; }
}

function settingsCurrency() {
  try { return JSON.parse(localStorage.getItem('sg_general') || '{}').currency || ''; }
  catch { return ''; }
}

export function getCurrency(lang) {
  const chosen = settingsCurrency();
  if (chosen.includes('£')) return '£';
  if (chosen.includes('€')) return '€';
  if (chosen.includes('¥')) return '¥';
  if (chosen.includes('$')) return '$';
  return EURO_LANGUAGES.has(activeLanguage(lang)) ? '€' : '$';
}

export function convertCurrency(amountUSD, lang) {
  try {
    const cached = JSON.parse(localStorage.getItem(CURRENCY_CACHE_KEY) || '{}');
    const rates  = cached.rates || { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5 };
    const symbol = getCurrency(lang);
    const code   = { '£': 'GBP', '€': 'EUR', '¥': 'JPY', '$': 'USD' }[symbol] || 'USD';
    return Math.round((Number(amountUSD) || 0) * (rates[code] || 1));
  } catch { return Math.round(Number(amountUSD) || 0); }
}

export async function fetchExchangeRates(base = 'USD') {
  try {
    const cached = JSON.parse(localStorage.getItem(CURRENCY_CACHE_KEY) || '{}');
    if (cached.rates && Date.now() - cached.ts < CACHE_TTL) return cached.rates;
    const res = await fetch('https://open.er-api.com/v6/latest/' + base);
    const data = await res.json();
    if (data.rates) {
      localStorage.setItem(CURRENCY_CACHE_KEY, JSON.stringify({ rates: data.rates, ts: Date.now() }));
      return data.rates;
    }
    return cached.rates || { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5 };
  } catch {
    return { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5 };
  }
}
