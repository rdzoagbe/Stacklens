import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, BarChart3, Check, Download, FileText, Sparkles, Target, Upload } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth/mammoth.browser';
import { callAI } from '../firebase-config';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';

// pdf.js needs a worker; Vite bundles it as a same-origin asset (no CDN, CSP-safe).
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Extract plain text from an uploaded contract file (PDF / DOCX / plain text).
// Returns the extracted text, or throws with a user-friendly message.
export async function extractContractText(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const pg = await pdf.getPage(i);
      const ct = await pg.getTextContent();
      text += ct.items.map(x => x.str).join(' ') + '\n';
    }
    return text.trim();
  }
  if (name.endsWith('.docx')) {
    const ab = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: ab });
    return (value || '').trim();
  }
  // .txt / .md / .rtf / .doc (legacy) → read as text
  return (await file.text()).trim();
}

export function ContractComparisonPage() {
  const { language } = useLang();
  const t = useTranslation(language);

  // ── View state ──────────────────────────────────────────────
  const [view, setView] = useState('upload'); // upload | analyze | results
  const [activeTab, setActiveTab] = useState('overview'); // overview | provisions | suggestions | chat

  // ── Contract inputs ─────────────────────────────────────────
  const [contractA, setContractA] = useState({ name: '', party: '', text: '', type: 'MSA', fileName: '' });
  const [contractB, setContractB] = useState({ name: '', party: '', text: '', type: 'MSA', fileName: '' });
  const [favors, setFavors] = useState('balanced'); // balanced | party-a | party-b
  const CONTRACT_TYPES = ['MSA', 'NDA', 'SaaS Agreement', 'SOW', 'Employment', 'Partnership', 'Other'];

  // ── Analysis results ────────────────────────────────────────
  const [analysis, setAnalysis] = useState(null);
  const [, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  // ── Chat ────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // ── Rewrite state ────────────────────────────────────────────
  const [rewriteTarget, setRewriteTarget] = useState(null);
  const [rewriteMode, setRewriteMode] = useState('simplify'); // simplify | align | robust
  const [rewriteResult, setRewriteResult] = useState(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // ── Helpers ─────────────────────────────────────────────────
  const canAnalyze = contractA.text.trim().length > 50 && contractB.text.trim().length > 50;

  const LOADING_MSGS = [
    'Reading contract structure…',
    'Identifying key provisions…',
    'Comparing party positions…',
    'Calculating neutrality scores…',
    'Flagging deal breakers…',
    'Generating AI suggestions…',
    'Building comparison report…',
  ];

  // ── Run AI Analysis ──────────────────────────────────────────
  const runAnalysis = async () => {
    setLoading(true);
    setView('analyze');
    let msgIdx = 0;
    setLoadingMsg(LOADING_MSGS[0]);
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MSGS.length;
      setLoadingMsg(LOADING_MSGS[msgIdx]);
    }, 1800);

    const prompt = `You are an expert contract analyst. Compare these two contracts and respond ONLY with valid JSON (no markdown, no explanation).

CONTRACT A (${contractA.name || 'Contract A'} — ${contractA.party || 'Party A'}):
${contractA.text.slice(0, 3000)}

CONTRACT B (${contractB.name || 'Contract B'} — ${contractB.party || 'Party B'}):
${contractB.text.slice(0, 3000)}

Deal favorability preference: ${favors}
Contract type: ${contractA.type}

Respond with this exact JSON structure:
{
  "summary": "2-3 sentence executive summary of key differences",
  "neutralityScore": { "a": 45, "b": 72 },
  "riskScore": { "a": 3, "b": 6 },
  "favorability": "party-a | party-b | balanced",
  "overallVerdict": "one sentence verdict on which contract is stronger",
  "dealBreakers": [
    { "issue": "string", "contract": "A | B | Both", "severity": "critical | high | medium" }
  ],
  "focusAreas": [
    { "area": "string", "description": "string", "contract": "A | B | Both" }
  ],
  "provisions": [
    {
      "name": "string",
      "category": "Payment | Liability | IP | Termination | Confidentiality | Governing Law | Other",
      "contractA": "string (what contract A says)",
      "contractB": "string (what contract B says)",
      "difference": "minor | moderate | significant | missing",
      "favors": "A | B | Neutral",
      "marketStandard": "above | at | below",
      "issues": ["string"],
      "suggestion": "string AI recommendation"
    }
  ],
  "marketDeviations": [
    { "clause": "string", "deviation": "above | below", "description": "string" }
  ]
}`;

    try {
      const data = await callAI({ messages: [{ role: 'user', content: prompt }], max_tokens: 4000 });
      const raw = data.content?.[0]?.text || '{}';
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setAnalysis(parsed);
      setChatMessages([{
        role: 'assistant',
        content: `✅ Analysis complete! I've compared **${contractA.name || 'Contract A'}** vs **${contractB.name || 'Contract B'}**. ${parsed.summary} Ask me anything about specific clauses or provisions.`,
      }]);
      setView('results');
      setActiveTab('overview');
    } catch {
      toast.error('Analysis failed — please try again');
      setView('upload');
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  // ── Rewrite a provision ──────────────────────────────────────
  const rewriteProvision = async (provision) => {
    setRewriteTarget(provision);
    setRewriteResult(null);
    setRewriteLoading(true);
    const modeDesc = { simplify: 'simpler plain English', align: 'aligned substantively between both contracts', robust: 'more robust and comprehensive' }[rewriteMode];
    try {
      const data = await callAI({ messages: [{
            role: 'user',
            content: `Rewrite this "${provision.name}" contract provision to be ${modeDesc}.
Contract A version: ${provision.contractA}
Contract B version: ${provision.contractB}
Issues: ${provision.issues?.join(', ')}

Respond with ONLY the rewritten clause text, no explanation, no JSON.`,
          }], max_tokens: 800 });
      setRewriteResult(data.content?.[0]?.text || '');
    } catch {
      toast.error('Rewrite failed');
    } finally {
      setRewriteLoading(false);
    }
  };

  // ── Chat with contracts ──────────────────────────────────────
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);
    try {
      const context = `Contract A (${contractA.name}): ${contractA.text.slice(0, 1500)}\n\nContract B (${contractB.name}): ${contractB.text.slice(0, 1500)}\n\nAnalysis summary: ${analysis?.summary}`;
      const data = await callAI({ messages: [
            { role: 'user', content: `You are a contract analyst. Context:\n${context}` },
            ...chatMessages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMsg },
          ], max_tokens: 600 });
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.content?.[0]?.text || 'Sorry, I could not answer that.' }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Error reaching AI. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  // ── Color helpers ────────────────────────────────────────────
  const diffColor = { minor: 'text-emerald-400 bg-emerald-500/10', moderate: 'text-amber-400 bg-amber-500/10', significant: 'text-rose-400 bg-rose-500/10', missing: 'text-slate-400 bg-slate-500/10' };
  const severityColor = { critical: 'border-rose-500 bg-rose-500/10 text-rose-300', high: 'border-amber-500 bg-amber-500/10 text-amber-300', medium: 'border-blue-500 bg-blue-500/10 text-blue-300' };
  const marketColor = { above: 'text-emerald-400', at: 'text-blue-400', below: 'text-amber-400' };

  // ── UPLOAD VIEW ─────────────────────────────────────────────
  if (view === 'upload') return (
    <div className="space-y-6">

      {/* ── Row 1: Compact header strip ── */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{t("cc_title")}</h2>
              <p className="text-sm text-slate-400">{t("cc_subtitle")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Setup (type + favorability) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block">{t("cc_contract_type")}</label>
          <div className="flex flex-wrap gap-2">
            {CONTRACT_TYPES.map(type => (
              <button key={type} onClick={() => { setContractA(a => ({...a, type})); setContractB(b => ({...b, type})); }}
                className={'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ' + (contractA.type === type ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white')}>
                {type}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block">{t("cc_favorability")}</label>
          <div className="flex gap-2">
            {[['balanced',t('cc_balanced')],['party-a',t('cc_favor_a')],['party-b',t('cc_favor_b')]].map(([v,l]) => (
              <button key={v} onClick={() => setFavors(v)}
                className={'flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ' + (favors === v ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white')}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Two contract inputs side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
        {[
          { label: 'Contract A', accent: 'blue', state: contractA, setState: setContractA },
          { label: 'Contract B', accent: 'emerald', state: contractB, setState: setContractB },
        ].map(({ label, accent, state, setState }) => {
          const accentBorder = accent === 'blue' ? 'border-blue-500/30' : 'border-emerald-500/30';
          const accentDot = accent === 'blue' ? 'bg-blue-500' : 'bg-emerald-500';
          return (
            <div key={label} className={"rounded-2xl border bg-slate-900/60 p-5 space-y-3 " + accentBorder}>
              <div className="flex items-center gap-2">
                <div className={"w-2.5 h-2.5 rounded-full " + accentDot} />
                <span className="text-white font-semibold text-sm">{label}</span>
                <span className={"ml-auto text-xs " + (state.text.length > 50 ? 'text-emerald-400' : 'text-slate-500')}>
                  {state.text.length > 50 ? '✓ Ready' : state.text.length + ' chars'}
                </span>
              </div>
              <input
                value={state.name}
                onChange={e => setState(s => ({...s, name: e.target.value}))}
                placeholder={t("cc_doc_name_placeholder")}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
              />
              <input
                value={state.party}
                onChange={e => setState(s => ({...s, party: e.target.value}))}
                placeholder={t("cc_party_placeholder")}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
              />
              <textarea
                value={state.text}
                onChange={e => setState(s => ({...s, text: e.target.value}))}
                placeholder={"Paste " + label + " text here, or upload a file below..."}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-500 outline-none focus:border-blue-500 transition-colors resize-none"
                rows={10}
              />
              <div className="flex items-center gap-2">
                <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-400 hover:text-white transition-all">
                  <Upload className="h-3.5 w-3.5" />
                  {state.fileName || t('cc_upload_file')}
                  <input type="file" accept=".pdf,.docx,.doc,.txt,.rtf,.md" className="hidden" onChange={async(e)=>{
                    const file = e.target.files?.[0];
                    e.target.value = ''; // allow re-selecting the same file
                    if (!file) return;
                    const toastId = toast.loading(t('cc_extracting') || 'Extracting text…');
                    try {
                      const text = await extractContractText(file);
                      if (!text) {
                        toast.error(t('cc_extract_empty') || 'No readable text found — this file may be a scanned image.', { id: toastId });
                        return;
                      }
                      setState(s => ({...s, text, fileName: file.name}));
                      toast.success(t('cc_extract_ok') || 'Text extracted', { id: toastId });
                    } catch (err) {
                      console.error('Contract extraction failed:', err);
                      toast.error(t('cc_extract_fail') || 'Could not read this file — try pasting the text instead.', { id: toastId });
                    }
                  }}/>
                </label>
                {state.fileName && <button onClick={() => setState(s => ({...s, text: "", fileName: ""}))} className="text-xs text-red-400 hover:text-red-300">clear</button>}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Row 4: Analyze CTA ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">{t("cc_ready_to_analyze")}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {canAnalyze ? t('cc_both_loaded') : t('cc_add_contract_text')}
          </div>
        </div>
        <button
          onClick={runAnalysis}
          disabled={!canAnalyze}
          className={"px-6 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 whitespace-nowrap " + (canAnalyze ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-600 cursor-not-allowed')}>
          <Sparkles className="h-4 w-4" />
          {t("cc_analyze_btn")}
        </button>
      </div>
    </div>
  );

  // ── LOADING VIEW ─────────────────────────────────────────────
  if (view === 'analyze') return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12">
      <div className="text-center space-y-4 max-w-md mx-auto">
        <div className="inline-flex p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 animate-pulse">
          <Sparkles className="h-8 w-8 text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-white">{t("cc_analyzing")}</h2>
        <p className="text-indigo-400 text-sm font-medium">{loadingMsg}</p>
        <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full animate-pulse" style={{ width: '70%' }} />
        </div>
        <p className="text-slate-500 text-xs">{t("cc_reading_clauses")}</p>
      </div>
    </div>
  );

  // ── RESULTS VIEW ─────────────────────────────────────────────
  if (view !== 'results' || !analysis) return null;

  const provisions = analysis.provisions || [];
  const dealBreakers = analysis.dealBreakers || [];
  const focusAreas = analysis.focusAreas || [];
  const marketDeviations = analysis.marketDeviations || [];

  return (
    <div className="space-y-6">

      {/* ── Row 1: Header strip with action buttons ── */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base lg:text-lg font-bold text-white truncate">
                <span className="text-blue-400">{contractA.name || 'Contract A'}</span>
                <span className="text-slate-500 mx-2">vs</span>
                <span className="text-emerald-400">{contractB.name || 'Contract B'}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{contractA.type} · {provisions.length} provisions analyzed</p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => { setView('upload'); setAnalysis(null); }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1.5">
              ← New Analysis
            </button>
            <button onClick={() => {
              const txt = `CONTRACT COMPARISON REPORT\n${contractA.name} vs ${contractB.name}\n\n${analysis.summary}\n\nPROVISIONS:\n${provisions.map(p => `${p.name}:\n  A: ${p.contractA}\n  B: ${p.contractB}\n  Suggestion: ${p.suggestion}`).join('\n\n')}`;
              const a = document.createElement('a'); a.href = 'data:text/plain,' + encodeURIComponent(txt); a.download = 'contract-comparison.txt'; a.click();
              toast.success('Report exported');
            }} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export Report
            </button>
          </div>
        </div>
      </div>

      {/* ── Row 2: KPI Strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-blue-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Risk Score A</div>
          <div className={"text-3xl font-black " + ((analysis.riskScore?.a || 0) > 6 ? 'text-rose-400' : 'text-amber-400')}>{analysis.riskScore?.a || 0}<span className="text-base text-slate-500">/10</span></div>
          <div className="text-sm text-slate-500 mt-1 truncate">{contractA.name || 'Contract A'}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-emerald-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Risk Score B</div>
          <div className={"text-3xl font-black " + ((analysis.riskScore?.b || 0) > 6 ? 'text-rose-400' : 'text-amber-400')}>{analysis.riskScore?.b || 0}<span className="text-base text-slate-500">/10</span></div>
          <div className="text-sm text-slate-500 mt-1 truncate">{contractB.name || 'Contract B'}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-indigo-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Provisions</div>
          <div className="text-3xl font-black text-indigo-400">{provisions.length}</div>
          <div className="text-sm text-slate-500 mt-1">analyzed</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 border-l-4 border-l-rose-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Deal Breakers</div>
          <div className="text-3xl font-black text-rose-400">{dealBreakers.length}</div>
          <div className="text-sm text-slate-500 mt-1">flagged</div>
        </div>
      </div>

      {/* ── Row 3: Neutrality / Favorability bars ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="text-base font-semibold text-white">Neutrality & Favorability</h3>
            <p className="text-xs text-slate-500">Higher score = more balanced terms</p>
          </div>
          <span className="text-xs text-slate-400 italic max-w-md text-right">{analysis.overallVerdict}</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-blue-400 text-xs font-semibold w-24 text-right truncate">{contractA.name || 'Contract A'}</span>
            <div className="flex-1 h-5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-1000 flex items-center justify-end pr-2"
                style={{ width: `${analysis.neutralityScore?.a || 50}%` }}>
                <span className="text-white text-[10px] font-bold">{analysis.neutralityScore?.a || 50}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 text-xs font-semibold w-24 text-right truncate">{contractB.name || 'Contract B'}</span>
            <div className="flex-1 h-5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-1000 flex items-center justify-end pr-2"
                style={{ width: `${analysis.neutralityScore?.b || 50}%` }}>
                <span className="text-white text-[10px] font-bold">{analysis.neutralityScore?.b || 50}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 4: Tab nav ── */}
      <div className="flex gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 w-fit overflow-x-auto max-w-full">
        {[
          { id: 'overview',    label: 'Overview' },
          { id: 'provisions',  label: `Provisions (${provisions.length})` },
          { id: 'suggestions', label: 'Rewrite' },
          { id: 'chat',        label: 'Ask AI' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={"px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap " + (activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Executive Summary */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-slate-400" />
              <h3 className="text-base font-semibold text-white">Executive Summary</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{analysis.summary}</p>
          </div>

          {/* Deal Breakers + Focus Areas — two columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
            {/* Deal Breakers */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                  <h3 className="text-base font-semibold text-white">Deal Breakers</h3>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-semibold">{dealBreakers.length} found</span>
              </div>
              {dealBreakers.length === 0 ? (
                <div className="py-6 text-center">
                  <Check className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-emerald-400 font-semibold">No critical deal breakers</p>
                  <p className="text-xs text-slate-500 mt-1">Both contracts look acceptable</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {dealBreakers.map((db, i) => (
                    <div key={i} className={"p-3 rounded-xl border " + (severityColor[db.severity] || severityColor.medium)}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold flex-1 min-w-0">{db.issue}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900/60 uppercase font-bold flex-shrink-0">{db.severity}</span>
                      </div>
                      <span className="text-xs opacity-70">In: Contract {db.contract}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Focus Areas */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-4 w-4 text-blue-400" />
                <h3 className="text-base font-semibold text-white">Focus Areas</h3>
              </div>
              {focusAreas.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No specific focus areas identified</p>
              ) : (
                <div className="space-y-2">
                  {focusAreas.map((fa, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
                      <div className="font-semibold text-blue-300 text-sm mb-1">{fa.area}</div>
                      <p className="text-xs text-slate-400 leading-relaxed">{fa.description}</p>
                      <span className="text-[10px] text-slate-600 mt-1.5 inline-block">Contract {fa.contract}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Market Deviations */}
          {marketDeviations.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-amber-400" />
                <h3 className="text-base font-semibold text-white">Market Standard Deviations</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {marketDeviations.map((md, i) => (
                  <div key={i} className="rounded-xl bg-slate-800/40 border border-slate-800 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-white truncate">{md.clause}</span>
                      <span className={"text-[10px] font-bold uppercase flex-shrink-0 ml-2 " + (marketColor[md.deviation] || 'text-slate-400')}>
                        {md.deviation === 'above' ? '↑ Above' : '↓ Below'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{md.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PROVISIONS TAB ── */}
      {activeTab === 'provisions' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-white">All Provisions</h3>
                <p className="text-xs text-slate-500">{provisions.length} provisions compared side-by-side</p>
              </div>
            </div>
          </div>

          {provisions.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-slate-800 mb-3">
                <FileText className="h-6 w-6 text-slate-500" />
              </div>
              <p className="text-sm text-slate-500">No provisions extracted from analysis</p>
            </div>
          ) : provisions.map((p, i) => (
            <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden hover:border-slate-700 transition-colors">
              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-2 px-5 py-3 bg-slate-950/40 border-b border-slate-800">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-sm font-semibold text-white truncate">{p.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 uppercase font-bold flex-shrink-0">{p.category}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                  <span className={"text-[10px] px-2 py-0.5 rounded-full font-bold uppercase " + (diffColor[p.difference] || diffColor.moderate)}>
                    {p.difference}
                  </span>
                  <span className="text-xs text-slate-500">Favors: <span className="text-white font-semibold">{p.favors}</span></span>
                  <span className={"text-xs font-semibold " + (marketColor[p.marketStandard] || 'text-slate-400')}>
                    {p.marketStandard === 'above' ? '↑ market' : p.marketStandard === 'below' ? '↓ market' : '= market'}
                  </span>
                  <button onClick={() => { setRewriteTarget(p); setActiveTab('suggestions'); }}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/40 transition-colors font-semibold uppercase">
                    Rewrite
                  </button>
                </div>
              </div>

              {/* Side-by-side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-blue-400 text-[10px] font-bold uppercase tracking-wider truncate">{contractA.name || 'Contract A'}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{p.contractA || <span className="text-slate-600 italic">Not present in this contract</span>}</p>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider truncate">{contractB.name || 'Contract B'}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{p.contractB || <span className="text-slate-600 italic">Not present in this contract</span>}</p>
                </div>
              </div>

              {/* Issues + AI suggestion footer */}
              {(p.issues?.length > 0 || p.suggestion) && (
                <div className="px-5 py-3 bg-indigo-950/20 border-t border-slate-800 space-y-2">
                  {p.issues?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {p.issues.map((issue, j) => (
                        <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {issue}
                        </span>
                      ))}
                    </div>
                  )}
                  {p.suggestion && (
                    <p className="text-xs text-indigo-300 flex items-start gap-2">
                      <Sparkles className="h-3 w-3 text-indigo-400 mt-0.5 flex-shrink-0" />
                      <span>{p.suggestion}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── REWRITE TAB ── */}
      {activeTab === 'suggestions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
          {/* Left: pick provision + mode */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-slate-400" />
                <h3 className="text-base font-semibold text-white">Select a Provision</h3>
              </div>
              {provisions.length === 0 ? (
                <p className="text-sm text-slate-500">No provisions to rewrite</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {provisions.map((p, i) => (
                    <button key={i} onClick={() => setRewriteTarget(p)}
                      className={"w-full text-left px-3 py-2 rounded-xl text-sm transition-all " + (rewriteTarget?.name === p.name ? 'bg-indigo-600 text-white' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800')}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">{p.name}</span>
                        <span className={"text-[10px] uppercase font-bold flex-shrink-0 " + (diffColor[p.difference] || diffColor.moderate)}>{p.difference}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <h3 className="text-base font-semibold text-white">Rewrite Mode</h3>
              </div>
              <div className="space-y-2">
                {[
                  { v: 'simplify', label: 'Simplify', desc: 'Plain English, remove legal jargon' },
                  { v: 'align',    label: 'Align',    desc: 'Merge both versions substantively' },
                  { v: 'robust',   label: 'Robust',   desc: 'More comprehensive & protective' },
                ].map(mode => (
                  <button key={mode.v} onClick={() => setRewriteMode(mode.v)}
                    className={"w-full text-left px-4 py-3 rounded-xl transition-all " + (rewriteMode === mode.v ? 'bg-indigo-600/20 border border-indigo-500/40 text-white' : 'bg-slate-800/40 border border-transparent text-slate-400 hover:bg-slate-800')}>
                    <div className="font-semibold text-sm">{mode.label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{mode.desc}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => rewriteTarget && rewriteProvision(rewriteTarget)}
                disabled={!rewriteTarget || rewriteLoading}
                className={"w-full mt-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 " + (rewriteTarget && !rewriteLoading ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed')}>
                <Sparkles className="h-4 w-4" />
                {rewriteLoading ? 'Rewriting...' : 'Generate Rewrite'}
              </button>
            </div>
          </div>

          {/* Right: result */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <h3 className="text-base font-semibold text-white">Rewritten Provision</h3>
            </div>
            {rewriteTarget && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-800/40 border border-slate-800 p-3">
                  <div className="text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-1">Original A</div>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">{rewriteTarget.contractA || '—'}</p>
                </div>
                <div className="rounded-xl bg-slate-800/40 border border-slate-800 p-3">
                  <div className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-1">Original B</div>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">{rewriteTarget.contractB || '—'}</p>
                </div>
              </div>
            )}
            <div className="rounded-xl bg-indigo-950/20 border border-indigo-500/20 p-4 min-h-32">
              {rewriteLoading ? (
                <div className="flex items-center gap-3 text-indigo-400">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  <span className="text-sm">Claude AI is rewriting...</span>
                </div>
              ) : rewriteResult ? (
                <>
                  <div className="text-indigo-300 text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" /> AI Rewrite — {rewriteMode}
                  </div>
                  <p className="text-sm text-white leading-relaxed">{rewriteResult}</p>
                  <button onClick={() => { navigator.clipboard?.writeText(rewriteResult); toast.success('Copied to clipboard'); }}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-xs font-semibold transition-colors">
                    Copy
                  </button>
                </>
              ) : (
                <p className="text-sm text-slate-500">Select a provision and click Generate Rewrite</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CHAT TAB ── */}
      {activeTab === 'chat' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col" style={{ height: '65vh' }}>
          <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">Ask AI About These Contracts</div>
              <div className="text-xs text-slate-500">Ask about specific clauses, risks, or recommendations</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {chatMessages.map((msg, i) => (
              <div key={i} className={"flex " + (msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={"max-w-2xl px-4 py-2.5 rounded-2xl text-sm leading-relaxed " + (
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-slate-800/60 text-slate-200 border border-slate-800 rounded-bl-sm'
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800/60 border border-slate-800 px-4 py-2.5 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: i*0.15 + 's' }} />)}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="px-4 py-2 border-t border-slate-800 flex flex-wrap gap-2">
            {['What are the key differences?','Which contract is riskier?','Summarize liability clauses','Any missing standard clauses?'].map(q => (
              <button key={q} onClick={() => setChatInput(q)}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors border border-slate-800">
                {q}
              </button>
            ))}
          </div>
          <div className="px-4 pb-4 pt-2 flex gap-2">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
              placeholder="Ask anything about these contracts..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
            />
            <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
              className={"px-4 py-2 rounded-xl font-semibold text-sm transition-all " + (!chatInput.trim() || chatLoading ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white')}>
              Send →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
