import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { useTheme } from '../context/ThemeContext'

export default function UserMenu({ onViewDashboard }) {
  const { user, signOut } = useAuth()
  const { t } = useLang()
  const { theme, changeTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initials = (user?.email || 'U').slice(0, 2).toUpperCase()
  const displayName = user?.email?.split('@')[0] || 'User'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'var(--accent-bg)', border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent)', fontSize: 12, fontWeight: 700, fontFamily: 'Syne, sans-serif',
        transition: 'all 0.2s'
      }}>
        {initials}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 6, zIndex: 60,
          boxShadow: '0 12px 32px var(--shadow)',
          minWidth: 240,
          animation: 'fadeUp 0.15s ease'
        }}>
          {/* User info */}
          <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, fontFamily: 'Syne, sans-serif' }}>{displayName}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</p>
          </div>

          {/* Dashboard */}
          <button onClick={() => { setOpen(false); onViewDashboard?.() }} style={menuItemStyle}>
            <span style={iconStyle}>📊</span>
            <span>{t('history')}</span>
          </button>

          {/* Theme */}
          <div style={{ padding: '8px 12px 6px' }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              {t('theme') || 'Theme'}
            </p>
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-input)', borderRadius: 10, padding: 3 }}>
              {[
                { v: 'light', icon: '☀️', label: t('light') || 'Light' },
                { v: 'dark', icon: '🌙', label: t('dark') || 'Dark' },
                { v: 'system', icon: '⚙️', label: t('auto') || 'Auto' }
              ].map(o => (
                <button key={o.v} onClick={() => changeTheme(o.v)} title={o.label} style={{
                  flex: 1, padding: '6px 4px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  background: theme === o.v ? 'var(--accent)' : 'transparent',
                  color: theme === o.v ? '#1A1B22' : 'var(--text-muted)',
                  fontSize: 12, transition: 'all 0.2s'
                }}>{o.icon}</button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
            <a href="/privacy" style={{ ...menuItemStyle, textDecoration: 'none' }}>
              <span style={iconStyle}>🔒</span>
              <span>{t('privacy')}</span>
            </a>
            <button onClick={() => { setOpen(false); signOut() }} style={menuItemStyle}>
              <span style={iconStyle}>🚪</span>
              <span style={{ color: '#ff6b6b' }}>{t('sign_out')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const menuItemStyle = {
  width: '100%', textAlign: 'left',
  padding: '10px 12px', borderRadius: 8,
  background: 'transparent', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 10,
  fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit',
  transition: 'background 0.15s'
}

const iconStyle = { fontSize: 14, width: 18, display: 'inline-flex', justifyContent: 'center' }
