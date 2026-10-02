// ── The free audit's categories, in the reader's language ──────────────────
//
// lib/saasAudit.js tags each vendor with an English category, which is also
// what the CSV carries (a stable column for spreadsheets). On the page it was
// shown as is, so a French accountant read "Project management" and
// "Software (unverified)" between French lines. The page shows this label;
// the data keeps the English value.

const FR = {
  'AI': 'IA',
  'Automation': 'Automatisation',
  'CRM': 'CRM',
  'Collaboration': 'Collaboration',
  'Communication API': 'API de communication',
  'Communication': 'Communication',
  'Design': 'Design',
  'E-commerce': 'E-commerce',
  'E-signature': 'Signature électronique',
  'Email': 'E-mail',
  'Engineering': 'Développement',
  'Finance': 'Finance',
  'Forms': 'Formulaires',
  'HR': 'RH',
  'Identity': 'Identité',
  'Infrastructure': 'Infrastructure',
  'Marketing': 'Marketing',
  'Media': 'Médias',
  'Productivity': 'Productivité',
  'Project management': 'Gestion de projet',
  'Sales': 'Ventes',
  'Scheduling': 'Prise de rendez-vous',
  'Security': 'Sécurité',
  'Software (from ledger account)': 'Logiciel (d’après le compte comptable)',
  'Software (unverified)': 'Logiciel (non vérifié)',
  'Software (added by reviewer)': 'Logiciel (ajouté à la revue)',
  'Storage': 'Stockage',
  'Support': 'Support client',
  'Unclassified': 'Non classé',
  'Website': 'Site web',
  'Writing': 'Rédaction',
};

export const AUDIT_CATEGORY_LABELS = { fr: FR };

/** The category as the page shows it; English, or anything unknown, unchanged. */
export function auditCategoryLabel(category, lang) {
  return AUDIT_CATEGORY_LABELS[lang]?.[category] || category;
}
