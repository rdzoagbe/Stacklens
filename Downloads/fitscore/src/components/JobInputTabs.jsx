import React from 'react'
import { useLang } from '../context/LangContext'

export default function JobInputTabs({ mode, onChange }) {
  const { t } = useLang()
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 10, background: 'var(--bg-input)', padding: 3, borderRadius: 10 }}>
      <button onClick={() => onChange('url')} style={{
        flex: 1, padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
        background: mode === 'url' ? 'var(--bg-card)' : 'transparent',
        color: mode === 'url' ? 'var(--text-primary)' : 'var(--text-muted)',
        fontSize: 12, fontWeight: mode === 'url' ? 600 : 500, fontFamily: 'inherit',
        transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
      }}>
        🔗 <span>{t('input_tab_url') || 'Job URL'}</span>
      </button>
      <button onClick={() => onChange('text')} style={{
        flex: 1, padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
        background: mode === 'text' ? 'var(--bg-card)' : 'transparent',
        color: mode === 'text' ? 'var(--text-primary)' : 'var(--text-muted)',
        fontSize: 12, fontWeight: mode === 'text' ? 600 : 500, fontFamily: 'inherit',
        transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
      }}>
        📝 <span>{t('input_tab_text') || 'Paste text'}</span>
      </button>
    </div>
  )
}
