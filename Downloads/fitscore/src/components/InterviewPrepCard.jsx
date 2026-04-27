import React, { useState } from 'react'
import { useLang } from '../context/LangContext'

function CollapsibleSection({ title, icon, color, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
        padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'left'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>{icon}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: color || 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}>
            {title}
          </span>
          {count !== undefined && (
            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: `${color}18`, color, fontWeight: 600, border: `1px solid ${color}30` }}>
              {count}
            </span>
          )}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
      </button>
      {open && <div style={{ marginTop: 10, animation: 'fadeUp 0.2s ease' }}>{children}</div>}
    </div>
  )
}

export default function InterviewPrepCard({ prep, score }) {
  const { t } = useLang()
  if (!prep || !prep.show_prep) return null
  if (score < 50) return null // Don't show if score too low

  const hasContent = prep.likely_questions?.length > 0 ||
                     prep.your_edges?.length > 0 ||
                     prep.weak_spots?.length > 0 ||
                     prep.salary_negotiation_hint
  if (!hasContent) return null

  return (
    <div className="card" style={{ marginBottom: 10, padding: '16px 18px', background: 'var(--bg-card)', border: '1px solid var(--accent)', borderRadius: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 18 }}>🎤</span>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(15px,3.5vw,18px)', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
          {t('interview_prep_title') || 'Interview prep'}
        </h3>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, lineHeight: 1.5 }}>
        {t('interview_prep_subtitle') || 'Personalized prep for this role — based on your CV.'}
      </p>

      {/* Likely questions */}
      {prep.likely_questions?.length > 0 && (
        <CollapsibleSection
          title={t('likely_questions') || 'Likely questions'}
          icon="🎯"
          color="#7b8cff"
          count={prep.likely_questions.length}
          defaultOpen={true}
        >
          <ol style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
            {prep.likely_questions.map((q, i) => (
              <li key={i} style={{ marginBottom: 8, padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 10, borderLeft: '3px solid #7b8cff' }}>
                <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#7b8cff', marginRight: 8 }}>Q{i + 1}</span>
                  {q}
                </p>
              </li>
            ))}
          </ol>
        </CollapsibleSection>
      )}

      {/* Your edges */}
      {prep.your_edges?.length > 0 && (
        <CollapsibleSection
          title={t('your_edges') || 'Your edges to lean on'}
          icon="💪"
          color="#4caf7d"
          count={prep.your_edges.length}
        >
          {prep.your_edges.map((edge, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, padding: '8px 10px', background: 'rgba(76,175,125,0.06)', borderRadius: 10 }}>
              <span style={{ color: '#4caf7d', flexShrink: 0, fontSize: 13 }}>✓</span>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{edge}</p>
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* Weak spots */}
      {prep.weak_spots?.length > 0 && (
        <CollapsibleSection
          title={t('weak_spots') || 'Weak spots to prepare'}
          icon="⚠️"
          color="#f5a623"
          count={prep.weak_spots.length}
        >
          {prep.weak_spots.map((spot, i) => {
            const area = typeof spot === 'string' ? spot : spot.area
            const tip = typeof spot === 'string' ? null : spot.prep_tip
            return (
              <div key={i} style={{ marginBottom: 10, padding: '10px 12px', background: 'rgba(245,166,35,0.05)', borderRadius: 10, borderLeft: '3px solid #f5a623' }}>
                <p style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, marginBottom: tip ? 4 : 0, lineHeight: 1.4 }}>
                  {area}
                </p>
                {tip && (
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    💡 {tip}
                  </p>
                )}
              </div>
            )
          })}
        </CollapsibleSection>
      )}

      {/* Salary negotiation */}
      {prep.salary_negotiation_hint && (
        <CollapsibleSection
          title={t('salary_negotiation') || 'Salary negotiation'}
          icon="💰"
          color="#FF8E6B"
        >
          <div style={{ padding: '10px 12px', background: 'var(--accent-bg)', borderRadius: 10, borderLeft: '3px solid var(--accent)' }}>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {prep.salary_negotiation_hint}
            </p>
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}
