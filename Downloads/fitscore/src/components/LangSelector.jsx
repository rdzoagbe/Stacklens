import React, { useState, useRef, useEffect } from 'react'
import { useLang } from '../context/LangContext'

export default function LangSelector() {
  const { lang, changeLang, languages } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current = languages.find(l => l.code === lang) || languages[0]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: 'var(--bg-input)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '6px 12px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'inherit',
        transition: 'all 0.2s'
      }}>
        <span style={{ fontSize: 14 }}>{current.flag}</span>
        <span style={{ fontWeight: 500 }}>{current.code.toUpperCase()}</span>
        <span style={{ fontSize: 9, opacity: 0.6, marginLeft: 1 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 4, zIndex: 50,
          boxShadow: '0 8px 24px var(--shadow)',
          minWidth: 160,
          animation: 'fadeUp 0.15s ease'
        }}>
          {languages.map(l => (
            <button key={l.code} onClick={() => { changeLang(l.code); setOpen(false) }} style={{
              width: '100%', textAlign: 'left',
              padding: '8px 12px', borderRadius: 8,
              background: lang === l.code ? 'var(--accent-bg)' : 'transparent',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 13, color: lang === l.code ? 'var(--accent)' : 'var(--text-primary)',
              fontFamily: 'inherit',
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => { if (lang !== l.code) e.currentTarget.style.background = 'var(--bg-input)' }}
            onMouseLeave={e => { if (lang !== l.code) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 16 }}>{l.flag}</span>
              <span style={{ fontWeight: lang === l.code ? 500 : 400 }}>{l.label}</span>
              {lang === l.code && <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
