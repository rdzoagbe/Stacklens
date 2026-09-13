export const LS_KEY = 'accessguard_v1';

// ── Keys that belong to one browser, never to the cloud copy ───────────────
//
// saveUserData spreads the whole blob into the Firestore document, so any
// marker left on it gets stored as workspace data and comes back on the next
// hydrate — on every device.
//
//   _trimmed      set when the blob had to be cut down to fit this browser's
//                 localStorage. It says "this copy is incomplete", which is
//                 true of one browser and meaningless in the cloud. Stored,
//                 it came back on hydrate and could never be cleared, so a
//                 shared-workspace editor was refused every save forever.
//   _shared_view  says the blob is someone else's workspace. Written into the
//                 viewer's own document it is worse than useless: the next
//                 hydrate would load it and the app would believe the viewer
//                 is inside a workspace they may no longer have access to.
//
// Stripped by saveUserData. functions/workspace-write.js keeps its own
// INTERNAL_KEYS list for the same reason on the server side.
export const LOCAL_ONLY_KEYS = ['_trimmed', '_shared_view'];

/**
 * A copy of a workspace blob safe to store in the cloud.
 *
 * A pure function rather than an inline `delete` loop so the behaviour can be
 * tested directly: firebase-config boots the Firebase SDK and is mocked in the
 * unit tests, and a source-scanning check on the loop turned out to match the
 * comment describing it rather than the code doing it.
 *
 * It lives here, beside the key list, because firebase-config already imports
 * this module and cannot import lib/db (which imports firebase-config).
 */
export function stripLocalOnly(blob) {
  const out = { ...blob };
  for (const key of LOCAL_ONLY_KEYS) delete out[key];
  return out;
}

export const CATEGORIES = [
  'engineering', 'design', 'marketing', 'sales', 'finance',
  'hr', 'operations', 'security', 'communication', 'other',
];

export const EMP_DEPARTMENTS = [...CATEGORIES, 'executive'];

export const TOOL_STATUS  = ['active', 'orphaned', 'unused', 'decommissioned'];
export const CRITICALITY  = ['low', 'medium', 'high'];
export const RISK_SCORE   = ['low', 'medium', 'high'];
export const ACCESS_LEVEL = ['admin', 'editor', 'viewer', 'billing'];
export const ACCESS_STATUS = ['active', 'revoked', 'pending_revocation'];
export const RISK_FLAG = [
  'none', 'orphaned', 'unused', 'former_employee', 'excessive_admin', 'needs_review',
];

// ── Legal identity — single source of truth ─────────────────────────────────
// The company's legal/publisher details, used across all legal pages and
// contracts (Mentions Légales, Privacy, Terms, DPA).
//
// TO INCORPORATE (e.g. register a SASU / US LLC): update the fields below once
// and every legal page + contract reflects the new entity automatically.
//   - publisher/director: 'Roland Dzoagbe'  →  'Stacklens SAS' (+ représentant)
//   - status:            'Micro-entrepreneur' →  'SAS au capital de X €'
//   - siret:             update to the new company registration number
export const LEGAL_ENTITY = {
  brand:     'Stacklens',
  publisher: 'Roland Dzoagbe',
  director:  'Roland Dzoagbe',
  status:    'Micro-entrepreneur',
  siret:     '10483872700014',
  phone:     '09 53 26 97 91',
  email:     'hello@stacklens.fr',
  city:      'Paris, France',
};

export const ROLES = {
  owner:  { level: 4, label: 'Owner' },
  admin:  { level: 3, label: 'Admin' },
  editor: { level: 2, label: 'Editor' },
  viewer: { level: 1, label: 'Viewer' },
};

// Emails that always get founder access (founder-admin page, top plan), even if
// the Firestore `is_founder` flag isn't set — so it survives account
// delete/recreate. Kept in sync with the isFounder() email list in
// firestore.rules. Lowercase.
export const FOUNDER_EMAILS = ['rolanddzoagbe@gmail.com'];
