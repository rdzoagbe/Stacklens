import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PAGE_HELP, HELP_TASKS, pageHelpKey, searchHelp, foldText } from './pageHelp';
import { translations } from '../translations';
import { PUBLIC_MENU_LINKS } from '../components/PublicMenu';

// ── Finding your way: every pointer leads somewhere real ───────────────────
//
// The help list, the page explanations, the public menu and the landing
// page's "What's inside" all point people at screens. A pointer to a route
// that does not exist redirects to the landing page (NotFound), which looks
// like being thrown out; a tab that does not exist opens the wrong one. These
// fail first.

/* eslint-disable security/detect-non-literal-fs-filename --
   every path here is a file of this repository named in this test. */
const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
const app = read('src/App.jsx');
const routed = new Set([...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]));
const LANGS = ['en', 'fr', 'de', 'es', 'pt'];

const finTabs = JSON.parse(/VALID_FIN_TABS = (\[[^\]]+\])/.exec(read('src/pages/FinancePage.jsx'))[1].replace(/'/g, '"'));
const setTabs = JSON.parse(/VALID_TABS = (\[[^\]]+\])/.exec(read('src/pages/SettingsPage.jsx'))[1].replace(/'/g, '"'));

describe('every help link opens a real screen, on a real tab', () => {
  it.each(HELP_TASKS)('$key → $to', ({ to }) => {
    const url = new URL(to, 'https://x');
    expect(routed.has(url.pathname), `${url.pathname} is not a route in App.jsx`).toBe(true);
    const tab = url.searchParams.get('tab');
    if (url.pathname === '/finance' && tab) expect(finTabs).toContain(tab);
    if (url.pathname === '/settings' && tab) expect(setTabs).toContain(tab);
    if (url.pathname === '/access' && url.searchParams.get('view')) expect(url.searchParams.get('view')).toBe('eligibility');
  });

  it('every page with an explanation is a route', () => {
    for (const path of Object.keys(PAGE_HELP)) expect(routed.has(path), path).toBe(true);
  });

  it('every sidebar page has its own explanation', () => {
    const nav = read('src/components/AppShell.jsx');
    const block = nav.slice(nav.indexOf('export const NAV = ['), nav.indexOf('\n];', nav.indexOf('export const NAV = [')));
    const paths = [...block.matchAll(/to:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(paths.length).toBeGreaterThan(6);
    for (const p of paths) expect(pageHelpKey(p), `${p} has no line in PAGE_HELP`).toBeTruthy();
  });

  it('a page without one falls back, and a trailing slash does not matter', () => {
    expect(pageHelpKey('/devices/')).toBe('ph_devices');
    expect(pageHelpKey('/founder-admin')).toBeNull();
  });
});

describe('every string is there in all five languages', () => {
  const keys = [
    ...Object.values(PAGE_HELP), ...HELP_TASKS.map((x) => x.key), ...HELP_TASKS.map((x) => x.page),
    ...PUBLIC_MENU_LINKS.map((l) => l.key),
    'hf_open', 'hf_button', 'hf_title', 'hf_sub', 'hf_search', 'hf_none', 'hf_contact_q', 'hf_contact_cta',
    'pm_demo', 'pm_open', 'pm_close', 'lp_start_title', 'lp_start_sub', 'lp_inside_title', 'lp_inside_sub',
  ];
  it.each(LANGS)('%s', (lang) => {
    for (const k of new Set(keys)) expect(translations[lang][k], `${lang}.${k}`).toBeTruthy();
  });
});

describe('searching the help', () => {
  const t = (k) => translations.fr[k];
  it('an empty search lists everything', () => {
    expect(searchHelp('', t)).toHaveLength(HELP_TASKS.length);
  });
  it('ignores case and accents, and needs every word', () => {
    expect(foldText('Écran Réglé')).toBe('ecran regle');
    expect(searchHelp('ecran', t).map((x) => x.key)).toEqual(['hf_device_add']);
    expect(searchHelp('budget service', t).map((x) => x.key)).toEqual(['hf_budget']);
    expect(searchHelp('zzzz', t)).toEqual([]);
  });
  it('finds the clear-data buttons by their own name, in every language', () => {
    const find = (lang, q) => searchHelp(q, (k) => translations[lang][k]).map((x) => x.key);
    expect(find('en', 'clear')).toContain('hf_clear');
    expect(find('fr', 'effacer')).toContain('hf_clear');
    expect(find('de', 'personen')).toContain('hf_clear');
    expect(find('es', 'borrar')).toContain('hf_clear');
    expect(find('pt', 'apagar')).toContain('hf_clear');
  });
  it('finds a task by the screen\'s name too', () => {
    expect(searchHelp('matériel', t).map((x) => x.key)).toContain('hf_device_intune');
  });
});

describe('the public menu and the landing page', () => {
  it('every menu link is a route, and both headers use the one menu', () => {
    for (const l of PUBLIC_MENU_LINKS) expect(routed.has(l.to), l.to).toBe(true);
    expect(read('src/components/PublicNav.jsx')).toMatch(/<PublicMenu t=\{t\} \/>/);
    expect(read('src/pages/TrialPage.jsx')).toMatch(/<PublicMenu t=\{t\} landing/);
  });

  it('?signin=true and ?demo=true, which the menu sends from other pages, are read on arrival', () => {
    const landing = read('src/pages/TrialPage.jsx');
    expect(landing).toMatch(/arrival\.get\('signin'\) === 'true'/);
    expect(landing).toMatch(/arrival\.get\('demo'\) !== 'true'/);
  });

  it('"What\'s inside" names each part as the sidebar does', () => {
    const landing = read('src/pages/TrialPage.jsx');
    const names = [...landing.slice(landing.indexOf('const LANDING_MODULES'), landing.indexOf('];', landing.indexOf('const LANDING_MODULES')))
      .matchAll(/name: '([a-z_]+)'/g)].map((m) => m[1]);
    const nav = read('src/components/AppShell.jsx');
    expect(names.length).toBe(9);
    for (const n of names.filter((x) => x !== 'pm_audit')) expect(nav).toContain(`tKey: "${n}"`);
    for (const lang of LANGS) for (const key of [...landing.matchAll(/key: '(lp_mod_[a-z]+)'/g)].map((m) => m[1])) {
      expect(translations[lang][`${key}_body`], `${lang}.${key}_body`).toBeTruthy();
    }
  });
});

describe('the old product tour is gone, not half-gone', () => {
  it('no file, no provider, no launcher', () => {
    expect(existsSync(resolve(process.cwd(), 'src/contexts/TourContext.jsx'))).toBe(false);
    expect(app).not.toMatch(/TourProvider/);
    expect(read('src/components/gates.jsx')).not.toMatch(/useTour|TourLaunchButton/);
  });
});
