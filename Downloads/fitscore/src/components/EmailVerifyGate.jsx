import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import ThemeToggle from './ThemeToggle'
import LangSelector from './LangSelector'

export default function EmailVerifyGate() {
  const { user, signOut } = useAuth()
  const { t } = useLang()
  const [resending, setResending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleResend = async () => {
    setResending(true)
    setError('')
    try {
      const { error: err } = await supabase.auth.resend({
        type: 'signup',
        email: user.email
      })
      if (err) throw err
      setSent(true)
      setTimeout(() => setSent(false), 5000)
    } catch (e) {
      setError(e.message)
    }
    setResending(false)
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(20px,5vw,40px)' }}>
      <div style={{ position: 'fixed', top: 20, right: 20, display: 'flex', gap: 8 }}>
        <LangSelector />
        <ThemeToggle />
      </div>

      <div style={{ width: '100%', maxWidth: 420, animation: 'fadeUp 0.4s ease', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 24 }}>📧</div>

        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(20px,5vw,26px)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, letterSpacing: '-0.01em' }}>
          {t('verify_email_title')}
        </h1>

        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 8 }}>
          {t('verify_email_desc')}
        </p>

        <p style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 28, fontWeight: 500 }}>
          {user?.email}
        </p>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px' }}>

          {sent ? (
            <p style={{ fontSize: 13, color: '#4caf7d', padding: '10px', background: 'rgba(76,175,125,0.08)', borderRadius: 8 }}>
              {t('verify_email_sent')}
            </p>
          ) : (
            <button onClick={handleResend} disabled={resending} className="btn-primary" style={{ width: '100%', marginBottom: 12 }}>
              {resending ? t('please_wait') : t('verify_email_resend')}
            </button>
          )}

          {error && <p style={{ fontSize: 12, color: '#ff6b6b', marginTop: 8 }}>{error}</p>}

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.5 }}>
            {t('check_spam')}
          </p>
        </div>

        <button onClick={signOut} style={{ marginTop: 24, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: 4 }}>
          {t('sign_out')}
        </button>
      </div>
    </div>
  )
}
