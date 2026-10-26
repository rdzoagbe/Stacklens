// ── The palette behind light mode ──────────────────────────────────────────
//
// The app was written for a dark page: about 2,500 class names like
// bg-slate-900, text-slate-400 and text-white across 53 files. Rewriting each
// one by hand would take weeks and miss some. Instead, the Tailwind colours
// those classes use are CSS variables (tailwind.config.js), and this module
// says what each variable holds in each theme:
//
// - DARK is Tailwind's own value for every colour (slate-500 excepted, see
//   tailwind.config.js), so the dark theme renders exactly as before.
// - LIGHT turns the greys round (the slate-950 page becomes slate-50, a
//   slate-900 card becomes white, text-slate-300 becomes slate-700, white text
//   becomes slate-900) and darkens coloured text, so text-blue-400 written for
//   a dark page reads on a light one.
// - Inside a solid coloured fill (a blue button, an amber badge) the dark
//   values come back (FILL_CLASSES): white on blue stays white on blue.
//
// palette.test.js checks every text colour against the backgrounds it sits
// on, in both themes.

import colors from 'tailwindcss/colors';

/** Colour families the app's classes use. */
export const GREYS = ['slate', 'gray'];
export const HUES = ['red', 'orange', 'amber', 'yellow', 'green', 'emerald', 'teal', 'sky', 'blue', 'indigo', 'violet', 'purple', 'pink'];
export const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

// slate-500 is the app's secondary text; Tailwind's #64748b is under 4.5:1 on
// the dark page, so it was raised to #74839a (tailwind.config.js history).
const SLATE_500_DARK = '#74839a';
// The same role on a light page: 4.5:1 or more on white, slate-50 and slate-100.
const SLATE_500_LIGHT = '#556274';

const hex = (family, shade) => (family === 'slate' && shade === '500' ? SLATE_500_DARK : colors[family][shade]);

// Light greys: the scale turned round, tuned so a card (900) is white and the
// page (950) is slate-50.
const GREY_LIGHT = {
  950: '50', 900: 'WHITE', 800: '200', 700: '300', 600: '400',
  500: 'MID', 400: '600', 300: '700', 200: '800', 100: '900', 50: '950',
};

// Coloured text on a light page: 300 to 600 become 700, the paler 50 to 200
// become 800. 700 and darker are already dark enough and stay.
const HUE_TEXT_LIGHT = { 50: '800', 100: '800', 200: '800', 300: '700', 400: '700', 500: '700', 600: '700' };

// Deep tints used as backgrounds (from-emerald-950/20, bg-blue-950/30) become
// the pale end of the same hue.
const HUE_DEEP_LIGHT = { 900: '100', 950: '50' };

// Gradient stops at 300 and 400 are the bright headline words
// (bg-clip-text from-blue-400 to-indigo-400): on a light page they darken to
// 700 like any coloured text. Inside a fill they come back (FILL_CLASSES).
const GRADIENT_TEXT_LIGHT = { 300: '700', 400: '700' };

const toRgb = (h) => {
  const n = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)).join(' ');
};

/** The CSS variable name for a colour, e.g. --c-slate-900. */
export const varName = (family, shade) => (shade ? `--c-${family}-${shade}` : `--c-${family}`);

