import React from 'react'
import ThemeToggle from '../components/ThemeToggle'

export default function PrivacyPage({ onBack }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '24px 20px 60px', transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            ← Retour
          </button>
          <ThemeToggle />
        </div>

        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          Politique de confidentialité & RGPD
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 36 }}>Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>

        {[
          { title: '1. Responsable du traitement', content: `FitScore est édité en tant que service personnel. En utilisant FitScore, vous acceptez la collecte et l'utilisation de vos données telles que décrites dans cette politique.` },
          { title: '2. Données collectées', content: `Nous collectons uniquement les données nécessaires :\n\n• Adresse email (création de compte)\n• Fichiers CV uploadés (PDF ou Word) — stockés de façon sécurisée\n• URLs des offres d'emploi analysées\n• Résultats des analyses ATS\n• Données de connexion (date, heure)` },
          { title: '3. Finalité du traitement', content: `Vos données sont utilisées exclusivement pour :\n\n• Vous fournir le service d'analyse ATS\n• Stocker votre historique d'analyses\n• Améliorer le service\n\nVos données ne sont jamais vendues, partagées ou utilisées à des fins publicitaires.` },
          { title: '4. Base légale (RGPD Art. 6)', content: `Le traitement est fondé sur :\n\n• L'exécution du contrat (fourniture du service)\n• Votre consentement explicite lors de l'inscription` },
          { title: '5. Durée de conservation', content: `• Données de compte : jusqu'à suppression du compte\n• Fichiers CV : jusqu'à suppression manuelle ou du compte\n• Historique d'analyses : jusqu'à suppression manuelle ou du compte\n\nEn cas de suppression, toutes les données sont supprimées sous 30 jours.` },
          { title: '6. Sous-traitants', content: `Tous conformes au RGPD :\n\n• Supabase (stockage) — serveurs en Europe\n• Anthropic (analyse IA) — traitement à la volée, aucune donnée conservée\n• Vercel (hébergement) — infrastructure sécurisée` },
          { title: '7. Vos droits (RGPD)', content: `• Droit d'accès\n• Droit de rectification\n• Droit à l'effacement (droit à l'oubli)\n• Droit à la portabilité\n• Droit d'opposition\n\nPour exercer ces droits, supprimez votre compte ou contactez-nous.` },
          { title: '8. Sécurité', content: `• Chiffrement en transit (HTTPS/TLS)\n• Chiffrement au repos (Supabase)\n• Authentification sécurisée\n• Accès strictement limité à votre compte` },
          { title: '9. Cookies', content: `FitScore utilise uniquement des cookies techniques nécessaires (session d'authentification). Aucun cookie publicitaire ou de tracking.` },
          { title: '10. Contact & réclamations', content: `Pour toute question relative à vos données, contactez-nous via l'application.\n\nVous avez le droit d'introduire une réclamation auprès de la CNIL (www.cnil.fr).` },
        ].map(({ title, content }) => (
          <div key={title} style={{ marginBottom: 28 }}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 600, color: 'var(--accent)', marginBottom: 10 }}>{title}</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, whiteSpace: 'pre-line' }}>{content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
