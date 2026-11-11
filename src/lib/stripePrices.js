// ── The Stripe prices each plan is sold at ─────────────────────────────────
//
// One list for the browser (Settings → Billing starts checkout with these
// ids). The server keeps its own copy, ALLOWED_PRICE_IDS and PLAN_MAP in
// functions/index.js, and refuses any other id; stripe-prices.test.js holds
// the two equal, so a price can never be offered here and refused there, or
// paid for and mapped to the wrong plan.
//
// Starter is €39 a month since 2026-11-11 (it was €29). Every yearly price is
// ten months for twelve ("2 months free"): Starter €390, Pro and Cabinet €790,
// Business €1,490. Earlier prices stay in PLAN_MAP for subscriptions billed
// on them.
//
// Business (€149 a month, €1,490 a year) is the plan between Pro and
// Enterprise. Enterprise is no longer sold by card checkout (its card opens
// the contact form); its prices stay here because existing Enterprise
// subscriptions are billed on them.

export const PRICE_IDS = {
  starter:    { monthly: 'price_1UaPKj1yFs6IziIV6MqK7gyb', annual: 'price_1UaQ951yFs6IziIVA1tgIyMk' },
  hr_finance: { monthly: 'price_1TWxAB1yFs6IziIVjxw3CG2V', annual: 'price_1TWxFd1yFs6IziIVjPZnA8XT' },
  pro:        { monthly: 'price_1TMhNW1yFs6IziIV5hwlssrt', annual: 'price_1UaQ951yFs6IziIVuBTWbOIR' },
  cabinet:    { monthly: 'price_1UaFkM1yFs6IziIVL2Y9VxOO', annual: 'price_1UaQ951yFs6IziIVv8OziTFl' },
  business:   { monthly: 'price_1UZsKz1yFs6IziIVtDrqBwBb', annual: 'price_1UaQ951yFs6IziIVvzfXxMQu' },
  enterprise: { monthly: 'price_1TMhNk1yFs6IziIVPkv7RiLc', annual: 'price_1TMhNk1yFs6IziIViMLzewdQ' },
};

/** The plans a customer can buy by card from Settings → Billing. */
// HR & Finance is no longer sold (merged into Starter on 2026-11-10); its
// prices stay above and in PLAN_MAP for the subscriptions billed on them.
export const CHECKOUT_PLANS = ['starter', 'pro', 'cabinet', 'business'];

export const priceIdFor = (plan, billing = 'monthly') =>
  CHECKOUT_PLANS.includes(plan) ? (PRICE_IDS[plan]?.[billing] || PRICE_IDS[plan]?.monthly || null) : null;
