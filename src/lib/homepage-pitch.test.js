import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PAGE_SEO } from './seo';

// ── The homepage has to say who it is for ─────────────────────────────────
//
// For four days the pivot to the accountant channel lived on two new pages
// while the homepage kept pitching the old persona — "the one person chasing
// invoices" — to whoever landed on /. The founder's ask was direct: make the
// landing page reflect it, say who it is for, make it catchy.
//
// So the hero now names the buyer, leads with the free audit (no account, no
// upload, the core claim demonstrated), and a section beneath it names BOTH
// audiences and sends each where it belongs. This pins that structure so the
// homepage cannot quietly drift back to a single, unnamed reader.

const page = () => readFileSync(resolve(process.cwd(), 'src/pages/TrialPage.jsx'), 'utf8');
const tr = () => readFileSync(resolve(process.cwd(), 'src/translations.js'), 'utf8');
const en = (key) => {
  const at = tr().indexOf(key + ': "');
  if (at < 0) return '';
  const from = at + key.length + 3;
  return tr().slice(from, tr().indexOf('",\n', from));
};

describe('the hero says who it is for and what to do first', () => {
  it('the badge names the accountant channel', () => {
    expect(en('lp_hero_badge').toLowerCase()).toMatch(/accountant|expert/);
  });

  it('the headline is the accountant pitch, not the old one', () => {
    expect(en('lp_hero_h1_line1')).not.toMatch(/Stop SaaS drift/);
    expect(en('lp_hero_h1_line1') + ' ' + en('lp_hero_h1_line2'))
      .toMatch(/receipts|clients/i);
  });

  it('the body no longer addresses only the overwhelmed ops person', () => {
    // That line still exists — it moved into the SMB card below, where it
    // belongs. It must not be the hero body, which now speaks to the buyer.
    expect(en('lp_hero_body')).not.toMatch(/one person chasing/i);
    expect(en('lp_hero_body')).toMatch(/fifty/i);
  });

  it('the primary CTA is the free audit, as a link, not a sign-up modal', () => {
    const src = page();
    const hero = src.slice(src.indexOf('{/* ── HERO ── */}'), src.indexOf("{/* ── WHO IT'S FOR ── "));
    expect(hero, 'the hero must exist between those markers').not.toBe('');
    const firstCta = hero.indexOf('<Link to="/audit-saas"');
    const startBtn = hero.indexOf("t('lp_cta_start')");
    expect(firstCta, 'no audit link in the hero').toBeGreaterThan(-1);
    expect(firstCta, 'the audit must come before Start free').toBeLessThan(startBtn);
  });

  it('keeps the free-plan fine print, which plan-claims.test.js pins to the real limits', () => {
    expect(page()).toMatch(/t\('lp_hero_fine_print'\)/);
  });
});

describe('the audience section names both buyers and routes each', () => {
  const src = () => {
    const s = page();
    return s.slice(s.indexOf("{/* ── WHO IT'S FOR ── "), s.indexOf('{/* ── TRUST SIGNALS ── */}'));
  };

  it('exists, between the hero and the trust strip', () => {
    expect(src().length).toBeGreaterThan(500);
  });

  it('sends accountants to their page', () => {
    expect(src()).toMatch(/<Link to="\/experts-comptables"/);
    expect(src()).toMatch(/lp_who_acct_title/);
  });

  it('sends SMB leads to sign-up, not to the accountant page', () => {
    // Sliced from the card's opening tag, not its eyebrow text: the onClick
    // that opens sign-up sits on the <button> BEFORE the eyebrow renders. A
    // first version sliced from the eyebrow and failed on correct code.
    const smb = src().slice(src().indexOf("location: 'who_smb'"));
    expect(smb).toMatch(/setShowAuth\(true\)/);
    expect(smb).not.toMatch(/experts-comptables/);
  });

  it('the SMB card carries the persona line the hero used to', () => {
    expect(en('lp_who_smb_title')).toMatch(/one person chasing/i);
  });

  it('every key it renders exists in English and French', () => {
    const keys = [...new Set([...src().matchAll(/\bt\('([a-z0-9_]+)'/g)].map(m => m[1]))];
    expect(keys.length).toBeGreaterThan(8);
    for (const k of [...keys, 'lp_cta_audit', 'lp_hero_badge', 'lp_hero_h1_line1', 'lp_hero_h1_line2', 'lp_hero_body']) {
      expect(tr().split(k + ':').length - 1, `${k} needs EN and FR`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('search results say the same thing the page does', () => {
  it('the homepage title and description name the accountant channel', () => {
    expect(PAGE_SEO['/'].title).toMatch(/accountant/i);
    expect(PAGE_SEO['/'].description).toMatch(/audit/i);
    // seo.test.js holds the length and uniqueness rules; this only checks
    // the positioning did not stay on the old line.
    expect(PAGE_SEO['/'].description).not.toMatch(/clarity layer/);
  });
});
