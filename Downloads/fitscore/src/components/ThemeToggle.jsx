import React from 'react'
import { useTheme } from '../context/ThemeContext'

const options = [
  { value: 'light', icon: '☀️', label: 'Light' },
  { value: 'dark',  icon: '🌙', label: 'Dark' },
  { value: 'system',icon: '⚙️', label: 'Auto' },
]

export default function ThemeToggle() {
  const { theme, changeTheme } = useTheme()
  return (
    <div style={{ display: 'flex', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 20, padding: 3, gap: 2 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => changeTheme(o.value)} title={o.label} style={{
          padding: '5px 10px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 13,
          background: theme === o.value ? 'var(--accent)' : 'transparent',
          color: theme === o.value ? '#0f0f0f' : 'var(--text-muted)',
          transition: 'all 0.2s', fontFamily: 'inherit'
        }}>{o.icon}</button>
      ))}
    </div>
  )
}
