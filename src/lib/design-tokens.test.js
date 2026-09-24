import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import tailwind from '../../tailwind.config.js';

/* eslint-disable security/detect-non-literal-fs-filename --
   every path is built from the repo root and a constant, not input. */

// ── One visual system ──────────────────────────────────────────────────────
//
// The September review found the site assembled from several: no font at all
// (each visitor saw their system's), two reds for the same meaning, grey text
// below the contrast AA requires, three modal backdrops, and six different
// headers across the public pages. These are the decisions, held in place.

const root = process.cwd();
function jsxFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return jsxFiles(path);
    return /\.jsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}
const sources = jsxFiles(resolve(root, 'src')).map((path) => ({ path, text: readFileSync(path, 'utf8') }));
const offenders = (re) => sources.filter((f) => re.test(f.text)).map((f) => f.path.replace(root + '/', ''));

// WCAG relative luminance and contrast ratio.
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('type', () => {
  it('the app ships its own font, served from our origin', () => {
    expect(tailwind.theme.extend.fontFamily.sans[0]).toBe('"Inter Variable"');
    expect(readFileSync(resolve(root, 'src/main.jsx'), 'utf8')).toMatch(/import '@fontsource-variable\/inter'/);
    // Google Fonts would be a new sub-processor and is outside the CSP.
    expect(readFileSync(resolve(root, 'index.html'), 'utf8')).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
  });
});

describe('colour', () => {
  it('secondary text passes WCAG AA on the page and on cards', () => {
    const slate500 = tailwind.theme.extend.colors.slate[500];
    expect(contrast(slate500, '#020617'), 'on slate-950').toBeGreaterThanOrEqual(4.5);
    expect(contrast(slate500, '#0f172a'), 'on slate-900').toBeGreaterThanOrEqual(4.5);
  });

  it('no text uses the greys that fail it', () => {
    expect(offenders(/\b(?:text|placeholder)-slate-(?:600|700)\b|placeholder:text-slate-(?:600|700)\b/)).toEqual([]);
  });

  it('one red means critical: no rose alongside it', () => {
    expect(offenders(/-rose-\d{2,3}\b/)).toEqual([]);
  });
});

describe('surfaces', () => {
  it('every modal backdrop is the same one', () => {
    const backdrops = sources.flatMap((f) => [...f.text.matchAll(/fixed inset-0[^"'`]*/g)].map((m) => m[0]))
      .filter((c) => /\bbg-(?:black|slate-9\d0)\/\d+/.test(c));
    expect(backdrops.length).toBeGreaterThan(5);
    for (const c of backdrops) expect(c).toMatch(/bg-slate-950\/70 backdrop-blur\b/);
  });
});

describe('the public pages share one header', () => {
  it.each([
    'src/pages/LegalPages.jsx',
    'src/pages/AccountantsPage.jsx',
    'src/pages/SaasAuditPage.jsx',
  ])('%s uses PublicNav and no hand-rolled nav', (file) => {
    const text = readFileSync(resolve(root, file), 'utf8');
    expect(text).toMatch(/<PublicNav /);
    expect(text).not.toMatch(/<nav\b/);
    // "← Back" went wherever the browser had been — off-site from a search.
    expect(text).not.toMatch(/navigate\(-1\)|history\.back\(\)/);
  });

  it('the landing nav looks the same as PublicNav', () => {
    const landing = readFileSync(resolve(root, 'src/pages/TrialPage.jsx'), 'utf8');
    const nav = /<nav className="([^"]+)"/.exec(landing)[1].split(/\s+/);
    for (const cls of ['border-b', 'border-slate-800/60', 'bg-slate-950/80', 'backdrop-blur-xl', 'sticky', 'top-0']) {
      expect(nav, cls).toContain(cls);
    }
  });

  it('the logo is not a button inside a link', () => {
    const ui = readFileSync(resolve(root, 'src/components/ui.jsx'), 'utf8');
    expect(ui).toMatch(/const Tag = onClick \? 'button' : 'span'/);
  });
});
