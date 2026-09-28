import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { TESTIMONIALS, problemsWith, publishable, presentTestimonial } from './testimonials';
import { Testimonials } from '../components/Testimonials';

// ── Testimonials: real, consented, or absent ───────────────────────────────
//
// A testimonial is a statement published in someone else's name. French
// consumer law treats an invented or unauthorised one as a misleading
// commercial practice, and a firm that finds its name on our site without
// having agreed is a customer lost. So the list is empty until a real quote
// is approved, every entry must carry the consent that allows it, and the
// section shows nothing — not a placeholder — while there is none.

/* eslint-disable security/detect-non-literal-fs-filename -- fixed repo paths. */
const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const valid = () => ({
  id: 'cabinet-test-2026-10',
  person: { name: 'Claire Martin', role: { fr: 'Expert-comptable associée', en: 'Partner' } },
  firm: { name: 'Cabinet Martin', city: 'Lyon' },
  original: 'fr',
  quote: { fr: '« Nous avons trouvé trois abonnements oubliés chez un client. »' },
  context: 'early_access',
  consent: { date: '2026-10-12', scope: ['name', 'role', 'firm', 'quote'], approvedVerbatim: true, proof: 'email du 12/10/2026' },
});

describe('what is on the site', () => {
  it('every published entry carries the consent that allows it', () => {
    for (const t of TESTIMONIALS) expect(problemsWith(t), t?.id).toEqual([]);
  });

  it('both pages mount the section, and nothing else pretends to be one', () => {
    expect(read('src/pages/TrialPage.jsx')).toMatch(/<Testimonials t=\{t\} language=\{language\} \/>/);
    expect(read('src/pages/AccountantsPage.jsx')).toMatch(/<Testimonials t=\{t\} language=\{language\} \/>/);
    // The old stub rotated through an empty list on a five-second timer.
    expect(read('src/pages/TrialPage.jsx')).not.toMatch(/setCurrentTestimonial|testimonials\.length/);
    for (const f of ['src/lib/testimonials.js', 'src/components/Testimonials.jsx']) {
      const code = read(f).replace(/\/\/.*$/gm, '');
      expect(code, f).not.toMatch(/John Doe|Jane Doe|Lorem|ipsum|Acme/i);
    }
  });
});

describe('an entry is refused when consent does not cover it', () => {
  it('a complete entry passes', () => expect(problemsWith(valid())).toEqual([]));

  it.each([
    ['no consent at all', (t) => { delete t.consent; }],
    ['text not approved as published', (t) => { t.consent.approvedVerbatim = false; }],
    ['no record of where the agreement is kept', (t) => { t.consent.proof = ''; }],
    ['no date', (t) => { t.consent.date = 'last week'; }],
    ['quote not in the scope', (t) => { t.consent.scope = ['name', 'role', 'firm']; }],
    ['a name published without agreement', (t) => { t.consent.scope = ['role', 'firm', 'quote']; }],
    ['a logo without agreement', (t) => { t.firm.logo = '/proof/x.svg'; }],
    ['a figure without agreement', (t) => { t.result = { fr: '1 200 € économisés' }; }],
    ['early access not stated either way', (t) => { delete t.context; }],
    ['no quote in its original language', (t) => { t.original = 'en'; }],
  ])('%s', (_label, mutate) => {
    const t = valid(); mutate(t);
    expect(publishable(t)).toBe(false);
  });
});

describe('what a visitor sees', () => {
  it('only what the consent covers: no name without "name"', () => {
    // Even if a name were left in the entry, it is not shown without consent.
    const t = valid();
    t.consent.scope = ['role', 'firm', 'quote'];
    const shown = presentTestimonial(t, 'fr');
    expect(shown.name).toBeNull();
    expect(shown.firm).toBe('Cabinet Martin');
  });

  it('the original words when no approved translation exists', () => {
    const shown = presentTestimonial(valid(), 'en');
    expect(shown.quote).toContain('trois abonnements');
    expect(shown.lang).toBe('fr');
  });
});

describe('the section', () => {
  let host, root;
  const t = (k) => ({ proof_title: 'What firms say', proof_note: 'Real customers.', proof_note_early_access: 'NOTE-EARLY-ACCESS', proof_early_access_label: 'LABEL-EARLY-ACCESS' }[k] || k);
  const render = async (items) => {
    host = document.createElement('div'); document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<Testimonials t={t} language="en" items={items} />));
  };
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

  it('renders nothing at all while there is no real quote', async () => {
    await render([]);
    expect(host.innerHTML).toBe('');
  });

  it('drops an entry that is not publishable rather than show it', async () => {
    const bad = valid(); bad.consent.approvedVerbatim = false;
    await render([bad]);
    expect(host.innerHTML).toBe('');
  });

  it('shows a consented quote and discloses early access', async () => {
    await render([valid()]);
    expect(host.textContent).toContain('Claire Martin');
    expect(host.textContent).toContain('trois abonnements');
    expect(host.querySelector('figcaption').textContent).toContain('LABEL-EARLY-ACCESS');
    expect(host.textContent).toContain('NOTE-EARLY-ACCESS');
    expect(host.querySelector('blockquote').getAttribute('lang')).toBe('fr');
  });
});
