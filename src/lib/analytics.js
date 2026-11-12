// Product analytics — thin wrapper over gtag (Google Analytics 4).
// Consent Mode v2 (index.html) gates everything: while consent is denied GA
// receives cookieless pings only; after the user accepts, full events flow.
// track() must never throw or block — analytics can never break the product.
// The events the anonymous counter knows (lib/pulse.js) are counted there too,
// by name only: the params never leave for it.
import { pulse } from './pulse';

export function track(event, params = {}) {
  pulse(event);
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', event, params);
    }
  } catch { /* never let analytics break the app */ }
}
