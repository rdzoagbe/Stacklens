import React from 'react';
import { Link } from 'react-router-dom';
import { RDLogo } from './ui';
import { PublicMenu } from './PublicMenu';

// The one header for the public pages that are not the landing page: about,
// contact, security, privacy, terms, DPA, sub-processors, legal notice and the
// accountants page. There were six versions — two logo sizes, three
// backgrounds, "← Back" that went wherever the browser had been (off-site for
// someone arriving from a search result), and on four pages no logo at all.
// The landing page keeps its own nav because it carries the pricing and
// sign-in links, but uses the same height, background and border. Both show
// the same menu (PublicMenu), so a visitor can reach every public page, the
// demo and sign-in from wherever they land.
export const PUBLIC_NAV_CLASS = 'sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl';

export function PublicNav({ t }) {
  return (
    <nav className={PUBLIC_NAV_CLASS}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3" aria-label="Stacklens">
          <RDLogo size="md" />
          <span className="text-lg font-bold text-white">Stacklens</span>
        </Link>
        <PublicMenu t={t} />
      </div>
    </nav>
  );
}
