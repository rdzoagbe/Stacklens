import React, { useState, useRef, useEffect } from 'react'
import { useLang } from '../context/LangContext'
import { useCvPersist } from '../hooks/useCvPersist'

export default function NewAnalysisMenu({ onNewWithCv, onUploadNew }) {
  const { t } = useLang()
  const { cvFile } = useCvPersist()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // If no CV stored, just run onNewWithCv directly (no menu needed)
  if (!cvFile) {
    return (
      <button onClick={onNewWithCv} style={{ background: 'var(--accent)', border: 'none', borderRadius: 20, padding: '9px 20px', color: '#1A1B22', fontSize: 13, fontFamily: 'Syne, sans-serif', fontWeight: 700, cursor: 'pointer' }}>
        + {t('new_analysis')}
      </button>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 20, padding: '9px 16px', color: '#1A1B22', fontSize: 13, fontFamily: 'Syne, sans-serif', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
        ↗ {t('new_analysis')}
        <span style={{ fontSize: 10, opacity: 0.7, borderLeft: '1px solid rgba(26,27,34,0.3)', paddingLeft: 8 }}>▾</span>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 6, zIndex: 60, minWidth: 260, boxShadow: '0 12px 32px var(--shadow)', animation: 'fadeUp 0.15s ease' }}>
          <button onClick={() => { setOpen(false); onNewWithCv() }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10, fontFamily: 'inherit' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>📄</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                {t('new_with_cv') || 'New analysis with current CV'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {cvFile?.name || 'Current CV'}
              </p>
            </div>
          </button>

          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

          <button onClick={() => { setOpen(false); onUploadNew() }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>↑</span>
            <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>
              {t('upload_new_cv') || 'Upload new CV'}
            </p>
          </button>
        </div>
      )}
    </div>
  )
}
