import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PRICE_IDS, CHECKOUT_PLANS, priceIdFor } from './stripePrices';
import { PLAN_CARDS } from './planCards';

// ── The browser's price list and the server's are one list ─────────────────
//
// Settings → Billing starts checkout with an id from src/lib/stripePrices.js;
// createCheckout refuses any id not in ALLOWED_PRICE_IDS, and the webhook
// turns the paid id into a plan through PLAN_MAP (functions/index.js). A price
// offered here and missing there is a checkout that fails; a price mapped to
// the wrong plan is a customer charged for one plan and given another.

const index = readFileSync(resolve(process.cwd(), 'functions/index.js'), 'utf8');
const allowed = new Set(/const ALLOWED_PRICE_IDS = new Set\(\[([\s\S]*?)\]\)/.exec(index)[1].match(/price_[A-Za-z0-9]+/g));
const planMap = Object.fromEntries([.../const PLAN_MAP = \{([\s\S]*?)\n\s*\};/.exec(index)[1].matchAll(/'(price_[A-Za-z0-9]+)':\s*'([a-z_]+)'/g)].map((m) => [m[1], m[2]]));

describe('Stripe prices', () => {
  it('every plan sold by card has a monthly and a yearly price', () => {
    for (const plan of CHECKOUT_PLANS) {
      expect(PRICE_IDS[plan]?.monthly, `${plan} monthly`).toMatch(/^price_/);
      expect(PRICE_IDS[plan]?.annual, `${plan} annual`).toMatch(/^price_/);
      expect(PRICE_IDS[plan].monthly).not.toBe(PRICE_IDS[plan].annual);
    }
  });

  it('every price the browser offers, the server accepts and maps to the same plan', () => {
    for (const [plan, ids] of Object.entries(PRICE_IDS)) {
      for (const id of [ids.monthly, ids.annual].filter(Boolean)) {
        expect(allowed.has(id), `${id} (${plan}) is not in ALLOWED_PRICE_IDS`).toBe(true);
        expect(planMap[id], `${id} maps to ${planMap[id]}, not ${plan}`).toBe(plan);
      }
    }
  });

  it('Enterprise is not sold by card; every other paid card is', () => {
    expect(priceIdFor('enterprise')).toBeNull();
    for (const card of PLAN_CARDS.filter((c) => c.monthly > 0)) {
      expect(!!card.contact, card.id).toBe(!CHECKOUT_PLANS.includes(card.id));
    }
  });
});
