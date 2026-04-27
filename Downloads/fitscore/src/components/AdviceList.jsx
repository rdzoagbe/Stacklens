import React from 'react'

const config = {
  add:    { label: 'Add',    bg: 'rgba(200,245,66,0.08)',  color: '#c8f542', border: 'rgba(200,245,66,0.2)' },
  reword: { label: 'Reword', bg: 'rgba(123,140,255,0.08)', color: '#7b8cff', border: 'rgba(123,140,255,0.2)' },
  remove: { label: 'Remove', bg: 'rgba(255,79,79,0.08)',   color: '#ff7070', border: 'rgba(255,79,79,0.2)' }
}

export default function AdviceList({ advice = [] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {advice.map((a, i) => {
        const c = config[a.type] || config.add
        return (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            padding: '13px 15px',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start'
          }}>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
              background: c.bg, color: c.color, border: `1px solid ${c.border}`,
              letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0, marginTop: 1
            }}>{c.label}</span>
            <span style={{ fontSize: 13.5, color: '#ccc', lineHeight: 1.55 }}>{a.text}</span>
          </div>
        )
      })}
    </div>
  )
}
