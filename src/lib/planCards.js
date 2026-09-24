// The plan cards, shared by the landing page and Settings → Billing.
//
// They used to be two hand-written lists. The landing page sold 5, 10 and 15
// "team seats" per plan and "Unlimited everything" on Enterprise; the billing
// page sold "Advanced analytics" that Pro already had; the server capped every
// paid plan at the same 10 invitees and 50 client workspaces. Every number on
// a card now comes from the constants the app and the server enforce
// (plan-parity.test.js holds the server's copies equal), and the words live
// here once. plan-claims.test.js checks each rendered card against the limits.
//
// Every feature listed exists in the product today. Team seat tiers, SSO/SAML,
// SCIM, account managers and SLAs are deliberately absent: do not add a line
// to a card before the thing it describes ships.

import { PLAN_LIMITS, TEAM_INVITE_LIMIT, CLIENT_WORKSPACE_LIMIT } from './plan';

export const PLAN_CARDS = [
  { id: 'free', monthly: 0, annual: 0,
    features: ['tools', 'employees', 'f_free_3', 'f_free_4', 'f_free_5', 'f_free_6'] },
  { id: 'starter', monthly: 29, annual: 278,
    features: ['tools', 'employees', 'f_starter_3', 'f_starter_4', 'f_starter_5', 'team', 'clients', 'f_starter_6'] },
  { id: 'hr_finance', monthly: 49, annual: 470,
    features: ['tools', 'employees', 'f_hrf_1', 'f_hrf_2', 'f_hrf_3', 'f_hrf_4', 'f_hrf_5', 'team', 'clients', 'f_hrf_6'] },
  { id: 'pro', monthly: 79, annual: 758,
    features: ['tools', 'employees', 'f_pro_3', 'f_pro_4', 'f_pro_5', 'f_pro_6', 'team', 'clients', 'f_pro_7'] },
  { id: 'enterprise', monthly: 299, annual: 2870,
    features: ['f_ent_1', 'f_ent_2', 'f_ent_3', 'f_ent_6', 'team', 'clients', 'f_ent_5'] },
];

const GROUP = { en: ',', fr: ' ', de: '.', es: '.', pt: '.' };

/** 1500 → "1,500" / "1 500" / "1.500", written the way each language groups. */
export function formatCount(n, lang = 'en') {
  const sep = GROUP[lang] ?? GROUP.en;
  const digits = String(n);
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += sep;
    out += digits[i];
  }
  return out;
}

const COUNTED = {
  en: { tools: (n) => `Up to ${n} SaaS tools`, employees: (n) => `Up to ${n} employees`,
        team: (n) => `Share with up to ${n} teammates`, clients: (n) => `Up to ${n} client workspaces` },
  fr: { tools: (n) => `Jusqu'à ${n} outils SaaS`, employees: (n) => `Jusqu'à ${n} employés`,
        team: (n) => `Partage avec jusqu'à ${n} collaborateurs`, clients: (n) => `Jusqu'à ${n} espaces clients` },
  de: { tools: (n) => `Bis zu ${n} SaaS-Tools`, employees: (n) => `Bis zu ${n} Mitarbeiter`,
        team: (n) => `Mit bis zu ${n} Teammitgliedern teilen`, clients: (n) => `Bis zu ${n} Mandanten-Workspaces` },
  es: { tools: (n) => `Hasta ${n} herramientas SaaS`, employees: (n) => `Hasta ${n} empleados`,
        team: (n) => `Comparte con hasta ${n} compañeros`, clients: (n) => `Hasta ${n} espacios de clientes` },
  pt: { tools: (n) => `Até ${n} ferramentas SaaS`, employees: (n) => `Até ${n} funcionários`,
        team: (n) => `Partilhe com até ${n} colegas`, clients: (n) => `Até ${n} espaços de clientes` },
};

