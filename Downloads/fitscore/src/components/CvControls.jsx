import React, { useState } from 'react'
import { useLang } from '../context/LangContext'

export default function CvControls({ cvFile, onReplace, onDelete }) {
  const { t } = useLang()
  const [previewing, setPreviewing] = useState(false)

  const openPreview = async () => {
    if (!cvFile) return
    try {
      const url = URL.createObjectURL(cvFile)
      window.open(url, '_blank')
      // Don't revoke immediately — let the new tab use the URL
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      console.error('Preview failed:', e)
    }
  }

  if (!cvFile) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={openPreview} title={t('preview') || 'Preview'} style={iconBtnStyle}>
        <span style={{ fontSize: 14 }}>👁</span>
      </button>
      <button onClick={onReplace} title={t('replace') || 'Replace'} style={iconBtnStyle}>
        <span style={{ fontSize: 14 }}>↑</span>
      </button>
      <button onClick={onDelete} title={t('delete') || 'Delete'} style={{ ...iconBtnStyle, color: '#ff6b6b' }}>
        <span style={{ fontSize: 14 }}>🗑</span>
      </button>
    </div>
  )
}

const iconBtnStyle = {
  width: 32, height: 32, borderRadius: 8,
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.15s', fontFamily: 'inherit',
  color: 'var(--text-secondary)'
}
