import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle, Check, ChevronRight, Download,
  RefreshCw, Upload,
} from 'lucide-react';
import { parseCsv, downloadText } from '../lib/dataUtils';
import { useDbMutations } from '../hooks/useDbQuery';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { Card, CardHeader, CardBody, Pill } from './ui';

export function ImportWizard({ defaultKind = null, onDone = null }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const muts = useDbMutations();
  const [step, setStep] = useState(defaultKind ? 2 : 0);
  const [kind, setKind] = useState(defaultKind);
  const [text, setText] = useState('');
  const [imported, setImported] = useState(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [, setAnimDir] = useState('forward');

  const goTo = (n) => { setAnimDir(n > step ? 'forward' : 'back'); setStep(n); };

  const KINDS = {
    company:   { icon: '🏢', label: t('company_data_label'),           desc: t('import_kinds_company_desc'),   example: t('import_kinds_company_example'),   color: 'blue' },
    tools:     { icon: '🛠️', label: t('import_kinds_tools_label'),     desc: t('import_kinds_tools_desc'),     example: t('import_kinds_tools_example'),     color: 'emerald' },
    employees: { icon: '👥', label: t('employees_import'),             desc: t('import_kinds_employees_desc'), example: t('import_kinds_employees_example'), color: 'blue' },
    access:    { icon: '🔑', label: t('import_kinds_access_label'),    desc: t('import_kinds_access_desc'),    example: t('import_kinds_access_example'),    color: 'violet' },
  };

  const TEMPLATES = {
    company:   'employee_name,employee_email,department,role,employee_status,start_date,tool_name,tool_category,tool_cost_monthly,tool_url,tool_status,tool_criticality,renewal_date,access_level\nAlice Martin,alice@co.com,engineering,Engineer,active,2023-01-15,GitHub,engineering,320,https://github.com,active,high,2026-11-15,admin\nAlice Martin,alice@co.com,engineering,Engineer,active,2023-01-15,Slack,communication,240,https://slack.com,active,high,2026-12-01,member\nBob Johnson,bob@co.com,sales,Manager,active,2022-06-01,Salesforce,sales,1200,https://salesforce.com,active,high,2027-01-01,admin',
    tools:     'name,category,owner_email,owner_name,criticality,url,status,cost_per_month\nSlack,communication,jane@co.com,Jane Smith,high,https://slack.com,active,299\nNotion,productivity,tom@co.com,Tom Brown,medium,https://notion.so,active,120\nFigma,design,amy@co.com,Amy Lee,high,https://figma.com,active,75',
    employees: 'full_name,email,department,role,status,start_date\nJane Smith,jane@co.com,Engineering,Engineer,active,2025-01-01\nTom Brown,tom@co.com,Marketing,Manager,active,2024-06-15\nAmy Lee,amy@co.com,Design,Designer,active,2025-03-01',
    access:    'tool_name,employee_email,access_level,granted_date,status\nSlack,jane@co.com,admin,2025-01-01,active\nNotion,tom@co.com,editor,2025-02-01,active\nFigma,amy@co.com,owner,2025-03-01,active',
  };

  const COLS     = { company: ['employee_name','employee_email','department','tool_name','tool_category','access_level'], tools: ['name','category','status','criticality','cost_per_month','owner_name'], employees: ['full_name','email','department','role','status'], access: ['tool_name','employee_email','access_level','status'] };
  const REQUIRED = { company: ['employee_name','employee_email','tool_name'], tools: ['name'], employees: ['full_name','email'], access: ['tool_name','employee_email'] };

  const liveRows = useMemo(() => { if (!text.trim()) return []; try { return parseCsv(text); } catch { return []; } }, [text]);
  const cols = kind ? COLS[kind] : [];
  const isRowValid = (row) => kind ? REQUIRED[kind].every(k => row[k]?.trim()) : false;
  const validCount   = liveRows.filter(isRowValid).length;
  const invalidCount = liveRows.length - validCount;

  const handleFileUpload = async (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    let csv;
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      if (!window.XLSX) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const ab = await file.arrayBuffer();
      const wb = window.XLSX.read(ab, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      csv = window.XLSX.utils.sheet_to_csv(ws);
    } else {
      csv = await new Promise((res) => {
        const reader = new FileReader();
        reader.onload = (e) => res(e.target.result);
        reader.readAsText(file);
      });
    }
    setText(csv);
    const detected = detectKind(csv);
    if (detected) {
      setKind(detected);
      toast.success('Detected: ' + (KINDS[detected]?.label || detected));
    }
    goTo(2);
  };

  const handleImport = async () => {
    if (!liveRows.length || !kind) return;
    setImporting(true);
    try {
      await muts.bulkImport.mutateAsync({ kind, records: liveRows });
      await new Promise(r => setTimeout(r, 1500));
      setImported({ count: liveRows.length, kind });
      if (onDone) setTimeout(onDone, 2000);
      goTo(3);
    } finally { setImporting(false); }
  };

  const reset = () => { setStep(0); setKind(null); setText(''); setImported(null); };

  const STEP_LABELS = [t('import_step1'), t('import_step2') || 'Get template', t('import_step3'), t('import_step4') || t('done')];

  const detectKind = (csvText) => {
    const firstLine = csvText.split('\n')[0].toLowerCase();
    const scores = { company: 0, tools: 0, employees: 0, access: 0 };

    const hasEmployeeFields = firstLine.includes('employee_name') || firstLine.includes('employee_email');
    const hasToolFields = firstLine.includes('tool_name') || firstLine.includes('tool_category') || firstLine.includes('tool_cost');
    const hasAccessLevel = firstLine.includes('access_level');

    if (hasEmployeeFields && hasToolFields) {
      scores.company += 10;
      if (hasAccessLevel) scores.company += 3;
    }

    if (firstLine.includes('cost_per_month') || (firstLine.match(/(^|,)name(,|$)/) && !hasEmployeeFields && !hasToolFields)) {
      scores.tools += 5;
    }

    if ((firstLine.includes('full_name') || firstLine.includes('department')) && !hasToolFields) {
      scores.employees += 5;
    }

    if (firstLine.includes('tool_name') && firstLine.includes('access_level') && !firstLine.includes('tool_category') && !firstLine.includes('tool_cost')) {
      scores.access += 5;
    }

    const best = Object.entries(scores).sort((a,b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : null;
  };

  const handlePaste = (val) => {
    setText(val);
    const detected = detectKind(val);
    if (detected && detected !== kind) {
      setKind(detected);
      toast.success('Detected type: ' + KINDS[detected].label + ' — smart detection!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Animated step progress */}
      <div className="flex items-center mb-8 pr-10">
        {STEP_LABELS.map((label, i) => {
          const done = step > i;
          const active = step === i;
          return (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center">
                <div className={
                  "h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 " +
                  (done ? 'bg-emerald-500 text-white scale-90' : active ? 'bg-blue-600 text-white ring-4 ring-blue-600/25 scale-110' : 'bg-slate-800 text-slate-500')
                }>
                  {done ? '✓' : i + 1}
                </div>
                <div className={"text-[10px] mt-1.5 font-semibold whitespace-nowrap transition-colors " + (active ? 'text-white' : done ? 'text-emerald-400' : 'text-slate-600')}>{label}</div>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={"flex-1 h-0.5 mx-3 mb-5 transition-all duration-500 " + (step > i ? 'bg-emerald-500' : 'bg-slate-800')} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* STEP 0 — Choose what to import */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-r from-blue-500/10 to-emerald-500/5 border border-blue-500/20 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">💡</span>
              <div>
                <div className="font-bold text-white mb-1">{t("hc_fastest_way_to_get_started")}</div>
                <p className="text-sm text-slate-400">{t('import_wizard_info')}</p>
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-1">{t('what_importing')}</h2>
            <p className="text-slate-400 text-sm mb-4">{t('import_each_type_info')}</p>
            <div className="grid gap-3">
              {Object.entries(KINDS).map(([id, meta]) => (
                <button key={id} onClick={() => { setKind(id); goTo(1); }}
                  className={"flex items-center gap-4 p-5 rounded-2xl border transition-all text-left hover:scale-[1.01] active:scale-[0.99] " + (kind === id ? 'border-' + meta.color + '-500/40 bg-' + meta.color + '-500/5' : 'border-slate-800 bg-slate-900/40 hover:border-slate-700')}>
                  <div className="text-4xl flex-shrink-0">{meta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white text-lg">{meta.label}</div>
                    <div className="text-sm text-slate-400">{meta.desc}</div>
                    <div className="text-xs text-slate-600 mt-0.5">e.g. {meta.example}</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-600 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 1 — Template */}
      {step === 1 && kind && (
        <div className="space-y-5">
          <button onClick={() => goTo(0)} className="text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1">← {t('back')}</button>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{KINDS[kind].icon}</span>
            <div>
              <h2 className="text-xl font-bold text-white">{t('import_heading')} {KINDS[kind].label}</h2>
              <p className="text-slate-400 text-sm">{KINDS[kind].desc}</p>
            </div>
          </div>

          <Card className="p-5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">{t('template_columns')}</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {TEMPLATES[kind].split('\n')[0].split(',').map(col => (
                <span key={col} className={"text-xs px-2.5 py-1 rounded-full font-mono " + (REQUIRED[kind].includes(col) ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400')}>
                  {col}{REQUIRED[kind].includes(col) ? ' *' : ''}
                </span>
              ))}
            </div>
            <div className="text-xs text-slate-600">{t('import_required_note')}</div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="text-sm font-bold text-white">{t('preview_title')}</div>
              <span className="text-xs text-slate-500">{t("hc_this_is_what_your_csv_should_look_l")}</span>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60">
                    {TEMPLATES[kind].split('\n')[0].split(',').map(col => (
                      <th key={col} className="text-left py-2.5 px-4 text-slate-500 font-semibold whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TEMPLATES[kind].split('\n').slice(1).map((row, i) => (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      {row.split(',').map((cell, j) => (
                        <td key={j} className="py-2.5 px-4 text-slate-300 whitespace-nowrap">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid sm:grid-cols-2 gap-3">
            <button onClick={() => downloadText(kind + '_template.csv', TEMPLATES[kind])}
              className="flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition-all active:scale-[0.98]">
              <Download className="h-4 w-4" /> {t('download_template')}
            </button>
            <button onClick={() => { setText(TEMPLATES[kind]); goTo(2); }}
              className="flex items-center justify-center gap-2 py-3.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-all text-slate-300">
              {t('import_use_sample')}
            </button>
          </div>
          <div className="text-center">
            <button onClick={() => goTo(2)} className="text-sm text-emerald-400 hover:underline">{t('skip_to_upload')}</button>
          </div>
        </div>
      )}

      {/* STEP 2 — Upload */}
      {step === 2 && (
        <div className="space-y-4">
          <button onClick={() => goTo(kind ? 1 : 0)} className="text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1">← {t('back')}</button>

          {kind && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5">
              <span className="text-lg">{KINDS[kind].icon}</span>
              <span>{t('import_as_label')} <span className="text-white font-semibold">{KINDS[kind].label}</span></span>
              <button onClick={() => goTo(0)} className="ml-auto text-blue-400 hover:text-blue-300 font-semibold">{t('back')}</button>
            </div>
          )}

          <Card className="p-4 md:p-6">
            <h2 className="text-xl font-bold text-white mb-1">{t('upload')}</h2>
            <p className="text-slate-400 text-sm mb-5">{t('import_drag_and_drop_desc')}</p>

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files[0]); }}
              onClick={() => document.getElementById('csv-import-input').click()}
              className={"relative rounded-2xl border-2 border-dashed flex flex-col items-center justify-center py-14 mb-5 cursor-pointer transition-all duration-200 " + (dragOver ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]' : 'border-slate-700 hover:border-slate-500 bg-slate-900/40')}
            >
              <input id="csv-import-input" type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={e => handleFileUpload(e.target.files[0])} />
              <div className={"text-2xl md:text-5xl mb-3 transition-all " + (dragOver ? 'scale-125' : '')}>{dragOver ? '📂' : '📁'}</div>
              <div className={"font-bold text-lg transition-colors " + (dragOver ? 'text-emerald-400' : 'text-slate-300')}>
                {dragOver ? t('import_drag_release') : t('import_drag_drop')}
              </div>
              <div className="text-sm text-slate-500 mt-1">{t('import_click_browse')}</div>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-700">
                <span className="px-2 py-0.5 bg-slate-800 rounded font-mono">CSV</span>
                <span className="px-2 py-0.5 bg-slate-800 rounded font-mono">TXT</span>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-x-0 -top-2.5 flex justify-center">
                <span className="text-xs text-slate-600 bg-slate-950 px-3">{t('import_paste_or_csv')}</span>
              </div>
              <textarea rows={4}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 font-mono text-xs text-slate-300 outline-none focus:border-emerald-500 transition-colors resize-none"
                value={text} onChange={e => handlePaste(e.target.value)}
                placeholder={t('import_paste_placeholder')} />
            </div>

            {liveRows.length > 0 && (
              <div className="flex items-center gap-3 mt-3 text-sm flex-wrap">
                <span className="text-slate-500">{liveRows.length} {t('rows_detected')}</span>
                {validCount > 0 && <span className="text-emerald-400 font-semibold">✓ {validCount} {t('valid')}</span>}
                {invalidCount > 0 && <span className="text-rose-400 font-semibold">✗ {invalidCount} {t('import_errors_label')}</span>}
              </div>
            )}
          </Card>

          {liveRows.length > 0 && kind && (
            <Card>
              <CardHeader title={t('preview_title')} subtitle={liveRows.length + " " + t('import_review_before')}
                right={<div className="flex gap-2">{validCount > 0 && <Pill tone="green">✓ {validCount} valid</Pill>}{invalidCount > 0 && <Pill tone="rose">✗ {invalidCount} errors</Pill>}</div>}
              />
              <CardBody>
                <div className="overflow-x-auto w-full">
                <div className="overflow-x-auto w-full"><table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60">
                        <th className="px-3 py-2 text-left text-slate-500 font-semibold w-8">#</th>
                        {cols.map(c => <th key={c} className="px-3 py-2 text-left text-slate-400 font-semibold capitalize">{c.replace(/_/g,' ')}</th>)}
                        <th className="px-3 py-2 text-left text-slate-500">{t('status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveRows.slice(0, 10).map((row, i) => {
                        const valid = isRowValid(row);
                        return (
                          <tr key={i} className={"border-b border-slate-800/60 " + (valid ? '' : 'bg-rose-500/5')}>
                            <td className="px-3 py-2 text-slate-500">{i+1}</td>
                            {cols.map(c => (
                              <td key={c} className={"px-3 py-2 " + (!row[c]?.trim() && REQUIRED[kind].includes(c) ? 'text-rose-400' : 'text-slate-300')}>
                                {row[c] || <span className="text-slate-700 italic">—</span>}
                              </td>
                            ))}
                            <td className="px-3 py-2">
                              {valid
                                ? <span className="text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" /> OK</span>
                                : <span className="text-rose-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Missing</span>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                  {liveRows.length > 10 && <div className="text-center text-xs text-slate-600 py-2">{t('import_showing_of')} {liveRows.length} {t('rows')}</div>}
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="text-xs text-slate-500">{t('import_not_duplicated')}</div>
                  <button disabled={validCount === 0 || importing} onClick={handleImport}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-xl font-bold text-sm transition-all active:scale-[0.98]">
                    {importing
                      ? <><RefreshCw className="h-4 w-4 animate-spin" /> {t('importing')}</>
                      : <><Upload className="h-4 w-4" /> {t('import_heading')} {validCount} record{validCount !== 1 ? 's' : ''}</>
                    }
                  </button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* STEP 3 — Success */}
      {step === 3 && imported && (
        <Card className="p-10 text-center">
          <div className="text-3xl md:text-6xl mb-4 animate-bounce">🎉</div>
          <h2 className="text-2xl font-black text-white mb-2">{t("import_complete")}</h2>
          <p className="text-slate-400 mb-2">
            <span className="text-emerald-400 font-bold">{imported.count} {KINDS[imported.kind]?.label}</span> {t('import_records_added')}
          </p>
          <p className="text-sm text-slate-600 mb-8">{t('import_risk_insights')}</p>
          <div className="grid sm:grid-cols-2 gap-3 max-w-sm mx-auto">
            <button onClick={reset} className="py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold text-sm transition-all">
              {t('import_more')}
            </button>
            <button onClick={() => window.location.href = '/' + (imported.kind === 'employees' ? 'employees' : imported.kind === 'access' ? 'access' : 'tools')}
              className="py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-sm transition-all">
              {t('view')} {KINDS[imported.kind]?.label} →
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
