import React from 'react'
import { useLang } from '../context/LangContext'

export default function MatchProbability({ probability, reasoning }) {
  const { t } = useLang()
  if (probability === undefined || probability === null) return null
  const color = probability >= 60 ? '#4caf7d' : probability >= 35 ? '#f5a623' : '#ff6b6b'

  return (
    <div className="card" style={{ marginBottom: 10, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {t('interview_probability')}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 'clamp(20px,5vw,26px)', fontWeight: 700, fontFamily: 'Syne, sans-serif', color, minWidth: 60, lineHeight: 1 }}>
          {probability}%
        </div>
        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${probability}%`, background: color, borderRadius: 3, transition: 'width 1s ease' }} />
        </div>
      </div>
      {reasoning && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>{reasoning}</p>}
    </div>
  )
}
