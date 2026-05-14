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

export function getCurrency(lang) {
  try {
    const activeLang = lang || localStorage.getItem('language') || 'en';
    if (activeLang === 'fr') return '€';
    const settings = JSON.parse(localStorage.getItem('sg_general') || '{}');
    if (settings.currency) {
      if (settings.currency.includes('£')) return '£';
      if (settings.currency.includes('€')) return '€';
      if (settings.currency.includes('¥')) return '¥';
    }
    return '$';
  } catch { return '$'; }
}

export function convertCurrency(amountUSD, lang) {
  try {
    const cached = JSON.parse(localStorage.getItem(CURRENCY_CACHE_KEY) || '{}');
    const rates = cached.rates || { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5 };
    const activeLang = lang || localStorage.getItem('language') || 'en';
    const settings = JSON.parse(localStorage.getItem('sg_general') || '{}');
    let code = 'USD';
    if (settings.currency?.includes('£')) code = 'GBP';
    else if (settings.currency?.includes('€')) code = 'EUR';
    else if (settings.currency?.includes('¥')) code = 'JPY';
    else if (activeLang === 'fr') code = 'EUR';
    const rate = rates[code] || 1;
    return Math.round(amountUSD * rate);
  } catch { return Math.round(amountUSD); }
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
