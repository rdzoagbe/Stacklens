export const LS_KEY = 'accessguard_v1';

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
