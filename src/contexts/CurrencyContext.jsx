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
 * Marketing plan pricing, which is a different thing from the workspace
 * currency and deliberately stays in euros.
 *
 * The Stripe prices behind the plan cards are euro-denominated, so quoting a
 * visitor "$29" was the one figure checkout could not honour — they would be
 * charged €29. This must keep matching Stripe, not the visitor's locale, until
 * USD prices exist in Stripe.
 */
export function usePlanPricing() {
  const symbol = '€';
  const format = React.useCallback(
    (amount) => symbol + Number(amount || 0).toLocaleString(),
    [symbol]
  );
  return { code: 'EUR', symbol, isLocal: false, format };
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
