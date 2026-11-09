// ── The Stripe prices each plan is sold at ─────────────────────────────────
//
// One list for the browser (Settings → Billing starts checkout with these
// ids). The server keeps its own copy, ALLOWED_PRICE_IDS and PLAN_MAP in
// functions/index.js, and refuses any other id; stripe-prices.test.js holds
// the two equal, so a price can never be offered here and refused there, or
// paid for and mapped to the wrong plan.
//
// Business (€149 a month, €1,430 a year) is the plan between Pro and
// Enterprise. Enterprise is no longer sold by card checkout (its card opens
// the contact form); its prices stay here because existing Enterprise
// subscriptions are billed on them.

export const PRICE_IDS = {
  starter:    { monthly: 'price_1TMhOt1yFs6IziIVgJGBbzoG', annual: 'price_1TMhfK1yFs6IziIVOtbhpy23' },
  hr_finance: { monthly: 'price_1TWxAB1yFs6IziIVjxw3CG2V', annual: 'price_1TWxFd1yFs6IziIVjPZnA8XT' },
  pro:        { monthly: 'price_1TMhNW1yFs6IziIV5hwlssrt', annual: 'price_1TMhNW1yFs6IziIVMxiacXD7' },
  business:   { monthly: null, annual: null },
  enterprise: { monthly: 'price_1TMhNk1yFs6IziIVPkv7RiLc', annual: 'price_1TMhNk1yFs6IziIViMLzewdQ' },
};

/** The plans a customer can buy by card from Settings → Billing. */
export const CHECKOUT_PLANS = ['starter', 'hr_finance', 'pro', 'business'];

export const priceIdFor = (plan, billing = 'monthly') =>
  CHECKOUT_PLANS.includes(plan) ? (PRICE_IDS[plan]?.[billing] || PRICE_IDS[plan]?.monthly || null) : null;
