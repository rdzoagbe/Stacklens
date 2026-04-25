import React from 'react'

const cats = [
  { key: 'keywords', label: 'Keywords', color: '#7b8cff' },
  { key: 'skills', label: 'Skills', color: '#4caf7d' },
  { key: 'experience', label: 'Experience', color: '#f5a623' },
  { key: 'education', label: 'Education', color: '#c8f542' }
]

export default function CategoryBars({ categories }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {cats.map(({ key, label, color }) => {
        const val = categories[key] ?? 0
        return (
          <div key={key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: '#888' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color }}>{val}%</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${val}%`,
                background: color,
                borderRadius: 2,
                transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)'
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
