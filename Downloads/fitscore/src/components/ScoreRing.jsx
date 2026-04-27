import React, { useEffect, useState } from 'react'

export default function ScoreRing({ score, size = 130 }) {
  const [displayed, setDisplayed] = useState(0)
  const r = (size / 2) - 10
  const circ = 2 * Math.PI * r
  const fill = (displayed / 100) * circ
  const color = score >= 70 ? '#4caf7d' : score >= 50 ? '#f5a623' : '#ff4f4f'
  const fontSize = size < 120 ? 20 : 28
  const subSize = size < 120 ? 10 : 11

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

  const cx = size / 2
  const cy = size / 2

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}
        strokeDashoffset={circ / 4}
        style={{ transition: 'stroke 0.3s' }}
      />
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#f0f0f0" fontSize={fontSize} fontWeight="600" fontFamily="Syne, sans-serif">{displayed}%</text>
      <text x={cx} y={cy + subSize + 2} textAnchor="middle" fill="#888" fontSize={subSize} fontFamily="DM Sans, sans-serif">ATS Score</text>
    </svg>
  )
}
