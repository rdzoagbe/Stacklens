import React from 'react'

export default function TimeRangeFilter({ value, onChange }) {
  const ranges = [
    { v: '1m', label: '1M' },
    { v: '3m', label: '3M' },
    { v: '6m', label: '6M' },
    { v: '1y', label: '1Y' },
    { v: 'all', label: 'All' }
  ]
  return (
    <div style={{ display: 'flex', gap: 2, background: 'var(--bg-input)', padding: 2, borderRadius: 20 }}>
      {ranges.map(r => (
        <button key={r.v} onClick={() => onChange(r.v)} style={{
          padding: '4px 11px', borderRadius: 18, border: 'none', cursor: 'pointer',
          background: value === r.v ? 'var(--accent)' : 'transparent',
          color: value === r.v ? '#1A1B22' : 'var(--text-muted)',
          fontSize: 11, fontWeight: 600, fontFamily: 'Syne, sans-serif',
          transition: 'all 0.15s'
        }}>{r.label}</button>
      ))}
    </div>
  )
}
