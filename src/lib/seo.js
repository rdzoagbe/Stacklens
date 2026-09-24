// ── One title, description and canonical per page ──────────────────────────
//
// index.html hardcoded `<link rel="canonical" href="https://stacklens.fr/" />`
// and nothing changed it per route. This is a single-page app, so that same
// HTML is served for /about, /privacy, /dpa and the rest — every URL in
// sitemap.xml told Google it was a duplicate of the homepage.
//
// So the sitemap submitted nine pages and eight of them carried an
// instruction to drop them. Adding more pages would have achieved nothing:
// they would have canonicalised to / as well. The same cause made every route
// share one <title>, so even an indexed page was indistinguishable in results.
//
// Runtime head updates are weaker than server-rendered ones — they depend on
// the crawler executing JavaScript, which Google does and some others do not.
// Prerendering these routes at build time would be better and is a larger
// change. This is the part that has to be right first either way.

export const SITE_ORIGIN = 'https://stacklens.fr';

const SUFFIX = ' | Stacklens';

/**
 * Public, indexable routes. Authenticated routes are disallowed in robots.txt
 * and deliberately absent: giving them titles would invite indexing of pages
 * that redirect to a sign-in screen.
 */
export const PAGE_SEO = {
  '/': {
    title: 'Stacklens — SaaS audits for accountants and the SMBs they run',
    description: 'Turn the bank exports and invoices you already hold into a SaaS audit per client: duplicates, forgotten subscriptions, price rises, renewals, and who still has access. Free browser-only audit; EU data storage; GDPR tooling built in.',
    fr: {
      title: "Stacklens — l'audit SaaS des experts-comptables et des PME qu'ils accompagnent",
      description: "Transformez les exports bancaires et les factures que vous avez déjà en audit SaaS par client : doublons, abonnements oubliés, hausses de prix, renouvellements, et qui a encore accès. Audit gratuit dans le navigateur ; données stockées dans l'UE ; outils RGPD intégrés.",
    },
  },
  '/about': {
    title: 'About Stacklens',
    description: 'Who builds Stacklens and why: SaaS spend and access management for small and mid-sized European companies, with EU data storage and GDPR at the centre.',
    fr: {
      title: "À propos de Stacklens",
      description: "Qui construit Stacklens et pourquoi : la gestion des dépenses et des accès SaaS pour les petites et moyennes entreprises européennes, avec des données stockées dans l'UE et le RGPD au centre.",
    },
  },
  '/contact': {
    title: 'Contact',
    description: 'Get in touch with the Stacklens team about SaaS spend management, access reviews, security questions or your data protection rights.',
    fr: {
      title: "Contact",
      description: "Contactez l'équipe Stacklens au sujet de la gestion des dépenses SaaS, des revues d'accès, de questions de sécurité ou de vos droits sur vos données.",
    },
  },
  '/security-info': {
    title: 'Security',
    description: 'How Stacklens protects your data: EU data storage, encryption in transit and at rest, access controls, audit logging and our breach notification procedure.',
    fr: {
      title: "Sécurité",
      description: "Comment Stacklens protège vos données : stockage dans l'UE, chiffrement en transit et au repos, contrôles d'accès, journal d'audit et procédure de notification des violations.",
    },
  },
  '/privacy': {
    title: 'Privacy Policy',
    description: 'What personal data Stacklens processes, why, how long it is kept, and the rights you can exercise under the GDPR.',
    fr: {
      title: "Politique de confidentialité",
      description: "Quelles données personnelles Stacklens traite, pourquoi, combien de temps elles sont conservées, et les droits que vous pouvez exercer au titre du RGPD.",
    },
  },
  '/terms': {
    title: 'Terms of Service',
    description: 'The terms governing your use of Stacklens, including subscriptions, acceptable use, liability and termination.',
    fr: {
      title: "Conditions d'utilisation",
      description: "Les conditions qui régissent votre utilisation de Stacklens : abonnements, usage acceptable, responsabilité et résiliation.",
    },
  },
  '/dpa': {
    title: 'Data Processing Agreement',
    description: 'The Stacklens Data Processing Agreement: Article 28 GDPR terms, sub-processors, international transfers and the CCPA/CPRA addendum.',
    fr: {
      title: "Accord de traitement des données",
      description: "L'accord de traitement des données de Stacklens : clauses de l'article 28 du RGPD, sous-traitants, transferts internationaux et avenant CCPA/CPRA.",
    },
  },
  '/sub-processors': {
    title: 'Sub-processors',
    description: 'The complete list of sub-processors Stacklens uses, what each one processes, where it is located and the transfer safeguards that apply.',
    fr: {
      title: "Sous-traitants",
      description: "La liste complète des sous-traitants de Stacklens : ce que chacun traite, où il est situé et les garanties de transfert applicables.",
    },
  },
  // Commercial pages for the accountant channel. Titles carry the product
  // name so they read whole in a result; descriptions are French-first
  // because that is who they are for.
  '/experts-comptables': {
    title: 'Stacklens pour les experts-comptables',
    description: "Un audit SaaS pour chaque client, en cinq minutes. Stacklens donne aux experts-comptables et DAF externalisés une vue des abonnements logiciels, des doublons et des renouvellements de tous leurs clients, depuis un seul compte.",
  },
  '/audit-saas': {
    title: 'Audit SaaS gratuit',
    description: "Déposez un export bancaire, obtenez la liste des abonnements logiciels récurrents, des doublons, des hausses de prix et des renouvellements à venir. Tout se passe dans votre navigateur : rien n'est envoyé à Stacklens.",
  },
  '/legal': {
    title: 'Legal Notice',
    description: 'Legal notice and company information for Stacklens, including publisher, hosting provider and contact details.',
    fr: {
      title: "Mentions légales",
      description: "Mentions légales et informations sur Stacklens : éditeur, hébergeur et coordonnées.",
    },
  },
};

