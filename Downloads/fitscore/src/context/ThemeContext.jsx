import React, { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({})

export function ThemeProvider({ children }) {
  // Default to DARK
  const [theme, setTheme] = useState(() => localStorage.getItem('fitscore_theme') || 'dark')
  const getEffective = (t) => {
    if (t === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    return t
  }
  const [effective, setEffective] = useState(() => getEffective(localStorage.getItem('fitscore_theme') || 'dark'))

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => { if (theme === 'system') setEffective(getEffective('system')) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const changeTheme = (t) => {
    setTheme(t)
    localStorage.setItem('fitscore_theme', t)
    setEffective(getEffective(t))
  }

  useEffect(() => {
    const root = document.documentElement
    if (effective === 'dark') {
      root.style.setProperty('--bg', '#1A1B22')
      root.style.setProperty('--bg-card', '#23252E')
      root.style.setProperty('--bg-input', '#2A2C36')
      root.style.setProperty('--border', 'rgba(255,255,255,0.07)')
      root.style.setProperty('--border-focus', 'rgba(255,255,255,0.22)')
      root.style.setProperty('--text-primary', '#ECECEF')
      root.style.setProperty('--text-secondary', '#A8A8B5')
      root.style.setProperty('--text-muted', '#888896')
      root.style.setProperty('--text-hint', '#5A5A66')
      root.style.setProperty('--shadow', 'rgba(0,0,0,0.4)')
      root.style.setProperty('--accent', '#FF8E6B')
      root.style.setProperty('--accent-bg', 'rgba(255,142,107,0.12)')
      root.style.setProperty('--accent-text', '#FF8E6B')
      root.style.setProperty('--slate', '#8DA3BD')
      root.style.setProperty('--slate-bg', 'rgba(141,163,189,0.12)')
    } else {
      root.style.setProperty('--bg', '#FAF7F2')
      root.style.setProperty('--bg-card', '#FFFFFF')
      root.style.setProperty('--bg-input', '#F2EEE8')
      root.style.setProperty('--border', 'rgba(60,55,80,0.08)')
      root.style.setProperty('--border-focus', 'rgba(60,55,80,0.25)')
      root.style.setProperty('--text-primary', '#2A2A35')
      root.style.setProperty('--text-secondary', '#5A5A66')
      root.style.setProperty('--text-muted', '#7A7A85')
      root.style.setProperty('--text-hint', '#A8A8B0')
      root.style.setProperty('--shadow', 'rgba(60,55,80,0.06)')
      root.style.setProperty('--accent', '#E07856')
      root.style.setProperty('--accent-bg', 'rgba(224,120,86,0.1)')
      root.style.setProperty('--accent-text', '#B5532E')
      root.style.setProperty('--slate', '#4B5D75')
      root.style.setProperty('--slate-bg', 'rgba(75,93,117,0.08)')
    }
  }, [effective])

  return <ThemeContext.Provider value={{ theme, effective, changeTheme }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
