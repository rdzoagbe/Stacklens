import React, { useState } from 'react'
import { useLang } from '../context/LangContext'

function Detail({ icon, label, value, hint }) {
  if (!value || value === 'Not specified' || value === 'unknown' || value === 'Unknown') return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0' }}>
      <span style={{ fontSize: 13, lineHeight: 1.4, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>{label}</p>
        <p style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4, wordBreak: 'break-word' }}>
          {value}
          {hint && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>{hint}</span>}
        </p>
      </div>
    </div>
  )
}

const workModeLabel = { remote: '🏠 Remote', hybrid: '🔁 Hybrid', onsite: '🏢 On-site' }
const contractLabel = { CDI: 'CDI', CDD: 'CDD', freelance: 'Freelance', internship: 'Internship', apprenticeship: 'Apprenticeship', temp: 'Temp' }

export default function JobContextCard({ context, summary, jobUrl, redFlags, salary }) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)
  if (!context) return null

  const copyUrl = (e) => {
    e.preventDefault()
    if (!jobUrl) return
    navigator.clipboard.writeText(jobUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const hasRedFlags = redFlags?.length > 0
  const salaryHint = salary?.assessment === 'below_market' ? '⚠ below market' :
                     salary?.assessment === 'above_market' ? '✓ above market' :
                     salary?.assessment === 'market' ? '✓ market' : null

  return (
    <div className="card" style={{ marginBottom: 10, position: 'relative' }}>
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
          {t('job_offer')}
        </p>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(16px,4vw,20px)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 4, letterSpacing: '-0.01em' }}>
          {context.title || 'Untitled position'}
        </h2>
        {context.company && context.company !== 'Not specified' && (
          <p style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 500 }}>
            @ {context.company}
          </p>
        )}
      </div>

      {summary && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14, padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 10 }}>
          {summary}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '4px 16px', marginBottom: 12 }}>
        <Detail icon="📍" label={t('location')} value={context.location} />
        <Detail icon="💼" label={t('work_mode')} value={context.work_mode && workModeLabel[context.work_mode]} />
        <Detail icon="📄" label={t('contract')} value={context.contract_type && (contractLabel[context.contract_type] || (context.contract_type !== 'unknown' ? context.contract_type : null))} />
        <Detail icon="💰" label={t('salary')} value={context.salary_range} hint={salaryHint} />
        <Detail icon="⏱" label={t('experience')} value={context.experience_required} />
        <Detail icon="🗓" label={t('posted')} value={context.posted_date} />
        {context.languages_required?.length > 0 && (
          <Detail icon="🌐" label={t('languages')} value={context.languages_required.join(', ')} />
        )}
      </div>

      {hasRedFlags && (
        <div style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: '#f5a623', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{t('posting_red_flags')}</p>
          {redFlags.map((flag, i) => (
            <p key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: i < redFlags.length - 1 ? 4 : 0 }}>• {flag}</p>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {jobUrl && (
          <a href={jobUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 120, padding: '8px 14px', borderRadius: 10, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center', textDecoration: 'none', fontWeight: 500 }}>
            {t('view_original')}
          </a>
        )}
        {jobUrl && (
          <button onClick={copyUrl} style={{ padding: '8px 14px', borderRadius: 10, background: 'var(--bg-input)', border: '1px solid var(--border)', color: copied ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
            {copied ? t('copied') : t('copy_link')}
          </button>
        )}
      </div>
    </div>
  )
}
