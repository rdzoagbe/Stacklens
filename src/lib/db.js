import { LS_KEY } from './constants';
import { saveUserData, loadUserData, workspaceWrite, workspaceRead } from '../firebase-config';
import { markSyncSaving, markSyncSaved, markSyncFailed, markSyncConflict } from './syncStatus';
import { REV_FIELD, revOf, isConflictError, sameSubstance } from './revision';
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

// ── Installing a copy that is known to be complete ─────────────────────────
//
// `_trimmed` means "this browser's copy is missing records the source of truth
// still has". saveDb sets it when the blob will not fit in localStorage, and
// keeps it on every later save — correctly, because a save whose blob happens
// to fit is usually the already-trimmed data, and syncing that to a shared
// workspace would delete the owner's history.
//
// What was missing was any way back. Nothing cleared the flag, so once a
// shared-workspace editor hit the ceiling every subsequent save was refused
// with "Workspace too large for this browser to sync safely" — for good, even
// after they deleted enough data to fit. Worse, saveUserData stored the flag
// in Firestore, so the next hydrate handed it back on every device.
//
// The flag can only be cleared by a copy that is complete by definition: one
// just read from Firestore or from the workspace endpoint. That is what this
// marks, and the only place it is safe to do.
function asCompleteCopy(data) {
  const copy = { ...data };
  delete copy._trimmed;
  delete copy._shared_view;
  return copy;
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

// ── Keeping the local copy's base revision current ─────────────────────────
//
// Every cloud write is conditional on the revision it was based on (see
// lib/revision.js). So after a write succeeds, the local blob has to learn the
// revision that was just committed — otherwise the very next save declares the
// old one, the check refuses it, and the app conflicts with itself.
//
// Written straight to localStorage rather than through saveDb: this is
// bookkeeping about the cloud copy, and routing it back through saveDb would
// schedule another cloud write for it.
function stampLocalRev(rev) {
  if (!Number.isFinite(rev)) return;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const blob = JSON.parse(raw);
    if (!blob || typeof blob !== 'object') return;
    blob[REV_FIELD] = rev;
    localStorage.setItem(LS_KEY, JSON.stringify(blob));
  } catch { /* bookkeeping must never break a save */ }
}

// ── Has the cloud got everything this browser holds? ───────────────────────
//
// useAuth calls saveDb on every onAuthStateChanged event, so every page load
// used to send a cloud write: the whole blob, and for a workspace of any size
// that is several chunk documents per page VIEW. Nobody edited anything — the
// write exists because the user block was patched with what Firebase Auth and
// /users had just returned, all of it cloud-derived and re-derived on the next
// load anyway.
//
// It cannot simply be deleted, because it doubles as the only retry a failed
// save ever gets. markSyncFailed keeps a retry function, but that lives in
// module memory: reload the page and it is gone. If the last save never
// reached Firestore — offline, quota, rules — the mount write is what pushes
// it up on the next visit.
//
// So the question is not "is this save bookkeeping?" but "is there anything
// here the cloud has not got?". That is answered honestly by comparing
// content, which hydration already has both halves of: it reads the cloud copy
// on the first load of every session.
//
//   clean   local holds nothing the stored copy lacks — a bookkeeping save
//           can skip the cloud entirely
//   dirty   it might, so a bookkeeping save must still go
//
// Absence means dirty. A browser carrying unsynced work from before this
// existed, a cleared key, a localStorage that throws in private mode: all of
// them sync once and mark themselves afterwards. Every uncertain case costs
// one write, never a lost one.
const SYNC_MARK_KEY = 'accessguard_synced_v1';

function markCloudClean() {
  try { localStorage.setItem(SYNC_MARK_KEY, 'clean'); } catch { /* never break a save */ }
}

function markCloudDirty() {
  try { localStorage.setItem(SYNC_MARK_KEY, 'dirty'); } catch { /* never break a save */ }
}

/** True unless we can prove the stored copy already has everything. */
function cloudMayBeBehind() {
  try { return localStorage.getItem(SYNC_MARK_KEY) !== 'clean'; } catch { return true; }
}

/**
 * The local copy is now exactly what the cloud holds.
 *
 * Every call site is a point where that is true — an accepted write, or a
 * conflict recognised as a no-op — so the revision stamp and the clean mark
 * are the same fact and are recorded together. The mark is set even when there
 * is no revision to stamp (a document written before revisions existed).
 */
function markInSync(rev) {
  stampLocalRev(rev);
  markCloudClean();
}

