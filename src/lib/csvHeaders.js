// ── CSV headers people actually write ──────────────────────────────────────
//
// The import asked for exact column names (employee_name, tool_cost_monthly…)
// while the homepage said "Stacklens maps everything automatically". A file
// exported from an HR tool, or typed in French ("Nom, Email, Service"), was
// rejected line by line. This recognises the common names, in French and
// English, and renames the header line only; a column that already has the
// canonical name is left alone, and an unknown one passes through untouched
// so nothing is silently dropped.

import { csvDelimiter } from './dataUtils';

const CANON = {
  employees: {
    full_name:  ['nom', 'nom_complet', 'nom_prenom', 'prenom_nom', 'name', 'employee', 'employe', 'salarie', 'collaborateur', 'employee_name', 'full_name'],
    email:      ['email', 'e_mail', 'mail', 'courriel', 'adresse_email', 'adresse_e_mail', 'email_address', 'work_email', 'employee_email'],
    department: ['department', 'departement', 'service', 'equipe', 'team', 'pole', 'direction'],
    role:       ['role', 'poste', 'fonction', 'title', 'job_title', 'intitule', 'intitule_du_poste'],
    status:     ['status', 'statut', 'etat'],
    start_date: ['start_date', 'date_entree', 'date_d_entree', 'date_debut', 'hire_date', 'arrivee', 'date_arrivee', 'entree'],
    end_date:   ['end_date', 'date_sortie', 'date_de_sortie', 'date_fin', 'depart', 'date_depart', 'sortie'],
  },
  tools: {
    name:           ['name', 'nom', 'outil', 'nom_outil', 'tool', 'tool_name', 'application', 'logiciel', 'app', 'service'],
    category:       ['category', 'categorie', 'type', 'famille', 'tool_category'],
    cost_per_month: ['cost_per_month', 'cout_mensuel', 'cout_par_mois', 'cout_mois', 'prix_mensuel', 'monthly_cost', 'cost_monthly', 'cout', 'prix', 'cost', 'montant', 'montant_mensuel', 'tool_cost_monthly'],
    owner_email:    ['owner_email', 'email_responsable', 'responsable_email', 'email_proprietaire', 'owner', 'proprietaire_email', 'tool_owner_email'],
    owner_name:     ['owner_name', 'responsable', 'nom_responsable', 'proprietaire', 'tool_owner_name'],
    renewal_date:   ['renewal_date', 'date_renouvellement', 'renouvellement', 'renewal', 'echeance', 'date_echeance'],
    url:            ['url', 'lien', 'site', 'website', 'site_web'],
    status:         ['status', 'statut', 'etat', 'tool_status'],
    criticality:    ['criticality', 'criticite', 'importance', 'tool_criticality'],
    mfa:            ['mfa', 'mfa_enabled', '2fa', 'two_factor', 'double_authentification'],
    seats:          ['seats', 'sieges', 'licences', 'licenses', 'nb_licences', 'nombre_de_licences', 'places'],
    billing_cycle:  ['billing_cycle', 'cycle', 'cycle_facturation', 'periodicite', 'frequence'],
  },
  access: {
    tool_name:      ['tool_name', 'outil', 'tool', 'application', 'logiciel', 'app'],
    employee_email: ['employee_email', 'email', 'e_mail', 'mail', 'courriel', 'email_salarie', 'email_employe', 'user', 'utilisateur'],
    access_level:   ['access_level', 'niveau', 'niveau_acces', 'niveau_d_acces', 'role', 'droits', 'permission', 'level'],
    status:         ['status', 'statut', 'etat'],
    granted_date:   ['granted_date', 'date_attribution', 'attribue_le', 'since', 'depuis'],
  },
  company: {
    employee_name:     ['employee_name', 'nom', 'nom_complet', 'salarie', 'collaborateur', 'employe', 'employee', 'full_name', 'nom_salarie'],
    employee_email:    ['employee_email', 'email', 'e_mail', 'mail', 'courriel', 'email_salarie', 'work_email'],
    department:        ['department', 'departement', 'service', 'equipe', 'team', 'pole'],
    role:              ['role', 'poste', 'fonction', 'job_title', 'intitule'],
    employee_status:   ['employee_status', 'statut_salarie', 'statut', 'status'],
    start_date:        ['start_date', 'date_entree', 'date_d_entree', 'hire_date', 'arrivee'],
    end_date:          ['end_date', 'date_sortie', 'date_depart', 'depart'],
    tool_name:         ['tool_name', 'outil', 'logiciel', 'application', 'tool', 'app', 'nom_outil'],
    tool_category:     ['tool_category', 'categorie', 'categorie_outil', 'category'],
    tool_cost_monthly: ['tool_cost_monthly', 'cout_mensuel', 'cout_par_mois', 'cout', 'prix', 'prix_mensuel', 'monthly_cost', 'cost_per_month', 'montant_mensuel'],
    tool_url:          ['tool_url', 'url', 'lien', 'site'],
    tool_status:       ['tool_status', 'statut_outil'],
    tool_criticality:  ['tool_criticality', 'criticite'],
    renewal_date:      ['renewal_date', 'date_renouvellement', 'renouvellement', 'echeance'],
    tool_owner_email:  ['tool_owner_email', 'email_responsable', 'responsable_email', 'owner_email'],
    tool_owner_name:   ['tool_owner_name', 'responsable', 'nom_responsable', 'owner_name'],
    tool_last_used:    ['tool_last_used', 'derniere_utilisation', 'last_used'],
    tool_mfa:          ['tool_mfa', 'mfa', '2fa'],
    tool_seats:        ['tool_seats', 'sieges', 'licences', 'seats'],
    tool_billing_cycle:['tool_billing_cycle', 'cycle', 'cycle_facturation', 'periodicite'],
    access_level:      ['access_level', 'niveau', 'niveau_acces', 'droits', 'permission'],
    access_status:     ['access_status', 'statut_acces'],
    access_last_used:  ['access_last_used'],
    access_last_reviewed: ['access_last_reviewed', 'derniere_revue', 'revu_le'],
  },
};

