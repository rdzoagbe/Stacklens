import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'

export default function AuthModal({ initialMode = 'signin', onClose }) {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const { t } = useLang()
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = '' }
  }, [onClose])

  const handleSubmit = async () => {
    setError(''); setSuccess(''); setLoading(true)
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) throw error
      } else {
        const { error } = await signUp(email, password)
        if (error) throw error
        setSuccess(t('account_created'))
      }
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const handleGoogle = async () => {
    setError('')
    const { error } = await signInWithGoogle()
    if (error) setError(error.message)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fadeIn 0.2s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 'clamp(24px,5vw,32px)', maxWidth: 420, width: '100%', position: 'relative', animation: 'fadeUp 0.3s ease', maxHeight: '90vh', overflowY: 'auto' }}>

        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 22, padding: '4px 8px', lineHeight: 1 }}>×</button>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Fit<span style={{ color: 'var(--accent)' }}>Score</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {mode === 'signin' ? (t('modal_welcome_back') || 'Welcome back') : (t('modal_join') || 'Create your account')}
          </p>
        </div>

        <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 10, padding: 3, marginBottom: 20 }}>
          {[['signin', t('sign_in')], ['signup', t('sign_up')]].map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }} style={{
              flex: 1, padding: '9px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: mode===m?'var(--accent)':'transparent',
              color: mode===m?'#1A1B22':'var(--text-muted)',
              fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 600, transition: 'all 0.2s'
            }}>{label}</button>
          ))}
        </div>

        <button onClick={handleGoogle} style={{ width:'100%', padding:'12px', borderRadius:12, background:'var(--bg-input)', border:'1px solid var(--border)', color:'var(--text-primary)', fontSize:14, cursor:'pointer', marginBottom:14, display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {t('continue_google')}
        </button>

        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <div style={{ flex:1, height:'1px', background:'var(--border)' }}/>
          <span style={{ fontSize:12, color:'var(--text-muted)' }}>{t('or')}</span>
          <div style={{ flex:1, height:'1px', background:'var(--border)' }}/>
        </div>

        <input type="email" placeholder={t('email_placeholder')} value={email} onChange={e=>setEmail(e.target.value)} style={{ marginBottom: 8 }} />
        <input type="password" placeholder={t('password_placeholder')} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} style={{ marginBottom: 14 }} />

        {error && <p style={{ fontSize:13, color:'#ff6b6b', marginBottom:10, padding:'10px 12px', background:'rgba(255,107,107,0.08)', borderRadius:8 }}>{error}</p>}
        {success && <p style={{ fontSize:13, color:'#4caf7d', marginBottom:10, padding:'10px 12px', background:'rgba(76,175,125,0.08)', borderRadius:8 }}>{success}</p>}

        <button onClick={handleSubmit} disabled={loading||!email||!password} className="btn-primary" style={{ width:'100%' }}>
          {loading ? t('please_wait') : mode==='signin' ? t('sign_in_arrow') : t('create_account')}
        </button>

        <p style={{ fontSize:11, color:'var(--text-hint)', textAlign:'center', marginTop:14, lineHeight:1.6 }}>
          {t('auth_terms')}{' '}
          <a href="/privacy" style={{ color:'var(--text-muted)' }}>{t('privacy_policy')}</a>.
        </p>
      </div>
    </div>
  )
}
