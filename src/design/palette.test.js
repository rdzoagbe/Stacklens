import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import colors from 'tailwindcss/colors';
import { themeValues, themeCss, varName, GREYS, HUES, SHADES } from './palette.js';
import { readThemeChoice, resolveTheme, saveThemeChoice, THEME_KEY } from '../lib/theme.js';

// ── Light mode is the same app, readable ───────────────────────────────────
//
// Dark must render exactly as before (Tailwind's values), light must keep
// every text colour the app uses at 4.5:1 against the surfaces it sits on, and
// the theme the page paints with must be the one the switch saved.

const lum = (hex) => {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const { dark, light } = themeValues();

describe('the dark theme is the app as it was', () => {
  it('holds Tailwind’s own value for every variable colour, slate-500 excepted', () => {
    for (const g of GREYS) {
      for (const s of SHADES) {
        const want = g === 'slate' && s === '500' ? '#74839a' : colors[g][s];
        expect(dark[varName(g, s)], `${g}-${s}`).toBe(want);
      }
    }
    expect(dark[varName('white')]).toBe('#ffffff');
    for (const h of HUES) {
      for (const s of ['50', '100', '200', '300', '400', '500', '600']) {
        expect(dark[varName(`${h}-text`, s)], `text-${h}-${s}`).toBe(colors[h][s]);
      }
      for (const s of ['900', '950']) expect(dark[varName(h, s)], `${h}-${s}`).toBe(colors[h][s]);
      for (const s of ['300', '400']) expect(dark[varName(`${h}-stop`, s)], `from-${h}-${s}`).toBe(colors[h][s]);
    }
  });

  it('gives a solid coloured fill the dark values back in light mode', () => {
    const css = themeCss();
    const fill = Object.keys(css).find((k) => k.startsWith('[data-theme="light"] :is('));
    expect(fill).toContain('.bg-blue-600');
    expect(fill).toContain('.hover\\:bg-red-700:hover');
    expect(fill).not.toMatch(/bg-blue-500\/10|bg-slate/);
    expect(fill).toContain(':not(.bg-clip-text)');
    expect(fill).toContain('#print-report');
    expect(fill).toContain('.paper');
    const audit = readFileSync(resolve(process.cwd(), 'src/pages/SaasAuditPage.jsx'), 'utf8');
    const review = readFileSync(resolve(process.cwd(), 'src/components/AccessReviewsView.jsx'), 'utf8');
    for (const src of [audit, review]) expect(src).toMatch(/className="paper bg-white text-gray-900/);
    expect(Object.keys(css[fill]).sort()).toEqual(Object.keys(dark).sort());
  });
});

describe('the light theme keeps text readable', () => {
  const page = light[varName('slate', '950')];
  const card = light[varName('slate', '900')];
  const chip = light[varName('slate', '800')];

  it('turns the page light and the cards white', () => {
    expect(lum(page)).toBeGreaterThan(0.9);
    expect(card).toBe('#ffffff');
  });

  it('every grey used for text reaches 4.5:1 on the page and on a card', () => {
    for (const s of ['500', '400', '300', '200', '100', '50']) {
      for (const [name, bg] of [['page', page], ['card', card]]) {
        expect(ratio(light[varName('slate', s)], bg), `text-slate-${s} on ${name}`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(light[varName('gray', s)] , bg), `text-gray-${s} on ${name}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(ratio(light[varName('white')], page)).toBeGreaterThanOrEqual(4.5);
    // Secondary buttons and chips are bg-slate-800 with slate-100 to 400 text.
    for (const s of ['400', '300', '200', '100']) {
      expect(ratio(light[varName('slate', s)], chip), `text-slate-${s} on a chip`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('coloured text reaches 4.5:1 on white and on the page', () => {
    for (const h of HUES) {
      for (const s of ['50', '100', '200', '300', '400', '500', '600']) {
        const fg = light[varName(`${h}-text`, s)];
        expect(ratio(fg, '#ffffff'), `text-${h}-${s} on white`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(fg, page), `text-${h}-${s} on the page`).toBeGreaterThanOrEqual(4.5);
      }
      // Gradient headline words (bg-clip-text from-blue-400 to-indigo-400).
      for (const s of ['300', '400']) {
        expect(ratio(light[varName(`${h}-stop`, s)], page), `from-${h}-${s} on the page`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('the theme the page paints with is the one the switch saved', () => {
  const script = readFileSync(resolve(process.cwd(), 'public/theme-init.js'), 'utf8');
  const run = (stored, prefersLight) => {
    const attrs = {};
    vm.runInNewContext(script, {
      localStorage: { getItem: (k) => (k === THEME_KEY ? stored : null) },
      window: { matchMedia: () => ({ matches: prefersLight }) },
      document: { documentElement: { setAttribute: (k, v) => { attrs[k] = v; } } },
    });
    return attrs['data-theme'];
  };

  beforeEach(() => localStorage.clear());

  it('agrees with lib/theme.js for every choice and system setting', () => {
    for (const stored of [null, 'dark', 'light', 'system', 'nonsense']) {
      for (const prefersLight of [false, true]) {
        const choice = ['dark', 'light', 'system'].includes(stored) ? stored : 'dark';
        expect(run(stored, prefersLight), `${stored}/${prefersLight}`).toBe(resolveTheme(choice, prefersLight));
      }
    }
  });

  it('dark is the default and leaves nothing in the browser', () => {
    expect(readThemeChoice()).toBe('dark');
    saveThemeChoice('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    saveThemeChoice('dark');
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('is loaded as a plain blocking script before the app, and is in the repository', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const at = html.indexOf('<script src="/theme-init.js"></script>');
    expect(at).toBeGreaterThan(-1);
    expect(html.indexOf('<script type="module"')).toBeGreaterThan(at);
    expect(readFileSync(resolve(process.cwd(), '.gitignore'), 'utf8')).toContain('!public/theme-init.js');
  });
});
