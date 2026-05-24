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

export const ROLES = {
  owner:  { level: 4, label: 'Owner' },
  admin:  { level: 3, label: 'Admin' },
  editor: { level: 2, label: 'Editor' },
  viewer: { level: 1, label: 'Viewer' },
};
