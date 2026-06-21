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

export const CurrencyContext = React.createContext({ convert: (n) => '$' + Math.round(n), symbol: '$', rates: {} });

export function CurrencyProvider({ children }) {
  const converter = useCurrencyConverter();
  return React.createElement(CurrencyContext.Provider, { value: converter }, children);
}

export function useCurrency() {
  return React.useContext(CurrencyContext);
}
