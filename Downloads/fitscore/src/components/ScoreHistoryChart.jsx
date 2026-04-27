import React, { useState } from 'react'
import { useLang } from '../context/LangContext'

const RANGES = ['1M','3M','6M','1Y','All']

function filterByRange(analyses, range) {
  if (range === 'All') return analyses
  const now = Date.now()
  const ms = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }[range] * 86400000
  return analyses.filter(a => new Date(a.created_at).getTime() >= now - ms)
}

export default function ScoreHistoryChart({ analyses, t }) {
  const [range, setRange] = useState('All')
  const [tooltip, setTooltip] = useState(null)
  const { lang } = useLang()

  const filtered = filterByRange([...analyses].reverse(), range)
  if (filtered.length < 2) return null

  const recent = filtered.slice(-10)
  const W = 300
  const H = 70
  const padX = 10
  const w = (W - padX * 2) / (recent.length - 1)

  const scoreColor = s => s >= 70 ? '#4caf7d' : s >= 50 ? '#f5a623' : '#ff6b6b'

  const localeMap = { en:'en-US', fr:'fr-FR', es:'es-ES', de:'de-DE', it:'it-IT', pt:'pt-PT' }
  const fmt = d => new Date(d).toLocaleDateString(localeMap[lang] || 'en-US', { day:'2-digit', month:'short' })

  const xOf = i => padX + i * w
  const yOf = s => H - (s / 100) * (H - 10) - 4

  return (
    <div>
      {/* Range filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {t('score_history')}
        </p>
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-input)', borderRadius: 20, padding: 3 }}>
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: '3px 8px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600,
              background: range === r ? 'var(--accent)' : 'transparent',
              color: range === r ? '#1A1B22' : 'var(--text-muted)',
              transition: 'all 0.2s', fontFamily: 'inherit'
            }}>{r}</button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
          {/* Grid lines */}
          {[25,50,75].map(y => (
            <line key={y} x1={padX} y1={yOf(y)} x2={W-padX} y2={yOf(y)} stroke="var(--border)" strokeWidth="1" strokeDasharray="3,3"/>
          ))}

          {/* Line */}
          <polyline fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round"
            points={recent.map((a,i) => `${xOf(i)},${yOf(a.score)}`).join(' ')} />

          {/* Dots */}
          {recent.map((a, i) => {
            const color = scoreColor(a.score)
            const x = xOf(i)
            const y = yOf(a.score)
            return (
              <g key={i}
                onMouseEnter={() => setTooltip({ i, a, x, y })}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: 'pointer' }}>
                <circle cx={x} cy={y} r="8" fill="transparent" />
                <circle cx={x} cy={y} r={tooltip?.i === i ? 6 : 4} fill={color} stroke="var(--bg-card)" strokeWidth="2" style={{ transition: 'r 0.15s' }} />
                {/* Score labels for first and last */}
                {(i === 0 || i === recent.length - 1) && (
                  <text x={x} y={y - 10} textAnchor="middle" fill="var(--text-muted)" fontSize="8">{a.score}%</text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: 'absolute',
            left: `${(tooltip.x / W) * 100}%`,
            top: `${(tooltip.y / H) * 100}%`,
            transform: 'translate(-50%, -120%)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '8px 10px',
            pointerEvents: 'none',
            zIndex: 10,
            minWidth: 140,
            boxShadow: '0 4px 16px var(--shadow)',
            animation: 'fadeIn 0.1s ease'
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: scoreColor(tooltip.a.score), fontFamily: 'Syne, sans-serif', marginBottom: 2 }}>
              {tooltip.a.score}%
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-primary)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
              {tooltip.a.result?.job_context?.title || tooltip.a.job_title || 'Analysis'}
            </p>
            {tooltip.a.result?.job_context?.company && tooltip.a.result.job_context.company !== 'Not specified' && (
              <p style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 2 }}>@ {tooltip.a.result.job_context.company}</p>
            )}
            <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmt(tooltip.a.created_at)}</p>
          </div>
        )}
      </div>
    </div>
  )
}
