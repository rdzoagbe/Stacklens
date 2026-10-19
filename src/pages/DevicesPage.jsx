import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CalendarClock, Download, Info, Laptop, Monitor, Package, PackageCheck, Pencil, Plus, Search,
  Smartphone, Tablet, Trash2, Upload,
} from 'lucide-react';
import { useDbQuery, useDbMutations } from '../hooks/useDbQuery';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { formatMoney } from '../lib/currency';
import { todayISO } from '../lib/db';
import { downloadText, parseCsv } from '../lib/dataUtils';
import {
  ASSET_KINDS, ASSET_STATUSES, COVERAGE_TYPES, COVERAGE_SOON_DAYS, ASSET_CSV_TEMPLATE,
  assetSummary, assetsCsvFile, assetsFromCsv, coverageEnding, coverageState, devicesToReturn, holderFields, holderOf, mdmConcerns,
} from '../lib/assets';
import { Button, Input, Modal, Select, SkeletonRow, Textarea } from '../components/ui';
import { RoleGate, hasRole } from '../components/gates';
import { IntuneDevicesCard } from '../components/IntuneDevicesCard';
import { AppShell } from '../components/AppShell';

// The hardware register (lib/assets.js). It records who holds which device,
// what it cost and when its warranty or lease ends. It never reaches a
// device: the banner at the top says so, and "Mark returned" only records
// that the device is back.

const LOCALE_TAG = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES', pt: 'pt-PT' };

const KIND_ICON = { laptop: Laptop, desktop: Monitor, phone: Smartphone, tablet: Tablet, monitor: Monitor, accessory: Package, other: Package };

const STATUS_TONE = {
  in_use: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  in_stock: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  in_repair: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  retired: 'bg-slate-700/50 text-slate-400 border-slate-600',
  lost: 'bg-red-500/15 text-red-300 border-red-500/30',
};

const EMPTY_FORM = {
  name: '', kind: 'laptop', serial: '', assigned_to: '', status: '',
  purchase_date: '', purchase_cost: '', coverage_type: '', coverage_end: '', notes: '',
};