/** Every variable with its hex value, per theme: { dark: {name: hex}, light: {...} } */
export function themeValues() {
  const dark = {};
  const light = {};
  for (const g of GREYS) {
    for (const s of SHADES) {
      dark[varName(g, s)] = hex(g, s);
      const to = GREY_LIGHT[s];
      light[varName(g, s)] = to === 'WHITE' ? '#ffffff' : to === 'MID' ? SLATE_500_LIGHT : colors[g][to];
    }
  }
  dark[varName('white')] = '#ffffff';
  light[varName('white')] = colors.slate['900'];
  for (const h of HUES) {
    for (const s of SHADES) {
      // Text and deep tints vary; everything else (fills, borders at 500, the
      // /10 washes) keeps Tailwind's value in both themes.
      if (HUE_TEXT_LIGHT[s]) {
        dark[varName(`${h}-text`, s)] = colors[h][s];
        light[varName(`${h}-text`, s)] = colors[h][HUE_TEXT_LIGHT[s]];
      }
      if (HUE_DEEP_LIGHT[s]) {
        dark[varName(h, s)] = colors[h][s];
        light[varName(h, s)] = colors[h][HUE_DEEP_LIGHT[s]];
      }
      if (GRADIENT_TEXT_LIGHT[s]) {
        dark[varName(`${h}-stop`, s)] = colors[h][s];
        light[varName(`${h}-stop`, s)] = colors[h][GRADIENT_TEXT_LIGHT[s]];
      }
    }
  }
  return { dark, light };
}

const v = (name) => `rgb(var(${name}) / <alpha-value>)`;

/** The `colors` and `textColor` entries for tailwind.config.js. */
export function tailwindColors() {
  const all = {};
  for (const g of GREYS) all[g] = Object.fromEntries(SHADES.map((s) => [s, v(varName(g, s))]));
  all.white = v(varName('white'));
  for (const h of HUES) {
    all[h] = Object.fromEntries(SHADES.map((s) => [s, HUE_DEEP_LIGHT[s] ? v(varName(h, s)) : colors[h][s]]));
  }
  const text = {};
  for (const h of HUES) {
    // Text 700 and darker is fixed: text-amber-900 on an amber-400 badge must
    // stay dark in both themes.
    text[h] = Object.fromEntries(SHADES.map((s) => [s, HUE_TEXT_LIGHT[s] ? v(varName(`${h}-text`, s)) : colors[h][s]]));
  }
  const stops = {};
  for (const h of HUES) {
    stops[h] = Object.fromEntries(SHADES.map((s) => [s, GRADIENT_TEXT_LIGHT[s] ? v(varName(`${h}-stop`, s))
      : HUE_DEEP_LIGHT[s] ? v(varName(h, s)) : colors[h][s]]));
  }
  return { colors: all, textColor: text, gradientColorStops: stops };
}

// A solid coloured fill: inside it, the dark values come back, so the white
// text on a blue button and the dark text on an amber badge keep their
// contrast. Washes (bg-blue-500/10) are not fills: their text follows the theme.
const FILL_SHADES = ['300', '400', '500', '600', '700', '800'];
const esc = (cls) => cls.replace(/:/g, '\\:').replace(/!/g, '\\!');
export function fillSelectors() {
  const sel = [];
  for (const h of HUES) {
    for (const s of FILL_SHADES) {
      sel.push(`.${esc(`bg-${h}-${s}`)}`, `.${esc(`!bg-${h}-${s}`)}`, `.${esc(`hover:bg-${h}-${s}`)}:hover`);
      // Gradient text (bg-clip-text) is text, not a fill: it follows the theme.
      sel.push(`.bg-gradient-to-r.${esc(`from-${h}-${s}`)}:not(.bg-clip-text)`, `.bg-gradient-to-br.${esc(`from-${h}-${s}`)}:not(.bg-clip-text)`);
    }
  }
  // The printed reports (free audit client report, access review) are a white
  // page, class "paper", shown on screen and portalled into #print-report: they
  // keep their designed colours in either theme, or light mode would print
  // white text on a dark page.
  sel.push('.paper', '#print-report');
  return sel;
}

/** The CSS for both themes, in rgb channels, for the tailwind plugin. */
export function themeCss() {
  const { dark, light } = themeValues();
  const decl = (map) => Object.fromEntries(Object.entries(map).map(([k, h]) => [k, toRgb(h)]));
  return {
    ':root, [data-theme="dark"]': { ...decl(dark), 'color-scheme': 'dark' },
    '[data-theme="light"]': { ...decl(light), 'color-scheme': 'light' },
    [`[data-theme="light"] :is(${fillSelectors().join(', ')})`]: decl(dark),
  };
}
