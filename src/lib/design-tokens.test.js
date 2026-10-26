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
    'src/pages/FinanceLeadsPage.jsx',
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

// ── The design system's tokens ─────────────────────────────────────────────
//
// src/design/tokens.json is a copy of the "Stacklens" design-system artifact.
// index.css turns it into CSS variables and tailwind.config.js into semantic
// colours. These hold the three together and the contrast the system promises.

const tokens = JSON.parse(readFileSync(resolve(root, 'src/design/tokens.json'), 'utf8'));
const indexCss = readFileSync(resolve(root, 'src/index.css'), 'utf8');
const colourTokens = tokens.color.tokens;

// A token value as a solid hex: rgba() is laid over the ground it sits on.
function solid(value, ground) {
  if (value.startsWith('#')) return value;
  const [r, g, b, a] = value.match(/[\d.]+/g).map(Number);
  const [gr, gg, gb] = [1, 3, 5].map((i) => parseInt(ground.slice(i, i + 2), 16));
  return '#' + [[r, gr], [g, gg], [b, gb]].map(([c, u]) => Math.round(c * a + u * (1 - a)).toString(16).padStart(2, '0')).join('');
}

describe('design tokens', () => {
  it('index.css declares every colour token with the value tokens.json gives, in both themes', () => {
    const blockOf = (selector) => indexCss.slice(indexCss.indexOf(selector), indexCss.indexOf('}', indexCss.indexOf(selector)));
    const dark = blockOf(':root, [data-theme="dark"] {');
    const light = blockOf('[data-theme="light"] {');
    for (const tok of colourTokens) {
      expect(dark, tok.name).toContain(`--${tok.name}: ${tok.value.dark};`);
      expect(light, tok.name).toContain(`--${tok.name}: ${tok.value.light};`);
    }
  });

  it('Tailwind exposes each one as a semantic colour', () => {
    const colours = tailwind.theme.extend.colors;
    for (const tok of colourTokens) expect(colours[tok.name], tok.name).toBe(`var(--${tok.name})`);
  });

  it.each(['dark', 'light'])('text reaches 4.5:1 and controls 3:1 on the grounds the tokens name (%s)', (theme) => {
    const v = Object.fromEntries(colourTokens.map((t) => [t.name, t.value[theme]]));
    const raised = v['surface-raised'];
    const pair = (fg, bg) => contrast(solid(v[fg], raised), solid(v[bg], raised));
    for (const [fg, bg] of [
      ['ink', 'surface'], ['ink', 'surface-raised'], ['ink', 'surface-hover'],
      ['ink-muted', 'surface'], ['ink-muted', 'surface-raised'], ['ink-subtle', 'surface'], ['ink-subtle', 'surface-raised'],
      ['on-brand', 'brand'], ['on-brand', 'brand-hover'], ['on-brand', 'danger-fill'],
      ['brand-text', 'surface'], ['brand-text', 'surface-raised'], ['brand-text', 'brand-soft'],
      ['danger', 'surface-raised'], ['danger', 'danger-soft'], ['warning', 'surface-raised'], ['warning', 'warning-soft'],
      ['success', 'surface-raised'], ['success', 'success-soft'],
    ]) expect(pair(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    for (const [fg, bg] of [['line-control', 'surface'], ['line-control', 'surface-raised'], ['focus-ring', 'surface'], ['focus-ring', 'surface-raised']]) {
      expect(pair(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('buttons and fields', () => {
  it('a filled blue or red button darkens on hover: white on blue-500 or red-500 is under 4.5:1', () => {
    expect(contrast('#ffffff', '#3b82f6')).toBeLessThan(4.5);
    expect(contrast('#ffffff', '#1d4ed8')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', '#b91c1c')).toBeGreaterThanOrEqual(4.5);
    expect(offenders(/hover:bg-(?:blue|red)-500(?![/\d])/)).toEqual([]);
  });

  it('Button shows a solid focus ring for the keyboard; Input, Select and Textarea have an edge that reaches 3:1', () => {
    const ui = readFileSync(resolve(root, 'src/components/ui.jsx'), 'utf8');
    expect(ui).toMatch(/focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring/);
    expect((ui.match(/rounded-xl border border-line-control bg-slate-950/g) || []).length).toBe(3);
    expect(ui).not.toMatch(/focus:ring-blue-500\//);
  });

  it('no hand-written text field keeps a border under 3:1 (slate-600/700/800 on the dark surfaces)', () => {
    const faint = [];
    for (const f of sources) {
      for (const m of f.text.matchAll(/<(?:input|select|textarea)\b/g)) {
        const chunk = f.text.slice(m.index, m.index + 700);
        const cls = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(chunk);
        if (!cls || /type="(?:checkbox|radio|file|range|color)"/.test(chunk.slice(0, cls.index))) continue;
        if (/\bborder-slate-(?:600|700|800)(?=\s|$)/.test(cls[1] ?? cls[2])) faint.push(f.path.replace(root + '/', ''));
      }
    }
    expect(faint).toEqual([]);
  });
});
