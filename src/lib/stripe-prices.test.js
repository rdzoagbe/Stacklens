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
    for (const plan of CHECKOUT_PLANS) {
      const ids = PRICE_IDS[plan];
      for (const id of [ids.monthly, ids.annual].filter(Boolean)) {
        expect(allowed.has(id), `${id} (${plan}) is not in ALLOWED_PRICE_IDS`).toBe(true);
        expect(planMap[id], `${id} maps to ${planMap[id]}, not ${plan}`).toBe(plan);
      }
    }
  });

  it('the server accepts no price the browser does not offer (Enterprise is agreed by conversation)', () => {
    const offered = new Set(CHECKOUT_PLANS.flatMap((p) => [PRICE_IDS[p].monthly, PRICE_IDS[p].annual]));
    expect([...allowed].sort()).toEqual([...offered].sort());
    for (const id of [PRICE_IDS.enterprise?.monthly, PRICE_IDS.enterprise?.annual].filter(Boolean)) {
      expect(allowed.has(id)).toBe(false);
      expect(planMap[id], 'existing Enterprise subscriptions still map').toBe('enterprise');
    }
  });

  it('pro_since follows the plan: set on becoming Pro, cleared otherwise and on cancellation', () => {
    expect(index).toMatch(/async function proSinceUpdate\(ref, plan, sub\)/);
    expect(index).toMatch(/if \(plan !== 'pro'\) return \{ pro_since: null \}/);
    expect((index.match(/\.\.\.\(await proSinceUpdate\(ref, plan, sub\)\)/g) || []).length).toBe(2);
    expect(index).toMatch(/plan: 'free', subscription_status: 'cancelled'[^}]*pro_since: null/);
    expect(index).not.toMatch(/subscription_started_at/);
  });

  it('a shared workspace carries the owner\'s pro_since, so members count against the same limit', () => {
    expect(index).toMatch(/pro_since: Number\(planSource\.pro_since\) \|\| null/);
  });

  it('every yearly price is ten months for twelve ("2 months free")', () => {
    for (const card of PLAN_CARDS.filter((c) => CHECKOUT_PLANS.includes(c.id))) {
      expect(card.annual, `${card.id} annual`).toBe(card.monthly * 10);
    }
  });

  it('Enterprise is not sold by card; every other paid card is', () => {
    expect(priceIdFor('enterprise')).toBeNull();
    for (const card of PLAN_CARDS.filter((c) => c.monthly > 0)) {
      expect(!!card.contact, card.id).toBe(!CHECKOUT_PLANS.includes(card.id));
    }
  });
});