export const PLAN_COPY = {
  en: {
    plan_free:'Free', plan_free_tag:'For small teams getting started',
    plan_starter:'Starter', plan_starter_tag:'For growing teams',
    plan_hr_finance:'HR & Finance', plan_hr_finance_tag:'For HR & Finance directors',
    plan_pro:'Pro', plan_pro_tag:'For teams that need full visibility and control',
    plan_enterprise:'Enterprise', plan_enterprise_tag:'For large organisations',
    f_free_3:'Shadow IT discovery',f_free_4:'Basic security alerts',f_free_5:'No credit card required',f_free_6:'Forever free',
    f_starter_3:'People board: employees, access & offboarding',f_starter_4:'Renewal alerts',f_starter_5:'CSV import & export',f_starter_6:'Email support',
    f_hrf_1:'Full Finance Board',f_hrf_2:'People & HR Board',f_hrf_3:'Access tracking & map',f_hrf_4:'Offboarding queue',f_hrf_5:'Budget tracking & renewal calendar',f_hrf_6:'Priority email support',
    f_pro_3:'Savings recommendations & AI contract analysis',f_pro_4:'Cost management & finance suite',f_pro_5:'Full security & audit suite',f_pro_6:'License optimization',f_pro_7:'Priority email support',
    f_ent_1:'Unlimited SaaS tools',f_ent_2:'Unlimited employees',f_ent_3:'Everything in Pro',f_ent_5:'Priority email support',f_ent_6:'Read-only REST API',
  },
  fr: {
    plan_free:'Gratuit', plan_free_tag:'Pour les petites équipes qui débutent',
    plan_starter:'Starter', plan_starter_tag:'Pour les équipes en croissance',
    plan_hr_finance:'RH & Finance', plan_hr_finance_tag:'Pour les DRH et directeurs financiers',
    plan_pro:'Pro', plan_pro_tag:'Pour les équipes qui ont besoin de visibilité totale',
    plan_enterprise:'Enterprise', plan_enterprise_tag:'Pour les grandes organisations',
    f_free_3:'Détection du Shadow IT',f_free_4:'Alertes de sécurité basiques',f_free_5:'Sans carte bancaire',f_free_6:'Gratuit pour toujours',
    f_starter_3:'Espace RH : salariés, accès et offboarding',f_starter_4:'Alertes de renouvellement',f_starter_5:'Import & export CSV',f_starter_6:'Support par email',
    f_hrf_1:'Tableau de bord Finance complet',f_hrf_2:'Tableau de bord RH & Personnel',f_hrf_3:'Suivi et carte des accès',f_hrf_4:"File d'offboarding",f_hrf_5:'Suivi budgétaire & calendrier des renouvellements',f_hrf_6:'Support email prioritaire',
    f_pro_3:"Recommandations d'économies & analyse de contrats par IA",f_pro_4:'Gestion des coûts & suite finance',f_pro_5:'Suite sécurité & audit complète',f_pro_6:'Optimisation des licences',f_pro_7:'Support email prioritaire',
    f_ent_1:'Outils SaaS illimités',f_ent_2:'Employés illimités',f_ent_3:'Tout le plan Pro inclus',f_ent_5:'Support email prioritaire',f_ent_6:'API REST en lecture seule',
  },
  de: {
    plan_free:'Kostenlos', plan_free_tag:'Für kleine Teams am Anfang',
    plan_starter:'Starter', plan_starter_tag:'Für wachsende Teams',
    plan_hr_finance:'HR & Finanzen', plan_hr_finance_tag:'Für HR- und Finanzleiter',
    plan_pro:'Pro', plan_pro_tag:'Für Teams, die volle Transparenz brauchen',
    plan_enterprise:'Enterprise', plan_enterprise_tag:'Für große Organisationen',
    f_free_3:'Shadow-IT-Erkennung',f_free_4:'Grundlegende Sicherheitswarnungen',f_free_5:'Keine Kreditkarte nötig',f_free_6:'Für immer kostenlos',
    f_starter_3:'Personal-Board: Mitarbeiter, Zugriffe & Offboarding',f_starter_4:'Verlängerungs-Alerts',f_starter_5:'CSV-Import & -Export',f_starter_6:'E-Mail-Support',
    f_hrf_1:'Komplettes Finanz-Dashboard',f_hrf_2:'HR- & Personal-Dashboard',f_hrf_3:'Zugriffsverfolgung & -karte',f_hrf_4:'Offboarding-Warteschlange',f_hrf_5:'Budgetverfolgung & Verlängerungskalender',f_hrf_6:'Bevorzugter E-Mail-Support',
    f_pro_3:'Sparempfehlungen & KI-Vertragsanalyse',f_pro_4:'Kostenmanagement & Finanz-Suite',f_pro_5:'Komplette Sicherheits- & Audit-Suite',f_pro_6:'Lizenzoptimierung',f_pro_7:'Bevorzugter E-Mail-Support',
    f_ent_1:'Unbegrenzte SaaS-Tools',f_ent_2:'Unbegrenzte Mitarbeiter',f_ent_3:'Alles aus Pro enthalten',f_ent_5:'Bevorzugter E-Mail-Support',f_ent_6:'Schreibgeschützte REST-API',
  },
  es: {
    plan_free:'Gratis', plan_free_tag:'Para equipos pequeños que empiezan',
    plan_starter:'Starter', plan_starter_tag:'Para equipos en crecimiento',
    plan_hr_finance:'RRHH y Finanzas', plan_hr_finance_tag:'Para directores de RRHH y finanzas',
    plan_pro:'Pro', plan_pro_tag:'Para equipos que necesitan visibilidad total',
    plan_enterprise:'Enterprise', plan_enterprise_tag:'Para grandes organizaciones',
    f_free_3:'Detección de Shadow IT',f_free_4:'Alertas de seguridad básicas',f_free_5:'Sin tarjeta de crédito',f_free_6:'Gratis para siempre',
    f_starter_3:'Panel de personas: empleados, accesos y offboarding',f_starter_4:'Alertas de renovación',f_starter_5:'Importación y exportación CSV',f_starter_6:'Soporte por email',
    f_hrf_1:'Panel de Finanzas completo',f_hrf_2:'Panel de RRHH y Personal',f_hrf_3:'Seguimiento y mapa de accesos',f_hrf_4:'Cola de offboarding',f_hrf_5:'Control de presupuesto y calendario de renovaciones',f_hrf_6:'Soporte prioritario por email',
    f_pro_3:'Recomendaciones de ahorro y análisis de contratos con IA',f_pro_4:'Gestión de costes y suite financiera',f_pro_5:'Suite completa de seguridad y auditoría',f_pro_6:'Optimización de licencias',f_pro_7:'Soporte prioritario por email',
    f_ent_1:'Herramientas SaaS ilimitadas',f_ent_2:'Empleados ilimitados',f_ent_3:'Todo lo del plan Pro',f_ent_5:'Soporte prioritario por email',f_ent_6:'API REST de solo lectura',
  },
  pt: {
    plan_free:'Grátis', plan_free_tag:'Para pequenas equipas a começar',
    plan_starter:'Starter', plan_starter_tag:'Para equipas em crescimento',
    plan_hr_finance:'RH e Finanças', plan_hr_finance_tag:'Para diretores de RH e financeiros',
    plan_pro:'Pro', plan_pro_tag:'Para equipas que precisam de visibilidade total',
    plan_enterprise:'Enterprise', plan_enterprise_tag:'Para grandes organizações',
    f_free_3:'Deteção de Shadow IT',f_free_4:'Alertas de segurança básicos',f_free_5:'Sem cartão de crédito',f_free_6:'Grátis para sempre',
    f_starter_3:'Painel de pessoas: funcionários, acessos e offboarding',f_starter_4:'Alertas de renovação',f_starter_5:'Importação e exportação CSV',f_starter_6:'Suporte por email',
    f_hrf_1:'Painel de Finanças completo',f_hrf_2:'Painel de RH e Pessoas',f_hrf_3:'Rastreio e mapa de acessos',f_hrf_4:'Fila de offboarding',f_hrf_5:'Controlo orçamental e calendário de renovações',f_hrf_6:'Suporte prioritário por email',
    f_pro_3:'Recomendações de poupança e análise de contratos com IA',f_pro_4:'Gestão de custos e suite financeira',f_pro_5:'Suite completa de segurança e auditoria',f_pro_6:'Otimização de licenças',f_pro_7:'Suporte prioritário por email',
    f_ent_1:'Ferramentas SaaS ilimitadas',f_ent_2:'Funcionários ilimitados',f_ent_3:'Tudo do plano Pro',f_ent_5:'Suporte prioritário por email',f_ent_6:'API REST apenas de leitura',
  },
};

/** A card string in `lang`, falling back to English, then to the key. */
export function planText(lang, key) {
  return (PLAN_COPY[lang] || PLAN_COPY.en)[key] ?? PLAN_COPY.en[key] ?? key;
}

/** The bullet lines for one plan, in `lang`, with every number from the enforced limits. */
export function planFeatures(id, lang = 'en') {
  const card = PLAN_CARDS.find((c) => c.id === id);
  if (!card) return [];
  const counted = COUNTED[lang] || COUNTED.en;
  const limits = PLAN_LIMITS[id];
  const value = {
    tools: limits?.tools, employees: limits?.employees,
    team: TEAM_INVITE_LIMIT, clients: CLIENT_WORKSPACE_LIMIT,
  };
  return card.features.map((f) => (counted[f] ? counted[f](formatCount(value[f], lang)) : planText(lang, f)));
}
