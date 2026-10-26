/* eslint-disable react-refresh/only-export-components -- the link table beside the menu that renders it */
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { LangSelectorCompact } from './AppShell';

// ── The menu of the public site ────────────────────────────────────────────
//
// One list of where a visitor can go, shown the same on the landing page and
// on every other public page (PublicNav): the free audit, the two pages for
// accountants and finance leads, pricing, the live demo, sign in and sign up.
// The landing page used to offer only Pricing and FAQ, and on a phone nothing
// at all; the other pages offered "← Home". public-menu.test.jsx holds every
// link to a route that exists.
//
// On the landing page the sign-in and demo entries open the form or start the
// demo directly (`onSignIn`, `onStart`, `onDemo`). Elsewhere they go to the
// landing page with ?signin=true, ?signup=true or ?demo=true, which TrialPage
// reads on arrival.

export const PUBLIC_MENU_LINKS = [
  { to: '/audit-saas', key: 'pm_audit' },
  { to: '/experts-comptables', key: 'pm_accountants' },
  { to: '/direction-financiere', key: 'pm_finance' },
];

const linkClass = 'text-sm text-slate-400 hover:text-white transition-colors whitespace-nowrap';
const currentClass = 'text-sm text-white font-semibold whitespace-nowrap';

export function PublicMenu({ t, landing = false, onSignIn = null, onStart = null, onDemo = null }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const close = () => setOpen(false);
  const pricingHref = landing ? '#pricing' : '/#pricing';

  const pageLinks = (mobile) => (
    <>
      {PUBLIC_MENU_LINKS.map((l) => (
        <Link key={l.to} to={l.to} onClick={close} aria-current={pathname === l.to ? 'page' : undefined}
          className={(pathname === l.to ? currentClass : linkClass) + (mobile ? ' block py-2' : '')}>
          {t(l.key)}
        </Link>
      ))}
      <a href={pricingHref} onClick={close} className={linkClass + (mobile ? ' block py-2' : '')}>{t('lp_nav_pricing')}</a>
      {landing && <a href="#faq" onClick={close} className={linkClass + (mobile ? ' block py-2' : '')}>{t('lp_nav_faq')}</a>}
      {onDemo
        ? <button type="button" onClick={() => { close(); onDemo(); }} className={linkClass + ' text-left' + (mobile ? ' block py-2 w-full' : '')}>{t('pm_demo')}</button>
        : <a href="/?demo=true" className={linkClass + (mobile ? ' block py-2' : '')}>{t('pm_demo')}</a>}
    </>
  );

  const signIn = onSignIn
    ? <button type="button" onClick={() => { close(); onSignIn(); }} className={linkClass}>{t('lp_nav_sign_in')}</button>
    : <a href="/?signin=true" className={linkClass}>{t('lp_nav_sign_in')}</a>;
  const start = onStart
    ? <button type="button" onClick={() => { close(); onStart(); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition-colors whitespace-nowrap">{t('lp_nav_start_free')}</button>
    : <a href="/?signup=true" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition-colors whitespace-nowrap">{t('lp_nav_start_free')}</a>;

  return (
    <>
      <div className="hidden xl:flex items-center gap-5" data-testid="public-menu">
        {pageLinks(false)}
        <LangSelectorCompact />
        {signIn}
        {start}
      </div>
      {/* Below 1280px the links fold into a menu button (in French they did not
          fit on one line). On a phone the header holds the button only: logo,
          name and "Start free" did not fit in 390px; the panel carries it. */}
      <div className="flex xl:hidden items-center gap-2">
        <span className="hidden sm:inline-flex">{start}</span>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="public-menu-panel"
          aria-label={open ? t('pm_close') : t('pm_open')}
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div id="public-menu-panel" data-testid="public-menu-panel"
          className="xl:hidden absolute left-0 right-0 top-full border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl px-6 py-4 space-y-1">
          {pageLinks(true)}
          <div className="pt-3 mt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            {signIn}
            <LangSelectorCompact />
            <span className="sm:hidden">{start}</span>
          </div>
        </div>
      )}
    </>
  );
}
