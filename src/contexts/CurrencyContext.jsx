/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { useLang } from './LangContext';

const CURRENCY_CACHE_KEY = 'accessguard_fx_rates';
const CACHE_TTL = 3600000; // 1 hour

async function fetchExchangeRates(base = 'USD') {
  try {
    const cached = JSON.parse(localStorage.getItem(CURRENCY_CACHE_KEY) || '{}');
    if (cached.rates && cached.ts && Date.now() - cached.ts < CACHE_TTL) return cached.rates;
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    const data = await res.json();
    if (data.rates) {
      localStorage.setItem(CURRENCY_CACHE_KEY, JSON.stringify({ rates: data.rates, ts: Date.now() }));
      return data.rates;
    }
  } catch (e) {
    console.warn('Exchange rate fetch failed:', e);
  }
  return { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5, CAD: 1.36 };
}

function getCurrencyForLang(lang) {
  const settings = JSON.parse(localStorage.getItem('sg_general') || '{}');
  if (settings.currency) {
    if (settings.currency.includes('£')) return { code: 'GBP', symbol: '£' };
    if (settings.currency.includes('€')) return { code: 'EUR', symbol: '€' };
    if (settings.currency.includes('¥')) return { code: 'JPY', symbol: '¥' };
  }
  if (lang === 'fr') return { code: 'EUR', symbol: '€' };
  return { code: 'USD', symbol: '$' };
}

export function useCurrencyConverter() {
  const { language } = useLang();
  const [rates, setRates] = React.useState({ USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5 });
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    fetchExchangeRates('USD').then(r => { setRates(r); setReady(true); });
  }, []);

  const convert = React.useCallback((amountUSD, lang) => {
    const activeLang = lang || language;
    const { code, symbol } = getCurrencyForLang(activeLang);
    const rate = rates[code] || 1;
    return symbol + Math.round(amountUSD * rate).toLocaleString();
  }, [rates, language]);

  const symbol = React.useMemo(() => getCurrencyForLang(language).symbol, [language]);

  return { convert, symbol, rates, ready };
}

// ── Marketing plan pricing — display prices in the visitor's local currency ──
// Plan prices are set in EUR (and billed in the customer's local currency at
// checkout via Stripe Adaptive Pricing). This detects the visitor's likely
// currency from their browser locale so the marketing pricing matches what
// they'll actually be charged.
const REGION_CURRENCY = {
  US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', JP: 'JPY',
  CH: 'CHF', SG: 'SGD', HK: 'HKD', IN: 'INR', BR: 'BRL', MX: 'MXN',
  AE: 'AED', ZA: 'ZAR', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN',
};
const CURRENCY_SYMBOL = {
  USD: '$', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$', NZD: 'NZ$', JPY: '¥',
  CHF: 'CHF ', SGD: 'S$', HKD: 'HK$', INR: '₹', BRL: 'R$', MXN: 'MX$',
  AED: 'AED ', ZAR: 'R', SEK: 'kr', NOK: 'kr', DKK: 'kr', PLN: 'zł',
};
const PRICING_FX_KEY = 'sg_pricing_fx_eur';

export function detectPricingCurrency() {
  try {
    const langs = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
    for (const l of langs) {
      const region = (String(l).split('-')[1] || '').toUpperCase();
      if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region];
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.startsWith('America/')) return 'USD';
    if (tz === 'Europe/London') return 'GBP';
  } catch { /* ignore — fall through to EUR */ }
  return 'EUR';
}

async function fetchEurRates() {
  try {
    const cached = JSON.parse(localStorage.getItem(PRICING_FX_KEY) || '{}');
    if (cached.rates && cached.ts && Date.now() - cached.ts < CACHE_TTL) return cached.rates;
    const res = await fetch('https://open.er-api.com/v6/latest/EUR');
    const data = await res.json();
    if (data.rates) {
      localStorage.setItem(PRICING_FX_KEY, JSON.stringify({ rates: data.rates, ts: Date.now() }));
      return data.rates;
    }
  } catch { /* offline / blocked — fall back to EUR display */ }
  return null;
}

// Returns { code, symbol, isLocal, format(eurAmount) } for marketing plan prices.
// Currency follows the app language so it updates live when the user switches:
// French → EUR, English → USD. (Stripe still bills each customer in their own
// local currency at checkout via Adaptive Pricing.)
export function usePlanPricing() {
  const { language } = useLang();
  const code = language === 'fr' ? 'EUR' : 'USD';
  const [rates, setRates] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    if (code !== 'EUR') fetchEurRates().then(r => { if (alive) setRates(r); });
    return () => { alive = false; };
  }, [code]);

  const symbol = CURRENCY_SYMBOL[code] || '€';
  const format = React.useCallback((eur) => {
    if (code === 'EUR' || !rates || !rates[code]) return '€' + eur;
    if (eur === 0) return symbol + '0';
    const local = eur * rates[code];
    // round JPY-like currencies to nearest 10, others to nearest whole unit
    const rounded = code === 'JPY' ? Math.round(local / 10) * 10 : Math.round(local);
    return symbol + rounded.toLocaleString();
  }, [rates, code, symbol]);

  return { code, symbol, isLocal: code !== 'EUR', format };
}

export const CurrencyContext = React.createContext({ convert: (n) => '$' + Math.round(n), symbol: '$', rates: {} });

export function CurrencyProvider({ children }) {
  const converter = useCurrencyConverter();
  return React.createElement(CurrencyContext.Provider, { value: converter }, children);
}

export function useCurrency() {
  return React.useContext(CurrencyContext);
}
