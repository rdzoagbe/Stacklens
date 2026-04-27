import React from 'react'
import { useLang } from '../context/LangContext'

export default function Footer({ compact = false }) {
  const { t } = useLang()
  if (compact) {
    return (
      <footer style={{ marginTop: 40, padding: '20px 0 0', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <p style={{ fontSize: 11, color: 'var(--text-hint)' }}>
          © {new Date().getFullYear()} FitScore · {t('footer_made_in') || 'Made in France'}
        </p>
        <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
          <a href="/privacy" style={{ color: 'var(--text-hint)', textDecoration: 'none' }}>{t('privacy')}</a>
          <a href="/terms" style={{ color: 'var(--text-hint)', textDecoration: 'none' }}>{t('footer_terms') || 'Terms'}</a>
          <a href="mailto:hello@fitscore.app" style={{ color: 'var(--text-hint)', textDecoration: 'none' }}>{t('footer_contact') || 'Contact'}</a>
        </div>
      </footer>
    )
  }
  return null
}