/**
 * Replace this browser's copy with what is stored in the cloud.
 *
 * The "keep theirs" half of a conflict. A reload rather than a state update:
 * every page derives its numbers from the blob at mount, and the point of this
 * path is that the user has just agreed to look at different data — leaving
 * half the screen computed from the copy they discarded would be worse than
 * the conflict was.
 */
async function adoptCloudCopy(uid) {
  const cloud = await loadUserData(uid);
  if (!cloud) throw new Error('Could not read the stored copy');
  localStorage.setItem(LS_KEY, JSON.stringify(asCompleteCopy(cloud)));
  // Local IS the stored copy now, so the next page load has nothing to push.
  markCloudClean();
  if (typeof window !== 'undefined') window.location.reload();
}

/**
 * Write the workspace to localStorage, and back it up to the cloud.
 *
 * `cloudSync: false` marks a save as bookkeeping — it carries nothing a person
 * typed, so it may skip the cloud write when we can prove the stored copy is
 * already current (see the SYNC_MARK_KEY comment above). It is a permission to
 * skip, not an instruction: if anything might be unsynced the write still
 * goes, because that write is the only retry a failed save gets after a
 * reload.
 */
export function saveDb(db, { cloudSync = true } = {}) {
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
  // A shared-view copy belongs to someone else's workspace. It must never go
  // to the viewer's own Firestore document, and it only reaches the owner's
  // through the workspace endpoint, which re-checks membership server-side —
  // the browser holds no Firestore credentials for another workspace.
  if (db?._shared_view) {
    if (db._shared_view.role !== 'editor') return;     // viewer: read-only
    if (db._trimmed) {
      // The blob was cut down to fit this browser's localStorage. Sending it
      // would delete history the owner still has, so refuse rather than
      // silently truncate their data. The endpoint refuses it too.
      markSyncFailed(new Error('Workspace too large for this browser to sync safely'), null);
      return;
    }
    if (!cloudSync && !cloudMayBeBehind()) return;
    clearTimeout(_cloudSaveTimer);
    const ownerUid = db._shared_view.owner_uid;
    // Before the debounce, not after: a tab closed inside those 1.5 seconds
    // must leave this browser marked dirty, or the write it never made would
    // look like one that succeeded.
    markCloudDirty();
    _cloudSaveTimer = setTimeout(() => {
      const attempt = () => workspaceWrite(ownerUid, db);
      markSyncSaving();
      attempt().then(
        (r) => { markInSync(r?.rev); markSyncSaved(); },
        async (err) => {
          // Two people, one workspace: the owner and an editor working the
          // same afternoon used to delete each other's work without either of
          // them ever finding out. The endpoint now answers 409 instead.
          if (!isConflictError(err)) return markSyncFailed(err, attempt);
          // Nothing to choose between if both copies hold the same data. See
          // sameSubstance in lib/revision: two tabs of one workspace each fire
          // a write on load, and one of them always loses the race.
          const theirs = await workspaceRead(ownerUid).then(r => r?.data, () => null);
          if (theirs && sameSubstance(db, theirs)) {
            markInSync(revOf(theirs));
            return markSyncSaved();
          }
          markSyncConflict(err, {
            keepTheirs: async () => {
              const { data, role } = await workspaceRead(ownerUid);
              enterSharedView(data, {
                owner_uid: ownerUid,
                owner_email: db?._shared_view?.owner_email,
                role: role || db?._shared_view?.role,
              });
              if (typeof window !== 'undefined') window.location.reload();
            },
            keepMine: async () => {
              // The 409 carries the revision stored now, so re-basing costs no
              // extra read.
              const r = await workspaceWrite(ownerUid, { ...db, [REV_FIELD]: err.rev ?? null });
              markInSync(r?.rev);
            },
          });
        },
      );
    }, 1500);
    return;
  }
  if (_firestoreUid && db?.user?.is_authenticated && !db?.user?.is_demo) {
    // Debounced: rapid consecutive edits produce one cloud write (the chunked
    // backup is several documents per save; un-debounced bursts previously
    // exhausted the Firestore write queue).
    if (!cloudSync && !cloudMayBeBehind()) return;
    clearTimeout(_cloudSaveTimer);
    const uid = _firestoreUid;
    markCloudDirty();
    _cloudSaveTimer = setTimeout(() => {
      // Observe-only: the rejection is still handled here (never rethrown), so
      // behaviour is unchanged — we just record the outcome so a failed cloud
      // backup stops being invisible to the user.
      const attempt = () => saveUserData(uid, db);
      markSyncSaving();
      attempt().then(
        (rev) => { markInSync(rev); markSyncSaved(); },
        async (err) => {
          // A conflict must not reach the ordinary retry: that re-sends this
          // same payload, which is the silent overwrite the revision check
          // exists to prevent. The user is offered the two real choices.
          if (!isConflictError(err)) return markSyncFailed(err, attempt);
          // Unless there are no choices to offer. useAuth saves on every auth
          // event, so a second tab or a phone and a laptop waking together
          // fire two writes carrying identical data; one loses the race and
          // used to raise a banner over two copies that are the same copy.
          // See sameSubstance in lib/revision. A read that fails leaves this
          // a conflict, which is the safe direction.
          const theirs = await loadUserData(uid).catch(() => null);
          if (theirs && sameSubstance(db, theirs)) {
            markInSync(revOf(theirs));
            return markSyncSaved();
          }
          markSyncConflict(err, {
            keepTheirs: () => adoptCloudCopy(uid),
            keepMine: async () => {
              // Re-base on what is stored now, then write again. This is a
              // deliberate overwrite, chosen by the user, not a blind retry.
              const cloud = await loadUserData(uid);
              const rev = await saveUserData(uid, { ...db, [REV_FIELD]: revOf(cloud) });
              markInSync(rev);
            },
          });
        },
      );
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

// ── Signing out leaves nothing behind ────────────────────────────────────────
//
// localStorage is this app's primary read path, so a signed-in browser holds a
// full copy of the workspace: every employee's name and work email, every
// access grant. Signing out used to keep all of it and only mark the user as
// signed out, so on a shared machine — an accounting practice, a front desk —
// the next person could read the last client's staff list out of the browser.
// The security page now says the local copy is removed on sign-out; these two
// functions are what make that true.
//
// Clearing must never lose work, hence the flush: anything the cloud may not
// have yet is written now rather than after the 1.5 s debounce, and if that
// cannot be confirmed the caller asks before discarding. Only an explicit
// sign-out clears. An expired session does not, because it is not a decision
// the user made and it may be holding unsaved work.

/** Keys that hold one account's data or secrets, removed on sign-out. */
export const SIGN_OUT_KEYS = [
  'accessguard_v1',              // LS_KEY: the workspace itself
  OWN_BACKUP_KEY,                // the owner's copy while viewing a client
  SYNC_MARK_KEY,
  'saasguard_db',                // pre-rename copy of the workspace
  'ag_uploaded_invoices',        // pre-migration invoice uploads
  'slack_webhook',               // a secret: anyone holding it can post
  'sg_connected_integrations',   // which vendors this account connected
];

/**
 * Write this browser's copy to the cloud now if the cloud may be behind.
 * Resolves true when nothing would be lost by clearing the browser, false when
 * that cannot be confirmed (offline, a conflict, or another workspace's data).
 * Never overwrites through a conflict: that stays the user's choice.
 */
export async function flushBeforeSignOut() {
  clearTimeout(_cloudSaveTimer);
  if (!cloudMayBeBehind()) return true;
  const db = loadDb();
  if (!db || db?.user?.is_demo || !db?.user?.is_authenticated) return true;
  if (db._shared_view || !_firestoreUid) return false;
  try {
    markSyncSaving();
    const rev = await saveUserData(_firestoreUid, db);
    markInSync(rev);
    markSyncSaved();
    return true;
  } catch (err) {
    markSyncFailed(err, null);
    return false;
  }
}

/** Remove this account's data and secrets from the browser. */
export function clearLocalWorkspace() {
  clearTimeout(_cloudSaveTimer);
  for (const key of SIGN_OUT_KEYS) {
    try { localStorage.removeItem(key); } catch { /* storage unavailable: nothing to clear */ }
  }
}

export function enterSharedView(sharedDb, meta) {
  const current = localStorage.getItem(LS_KEY);
  try {
    if (current && !JSON.parse(current)?._shared_view) localStorage.setItem(OWN_BACKUP_KEY, current);
  } catch { /* unreadable blob — don't overwrite an existing backup with it */ }
  // The role comes from the membership record the server returned, not from a
  // constant. 'editor' lets the RoleGates show edit controls and lets saveDb
  // sync through the workspace endpoint; anything else stays read-only.
  // Defaulting to 'viewer' matters: an older server that does not send a role
  // must not silently grant write access.
  const role = meta?.role === 'editor' ? 'editor' : 'viewer';
  const view = {
    ...asCompleteCopy(sharedDb),
    _shared_view: { ...meta, role }, // { owner_uid, owner_email, role }
    user: { ...(sharedDb.user || {}), role, is_authenticated: true, is_demo: false },
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

    // Billing fields always come from Firestore (only the webhook can set them).
    //
    // This used to return `target` on every path, so the caller's
    // `if (merged !== freshLocal) saveDb(merged)` compared an object with
    // itself and was never true: the merge applied in memory for the session
    // and was never written down. On the next load, if the cloud read failed,
    // the user dropped back to whatever plan their stale local copy claimed.
    // It now reports whether it changed anything.
    const mergeBilling = (target, cloud) => {
      if (!cloud?.user) return false;
      if (!target.user) target.user = {};
      const before = JSON.stringify([
        target.user.plan, target.user.subscription_plan,
        target.user.stripe_customer_id, target.user.subscription_status,
      ]);
      if (cloud.user.plan && cloud.user.plan !== 'free') {
        target.user.plan = cloud.user.plan;
        target.user.subscription_plan = cloud.user.plan;
      }
      target.user.stripe_customer_id  = cloud.user.stripe_customer_id  || target.user.stripe_customer_id;
      target.user.subscription_status = cloud.user.subscription_status || target.user.subscription_status;
      return JSON.stringify([
        target.user.plan, target.user.subscription_plan,
        target.user.stripe_customer_id, target.user.subscription_status,
      ]) !== before;
    };

    // No local data at all → use cloud
    if (!freshLocal || (!freshLocal.tools?.length && !freshLocal.employees?.length)) {
      if (cloudData && cloudData.tools !== undefined) {
        const complete = asCompleteCopy(cloudData);
        localStorage.setItem(LS_KEY, JSON.stringify(complete));
        // This browser now holds exactly the stored copy — the fresh-browser
        // and cleared-storage case. Without this mark its first page load
        // would send the whole blob straight back to Firestore.
        markCloudClean();
        return complete;
      }
      // New user — nothing in cloud either, push local stub up
      const local = loadDb();
      if (local && !local.user?.is_demo) {
        const rev = await saveUserData(uid, local).catch(() => null);
        if (Number.isFinite(rev)) {
          local[REV_FIELD] = rev;
          localStorage.setItem(LS_KEY, JSON.stringify(local));
          markCloudClean();
        }
      }
      return local;
    }

    // Both exist — use the newer copy, always trust cloud for billing
    if (cloudData && cloudData.tools !== undefined && cloudTs > localTs) {
      const complete = asCompleteCopy(cloudData);
      localStorage.setItem(LS_KEY, JSON.stringify(complete));
      markCloudClean();
      return complete;
    }

    // Local is newer (or cloud missing) — merge billing from cloud and return local
    const billingChanged = mergeBilling(freshLocal, cloudData);
    // The local copy deliberately keeps ITS OWN revision here, not the
    // cloud's.
    //
    // Adopting the cloud's revision looks like tidy bookkeeping and is a
    // data-loss bug: this branch is reached when the two copies have diverged
    // and local is the newer by timestamp. If this browser edited offline
    // while another device carried the cloud on to revision 7, stamping 7
    // here would make the next save pass the staleness check and quietly
    // replace that device's work — the exact overwrite the check exists to
    // stop, reintroduced one layer up.
    //
    // Left alone, the next save declares the older revision, is refused, and
    // the user is asked which copy to keep. A conflict is the correct answer
    // to a genuine divergence.
    //
    // For the ordinary single-device case the two are already equal, because
    // every successful save stamps the committed revision locally — so this
    // costs nothing there.
    //
    // Written straight to localStorage rather than through saveDb: the values
    // came from Firestore, so a cloud write here would only send them back.
    if (billingChanged) localStorage.setItem(LS_KEY, JSON.stringify(freshLocal));

    // Does this browser hold anything the cloud has not got?
    //
    // Decided by CONTENT, not by the timestamp that picked this branch. That
    // timestamp is _saved_at, which every localStorage write bumps — including
    // the bookkeeping save on every page load — so local "wins" here in the
    // ordinary single-device case where the two copies are in fact identical.
    // Trusting it would mark a perfectly synced browser dirty on every visit
    // and the page-load write would never be skipped at all.
    //
    // A failed read leaves cloudData null, which reads as dirty: unproven is
    // not the same as synced, and the cost of being wrong that way is one
    // write rather than somebody's unsynced afternoon.
    if (cloudData && sameSubstance(freshLocal, cloudData)) markCloudClean();
    else markCloudDirty();
    return freshLocal;
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