/** The full <title> for a path, or null when the path is not a public page. */
export function titleFor(pathname, language = 'en') {
  const entry = PAGE_SEO[normalise(pathname)];
  if (!entry) return null;
  const page = localised(entry, language);
  // The homepage title already names the product; the rest get the suffix so
  // a result reads "Privacy Policy | Stacklens" rather than bare "Privacy".
  return pathname === '/' || page.title.includes('Stacklens')
    ? page.title
    : page.title + SUFFIX;
}

/** The canonical URL for a path. Query strings and hashes never belong in it. */
export function canonicalFor(pathname) {
  const path = normalise(pathname);
  if (!PAGE_SEO[path]) return null;
  return path === '/' ? SITE_ORIGIN + '/' : SITE_ORIGIN + path;
}

export function descriptionFor(pathname, language = 'en') {
  const entry = PAGE_SEO[normalise(pathname)];
  return entry ? localised(entry, language).description || null : null;
}

// A page's head in the reader's language where one is written, English
// otherwise. French is written for every public page because France is the
// market; the accountant pages are French to begin with. The other three
// languages fall back to English rather than to a machine translation in a
// title Google will cache.
function localised(entry, language) {
  return (language && language !== 'en' && entry[language]) || entry;
}

/** Trailing slashes and case differences must not produce a second URL. */
function normalise(pathname) {
  let p = String(pathname || '/').split('?')[0].split('#')[0].toLowerCase();
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}

export { normalise as normalisePath };

/**
 * Write the head for this path. A route with no entry — every authenticated
 * page — is left alone rather than given the homepage's canonical, which is
 * the bug this module exists to fix.
 */
export function applySeo(pathname, doc = typeof document !== 'undefined' ? document : null, language = 'en') {
  if (!doc) return false;
  const title = titleFor(pathname, language);
  const description = descriptionFor(pathname, language);
  const canonical = canonicalFor(pathname);
  if (!title || !canonical) return false;

  doc.title = title;
  setMeta(doc, 'name', 'description', description);
  setMeta(doc, 'property', 'og:title', title);
  setMeta(doc, 'property', 'og:description', description);
  setMeta(doc, 'property', 'og:url', canonical);
  setMeta(doc, 'property', 'twitter:title', title);
  setMeta(doc, 'property', 'twitter:description', description);
  setMeta(doc, 'property', 'twitter:url', canonical);
  setLink(doc, 'canonical', canonical);
  return true;
}

function setMeta(doc, attr, key, value) {
  if (!value) return;
  let el = doc.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = doc.createElement('meta');
    el.setAttribute(attr, key);
    doc.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function setLink(doc, rel, href) {
  let el = doc.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = doc.createElement('link');
    el.setAttribute('rel', rel);
    doc.head.appendChild(el);
  }
  el.setAttribute('href', href);
}
