import React from 'react'
import { useLang } from '../context/LangContext'

const config = {
  right_level:    { color: '#4caf7d', bg: 'rgba(76,175,125,0.1)',  border: 'rgba(76,175,125,0.25)',  icon: '🎯', emoji: '✓' },
  stretch:        { color: '#FF8E6B', bg: 'rgba(255,142,107,0.1)', border: 'rgba(255,142,107,0.25)', icon: '🚀', emoji: '↗' },
  reach:          { color: '#f5a623', bg: 'rgba(245,166,35,0.1)',  border: 'rgba(245,166,35,0.25)',  icon: '🏔️', emoji: '↑' },
  below_level:    { color: '#7b8cff', bg: 'rgba(123,140,255,0.1)', border: 'rgba(123,140,255,0.25)', icon: '⬇', emoji: '↓' },
  pivot:          { color: '#8DA3BD', bg: 'rgba(141,163,189,0.1)', border: 'rgba(141,163,189,0.25)', icon: '🔀', emoji: '↔' },
}

const levelLabel = {
  intern: 'Intern',
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  lead: 'Lead',
  staff_principal: 'Staff/Principal',
  executive: 'Executive'
}

export default function SeniorityCard({ seniority }) {
  const { t } = useLang()
  if (!seniority || !seniority.alignment) return null

  const c = config[seniority.alignment] || config.right_level
  const candidateLevel = levelLabel[seniority.candidate_level] || seniority.candidate_level
  const jobLevel = levelLabel[seniority.job_level] || seniority.job_level

  return (
    <div className="card" style={{ marginBottom: 10, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {c.icon} {t('seniority_alignment') || 'Seniority alignment'}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontFamily: 'Syne, sans-serif' }}>
          {seniority.alignment_label || seniority.alignment}
        </span>
      </div>

      {/* Visual level comparison */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 10 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            {t('your_level') || 'Your level'}
          </p>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}>
            {candidateLevel}
          </p>
          {seniority.candidate_years > 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {seniority.candidate_years} {seniority.candidate_years === 1 ? 'year' : 'years'}
            </p>
          )}
        </div>

        <div style={{ flexShrink: 0, fontSize: 18, color: c.color, padding: '0 4px' }}>{c.emoji}</div>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            {t('job_level') || 'Job level'}
          </p>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}>
            {jobLevel}
          </p>
          {seniority.job_years_required > 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {seniority.job_years_required}+ {seniority.job_years_required === 1 ? 'year' : 'years'}
            </p>
          )}
        </div>
      </div>

      {/* Reason */}
      {seniority.alignment_reason && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
          {seniority.alignment_reason}
        </p>
      )}
    </div>
  )
}
