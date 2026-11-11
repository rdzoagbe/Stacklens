import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── The name never touches the menu ────────────────────────────────────────
//
// In French, just above the width where the menu stops folding into a button,
// the links filled the bar and "Stacklens" ran into "Audit gratuit": the bar
// had justify-between and no gap. Both headers (the landing page's and
// PublicNav) keep a gap and a brand that does not shrink.
const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('public headers', () => {
  it('the landing header keeps a gap between the name and the menu', () => {
    const src = read('src/pages/TrialPage.jsx');
    expect(src).toMatch(/className="flex items-center justify-between gap-6">\s*<div className="flex items-center gap-3 shrink-0">/);
  });
  it('PublicNav keeps the same gap and an unshrinking brand', () => {
    const src = read('src/components/PublicNav.jsx');
    expect(src).toMatch(/justify-between gap-6/);
    expect(src).toMatch(/<Link to="\/" className="flex items-center gap-3 shrink-0"/);
  });
});
