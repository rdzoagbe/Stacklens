import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { founderPulse } from '../firebase-config';
import { pulseByCampaign } from '../lib/pulse';

// The anonymous visit counter (functions/pulse.js), on /founder-admin: what
// each campaign tag (`?c=nl` on an email link) brought, over the last 30 days.
// Founder only, English only, like the rest of that page.

const COLUMNS = [
  ['visit', 'Visits'],
  ['audit_run', 'Audits'],
  ['cta_click', 'Clicks'],
  ['sign_up', 'Sign-ups'],
  ['trial_started', 'Trials'],
  ['checkout_started', 'Checkouts'],
  ['checkout_completed', 'Paid'],
];

export default function PulseCard() {
  const [state, setState] = useState({ loading: false, lines: null });
  const load = async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const r = await founderPulse();
      setState({ loading: false, lines: pulseByCampaign(r.rows) });
    } catch (err) {
      setState({ loading: false, lines: null, error: err.message });
    }
  };
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4" data-testid="founder-pulse">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-white">📈 Visits by campaign (30 days)</span>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Anonymous counter: every visitor, no cookie. Tag a link with ?c=name to see what it brings.
          </div>
        </div>
        <button onClick={load} disabled={state.loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-lg text-xs transition-colors disabled:opacity-50">
          <RefreshCw size={13} className={state.loading ? 'animate-spin' : ''} />
          {state.lines ? 'Refresh' : 'Load'}
        </button>
      </div>
      {state.error && <div className="mt-2 font-mono text-[11px] text-red-300 break-words">{state.error}</div>}
      {state.lines && (state.lines.length === 0 ? (
        <div className="text-xs text-slate-500 mt-3">Nothing counted yet.</div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 text-left">
                <th className="py-1 pr-3 font-medium">Campaign</th>
                {COLUMNS.map(([k, label]) => <th key={k} className="py-1 px-2 font-medium text-right">{label}</th>)}
                <th className="py-1 pl-3 font-medium">Pages visited</th>
              </tr>
            </thead>
            <tbody>
              {state.lines.map((l) => (
                <tr key={l.campaign} className="border-t border-slate-800 text-slate-300">
                  <td className="py-1 pr-3 font-mono">{l.campaign}</td>
                  {COLUMNS.map(([k]) => <td key={k} className="py-1 px-2 text-right tabular-nums">{l[k] || 0}</td>)}
                  <td className="py-1 pl-3 text-slate-500">
                    {Object.entries(l.pages).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${n}`).join(' · ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
