import React, { useEffect, useState } from 'react'

export default function ScoreRing({ score }) {
  const [displayed, setDisplayed] = useState(0)
  const r = 54
  const circ = 2 * Math.PI * r
  const fill = (displayed / 100) * circ
  const color = score >= 80 ? '#4caf7d' : score >= 60 ? '#f5a623' : '#ff4f4f'
  const label = score >= 80 ? 'Strong match' : score >= 60 ? 'Partial match' : 'Low match'

  useEffect(() => {
    let start = null
    const duration = 900
    const step = (ts) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(eased * score))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [score])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle
          cx="65" cy="65" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${fill} ${circ}`}
          strokeDashoffset={circ / 4}
          style={{ transition: 'stroke 0.3s' }}
        />
        <text x="65" y="58" textAnchor="middle" fill="#f0f0f0" fontSize="28" fontWeight="600" fontFamily="Syne, sans-serif">{displayed}%</text>
        <text x="65" y="76" textAnchor="middle" fill="#888" fontSize="11" fontFamily="DM Sans, sans-serif">ATS Score</text>
      </svg>
      <span style={{ fontSize: 13, fontWeight: 500, color, letterSpacing: '0.03em' }}>{label}</span>
    </div>
  )
}
