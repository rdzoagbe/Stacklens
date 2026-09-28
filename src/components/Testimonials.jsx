import React from 'react';
import { Quote } from 'lucide-react';
import { TESTIMONIALS, publishable, presentTestimonial } from '../lib/testimonials';

// Real customers' words, with their agreement, or nothing at all. While
// TESTIMONIALS is empty this renders null: no placeholder, no "coming soon",
// no invented name. Entries that fail problemsWith() are dropped rather than
// shown half-consented (testimonials.test.js keeps any from reaching main).
//
// `items` is for tests; the site always uses TESTIMONIALS.
export function Testimonials({ t, language, items = TESTIMONIALS }) {
  const shown = items.filter(publishable).map((x) => presentTestimonial(x, language));
  if (!shown.length) return null;
  const anyEarlyAccess = shown.some((s) => s.earlyAccess);

  return (
    <section className="relative z-10 py-20 px-6 border-t border-slate-900" aria-labelledby="proof-title">
      <div className="max-w-5xl mx-auto">
        <h2 id="proof-title" className="text-3xl md:text-4xl font-bold text-white mb-10 text-center">{t('proof_title')}</h2>
        <div className={`grid gap-4 ${shown.length > 1 ? 'md:grid-cols-2' : 'max-w-2xl mx-auto'}`}>
          {shown.map((s) => (
            <figure key={s.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col">
              <Quote className="w-5 h-5 text-blue-400 mb-3" aria-hidden="true" />
              <blockquote lang={s.lang} className="text-slate-200 leading-relaxed flex-1">{s.quote}</blockquote>
              {s.result && <p className="mt-3 text-sm font-semibold text-emerald-300">{s.result}</p>}
              <figcaption className="mt-5 flex items-center gap-3">
                {s.logo && <img src={s.logo} alt="" className="h-9 w-9 rounded-lg object-contain bg-white/5" />}
                <div className="text-sm">
                  {s.name && <div className="font-semibold text-white">{s.name}</div>}
                  <div className="text-slate-400">{[s.role, s.firm, s.city].filter(Boolean).join(' · ')}</div>
                  {s.earlyAccess && <div className="mt-1 text-xs text-amber-300/90">{t('proof_early_access_label')}</div>}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-slate-500">
          {t('proof_note')}{anyEarlyAccess ? ` ${t('proof_note_early_access')}` : ''}
        </p>
      </div>
    </section>
  );
}