function DeviceForm({ open, initial, employees, onClose, onSave, t }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [seenKey, setSeenKey] = useState(null);
  // Reset the fields whenever the dialog opens on another device (or a new one).
  const key = open ? (initial?.id || 'new') : null;
  if (key !== seenKey) {
    setSeenKey(key);
    if (open) {
      setForm(initial ? {
        ...EMPTY_FORM, ...initial,
        purchase_cost: initial.purchase_cost ? String(initial.purchase_cost) : '',
      } : EMPTY_FORM);
    }
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  // People who can be handed a device, plus whoever holds this one now.
  const choices = employees.filter((e) => e.status !== 'offboarded' || e.id === form.assigned_to);

  const submit = () => {
    if (!form.name.trim() && !form.serial.trim()) {
      toast.error(t('dev_err_name'));
      return;
    }
    const holder = employees.find((e) => e.id === form.assigned_to) || null;
    // Choosing someone in the list sets the holder; choosing nobody clears it,
    // even if the device was held by someone no longer in the people list.
    const holderPatch = form.assigned_to === (initial?.assigned_to || '') && !holder
      ? {}
      : holderFields(holder);
    onSave({ ...form, ...holderPatch, status: form.status || undefined });
  };

  return (
    <Modal open={open} onClose={onClose}
      title={initial ? t('dev_edit_title') : t('dev_add_title')}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
          <Button onClick={submit}>{t('save')}</Button>
        </div>
      )}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block sm:col-span-2">
          <span className="text-xs text-slate-400">{t('dev_fld_name')}</span>
          <Input value={form.name} onChange={set('name')} placeholder="MacBook Air 13 M3" />
        </label>
        <label className="block">
          <span className="text-xs text-slate-400">{t('dev_fld_kind')}</span>
          <Select value={form.kind} onChange={set('kind')}>
            {ASSET_KINDS.map((k) => <option key={k} value={k}>{t(`dev_kind_${k}`)}</option>)}
          </Select>
        </label>
        <label className="block">
          <span className="text-xs text-slate-400">{t('dev_fld_serial')}</span>
          <Input value={form.serial} onChange={set('serial')} />
        </label>
        <label className="block">
          <span className="text-xs text-slate-400">{t('dev_fld_holder')}</span>
          <Select value={form.assigned_to} onChange={set('assigned_to')}>
            <option value="">{t('dev_nobody')}</option>
            {choices.map((e) => <option key={e.id} value={e.id}>{e.full_name || e.email}</option>)}
          </Select>
          {initial && !initial.assigned_to && initial.assigned_email && (
            <span className="text-[11px] text-slate-500">{t('dev_holder_not_listed').replace('{who}', initial.assigned_name || initial.assigned_email)}</span>
          )}
        </label>
        <label className="block">
          <span className="text-xs text-slate-400">{t('dev_fld_status')}</span>
          <Select value={form.status} onChange={set('status')}>
            <option value="">{t('dev_status_auto')}</option>
            {ASSET_STATUSES.map((s) => <option key={s} value={s}>{t(`dev_st_${s}`)}</option>)}
          </Select>
        </label>
        <label className="block">
          <span className="text-xs text-slate-400">{t('dev_fld_purchase_date')}</span>
          <Input type="date" value={form.purchase_date} onChange={set('purchase_date')} />
        </label>
        <label className="block">
          <span className="text-xs text-slate-400">{t('dev_fld_cost')}</span>
          <Input inputMode="decimal" value={form.purchase_cost} onChange={set('purchase_cost')} />
        </label>
        <label className="block">
          <span className="text-xs text-slate-400">{t('dev_fld_coverage_type')}</span>
          <Select value={form.coverage_type} onChange={set('coverage_type')}>
            <option value="">{t('dev_cov_none')}</option>
            {COVERAGE_TYPES.map((c) => <option key={c} value={c}>{t(`dev_cov_${c}`)}</option>)}
          </Select>
        </label>
        <label className="block">
          <span className="text-xs text-slate-400">{t('dev_fld_coverage_end')}</span>
          <Input type="date" value={form.coverage_end} onChange={set('coverage_end')} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs text-slate-400">{t('dev_fld_notes')}</span>
          <Textarea rows={2} value={form.notes} onChange={set('notes')} />
        </label>
      </div>
    </Modal>
  );
}

