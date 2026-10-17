import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, HelpCircle, Search } from 'lucide-react';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Modal } from './ui';
import { searchHelp } from '../lib/pageHelp';

// ── "?" → Where to find what ───────────────────────────────────────────────
//
// A button in the app's top bar that opens a searchable list of tasks, each
// linking to the screen that does it (lib/pageHelp.js HELP_TASKS). It reads
// nothing and stores nothing: the search lives in this component's state.

export function HelpPanel({ compact = false }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const close = () => { setOpen(false); setQuery(''); };
  const results = open ? searchHelp(query, t) : [];

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t('hf_open')} title={t('hf_open')}
        data-testid="help-button"
        className={compact
          ? 'flex items-center justify-center w-9 h-9 bg-slate-800 border border-slate-700 rounded-xl text-slate-300'
          : 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/60 text-sm text-slate-300 hover:text-white hover:border-slate-600'}>
        <HelpCircle className="h-4 w-4" />
        {!compact && <span>{t('hf_button')}</span>}
      </button>
      <Modal open={open} onClose={close} title={t('hf_title')} subtitle={t('hf_sub')}>
        <div className="relative mb-4">
          <Search className="h-4 w-4 text-slate-500 absolute left-3 top-3" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('hf_search')} aria-label={t('hf_search')}
            data-testid="help-search"
            className="h-10 w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
        </div>
        {results.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center" data-testid="help-none">{t('hf_none')}</p>
        ) : (
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800" data-testid="help-results">
            {results.map((task) => (
              <li key={task.key}>
                <Link to={task.to} onClick={close} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-900/60">
                  <span className="flex-1 text-sm text-slate-200">{t(task.key)}</span>
                  <span className="text-xs text-slate-500 whitespace-nowrap">{t(task.page)}</span>
                  <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-slate-500">
          {t('hf_contact_q')}{' '}
          <Link to="/contact" onClick={close} className="text-blue-400 hover:text-blue-300">{t('hf_contact_cta')}</Link>
        </p>
      </Modal>
    </>
  );
}
