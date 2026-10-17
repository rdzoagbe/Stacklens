// ── Saying what each screen is for, and where to find what ─────────────────
//
// Every page in the app used to carry the same line under its title ("Keep
// control. Reduce risk."), and there was no way to ask "where do I do X?".
// PAGE_HELP gives each page one sentence saying what it is for, shown under
// the title (components/AppShell.jsx TopBar); HELP_TASKS is the list the "?"
// help opens (components/HelpPanel.jsx): a task in the reader's words, and the
// screen that does it.
//
// page-help.test.js holds every link to a route App.jsx answers, every tab to
// one the page accepts, and every key to all five languages. Add a task here
// when a screen gains something people will look for.

/** Page path → the translation key of its one-line explanation. */
export const PAGE_HELP = {
  '/dashboard': 'ph_dashboard',
  '/clients': 'ph_clients',
  '/tools': 'ph_tools',
  '/employees': 'ph_employees',
  '/devices': 'ph_devices',
  '/access': 'ph_access',
  '/offboarding': 'ph_offboarding',
  '/security': 'ph_security',
  '/audit': 'ph_security',
  '/finance': 'ph_finance',
  '/settings': 'ph_settings',
};

/** The explanation key for a path, or null (the generic line is shown then). */
export function pageHelpKey(pathname) {
  const path = String(pathname || '').replace(/\/+$/, '') || '/';
  return PAGE_HELP[path] || null;
}

/**
 * "Where do I…?" → the screen. `key` is the question (`${key}` in
 * translations.js), `page` the menu label key of the screen it opens.
 */
export const HELP_TASKS = [
  { key: 'hf_add_tool', to: '/tools', page: 'nav_tools' },
  { key: 'hf_check_found', to: '/tools', page: 'nav_tools' },
  { key: 'hf_spend', to: '/finance?tab=overview', page: 'nav_finance' },
  { key: 'hf_renewals', to: '/finance?tab=renewals', page: 'nav_finance' },
  { key: 'hf_budget', to: '/finance?tab=budget', page: 'nav_finance' },
  { key: 'hf_invoices', to: '/finance?tab=budget', page: 'nav_finance' },
  { key: 'hf_add_person', to: '/employees', page: 'nav_employees' },
  { key: 'hf_access', to: '/access', page: 'nav_access' },
  { key: 'hf_eligibility', to: '/access?view=eligibility', page: 'nav_access' },
  { key: 'hf_joiners', to: '/access?view=eligibility', page: 'nav_access' },
  { key: 'hf_leaver', to: '/offboarding', page: 'nav_offboarding' },
  { key: 'hf_device_add', to: '/devices', page: 'nav_devices' },
  { key: 'hf_device_return', to: '/devices', page: 'nav_devices' },
  { key: 'hf_device_intune', to: '/devices', page: 'nav_devices' },
  { key: 'hf_device_warranty', to: '/devices', page: 'nav_devices' },
  { key: 'hf_security', to: '/security', page: 'nav_security' },
  { key: 'hf_integrations', to: '/settings?tab=integrations', page: 'nav_settings' },
  { key: 'hf_invite', to: '/settings?tab=team', page: 'nav_settings' },
  { key: 'hf_billing', to: '/settings?tab=billing', page: 'nav_settings' },
  { key: 'hf_notifications', to: '/settings?tab=notifications', page: 'nav_settings' },
  { key: 'hf_export', to: '/settings?tab=data', page: 'nav_settings' },
  { key: 'hf_audit_log', to: '/settings?tab=data', page: 'nav_settings' },
  { key: 'hf_free_audit', to: '/audit-saas', page: 'pm_audit' },
];

/** Lower case, accents removed: "réglages" finds "Reglages". */
export function foldText(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * The tasks whose question or screen name contains every word typed, in the
 * list's order. `t` translates; an empty query returns them all.
 */
export function searchHelp(query, t, tasks = HELP_TASKS) {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (!words.length) return tasks;
  return tasks.filter((task) => {
    const hay = foldText(`${t(task.key)} ${t(task.page)}`);
    return words.every((w) => hay.includes(w));
  });
}