/** "Coût / mois" → "cout_mois"; "E-mail" → "e_mail". */
export function slugHeader(h) {
  return String(h ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * The header line rewritten to the canonical names for `kind`, and the
 * renames made. Splits on the delimiter the line uses (comma or semicolon:
 * French Excel writes semicolons) and keeps it.
 */
export function mapHeaders(headerLine, kind) {
  const table = CANON[kind];
  const sep = csvDelimiter(headerLine);
  const raw = headerLine.split(sep);
  const slugs = raw.map(slugHeader);
  const taken = new Set(slugs);
  const renamed = [];
  const out = raw.map((orig, i) => {
    const slug = slugs[i];
    if (!table || table[slug]) return table && table[slug] ? slug : orig.trim();
    for (const [canon, aliases] of Object.entries(table)) {
      if (aliases.includes(slug) && !taken.has(canon)) {
        taken.add(canon); renamed.push([orig.trim(), canon]);
        return canon;
      }
    }
    return orig.trim();
  });
  return { line: out.join(sep), renamed };
}

/** The CSV text with its header line mapped for `kind`; the other lines untouched. */
export function normaliseCsvHeaders(text, kind) {
  const nl = text.indexOf('\n');
  const header = nl < 0 ? text : text.slice(0, nl);
  const rest = nl < 0 ? '' : text.slice(nl);
  const { line, renamed } = mapHeaders(header.replace(/\r$/, ''), kind);
  return { text: line + rest, renamed };
}

/**
 * An amount as a spreadsheet writes it: "1 200,50", "1.200,50", "€ 49",
 * "49.90 €". Number("1 200,50") is NaN, which an import used to record as 0.
 */
export function csvAmount(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v ?? '').replace(/[\s\u00a0\u202f€$£]|CHF|EUR|USD|GBP/g, '').trim();
  if (!s) return 0;
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');   // 1.200,50 / 1200,50
  else s = s.replace(/,/g, '');                                          // 1,200.50 / 1200.50
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
