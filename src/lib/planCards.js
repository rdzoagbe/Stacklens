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
  // Starter took in HR & Finance (2026-11-10): one €29 plan with the Finance
  // pages. HR & Finance subscribers keep their plan; it is no longer sold.
  { id: 'starter', monthly: 29, annual: 278,
    features: ['tools', 'employees', 'f_hrf_1', 'f_starter_3', 'f_hrf_5', 'f_starter_5', 'team', 'f_starter_6'] },
  { id: 'pro', monthly: 79, annual: 758,
    features: ['tools', 'employees', 'f_pro_4', 'f_pro_3', 'f_pro_5', 'f_pro_6', 'team', 'f_pro_7'] },
  // For accounting firms and outsourced CFOs: Pro's pages in the firm's own
  // workspace and in every client workspace (they run on the firm's plan).
  // Client workspaces left Starter and Pro the same day (CLIENT_PLANS).
  { id: 'cabinet', monthly: 79, annual: 758,
    features: ['clients', 'f_cab_1', 'f_cab_2', 'tools', 'employees', 'team', 'f_pro_7'] },
  // Pro's people and the API used to differ only on a card at €299; Business
  // sits between them: unlimited tools, up to 1,500 people, the API and the
  // bank connection (the `api` module).
  { id: 'business', monthly: 149, annual: 1430,
    features: ['f_ent_1', 'employees', 'f_bus_1', 'f_ent_6', 'f_bus_2', 'team', 'clients', 'f_ent_5'] },
  // Above 1,500 people: a starting price, an annual contract priced by
  // headcount, through a conversation rather than card checkout (`contact`).
  // "Unlimited employees" is gone: the security page says the product is
  // designed and tested for about 1,500 people.
  { id: 'enterprise', monthly: 299, annual: 2870, contact: true,
    features: ['f_ent_7', 'f_ent_8', 'f_ent_9', 'f_ent_10', 'team', 'clients'] },
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
        team: (n) => `Share with up to ${n} teammates`, clients: (n) => `For firms: up to ${n} client workspaces` },
  fr: { tools: (n) => `Jusqu'à ${n} outils SaaS`, employees: (n) => `Jusqu'à ${n} employés`,
        team: (n) => `Partage avec jusqu'à ${n} collaborateurs`, clients: (n) => `Pour les cabinets : jusqu'à ${n} espaces clients` },
  de: { tools: (n) => `Bis zu ${n} SaaS-Tools`, employees: (n) => `Bis zu ${n} Mitarbeiter`,
        team: (n) => `Mit bis zu ${n} Teammitgliedern teilen`, clients: (n) => `Für Kanzleien: bis zu ${n} Mandanten-Workspaces` },
  es: { tools: (n) => `Hasta ${n} herramientas SaaS`, employees: (n) => `Hasta ${n} empleados`,
        team: (n) => `Comparte con hasta ${n} compañeros`, clients: (n) => `Para despachos: hasta ${n} espacios de clientes` },
  pt: { tools: (n) => `Até ${n} ferramentas SaaS`, employees: (n) => `Até ${n} funcionários`,
        team: (n) => `Partilhe com até ${n} colegas`, clients: (n) => `Para escritórios: até ${n} espaços de clientes` },
};

