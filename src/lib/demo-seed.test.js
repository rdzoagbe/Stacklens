import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { buildSeedDb, DEMO_EMAIL } from './db';
import { computeWaste, monthlySpend } from './waste';
import { spendTrend, previousMonthSpend, monthKey } from './budget';
import { translations } from '../translations';

// ── The demo tells the story the product sells ─────────────────────────────
//
// The demo showed "Dépenses gaspillées 0 €" and "Économies potentielles 0 €"
// beside a banner about ex-employees, and an empty spend trend: no tool in the
// seed was paid for with nobody able to log in, and the seed had no history.
// It also showed the account as demo@accessguard.app, the product's former
// name, and "Quitter le démo".

/* eslint-disable security/detect-non-literal-fs-filename --
   every path here comes from walking this repository's own src/ tree. */

describe('the demo workspace', () => {
  const seed = buildSeedDb();

  it('has recoverable spend, measured the way every customer’s is', () => {
    const waste = computeWaste(seed);
    expect(waste.recoverable).toBeGreaterThan(0);
    // Only tools nobody holds an active access to: Loom, whose two users left.
    expect(waste.unusedTools.map(t => t.name)).toEqual(['Loom']);
    expect(waste.recoverable).toBe(seed.tools.find(t => t.name === 'Loom').cost_per_month);
  });

  it('has a spend trend and a previous month to compare with', () => {
    const trend = spendTrend(seed, monthlySpend(seed));
    expect(trend).toHaveLength(6);
    expect(trend.map(p => p.month)).toEqual([...trend.map(p => p.month)].sort());
    expect(trend[trend.length - 1].month).toBe(monthKey());
    expect(previousMonthSpend(seed)).toBeGreaterThan(0);
    // Past months only: the current month is always the live figure.
    expect(seed.spend_history.every(s => s.month < monthKey())).toBe(true);
  });

  it('uses a reserved address, never the product’s former name', () => {
    expect(seed.user.email).toBe(DEMO_EMAIL);
    expect(DEMO_EMAIL).toMatch(/\.example$/);
  });
});

describe('no screen shows the former name in an address', () => {
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  it('src/ has no accessguard.app outside tests', () => {
    const offenders = walk(resolve(process.cwd(), 'src'))
      .filter(p => /\.(jsx?|tsx?)$/.test(p) && !/\.test\./.test(p))
      .filter(p => readFileSync(p, 'utf8').includes('accessguard.app'));
    expect(offenders).toEqual([]);
  });
});

describe('French copy', () => {
  it('« la démo », as French says it', () => {
    expect(translations.fr.exit_demo).toBe('Quitter la démo');
    const frValues = Object.values(translations.fr).join('\n');
    expect(frValues).not.toMatch(/\b(le|du|un|ce) démo\b/);
  });
});

describe('landing hero buttons', () => {
  it('keep each label on one line from the tablet width up', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/TrialPage.jsx'), 'utf8');
    for (const key of ['lp_cta_audit', 'lp_cta_start', 'lp_cta_demo']) {
      const at = page.indexOf(`{t('${key}')}`);
      const tag = page.slice(page.lastIndexOf('className=', at), at);
      expect(tag, key).toMatch(/whitespace-nowrap/);
    }
  });
});
