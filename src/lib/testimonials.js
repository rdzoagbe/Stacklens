// ── What customers say, published only with their written agreement ────────
//
// Empty until a real customer has approved a quote. The section that shows
// these (components/Testimonials.jsx) renders nothing while the list is empty,
// so the site never carries a placeholder, a made-up name or an invented
// figure; testimonials.test.js fails the build if an entry below lacks the
// consent that allows it.
//
// Adding one (docs/outreach/preuves-clients.md has the process and the email
// that collects the agreement):
//
//   {
//     id: 'cabinet-martin-2026-10',
//     person: { name: 'Claire Martin', role: { fr: 'Expert-comptable associée', en: 'Partner, chartered accountant' } },
//     firm: { name: 'Cabinet Martin', city: 'Lyon', logo: '/proof/cabinet-martin.svg' },
//     original: 'fr',                          // the language the quote was given in
//     quote: { fr: '« … »', en: '"…"' },       // fr verbatim as approved; en approved too
//     result: { fr: '…', en: '…' },            // optional: a figure they measured and approved
//     context: 'early_access',                 // or 'customer' — early access is disclosed
//     consent: {
//       date: '2026-10-12',                    // when they approved the exact text
//       scope: ['name', 'role', 'firm', 'quote'],  // + 'logo', 'result' when agreed
//       approvedVerbatim: true,                // they saw the text exactly as published
//       proof: 'email du 12/10/2026, archivé', // where the agreement is kept
//     },
//   }
//
// Without 'name' in the scope the author is shown by role and city only.
// Withdrawal: delete the entry and redeploy, the day it is asked.

export const TESTIMONIALS = [];

const SCOPES = ['name', 'role', 'firm', 'quote', 'logo', 'result'];
const CONTEXTS = ['early_access', 'customer'];
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

/**
 * The reasons an entry may not be published; [] when it may.
 * Deliberately strict: a testimonial is a statement made in someone else's
 * name, so anything missing is a reason not to show it.
 */
export function problemsWith(t) {
  const p = [];
  if (!t || typeof t !== 'object') return ['not an object'];
  if (!nonEmpty(t.id)) p.push('id');
  const c = t.consent || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(c.date || ''))) p.push('consent.date (YYYY-MM-DD)');
  if (c.approvedVerbatim !== true) p.push('consent.approvedVerbatim must be true');
  if (!nonEmpty(c.proof)) p.push('consent.proof');
  const scope = Array.isArray(c.scope) ? c.scope : [];
  if (!scope.includes('quote')) p.push("consent.scope must include 'quote'");
  if (scope.some((s) => !SCOPES.includes(s))) p.push('consent.scope has an unknown entry');
  if (!CONTEXTS.includes(t.context)) p.push("context must be 'early_access' or 'customer'");
  if (!['fr', 'en'].includes(t.original) || !nonEmpty(t.quote?.[t.original])) p.push('quote in its original language');
  if (!nonEmpty(t.person?.role?.fr) && !nonEmpty(t.person?.role?.en)) p.push('person.role');
  if (scope.includes('name') && !nonEmpty(t.person?.name)) p.push('person.name (scope includes name)');
  if (!scope.includes('name') && nonEmpty(t.person?.name)) p.push('person.name given without consent to publish it');
  if (t.firm?.logo && !scope.includes('logo')) p.push('firm.logo without consent to show it');
  if (t.result && !scope.includes('result')) p.push('result without consent to publish it');
  if (scope.includes('firm') && !nonEmpty(t.firm?.name)) p.push('firm.name (scope includes firm)');
  return p;
}

export const publishable = (t) => problemsWith(t).length === 0;

/** What a visitor in `lang` sees for one entry, with only what consent covers. */
export function presentTestimonial(t, lang = 'fr') {
  const scope = t.consent.scope;
  const pickLang = (o) => (o ? (o[lang] || o[t.original] || o.fr || o.en || '') : '');
  return {
    id: t.id,
    quote: pickLang(t.quote),
    // Shown in the language it was given in when no approved translation exists.
    lang: t.quote[lang] ? lang : t.original,
    name: scope.includes('name') ? t.person.name : null,
    role: pickLang(t.person.role),
    firm: scope.includes('firm') ? t.firm?.name || null : null,
    city: t.firm?.city || null,
    logo: scope.includes('logo') ? t.firm?.logo || null : null,
    result: scope.includes('result') ? pickLang(t.result) : null,
    earlyAccess: t.context === 'early_access',
  };
}