function ImportDevices({ open, employees, onClose, onImport, t }) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    try { return assetsFromCsv(parseCsv(text), employees); } catch { return null; }
  }, [text, employees]);

  const readFile = async (file) => {
    if (!file) return;
    setText(await file.text());
  };
  const close = () => { setText(''); onClose(); };

  return (
    <Modal open={open} onClose={close} title={t('dev_import_title')} subtitle={t('dev_import_sub')}
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => downloadText('devices-template.csv', ASSET_CSV_TEMPLATE)}>
            <Download className="h-4 w-4" /> {t('dev_import_template')}
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={close}>{t('cancel')}</Button>
            <Button disabled={!parsed?.records.length}
              onClick={() => { onImport(parsed.records); setText(''); }}>
              {t('dev_import_cta').replace('{n}', parsed?.records.length || 0)}
            </Button>
          </div>
        </div>
      )}>
      <div className="space-y-3">
        <input type="file" accept=".csv,text/csv" aria-label={t('dev_import_file')}
          onChange={(e) => readFile(e.target.files?.[0])}
          className="block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200" />
        <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={ASSET_CSV_TEMPLATE.split('\n')[0]} aria-label={t('dev_import_paste')} />
        <p className="text-xs text-slate-500">{t('dev_import_hint')}</p>
        {parsed && (
          <div className="text-xs text-slate-400 space-y-1" data-testid="device-import-preview">
            <div>{t('dev_import_ready').replace('{n}', parsed.records.length)}</div>
            {parsed.skipped > 0 && <div className="text-amber-300">{t('dev_import_skipped').replace('{n}', parsed.skipped)}</div>}
            {parsed.unmatched > 0 && <div className="text-amber-300">{t('dev_import_unmatched').replace('{n}', parsed.unmatched)}</div>}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function DevicesPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const { data: db, isLoading } = useDbQuery();
  const muts = useDbMutations();

  const assets = useMemo(() => db?.assets || [], [db]);
  const employees = useMemo(() => db?.employees || [], [db]);
  const summary = useMemo(() => assetSummary(db), [db]);
  const toReturn = useMemo(() => devicesToReturn(db), [db]);
  const ending = useMemo(() => coverageEnding(db), [db]);
  // Devices the last Intune read flagged (lib/assets.js mdmConcerns).
  const attention = useMemo(() => assets.filter((a) => mdmConcerns(a).length > 0), [assets]);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const money = (n) => formatMoney(n, language);
  const exportCsv = () => {
    const { filename, text } = assetsCsvFile(assets, language, todayISO());
    downloadText(filename, text);
    toast.success(t('dev_exported').replace('{n}', assets.length));
  };
  const fmtDate = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString(LOCALE_TAG[language] || 'en-GB') : '—');
  const holderLabel = (a) => {
    const p = holderOf(a, employees);
    return p ? (p.full_name || p.email) : (a.assigned_name || a.assigned_email || '');
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (status && a.status !== status) return false;
      if (kind && a.kind !== kind) return false;
      if (!q) return true;
      return [a.name, a.serial, a.assigned_name, a.assigned_email, a.notes]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [assets, query, status, kind]);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (a) => { setEditing(a); setFormOpen(true); };
  const save = (input) => {
    const done = { onSuccess: () => { toast.success(t('dev_saved')); setFormOpen(false); } };
    if (editing) muts.updateAsset.mutate({ id: editing.id, patch: input }, done);
    else muts.createAsset.mutate(input, done);
  };
  const remove = (a) => {
    if (!window.confirm(t('dev_delete_confirm').replace('{name}', a.name || a.serial))) return;
    muts.deleteAsset.mutate(a.id, { onSuccess: () => toast.success(t('dev_deleted')) });
  };
  const markReturned = (a, who) => {
    if (!window.confirm(t('dev_return_confirm').replace('{name}', a.name || a.serial).replace('{who}', who))) return;
    muts.returnAsset.mutate(a.id, { onSuccess: () => toast.success(t('dev_returned_toast')) });
  };
  const runImport = (records) => {
    muts.importAssets.mutate(records, {
      onSuccess: (r) => {
        toast.success(t('dev_import_done').replace('{created}', r?.created || 0).replace('{updated}', r?.updated || 0));
        setImportOpen(false);
      },
    });
  };

  const kpis = [
    { label: t('dev_kpi_total'), value: summary.total, border: 'border-l-blue-500', tone: 'text-white' },
    { label: t('dev_kpi_in_use'), value: summary.in_use, border: 'border-l-blue-500', tone: 'text-blue-400' },
    { label: t('dev_kpi_in_stock'), value: summary.in_stock, border: 'border-l-emerald-500', tone: 'text-emerald-400' },
    { label: t('dev_kpi_to_return'), value: summary.to_return, border: summary.to_return ? 'border-l-red-500' : 'border-l-slate-700', tone: summary.to_return ? 'text-red-400' : 'text-slate-500' },
    { label: t('dev_kpi_coverage').replace('{n}', COVERAGE_SOON_DAYS), value: summary.coverage_soon, border: summary.coverage_soon ? 'border-l-amber-500' : 'border-l-slate-700', tone: summary.coverage_soon ? 'text-amber-400' : 'text-slate-500' },
  ];

  return (
    <AppShell
      title={t('nav_devices')}
      right={(
        <div className="flex gap-2">
          {/* Everyone who can read the register can take it away as a spreadsheet. */}
          {assets.length > 0 && (
            <Button variant="secondary" onClick={exportCsv}>
              <Download className="h-4 w-4" /> {t('dev_export')}
            </Button>
          )}
          <RoleGate requires="editor">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" /> {t('dev_import')}
              </Button>
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" /> {t('dev_add')}
              </Button>
            </div>
          </RoleGate>
        </div>
      )}
    >
      <div className="space-y-6">
        <div className="flex items-start gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 lg:p-5">
          <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-blue-300">{t('dev_tracked_title')}</div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{t('dev_tracked_body')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-4 border-l-4 ${k.border}`}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{k.label}</div>
              <div className={`text-2xl font-black ${k.tone}`}>{k.value}</div>
            </div>
          ))}
        </div>

        {toReturn.length > 0 && (
          <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
            <h2 className="text-base font-semibold text-red-300">{t('dev_return_title').replace('{n}', toReturn.length)}</h2>
            <p className="text-sm text-slate-400 mt-1 mb-4">{t('dev_return_body')}</p>
            <div className="space-y-2">
              {toReturn.map(({ asset, employee }) => (
                <div key={asset.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/20 bg-slate-900/50 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{asset.name || asset.serial}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {employee.full_name || employee.email} · {t(employee.status === 'offboarded' ? 'dev_left_on' : 'dev_leaving_on').replace('{date}', fmtDate(employee.end_date))}
                      {asset.serial ? ` · ${asset.serial}` : ''}
                    </div>
                  </div>
                  <RoleGate requires="editor">
                    <Button size="sm" variant="secondary" onClick={() => markReturned(asset, employee.full_name || employee.email)}>
                      <PackageCheck className="h-4 w-4" /> {t('dev_mark_returned')}
                    </Button>
                  </RoleGate>
                </div>
              ))}
            </div>
            <Link to="/offboarding" className="inline-block mt-3 text-xs text-slate-400 hover:text-white">{t('dev_go_offboarding')} →</Link>
          </section>
        )}

        {ending.length > 0 && (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
            <h2 className="text-base font-semibold text-amber-300 flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> {t('dev_coverage_title').replace('{n}', ending.length).replace('{days}', COVERAGE_SOON_DAYS)}
            </h2>
            <p className="text-sm text-slate-400 mt-1 mb-3">{t('dev_coverage_body')}</p>
            <ul className="space-y-1 text-sm">
              {ending.map((a) => (
                <li key={a.id} className="flex flex-wrap gap-x-2 text-slate-300">
                  <span className="font-semibold text-white">{a.name || a.serial}</span>
                  <span className="text-slate-500">{a.coverage_type ? t(`dev_cov_${a.coverage_type}`) : t('dev_fld_coverage_end')} · {fmtDate(a.coverage_end)}</span>
                  {holderLabel(a) && <span className="text-slate-500">· {holderLabel(a)}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {attention.length > 0 && (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5" data-testid="itn-attention">
            <h2 className="text-base font-semibold text-amber-300">{t('itn_attention_title').replace('{n}', attention.length)}</h2>
            <p className="text-sm text-slate-400 mt-1 mb-3">{t('itn_attention_body')}</p>
            <ul className="space-y-1 text-sm">
              {attention.map((a) => (
                <li key={a.id} className="flex flex-wrap gap-x-2 text-slate-300">
                  <span className="font-semibold text-white">{a.name || a.serial}</span>
                  <span className="text-amber-300">{mdmConcerns(a).map((c) => t(`itn_concern_${c}`)).join(' · ')}</span>
                  {holderLabel(a) && <span className="text-slate-500">· {holderLabel(a)}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {db && <IntuneDevicesCard db={db} canEdit={hasRole('editor')} t={t} />}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 p-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-slate-500 absolute left-3 top-3" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('dev_search')} className="pl-9" aria-label={t('dev_search')} />
            </div>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48" aria-label={t('dev_fld_status')}>
              <option value="">{t('dev_all_statuses')}</option>
              {ASSET_STATUSES.map((s) => <option key={s} value={s}>{t(`dev_st_${s}`)}</option>)}
            </Select>
            <Select value={kind} onChange={(e) => setKind(e.target.value)} className="sm:w-48" aria-label={t('dev_fld_kind')}>
              <option value="">{t('dev_all_kinds')}</option>
              {ASSET_KINDS.map((k) => <option key={k} value={k}>{t(`dev_kind_${k}`)}</option>)}
            </Select>
          </div>

          {isLoading || !db ? (
            <div className="p-6"><SkeletonRow cols={5} /></div>
          ) : assets.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-slate-800 mb-3"><Laptop className="h-6 w-6 text-slate-400" /></div>
              <h3 className="text-base font-semibold text-white mb-1">{t('dev_empty_title')}</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">{t('dev_empty_body')}</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">{t('dev_no_match')}</div>
          ) : (
            <div className="divide-y divide-slate-800">
              {rows.map((a) => {
                const Icon = KIND_ICON[a.kind] || Package;
                const cov = coverageState(a);
                const who = holderLabel(a);
                const listed = !!holderOf(a, employees);
                return (
                  <div key={a.id} className="flex flex-wrap items-center gap-3 p-4" data-testid="device-row">
                    <div className="p-2 rounded-lg bg-slate-800 flex-shrink-0"><Icon className="h-4 w-4 text-slate-300" /></div>
                    <div className="flex-1 min-w-[180px]">
                      <div className="text-sm font-semibold text-white truncate">{a.name || a.serial}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {t(`dev_kind_${a.kind}`)}{a.serial ? ` · ${a.serial}` : ''}{a.purchase_cost > 0 ? ` · ${money(a.purchase_cost)}` : ''}
                      </div>
                      {a.mdm && (
                        <div className="text-[11px] text-slate-500 truncate" data-testid="device-mdm">
                          {t('itn_row').replace('{os}', [a.mdm.os, a.mdm.os_version].filter(Boolean).join(' ') || '—').replace('{date}', fmtDate(a.mdm.last_sync))}
                          {mdmConcerns(a).map((c) => (
                            <span key={c} className="ml-2 text-amber-300 font-semibold">{t(`itn_concern_${c}`)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="w-44 min-w-0 text-xs">
                      <div className="text-slate-300 truncate">{who || <span className="text-slate-500">{t('dev_nobody')}</span>}</div>
                      {who && !listed && <div className="text-[10px] text-slate-500">{t('dev_not_in_people')}</div>}
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_TONE[a.status] || STATUS_TONE.in_stock}`}>
                      {t(`dev_st_${a.status}`)}
                    </span>
                    <div className="w-36 text-xs">
                      {a.coverage_end ? (
                        <span className={cov === 'expired' ? 'text-red-400' : cov === 'soon' ? 'text-amber-400' : 'text-slate-400'}>
                          {a.coverage_type ? `${t(`dev_cov_${a.coverage_type}`)} · ` : ''}{cov === 'expired' ? t('dev_ended') : t('dev_until')} {fmtDate(a.coverage_end)}
                        </span>
                      ) : <span className="text-slate-500">—</span>}
                    </div>
                    <RoleGate requires="editor">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(a)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label={t('dev_edit_title')}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => remove(a)} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800" aria-label={t('dev_delete')}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </RoleGate>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <DeviceForm open={formOpen} initial={editing} employees={employees}
        onClose={() => setFormOpen(false)} onSave={save} t={t} />
      <ImportDevices open={importOpen} employees={employees}
        onClose={() => setImportOpen(false)} onImport={runImport} t={t} />
    </AppShell>
  );
}
