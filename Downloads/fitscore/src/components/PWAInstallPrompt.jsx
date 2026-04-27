import React, { useEffect, useState } from 'react'
import { useLang } from '../context/LangContext'

export default function PWAInstallPrompt() {
  const { t } = useLang()
  const [prompt, setPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pwa_dismissed') === 'true')
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstalled(true))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setPrompt(null)
  }

  const handleDismiss = () => { setDismissed(true); localStorage.setItem('pwa_dismissed', 'true') }

  if (!prompt || dismissed || installed) return null

  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: 400, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', zIndex: 500, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 8px 32px var(--shadow)', animation: 'fadeUp 0.4s ease' }}>
      <span style={{ fontSize: 24, flexShrink: 0 }}>📱</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{t('install_fitscore')}</p>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('install_desc')}</p>
      </div>
      <button onClick={handleDismiss} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: '2px 6px' }}>×</button>
      <button onClick={handleInstall} style={{ background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '8px 14px', color: '#1A1B22', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'Syne, sans-serif' }}>{t('install')}</button>
    </div>
  )
}
