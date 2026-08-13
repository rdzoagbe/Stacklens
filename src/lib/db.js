import { LS_KEY } from './constants';
import { saveUserData, loadUserData } from '../firebase-config';
import { markSyncSaving, markSyncSaved, markSyncFailed } from './syncStatus';
import { format, subDays, parseISO, isValid } from 'date-fns';

// ─── ID / date helpers ────────────────────────────────────────────────────────

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function safeParseISO(s) {
  // Returns null for anything unparseable rather than an Invalid Date.
  // parseISO('not a date') yields an Invalid Date, which is truthy — callers
  // then hand it to differenceInDays and get NaN, so `NaN >= 90` is false and
  // a tool with a malformed last_used_date silently never counts as unused.
  // CSV import lets users supply arbitrary date strings, so this is reachable.
  try {
    if (!s) return null;
    const d = parseISO(s);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

// ─── Firestore-backed data layer ──────────────────────────────────────────────
// loadDb / saveDb work synchronously for React Query compat.
// Firestore sync is fire-and-forget via saveDb.

let _firestoreUid = null;

export function setFirestoreUid(newUid) { _firestoreUid = newUid; }

// The app reads all data through React Query (queryKey: ['db']). Registering the
// client here lets resetDb() clear the on-screen data instantly, instead of
// waiting for a full page reload.
let _queryClient = null;

export function setQueryClient(qc) { _queryClient = qc; }

// Early spend snapshots stored the unallocated bucket under "__unallocated__",
// which Firestore rejects as a field name ("cannot begin and end with __") —
// every cloud backup of a db containing it failed. Rename it in place so
// existing local blobs heal on load and the next saveDb persists clean data.
function _migrateSpendHistory(db) {
  if (!Array.isArray(db?.spend_history)) return db;
  db.spend_history.forEach(snap => {
    const dept = snap?.by_department;
    if (dept && Object.prototype.hasOwnProperty.call(dept, '__unallocated__')) {
      dept.unallocated = (dept.unallocated || 0) + dept.__unallocated__;
      delete dept.__unallocated__;
    }
  });
  return db;
}

export function loadDb() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try { return _migrateSpendHistory(JSON.parse(raw)); } catch { return null; }
}

const LS_SIZE_WARN_BYTES = 3 * 1024 * 1024;
const LS_SIZE_MAX_BYTES  = 4.5 * 1024 * 1024;

function _trimDbForStorage(db) {
  const trimmed = { ...db };
  // Keep all employees and tools — they're the source of truth.
  // Trim access records: sort by last_accessed_date desc, keep most recent.
  if (trimmed.access?.length > 100) {
    trimmed.access = [...trimmed.access]
      .sort((a, b) => {
        const ta = a.last_accessed_date ? new Date(a.last_accessed_date).getTime() : 0;
        const tb = b.last_accessed_date ? new Date(b.last_accessed_date).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 150);
  }
  return trimmed;
}

export function saveDb(db) {
  const serialized = JSON.stringify({ ...db, _saved_at: Date.now() });
  if (serialized.length > LS_SIZE_MAX_BYTES) {
    const trimmed = _trimDbForStorage(db);
    const trimmedSerialized = JSON.stringify({ ...trimmed, _saved_at: Date.now(), _trimmed: true });
    localStorage.setItem(LS_KEY, trimmedSerialized);
    console.warn('[Stacklens] localStorage limit reached — oldest access records archived. Sync to cloud to preserve full history.');
  } else {
    if (serialized.length > LS_SIZE_WARN_BYTES) {
      console.warn('[Stacklens] localStorage usage high:', Math.round(serialized.length / 1024), 'KB');
    }
    localStorage.setItem(LS_KEY, serialized);
  }
  // A shared-view copy (someone else's workspace, read-only) must NEVER be
  // synced to the cloud — neither to the owner's doc nor over the viewer's own.
  if (db?._shared_view) return;
  if (_firestoreUid && db?.user?.is_authenticated && !db?.user?.is_demo) {
    // Debounced: rapid consecutive edits produce one cloud write (the chunked
    // backup is several documents per save; un-debounced bursts previously
    // exhausted the Firestore write queue).
    clearTimeout(_cloudSaveTimer);
    const uid = _firestoreUid;
    _cloudSaveTimer = setTimeout(() => {
      // Observe-only: the rejection is still handled here (never rethrown), so
      // behaviour is unchanged — we just record the outcome so a failed cloud
      // backup stops being invisible to the user.
      const attempt = () => saveUserData(uid, db);
      markSyncSaving();
      attempt().then(markSyncSaved, (err) => markSyncFailed(err, attempt));
    }, 1500);
  }
}
let _cloudSaveTimer = null;

// ── Shared workspaces (read-only viewer mode) ────────────────────────────
// Entering a shared view stashes the viewer's own blob and replaces it with
// the owner's data flagged _shared_view + role 'viewer' (all existing
// RoleGates hide edit controls). saveDb refuses to cloud-sync the flagged
// copy, and hydration restores the viewer's own workspace on reload.
const OWN_BACKUP_KEY = 'sg_own_workspace_backup';

export function enterSharedView(sharedDb, meta) {
  const current = localStorage.getItem(LS_KEY);
  try {
    if (current && !JSON.parse(current)?._shared_view) localStorage.setItem(OWN_BACKUP_KEY, current);
  } catch { /* unreadable blob — don't overwrite an existing backup with it */ }
  const view = {
    ...sharedDb,
    _shared_view: meta, // { owner_uid, owner_email }
    user: { ...(sharedDb.user || {}), role: 'viewer', is_authenticated: true, is_demo: false },
  };
  localStorage.setItem(LS_KEY, JSON.stringify(view));
  return view;
}

export function exitSharedView() {
  const backup = localStorage.getItem(OWN_BACKUP_KEY);
  if (backup) {
    localStorage.setItem(LS_KEY, backup);
    localStorage.removeItem(OWN_BACKUP_KEY);
  } else {
    localStorage.removeItem(LS_KEY);
  }
}

export function getSharedView() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null')?._shared_view || null; } catch { return null; }
}

export async function hydrateFromFirestore(uid) {
  _firestoreUid = uid;
  // Never hydrate over (or cloud-compare against) a shared-view copy —
  // put the viewer's own workspace back first.
  if (getSharedView()) exitSharedView();
  try {
    const cloudData = await loadUserData(uid);
    const localData = loadDb();

    const storedUid = localStorage.getItem('sg_auth_uid');
    if (localData && storedUid && storedUid !== uid) {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem('sg_team_members');
      localStorage.removeItem('sg_api_keys');
      localStorage.removeItem('sg_notifications');
      localStorage.removeItem('sg_budget_cap');
    }
    localStorage.setItem('sg_auth_uid', uid);

    const freshLocal = loadDb();
    const localTs = freshLocal?._saved_at || 0;
    // The cloud copy is stamped _updatedAt by saveUserData (the local blob's
    // _saved_at is added at serialize time and never reaches the cloud), so
    // reading only _saved_at made cloudTs 0 — local silently won every time,
    // losing newer data saved from another device.
    const cloudTs = cloudData?._saved_at || cloudData?._updatedAt || 0;

    // Billing fields always come from Firestore (only the webhook can set them)
    const mergeBilling = (target, cloud) => {
      if (!cloud?.user) return target;
      if (!target.user) target.user = {};
      if (cloud.user.plan && cloud.user.plan !== 'free') {
        target.user.plan = cloud.user.plan;
        target.user.subscription_plan = cloud.user.plan;
      }
      target.user.stripe_customer_id  = cloud.user.stripe_customer_id  || target.user.stripe_customer_id;
      target.user.subscription_status = cloud.user.subscription_status || target.user.subscription_status;
      return target;
    };

    // No local data at all → use cloud
    if (!freshLocal || (!freshLocal.tools?.length && !freshLocal.employees?.length)) {
      if (cloudData && cloudData.tools !== undefined) {
        localStorage.setItem(LS_KEY, JSON.stringify(cloudData));
        return cloudData;
      }
      // New user — nothing in cloud either, push local stub up
      const local = loadDb();
      if (local && !local.user?.is_demo) await saveUserData(uid, local).catch(() => {});
      return local;
    }

    // Both exist — use the newer copy, always trust cloud for billing
    if (cloudData && cloudData.tools !== undefined && cloudTs > localTs) {
      localStorage.setItem(LS_KEY, JSON.stringify(cloudData));
      return cloudData;
    }

    // Local is newer (or cloud missing) — merge billing from cloud and return local
    const merged = mergeBilling(freshLocal, cloudData);
    if (merged !== freshLocal) saveDb(merged);
    return merged;
  } catch (err) {
    console.warn('Firestore hydration failed, using local cache:', err);
    return loadDb();
  }
}

export function seedDbIfEmpty() {
  const existing = loadDb();
  if (existing && existing.user && existing.user.is_authenticated && !existing.user.is_demo) {
    const fakeNames = ['__fake_seed_data_marker__'];
    const hasFake = (existing.tools || []).some(t => fakeNames.includes(t.name));
    if (hasFake) {
      const cleanDb = Object.assign({}, existing, { tools: [], employees: [], access: [] });
      saveDb(cleanDb);
      return cleanDb;
    }
    return existing;
  }
  if (existing) return existing;

  const now = new Date();
  const d = (daysAgo) => format(subDays(now, daysAgo), 'yyyy-MM-dd');

  // Demo stack for a ~12-person company. Every page now computes from this
  // seed (Finance used to ignore it and show hardcoded figures), so it has to
  // be both realistic and rich enough to tell the product's story: an
  // ex-employee who still has access, orphaned tools nobody owns, licences
  // nobody has opened in months, admin grants overdue for review, and
  // renewals landing in the next few weeks.
  const employees = [
    { id: uid('emp'), full_name: 'Amina Dupont',   email: 'amina.dupont@acme.com',   department: 'security',    role: 'Security Lead',      status: 'active',      start_date: d(420), end_date: '' },
    { id: uid('emp'), full_name: 'Lucas Martin',   email: 'lucas.martin@acme.com',   department: 'engineering', role: 'Platform Engineer',  status: 'active',      start_date: d(210), end_date: '' },
    { id: uid('emp'), full_name: 'Chloé Bernard',  email: 'chloe.bernard@acme.com',  department: 'finance',     role: 'Controller',         status: 'offboarding', start_date: d(680), end_date: d(3) },
    { id: uid('emp'), full_name: 'Noah Petit',     email: 'noah.petit@acme.com',     department: 'marketing',   role: 'Growth Manager',     status: 'offboarded',  start_date: d(980), end_date: d(35) },
    { id: uid('emp'), full_name: 'Sofia Rossi',    email: 'sofia.rossi@acme.com',    department: 'engineering', role: 'Senior Developer',   status: 'active',      start_date: d(540), end_date: '' },
    { id: uid('emp'), full_name: 'Thomas Leroy',   email: 'thomas.leroy@acme.com',   department: 'sales',       role: 'Account Executive',  status: 'active',      start_date: d(300), end_date: '' },
    { id: uid('emp'), full_name: 'Emma Girard',    email: 'emma.girard@acme.com',    department: 'design',      role: 'Product Designer',   status: 'active',      start_date: d(250), end_date: '' },
    { id: uid('emp'), full_name: 'Hugo Moreau',    email: 'hugo.moreau@acme.com',    department: 'engineering', role: 'DevOps Engineer',    status: 'active',      start_date: d(150), end_date: '' },
    { id: uid('emp'), full_name: 'Léa Fontaine',   email: 'lea.fontaine@acme.com',   department: 'hr',          role: 'People Manager',     status: 'active',      start_date: d(610), end_date: '' },
    { id: uid('emp'), full_name: 'Karim Benali',   email: 'karim.benali@acme.com',   department: 'sales',       role: 'Sales Manager',      status: 'active',      start_date: d(480), end_date: '' },
    { id: uid('emp'), full_name: 'Julie Mercier',  email: 'julie.mercier@acme.com',  department: 'marketing',   role: 'Content Lead',       status: 'active',      start_date: d(190), end_date: '' },
    { id: uid('emp'), full_name: 'Antoine Rey',    email: 'antoine.rey@acme.com',    department: 'finance',     role: 'Financial Analyst',  status: 'offboarded',  start_date: d(720), end_date: d(60) },
  ];
  const byEmail = Object.fromEntries(employees.map(e => [e.email, e]));

  // r(n) = a renewal date n days from now, so the Renewals tab has a real queue.
  const r = (daysAhead) => format(subDays(now, -daysAhead), 'yyyy-MM-dd');

  const tools = [
    { id: uid('tool'), name: 'Slack',            category: 'communication', owner_email: 'amina.dupont@acme.com', owner_name: 'Amina Dupont',  criticality: 'high',   url: 'https://slack.com',      description: 'Company messaging + alerts',   status: 'active',   last_used_date: d(0),   cost_per_month: 312, risk_score: 'low',    mfa_required: true,  renewal_date: r(24),  notes: 'SSO enabled' },
    { id: uid('tool'), name: 'GitHub',           category: 'engineering',   owner_email: 'lucas.martin@acme.com', owner_name: 'Lucas Martin',  criticality: 'high',   url: 'https://github.com',     description: 'Source control + CI',          status: 'active',   last_used_date: d(0),   cost_per_month: 336, risk_score: 'medium', mfa_required: true,  renewal_date: r(51),  notes: 'Review admin access quarterly' },
    { id: uid('tool'), name: 'Google Workspace', category: 'operations',    owner_email: 'amina.dupont@acme.com', owner_name: 'Amina Dupont',  criticality: 'high',   url: 'https://workspace.google.com', description: 'Email, docs, calendar',  status: 'active',   last_used_date: d(0),   cost_per_month: 828, risk_score: 'low',    mfa_required: true,  renewal_date: r(96),  notes: '12 seats' },
    { id: uid('tool'), name: 'Figma',            category: 'design',        owner_email: '',                     owner_name: '',              criticality: 'medium', url: 'https://figma.com',      description: 'Design collaboration',         status: 'orphaned', last_used_date: d(16),  cost_per_month: 180, risk_score: 'high',   mfa_required: false, renewal_date: r(12),  notes: 'Owner left — needs reassigning' },
    { id: uid('tool'), name: 'HubSpot',          category: 'sales',         owner_email: 'karim.benali@acme.com', owner_name: 'Karim Benali',  criticality: 'medium', url: 'https://hubspot.com',    description: 'CRM + marketing automation',   status: 'unused',   last_used_date: d(124), cost_per_month: 690, risk_score: 'high',   mfa_required: false, renewal_date: r(9),   notes: 'Nobody has logged in for 4 months' },
    { id: uid('tool'), name: 'Notion',           category: 'operations',    owner_email: 'lea.fontaine@acme.com', owner_name: 'Léa Fontaine',  criticality: 'medium', url: 'https://notion.so',      description: 'Internal wiki + handbook',     status: 'active',   last_used_date: d(1),   cost_per_month: 144, risk_score: 'low',    mfa_required: true,  renewal_date: r(38),  notes: '' },
    { id: uid('tool'), name: 'Jira',             category: 'engineering',   owner_email: 'sofia.rossi@acme.com',  owner_name: 'Sofia Rossi',   criticality: 'high',   url: 'https://atlassian.com',  description: 'Issue tracking',               status: 'active',   last_used_date: d(0),   cost_per_month: 231, risk_score: 'low',    mfa_required: true,  renewal_date: r(63),  notes: '' },
    { id: uid('tool'), name: 'Datadog',          category: 'engineering',   owner_email: 'hugo.moreau@acme.com',  owner_name: 'Hugo Moreau',   criticality: 'high',   url: 'https://datadoghq.com',  description: 'Infrastructure monitoring',    status: 'active',   last_used_date: d(0),   cost_per_month: 445, risk_score: 'medium', mfa_required: true,  renewal_date: r(19),  notes: 'Usage-based — watch overage' },
    { id: uid('tool'), name: 'Adobe Creative Cloud', category: 'design',    owner_email: 'emma.girard@acme.com',  owner_name: 'Emma Girard',   criticality: 'medium', url: 'https://adobe.com',      description: 'Design suite',                 status: 'active',   last_used_date: d(4),   cost_per_month: 238, risk_score: 'medium', mfa_required: false, renewal_date: r(7),   notes: '4 seats, 2 rarely used' },
    { id: uid('tool'), name: 'Zoom',             category: 'communication', owner_email: 'lea.fontaine@acme.com', owner_name: 'Léa Fontaine',  criticality: 'medium', url: 'https://zoom.us',        description: 'Video meetings',               status: 'active',   last_used_date: d(2),   cost_per_month: 165, risk_score: 'low',    mfa_required: true,  renewal_date: r(74),  notes: '' },
    { id: uid('tool'), name: 'Salesforce',       category: 'sales',         owner_email: 'karim.benali@acme.com', owner_name: 'Karim Benali',  criticality: 'high',   url: 'https://salesforce.com', description: 'Pipeline + forecasting',       status: 'active',   last_used_date: d(1),   cost_per_month: 520, risk_score: 'medium', mfa_required: true,  renewal_date: r(41),  notes: '' },
    { id: uid('tool'), name: 'Mailchimp',        category: 'marketing',     owner_email: 'julie.mercier@acme.com', owner_name: 'Julie Mercier', criticality: 'low',   url: 'https://mailchimp.com',  description: 'Newsletter + campaigns',       status: 'active',   last_used_date: d(6),   cost_per_month: 89,  risk_score: 'low',    mfa_required: false, renewal_date: r(29),  notes: '' },
    { id: uid('tool'), name: 'Dropbox',          category: 'operations',    owner_email: '',                     owner_name: '',              criticality: 'low',    url: 'https://dropbox.com',    description: 'Legacy file storage',          status: 'orphaned', last_used_date: d(210), cost_per_month: 120, risk_score: 'high',   mfa_required: false, renewal_date: r(4),   notes: 'Superseded by Google Drive — candidate to cancel' },
    { id: uid('tool'), name: 'Miro',             category: 'design',        owner_email: 'emma.girard@acme.com',  owner_name: 'Emma Girard',   criticality: 'low',    url: 'https://miro.com',       description: 'Whiteboarding',                status: 'unused',   last_used_date: d(96),  cost_per_month: 96,  risk_score: 'medium', mfa_required: false, renewal_date: r(56),  notes: 'Overlaps with FigJam' },
    { id: uid('tool'), name: 'Pennylane',        category: 'finance',       owner_email: 'chloe.bernard@acme.com', owner_name: 'Chloé Bernard', criticality: 'high',  url: 'https://pennylane.com',  description: 'Accounting + invoicing',       status: 'active',   last_used_date: d(3),   cost_per_month: 199, risk_score: 'medium', mfa_required: true,  renewal_date: r(33),  notes: 'Owner is offboarding — reassign' },
    { id: uid('tool'), name: '1Password',        category: 'security',      owner_email: 'amina.dupont@acme.com', owner_name: 'Amina Dupont',  criticality: 'high',   url: 'https://1password.com',  description: 'Password manager',             status: 'active',   last_used_date: d(0),   cost_per_month: 96,  risk_score: 'low',    mfa_required: true,  renewal_date: r(88),  notes: '' },
  ];
  const byName = Object.fromEntries(tools.map(t => [t.name, t]));

  const grant = (toolName, email, level, opts = {}) => {
    const tool = byName[toolName];
    const emp  = byEmail[email];
    return {
      id: uid('acc'),
      tool_id: tool.id, tool_name: tool.name,
      employee_id: emp.id, employee_name: emp.full_name, employee_email: emp.email,
      access_level: level,
      granted_date: d(opts.granted ?? 200),
      last_accessed_date: d(opts.used ?? 2),
      last_reviewed_date: d(opts.reviewed ?? 90),
      status: opts.status || 'active',
      risk_flag: opts.flag || 'none',
    };
  };

  const access = [
    // Ex-employees who still have access — the headline risk the product sells against
    grant('HubSpot',     'noah.petit@acme.com',     'admin',   { granted: 400, used: 200, reviewed: 300, flag: 'former_employee' }),
    grant('Salesforce',  'noah.petit@acme.com',     'editor',  { granted: 360, used: 190, reviewed: 300, flag: 'former_employee' }),
    grant('Pennylane',   'antoine.rey@acme.com',    'admin',   { granted: 500, used: 70,  reviewed: 320, flag: 'former_employee' }),
    // Admin grants long overdue for review
    grant('Slack',       'amina.dupont@acme.com',   'admin',   { granted: 300, used: 0,   reviewed: 220, flag: 'needs_review' }),
    grant('GitHub',      'lucas.martin@acme.com',   'admin',   { granted: 190, used: 0,   reviewed: 240, flag: 'excessive_admin' }),
    grant('Datadog',     'hugo.moreau@acme.com',    'admin',   { granted: 140, used: 0,   reviewed: 200, flag: 'excessive_admin' }),
    grant('Google Workspace', 'amina.dupont@acme.com', 'admin',{ granted: 415, used: 0,   reviewed: 190, flag: 'needs_review' }),
    // Someone mid-offboarding still holding finance access
    grant('Pennylane',   'chloe.bernard@acme.com',  'billing', { granted: 620, used: 3,   reviewed: 20 }),
    grant('Google Workspace', 'chloe.bernard@acme.com', 'editor', { granted: 620, used: 3, reviewed: 40 }),
    // Orphaned tools
    grant('Figma',       'emma.girard@acme.com',    'editor',  { granted: 60,  used: 16,  reviewed: 60, flag: 'orphaned' }),
    grant('Dropbox',     'lucas.martin@acme.com',   'viewer',  { granted: 300, used: 210, reviewed: 280, flag: 'orphaned' }),
    // Everyday healthy access
    grant('Slack',       'lucas.martin@acme.com',   'editor',  { granted: 200, used: 0,  reviewed: 40 }),
    grant('Slack',       'sofia.rossi@acme.com',    'editor',  { granted: 500, used: 0,  reviewed: 40 }),
    grant('Slack',       'emma.girard@acme.com',    'editor',  { granted: 240, used: 1,  reviewed: 40 }),
    grant('Slack',       'thomas.leroy@acme.com',   'editor',  { granted: 290, used: 0,  reviewed: 40 }),
    grant('Slack',       'julie.mercier@acme.com',  'editor',  { granted: 180, used: 1,  reviewed: 40 }),
    grant('GitHub',      'sofia.rossi@acme.com',    'editor',  { granted: 520, used: 0,  reviewed: 50 }),
    grant('GitHub',      'hugo.moreau@acme.com',    'editor',  { granted: 140, used: 0,  reviewed: 50 }),
    grant('Jira',        'sofia.rossi@acme.com',    'admin',   { granted: 520, used: 0,  reviewed: 45 }),
    grant('Jira',        'lucas.martin@acme.com',   'editor',  { granted: 200, used: 1,  reviewed: 45 }),
    grant('Jira',        'hugo.moreau@acme.com',    'editor',  { granted: 140, used: 2,  reviewed: 45 }),
    grant('Notion',      'lea.fontaine@acme.com',   'admin',   { granted: 590, used: 1,  reviewed: 30 }),
    grant('Notion',      'julie.mercier@acme.com',  'editor',  { granted: 180, used: 2,  reviewed: 30 }),
    grant('Adobe Creative Cloud', 'emma.girard@acme.com', 'admin', { granted: 240, used: 4, reviewed: 70 }),
    grant('Miro',        'emma.girard@acme.com',    'editor',  { granted: 230, used: 96, reviewed: 100, flag: 'unused' }),
    grant('Salesforce',  'karim.benali@acme.com',   'admin',   { granted: 460, used: 1,  reviewed: 35 }),
    grant('Salesforce',  'thomas.leroy@acme.com',   'editor',  { granted: 290, used: 1,  reviewed: 35 }),
    grant('HubSpot',     'karim.benali@acme.com',   'admin',   { granted: 450, used: 124, reviewed: 120, flag: 'unused' }),
    grant('Mailchimp',   'julie.mercier@acme.com',  'admin',   { granted: 180, used: 6,  reviewed: 60 }),
    grant('Zoom',        'lea.fontaine@acme.com',   'admin',   { granted: 590, used: 2,  reviewed: 55 }),
    grant('1Password',   'amina.dupont@acme.com',   'admin',   { granted: 410, used: 0,  reviewed: 25 }),
    grant('Pennylane',   'chloe.bernard@acme.com',  'admin',   { granted: 620, used: 3,  reviewed: 25 }),
    // Already cleaned up — shows the offboarding history isn't empty
    grant('Slack',       'noah.petit@acme.com',     'editor',  { granted: 900, used: 40, reviewed: 300, status: 'revoked' }),
    grant('Notion',      'antoine.rey@acme.com',    'viewer',  { granted: 700, used: 65, reviewed: 300, status: 'revoked' }),
  ];

  const user = { id: uid('usr'), email: 'demo@accessguard.app', subscription_plan: 'pro', is_authenticated: false, is_demo: false };

  const db = { tools, employees, access, user };
  saveDb(db);
  return db;
}

export async function resetDb() {
  try {
    const existing = loadDb();
    const emptyDb = {
      user: existing?.user ? { ...existing.user } : {},
      tools: [],
      employees: [],
      access: [],
    };

    if (_firestoreUid) {
      try {
        await saveUserData(_firestoreUid, emptyDb);
      } catch (e) {
        console.error('✗ Firestore reset failed:', e);
        alert('Failed to reset cloud data. Please check your connection and try again.');
        return false;
      }
    }

    saveDb(emptyDb);

    localStorage.removeItem('accessguard_fx_rates');
    localStorage.removeItem('sg_general');
    localStorage.removeItem('sg_team_members');
    localStorage.removeItem('ag_ai_recs_cache');
    localStorage.removeItem('ag_live_translations');
    // Integration state
    localStorage.removeItem('sg_connected_integrations');
    localStorage.removeItem('sg_gws_last_sync');
    localStorage.removeItem('sg_slack_token');
    localStorage.removeItem('sg_slack_channel');
    localStorage.removeItem('sg_slack_last_sync');
    localStorage.removeItem('sg_m365_last_sync');
    localStorage.removeItem('sg_github_token');
    localStorage.removeItem('sg_github_org');
    localStorage.removeItem('sg_github_last_sync');
    localStorage.removeItem('sg_okta_token');
    localStorage.removeItem('sg_okta_domain');
    localStorage.removeItem('sg_okta_last_sync');
    localStorage.removeItem('sg_zoom_account_id');
    localStorage.removeItem('sg_zoom_client_id');
    localStorage.removeItem('sg_zoom_client_secret');
    localStorage.removeItem('sg_zoom_last_sync');
    localStorage.removeItem('sg_asana_token');
    localStorage.removeItem('sg_asana_workspace');
    localStorage.removeItem('sg_asana_last_sync');
    localStorage.removeItem('sg_sf_client_id');
    localStorage.removeItem('sg_sf_login_url');
    localStorage.removeItem('sg_sf_instance_url');
    localStorage.removeItem('sg_sf_refresh_token');
    localStorage.removeItem('sg_sf_last_sync');

    // Clear the data on screen immediately by resetting the React Query cache,
    // so the reset feels instant. Falls back to a reload if the client wasn't
    // registered (e.g. an unexpected call site).
    if (_queryClient) {
      _queryClient.setQueryData(['db'], emptyDb);
      _queryClient.invalidateQueries();
    } else {
      window.location.reload();
    }
    return true;
  } catch (e) {
    console.error('Reset failed:', e);
    alert('Reset failed: ' + e.message + '. Please try again.');
    return false;
  }
}
