// ── Colour theme: dark (the default), light, or the system's ───────────────
//
// The choice is a per-browser convenience in localStorage ('theme'), written
// only when someone picks light or system: dark is the default and leaves
// nothing behind. public/theme-init.js applies the same rule before the page
// paints; the colours themselves are src/design/palette.js.

export const THEME_KEY = 'theme';
export const THEME_CHOICES = ['dark', 'light', 'system'];

const prefersLight = () => {
  try { return !!window.matchMedia?.('(prefers-color-scheme: light)').matches; } catch { return false; }
};

/** The saved choice, or 'dark'. */
export function readThemeChoice() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return THEME_CHOICES.includes(v) ? v : 'dark';
  } catch { return 'dark'; }
}

/** The theme a choice shows: light, or dark. */
export function resolveTheme(choice, systemPrefersLight = prefersLight()) {
  return choice === 'light' || (choice === 'system' && systemPrefersLight) ? 'light' : 'dark';
}

export function applyTheme(choice) {
  document.documentElement.setAttribute('data-theme', resolveTheme(choice));
}

/** Save the choice in this browser and apply it now. */
export function saveThemeChoice(choice) {
  const c = THEME_CHOICES.includes(choice) ? choice : 'dark';
  try {
    if (c === 'dark') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, c);
  } catch { /* storage blocked: the choice lasts for this page */ }
  applyTheme(c);
  return c;
}

/** Follow the system while the choice is 'system'; returns the unsubscribe. */
export function followSystemTheme(choice) {
  if (choice !== 'system' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  const on = () => applyTheme('system');
  mq.addEventListener?.('change', on);
  return () => mq.removeEventListener?.('change', on);
}