export const PLAN_COPY = {
  en: {
    plan_free:'Free', plan_free_tag:'For small teams getting started',
    plan_cabinet:'Cabinet', plan_cabinet_tag:'For accounting firms and outsourced CFOs', f_cab_1:'Everything in Pro, in every client workspace', f_cab_2:'Turn a free audit into a client workspace',
    plan_starter:'Starter', plan_starter_tag:'For growing teams',
    plan_hr_finance:'HR & Finance', plan_hr_finance_tag:'For HR & Finance directors',
    plan_pro:'Pro', plan_pro_tag:'For teams that need full visibility and control',
    plan_enterprise:'Enterprise', plan_enterprise_tag:'For large organisations',
    plan_business:'Business', plan_business_tag:'For companies of 500 to 1,500 people', f_bus_1:'Everything in Pro', f_bus_2:'Bank connection for supplier invoices', f_ent_7:'Over 1,500 employees, priced by headcount', f_ent_8:'Everything in Business', f_ent_9:'Annual contract, paid by invoice', f_ent_10:'Contract and DPA reviewed with you', plan_enterprise_from:'From', plan_enterprise_cta:'Talk to us',
    f_free_3:'Every tool you pay for, and who has access',f_free_4:'Leavers who can still log in, flagged',f_free_5:'No credit card required',f_free_6:'Forever free',
    f_starter_3:'Leavers\' access removed, with proof',f_starter_4:'Renewal alerts',f_starter_5:'CSV import & export',f_starter_6:'Email support',
    f_hrf_1:'Renewals with the last day to cancel',f_hrf_2:'People & HR Board',f_hrf_3:'Access tracking & map',f_hrf_4:'Offboarding queue',f_hrf_5:'Supplier invoices checked: duplicates and price rises',f_hrf_6:'Priority email support',
    f_pro_3:'Savings with their evidence, confirmed on invoices',f_pro_4:'Everything in Starter',f_pro_5:'Signed access reviews and a tamper-evident audit trail',f_pro_6:'Security page: MFA coverage and score',f_pro_7:'Priority email support',
    f_ent_1:'Unlimited SaaS tools',f_ent_3:'Everything in Pro',f_ent_5:'Priority email support',f_ent_6:'Read-only REST API',
  },
  fr: {
    plan_free:'Gratuit', plan_free_tag:'Pour les petites équipes qui débutent',
    plan_cabinet:'Cabinet', plan_cabinet_tag:'Pour les experts-comptables et DAF externalisés', f_cab_1:'Tout le plan Pro, dans chaque espace client', f_cab_2:"Transformez un audit gratuit en espace client",
    plan_starter:'Starter', plan_starter_tag:'Pour les équipes en croissance',
    plan_hr_finance:'RH & Finance', plan_hr_finance_tag:'Pour les DRH et directeurs financiers',
    plan_pro:'Pro', plan_pro_tag:'Pour les équipes qui ont besoin de visibilité totale',
    plan_enterprise:'Enterprise', plan_enterprise_tag:'Pour les grandes organisations',
    plan_business:'Business', plan_business_tag:'Pour les entreprises de 500 à 1 500 personnes', f_bus_1:'Tout le plan Pro inclus', f_bus_2:'Connexion bancaire pour les factures fournisseurs', f_ent_7:'Plus de 1 500 employés, prix selon l\'effectif', f_ent_8:'Tout le plan Business inclus', f_ent_9:'Contrat annuel, réglé sur facture', f_ent_10:'Contrat et DPA revus avec vous', plan_enterprise_from:'À partir de', plan_enterprise_cta:'Nous contacter',
    f_free_3:'Chaque outil payé, et qui y a accès',f_free_4:'Les partants qui peuvent encore se connecter, signalés',f_free_5:'Sans carte bancaire',f_free_6:'Gratuit pour toujours',
    f_starter_3:'Accès des partants retirés, avec preuve',f_starter_4:'Alertes de renouvellement',f_starter_5:'Import & export CSV',f_starter_6:'Support par email',
    f_hrf_1:'Renouvellements avec la date limite pour résilier',f_hrf_2:'Tableau de bord RH & Personnel',f_hrf_3:'Suivi et carte des accès',f_hrf_4:"File d'offboarding",f_hrf_5:'Factures fournisseurs contrôlées : doublons et hausses de prix',f_hrf_6:'Support email prioritaire',
    f_pro_3:'Économies avec leurs preuves, confirmées sur les factures',f_pro_4:'Tout le plan Starter',f_pro_5:'Revues d\'accès signées et journal d\'audit infalsifiable',f_pro_6:'Page sécurité : couverture MFA et score',f_pro_7:'Support email prioritaire',
    f_ent_1:'Outils SaaS illimités',f_ent_3:'Tout le plan Pro inclus',f_ent_5:'Support email prioritaire',f_ent_6:'API REST en lecture seule',
  },
  de: {
    plan_free:'Kostenlos', plan_free_tag:'Für kleine Teams am Anfang',
    plan_cabinet:'Kanzlei', plan_cabinet_tag:'Für Steuerberater und externe CFOs', f_cab_1:'Alles aus Pro, in jedem Mandanten-Workspace', f_cab_2:'Ein kostenloses Audit zum Mandanten-Workspace machen',
    plan_starter:'Starter', plan_starter_tag:'Für wachsende Teams',
    plan_hr_finance:'HR & Finanzen', plan_hr_finance_tag:'Für HR- und Finanzleiter',
    plan_pro:'Pro', plan_pro_tag:'Für Teams, die volle Transparenz brauchen',
    plan_enterprise:'Enterprise', plan_enterprise_tag:'Für große Organisationen',
    plan_business:'Business', plan_business_tag:'Für Unternehmen mit 500 bis 1.500 Personen', f_bus_1:'Alles aus Pro enthalten', f_bus_2:'Bankverbindung für Lieferantenrechnungen', f_ent_7:'Über 1.500 Mitarbeiter, Preis nach Mitarbeiterzahl', f_ent_8:'Alles aus Business enthalten', f_ent_9:'Jahresvertrag, Zahlung per Rechnung', f_ent_10:'Vertrag und AVV gemeinsam mit Ihnen geprüft', plan_enterprise_from:'Ab', plan_enterprise_cta:'Kontakt aufnehmen',
    f_free_3:'Jedes bezahlte Tool, und wer Zugriff hat',f_free_4:'Ausgeschiedene, die sich noch anmelden können, markiert',f_free_5:'Keine Kreditkarte nötig',f_free_6:'Für immer kostenlos',
    f_starter_3:'Zugriffe Ausgeschiedener entfernt, mit Nachweis',f_starter_4:'Verlängerungs-Alerts',f_starter_5:'CSV-Import & -Export',f_starter_6:'E-Mail-Support',
    f_hrf_1:'Verlängerungen mit letztem Kündigungstag',f_hrf_2:'HR- & Personal-Dashboard',f_hrf_3:'Zugriffsverfolgung & -karte',f_hrf_4:'Offboarding-Warteschlange',f_hrf_5:'Lieferantenrechnungen geprüft: Doppelungen und Preiserhöhungen',f_hrf_6:'Bevorzugter E-Mail-Support',
    f_pro_3:'Einsparungen mit Nachweis, an Rechnungen bestätigt',f_pro_4:'Alles aus Starter',f_pro_5:'Unterschriebene Zugriffsprüfungen und manipulationssicheres Audit-Protokoll',f_pro_6:'Sicherheitsseite: MFA-Abdeckung und Score',f_pro_7:'Bevorzugter E-Mail-Support',
    f_ent_1:'Unbegrenzte SaaS-Tools',f_ent_3:'Alles aus Pro enthalten',f_ent_5:'Bevorzugter E-Mail-Support',f_ent_6:'Schreibgeschützte REST-API',
  },
  es: {
    plan_free:'Gratis', plan_free_tag:'Para equipos pequeños que empiezan',
    plan_cabinet:'Despacho', plan_cabinet_tag:'Para despachos contables y CFO externos', f_cab_1:'Todo lo del plan Pro, en cada espacio de cliente', f_cab_2:'Convierta una auditoría gratuita en un espacio de cliente',
    plan_starter:'Starter', plan_starter_tag:'Para equipos en crecimiento',
    plan_hr_finance:'RRHH y Finanzas', plan_hr_finance_tag:'Para directores de RRHH y finanzas',
    plan_pro:'Pro', plan_pro_tag:'Para equipos que necesitan visibilidad total',
    plan_enterprise:'Enterprise', plan_enterprise_tag:'Para grandes organizaciones',
    plan_business:'Business', plan_business_tag:'Para empresas de 500 a 1.500 personas', f_bus_1:'Todo lo del plan Pro', f_bus_2:'Conexión bancaria para facturas de proveedores', f_ent_7:'Más de 1.500 empleados, precio según plantilla', f_ent_8:'Todo lo del plan Business', f_ent_9:'Contrato anual, pago por factura', f_ent_10:'Contrato y DPA revisados con usted', plan_enterprise_from:'Desde', plan_enterprise_cta:'Hablar con nosotros',
    f_free_3:'Cada herramienta que paga, y quién tiene acceso',f_free_4:'Quienes se fueron y aún pueden entrar, señalados',f_free_5:'Sin tarjeta de crédito',f_free_6:'Gratis para siempre',
    f_starter_3:'Accesos de quienes se fueron retirados, con prueba',f_starter_4:'Alertas de renovación',f_starter_5:'Importación y exportación CSV',f_starter_6:'Soporte por email',
    f_hrf_1:'Renovaciones con el último día para cancelar',f_hrf_2:'Panel de RRHH y Personal',f_hrf_3:'Seguimiento y mapa de accesos',f_hrf_4:'Cola de offboarding',f_hrf_5:'Facturas de proveedores revisadas: duplicados y subidas de precio',f_hrf_6:'Soporte prioritario por email',
    f_pro_3:'Ahorros con su prueba, confirmados en las facturas',f_pro_4:'Todo lo del plan Starter',f_pro_5:'Revisiones de acceso firmadas y registro de auditoría a prueba de manipulaciones',f_pro_6:'Página de seguridad: cobertura MFA y puntuación',f_pro_7:'Soporte prioritario por email',
    f_ent_1:'Herramientas SaaS ilimitadas',f_ent_3:'Todo lo del plan Pro',f_ent_5:'Soporte prioritario por email',f_ent_6:'API REST de solo lectura',
  },
  pt: {
    plan_free:'Grátis', plan_free_tag:'Para pequenas equipas a começar',
    plan_cabinet:'Gabinete', plan_cabinet_tag:'Para contabilistas e CFO externos', f_cab_1:'Tudo do plano Pro, em cada espaço de cliente', f_cab_2:'Transforme uma auditoria gratuita num espaço de cliente',
    plan_starter:'Starter', plan_starter_tag:'Para equipas em crescimento',
    plan_hr_finance:'RH e Finanças', plan_hr_finance_tag:'Para diretores de RH e financeiros',
    plan_pro:'Pro', plan_pro_tag:'Para equipas que precisam de visibilidade total',
    plan_enterprise:'Enterprise', plan_enterprise_tag:'Para grandes organizações',
    plan_business:'Business', plan_business_tag:'Para empresas de 500 a 1.500 pessoas', f_bus_1:'Tudo do plano Pro', f_bus_2:'Ligação bancária para faturas de fornecedores', f_ent_7:'Mais de 1.500 funcionários, preço por número de pessoas', f_ent_8:'Tudo do plano Business', f_ent_9:'Contrato anual, pago por fatura', f_ent_10:'Contrato e DPA revistos consigo', plan_enterprise_from:'Desde', plan_enterprise_cta:'Falar connosco',
    f_free_3:'Cada ferramenta paga, e quem tem acesso',f_free_4:'Quem saiu e ainda consegue entrar, assinalado',f_free_5:'Sem cartão de crédito',f_free_6:'Grátis para sempre',
    f_starter_3:'Acessos de quem saiu retirados, com prova',f_starter_4:'Alertas de renovação',f_starter_5:'Importação e exportação CSV',f_starter_6:'Suporte por email',
    f_hrf_1:'Renovações com o último dia para cancelar',f_hrf_2:'Painel de RH e Pessoas',f_hrf_3:'Rastreio e mapa de acessos',f_hrf_4:'Fila de offboarding',f_hrf_5:'Faturas de fornecedores verificadas: duplicados e aumentos de preço',f_hrf_6:'Suporte prioritário por email',
    f_pro_3:'Poupanças com prova, confirmadas nas faturas',f_pro_4:'Tudo do plano Starter',f_pro_5:'Revisões de acesso assinadas e registo de auditoria inviolável',f_pro_6:'Página de segurança: cobertura MFA e pontuação',f_pro_7:'Suporte prioritário por email',
    f_ent_1:'Ferramentas SaaS ilimitadas',f_ent_3:'Tudo do plano Pro',f_ent_5:'Suporte prioritário por email',f_ent_6:'API REST apenas de leitura',
  },
};

/** A card string in `lang`, falling back to English, then to the key. */
export function planText(lang, key) {
  return (PLAN_COPY[lang] || PLAN_COPY.en)[key] ?? PLAN_COPY.en[key] ?? key;
}

/** The bullet lines for one plan, in `lang`, with every number from the enforced limits. */
/** The card's lines; pass `limits` (getPlanLimits with the user) so a Pro customer from before the change reads their own 1,500. */
export function planFeatures(id, lang = 'en', limits = PLAN_LIMITS[id]) {
  const card = PLAN_CARDS.find((c) => c.id === id);
  if (!card) return [];
  const counted = COUNTED[lang] || COUNTED.en;
  const value = {
    tools: limits?.tools, employees: limits?.employees,
    team: TEAM_INVITE_LIMIT, clients: CLIENT_WORKSPACE_LIMIT,
  };
  return card.features.map((f) => (counted[f] ? counted[f](formatCount(value[f], lang)) : planText(lang, f)));
}
