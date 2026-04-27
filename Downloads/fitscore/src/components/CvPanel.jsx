import React, { useRef } from 'react'
import { useLang } from '../context/LangContext'
import { useCvPersist } from '../hooks/useCvPersist'

const ACCEPTED = ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword']

export default function CvPanel() {
  const { t } = useLang()
  const { cvFile, loading, saveCv, clearCv } = useCvPersist()
  const fileInputRef = useRef(null)
  const [dragging, setDragging] = React.useState(false)

  const handleFile = (file) => {
    if (!file) return
    if (!ACCEPTED.includes(file.type)) { alert('PDF or Word only'); return }
    if (file.size > 10 * 1024 * 1024) { alert('Max 10MB'); return }
    saveCv(file)
  }

  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }

  if (loading) return <div className="skeleton" style={{ height: 70, borderRadius: 12 }} />

  if (!cvFile) return (
    <div
      onDrop={onDrop}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onClick={() => fileInputRef.current?.click()}
      style={{ border: `1.5px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 14, padding: 'clamp(24px,5vw,40px) 20px', textAlign: 'center', cursor: 'pointer', background: dragging ? 'var(--accent-bg)' : 'var(--bg-input)', transition: 'all 0.2s' }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>📎</div>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('drop_cv')}</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('cv_format')}</p>
      <p style={{ fontSize: 11, color: 'var(--accent)', marginTop: 8 }}>{t('cv_saved')}</p>
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
    </div>
  )

  const sizeKb = cvFile.size ? `${(cvFile.size / 1024).toFixed(0)} KB` : ''
  const icon = cvFile.type === 'application/pdf' ? '📄' : '📝'

  return (
    <div style={{ background: 'rgba(76,175,125,0.06)', border: '1px solid rgba(76,175,125,0.25)', borderRadius: 14, padding: '12px 14px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ color: '#4caf7d', fontSize: 14 }}>✓</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#4caf7d', fontFamily: 'Syne, sans-serif' }}>
          {t('cv_saved_ready') || 'Saved & Ready!'}
        </span>
      </div>

      {/* File row */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cvFile.name}</p>
          {sizeKb && <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sizeKb}</p>}
        </div>

        {/* Action icons */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {/* Preview — opens file as object URL */}
          <button
            onClick={() => {
              const blob = new Blob([cvFile], { type: cvFile.type })
              const url = URL.createObjectURL(blob)
              window.open(url, '_blank')
              setTimeout(() => URL.revokeObjectURL(url), 3000)
            }}
            title={t('preview_cv') || 'Preview'}
            style={iconBtnStyle}>👁</button>
          {/* Replace */}
          <button onClick={() => fileInputRef.current?.click()} title={t('change_cv')} style={iconBtnStyle}>↑</button>
          {/* Delete */}
          <button onClick={clearCv} title={t('clear_cv') || 'Remove'} style={{ ...iconBtnStyle, color: '#ff6b6b' }}>🗑</button>
        </div>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        *{t('cv_stored_locally') || 'Stored locally on your device for privacy'}*
      </p>
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
    </div>
  )
}

const iconBtnStyle = {
  background: 'var(--bg-input)', border: '1px solid var(--border)',
  borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 14, transition: 'all 0.15s', color: 'var(--text-secondary)'
}
