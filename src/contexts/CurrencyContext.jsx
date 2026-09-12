/* eslint-disable react-refresh/only-export-components */
// ── Currency context: a thin wrapper over lib/currency, not a second one ────
//
// This file used to hold its own copy of the currency logic — a private
// fetchExchangeRates and a getCurrencyForLang that only knew about French, so
// Spanish, German and Portuguese users were shown dollars here while
// lib/currency showed them euros. Two implementations of money, drifted apart,
// in one app. That is the same defect class as the duplicated toCsv that broke
// the CSV export and the duplicated security metrics that made two screens
// disagree, and the duplicate-export test could not catch it because a private
// function is not an export.
//
// There is now exactly one implementation, in lib/currency.js. Everything here
// delegates to it. No rates are fetched: amounts are stored in the workspace
// currency and displayed as entered.

import React from 'react';
import { formatMoney, getCurrency, getCurrencyCode } from '../lib/currency';

/**
 * Marketing plan pricing.
 *
 * The contract price is in euros — that is what the Stripe price is
 * denominated in and what appears on the invoice. Quoting a visitor "$29" as
 * if it were the price was wrong, which is why an earlier pass hardcoded euros
 * for everyone; but showing a Californian €79 with no idea what that costs
 * them is its own kind of unhelpful.
 *
 * So both are shown: the euro price, and the visitor's local currency as an
 * explicit approximation. That is truthful whichever way Stripe's Adaptive
 * Pricing setting is switched — with it on, Stripe bills roughly the converted
 * figure; with it off, the customer is billed in euros and their bank converts
 * to roughly the same. Neither case makes the displayed number a lie, and the
 * display no longer depends on a dashboard toggle nobody is watching.
 *
 * The rates are indicative and deliberately static: they are for a "roughly
 * this much" line on a pricing page, not for billing, and a pricing page that
 * fetches exchange rates on load is a third party watching your visitors.
 */
const INDICATIVE_RATES = { USD: 1.08, GBP: 0.85, CHF: 0.94, CAD: 1.47, AUD: 1.63 };
const LOCAL_SYMBOL = { USD: '$', GBP: '£', CHF: 'CHF ', CAD: 'C$', AUD: 'A$' };

/** The visitor's likely currency, for the approximation only. */
function detectVisitorCurrency() {
  try {
    const langs = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
    const region = String(langs[0] || '').split('-')[1]?.toUpperCase();
    const byRegion = { US: 'USD', GB: 'GBP', CH: 'CHF', CA: 'CAD', AU: 'AUD' };
    if (region && byRegion[region]) return byRegion[region];
  } catch { /* no navigator — fall through to euros only */ }
  return null;
}

export function usePlanPricing() {
  const local = React.useMemo(() => detectVisitorCurrency(), []);
  const format = React.useCallback(
    (amount) => '€' + Number(amount || 0).toLocaleString(),
    []
  );
  /** "≈ $85" for a visitor we can place, otherwise nothing. */
  const approx = React.useCallback((amount) => {
    const n = Number(amount || 0);
    if (!local || !n) return null;
    const converted = Math.round(n * INDICATIVE_RATES[local]);
    return `≈ ${LOCAL_SYMBOL[local]}${converted.toLocaleString()}`;
  }, [local]);

  return { code: 'EUR', symbol: '€', isLocal: false, localCode: local, format, approx };
}

/** The workspace currency, for components that want it from context. */
export function useCurrencyConverter() {
  const [code, setCode] = React.useState(getCurrencyCode);

  // Settings writes the currency to localStorage, which fires no event in the
  // tab that made the change. Re-read on focus so a change in Settings is
  // reflected without a reload.
  React.useEffect(() => {
    const refresh = () => setCode(getCurrencyCode());
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return React.useMemo(() => ({
    code,
    symbol: getCurrency(),
    // Kept named `convert` because call sites use it, but it no longer
    // converts — it formats an amount already in the workspace currency.
    convert: (amount) => formatMoney(amount),
    ready: true,
  }), [code]);
}

export const CurrencyContext = React.createContext({
  code: 'EUR',
  symbol: '€',
  convert: (n) => formatMoney(n),
  ready: true,
});

export function CurrencyProvider({ children }) {
  const value = useCurrencyConverter();
  return React.createElement(CurrencyContext.Provider, { value }, children);
}

export function useCurrency() {
  return React.useContext(CurrencyContext);
}
