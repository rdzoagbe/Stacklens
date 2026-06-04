import { LS_KEY } from './constants';
import { saveUserData, loadUserData } from '../firebase-config';
import { format, subDays, parseISO } from 'date-fns';

// ─── ID / date helpers ────────────────────────────────────────────────────────

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function safeParseISO(s) {
  try {
    if (!s) return null;
    return parseISO(s);
  } catch {
    return null;
  }
}

// ─── Firestore-backed data layer ──────────────────────────────────────────────
// loadDb / saveDb work synchronously for React Query compat.
// Firestore sync is fire-and-forget via saveDb.

let _firestoreUid = null;

export function setFirestoreUid(newUid) { _firestoreUid = newUid; }

export function loadDb() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const LS_SIZE_WARN_BYTES = 3 * 1024 * 1024;
const LS_SIZE_MAX_BYTES  = 4.5 * 1024 * 1024;

export function saveDb(db) {
  const serialized = JSON.stringify({ ...db, _saved_at: Date.now() });
  if (serialized.length > LS_SIZE_MAX_BYTES) {
    const trimmed = { ...db };
    if (trimmed.tools?.length > 50) trimmed.tools = trimmed.tools.slice(0, Math.floor(trimmed.tools.length * 0.8));
    if (trimmed.access?.length > 200) trimmed.access = trimmed.access.slice(0, Math.floor(trimmed.access.length * 0.8));
    localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
    console.warn('[Stacklens] localStorage approaching limit — oldest records trimmed.');
  } else {
    if (serialized.length > LS_SIZE_WARN_BYTES) {
      console.warn('[Stacklens] localStorage usage high:', Math.round(serialized.length / 1024), 'KB');
    }
    localStorage.setItem(LS_KEY, serialized);
  }
  if (_firestoreUid && db?.user?.is_authenticated && !db?.user?.is_demo) {
    saveUserData(_firestoreUid, db).catch(() => {});
  }
}

export async function hydrateFromFirestore(uid) {
  _firestoreUid = uid;
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
    const cloudTs = cloudData?._saved_at  || 0;

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

  const employees = [
    { id: uid('emp'), full_name: 'Amina Dupont', email: 'amina.dupont@acme.com', department: 'security', role: 'Security Lead', status: 'active', start_date: d(420), end_date: '' },
    { id: uid('emp'), full_name: 'Lucas Martin', email: 'lucas.martin@acme.com', department: 'engineering', role: 'Platform Engineer', status: 'active', start_date: d(210), end_date: '' },
    { id: uid('emp'), full_name: 'Chloé Bernard', email: 'chloe.bernard@acme.com', department: 'finance', role: 'Controller', status: 'offboarding', start_date: d(680), end_date: d(3) },
    { id: uid('emp'), full_name: 'Noah Petit', email: 'noah.petit@acme.com', department: 'marketing', role: 'Growth Manager', status: 'offboarded', start_date: d(980), end_date: d(35) },
  ];

  const tools = [
    { id: uid('tool'), name: 'Slack', category: 'communication', owner_email: 'amina.dupont@acme.com', owner_name: 'Amina Dupont', criticality: 'high', url: 'https://slack.com', description: 'Company messaging + alerts', status: 'active', last_used_date: d(1), cost_per_month: 240, risk_score: 'low', notes: 'SSO enabled' },
    { id: uid('tool'), name: 'GitHub', category: 'engineering', owner_email: 'lucas.martin@acme.com', owner_name: 'Lucas Martin', criticality: 'high', url: 'https://github.com', description: 'Source control', status: 'active', last_used_date: d(0), cost_per_month: 320, risk_score: 'medium', notes: 'Review admin access quarterly' },
    { id: uid('tool'), name: 'Figma', category: 'design', owner_email: '', owner_name: '', criticality: 'medium', url: 'https://figma.com', description: 'Design collaboration', status: 'orphaned', last_used_date: d(16), cost_per_month: 180, risk_score: 'high', notes: 'Owner missing' },
    { id: uid('tool'), name: 'HubSpot', category: 'sales', owner_email: 'noah.petit@acme.com', owner_name: 'Noah Petit', criticality: 'medium', url: 'https://hubspot.com', description: 'CRM', status: 'unused', last_used_date: d(120), cost_per_month: 600, risk_score: 'high', notes: 'Unused > 90 days' },
  ];

  const access = [
    { id: uid('acc'), tool_id: tools[0].id, tool_name: tools[0].name, employee_id: employees[0].id, employee_name: employees[0].full_name, employee_email: employees[0].email, access_level: 'admin', granted_date: d(300), last_accessed_date: d(1), last_reviewed_date: d(200), status: 'active', risk_flag: 'needs_review' },
    { id: uid('acc'), tool_id: tools[1].id, tool_name: tools[1].name, employee_id: employees[1].id, employee_name: employees[1].full_name, employee_email: employees[1].email, access_level: 'admin', granted_date: d(190), last_accessed_date: d(0), last_reviewed_date: d(210), status: 'active', risk_flag: 'excessive_admin' },
    { id: uid('acc'), tool_id: tools[2].id, tool_name: tools[2].name, employee_id: employees[1].id, employee_name: employees[1].full_name, employee_email: employees[1].email, access_level: 'viewer', granted_date: d(60), last_accessed_date: d(20), last_reviewed_date: d(60), status: 'active', risk_flag: 'orphaned' },
    { id: uid('acc'), tool_id: tools[3].id, tool_name: tools[3].name, employee_id: employees[3].id, employee_name: employees[3].full_name, employee_email: employees[3].email, access_level: 'admin', granted_date: d(400), last_accessed_date: d(200), last_reviewed_date: d(300), status: 'active', risk_flag: 'former_employee' },
    { id: uid('acc'), tool_id: tools[3].id, tool_name: tools[3].name, employee_id: employees[2].id, employee_name: employees[2].full_name, employee_email: employees[2].email, access_level: 'billing', granted_date: d(120), last_accessed_date: d(80), last_reviewed_date: d(20), status: 'active', risk_flag: 'needs_review' },
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
        return;
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

    await new Promise(r => setTimeout(r, 500));
    window.location.reload();
  } catch (e) {
    console.error('Reset failed:', e);
    alert('Reset failed: ' + e.message + '. Please try again.');
  }
}
