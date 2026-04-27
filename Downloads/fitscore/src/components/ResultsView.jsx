import React, { useState } from 'react'
import ScoreRing from './ScoreRing'
import VerdictBadge from './VerdictBadge'
import JobContextCard from './JobContextCard'
import MatchProbability from './MatchProbability'
import SeniorityCard from './SeniorityCard'
import InterviewPrepCard from './InterviewPrepCard'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'

const Tag = ({ label, type }) => {
  const styles = {
    found:   { bg: 'rgba(76,175,125,0.12)',  color: '#4caf7d', border: 'rgba(76,175,125,0.2)' },
    missing: { bg: 'rgba(255,107,107,0.1)',  color: '#ff7878', border: 'rgba(255,107,107,0.2)' },
    nice:    { bg: 'rgba(245,166,35,0.1)',   color: '#f5a623', border: 'rgba(245,166,35,0.2)' },
  }
  const s = styles[type] || styles.found
  return <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}`, display: 'inline-block', margin: '2px 2px 2px 0' }}>{label}</span>
}

const MiniCard = ({ title, children, accent }) => (
  <div style={{ background: 'var(--bg-card)', border: `1px solid ${accent ? `${accent}30` : 'var(--border)'}`, borderRadius: 14, overflow: 'hidden' }}>
    <div style={{ padding: '12px 14px 0' }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: accent || 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{title}</span>
    </div>
    <div style={{ padding: '8px 14px 14px' }}>{children}</div>
  </div>
)

export default function ResultsView({ data, onReset }) {
  const { user } = useAuth()
  const { t } = useLang()
  const km = data.keyword_match || {}
  const req = data.requirements_check || {}
  const score = data.display_score ?? 0
  const jobUrl = data.job_url || null
  const isPassed = data.overall_verdict === 'likely_passed'
  const [saveStatus, setSaveStatus] = useState('idle')

  const handleSave = async () => {
    if (!user) return
    setSaveStatus('saving')
    try {
      const { error } = await supabase.from('analyses').insert({
        user_id: user.id,
        job_url: jobUrl || '',
        job_title: data.job_context?.title || data.job_title || null,
        score,
        result: data
      })
      setSaveStatus(error ? 'error' : 'saved')
    } catch { setSaveStatus('error') }
  }

  return (
    <div style={{ animation: 'fadeUp 0.5s ease' }}>
      <JobContextCard
        context={data.job_context}
        summary={data.job_summary}
        jobUrl={jobUrl}
        redFlags={data.red_flags}
        salary={data.salary_assessment}
      />

      <div className="card" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14 }}>
          <div style={{ flexShrink: 0 }}><ScoreRing score={score} size={100} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>{t('ats_score')}</p>
            <p style={{ fontSize: 'clamp(22px,5vw,28px)', fontWeight: 700, fontFamily: 'Syne, sans-serif', color: score>=70?'#4caf7d':score>=50?'#f5a623':'#ff6b6b', marginBottom: 6, animation: 'pop 0.5s ease' }}>{score}%</p>
            {data.verdict && <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{data.verdict}</p>}
          </div>
        </div>
        <VerdictBadge verdict={data.overall_verdict} reason={data.overall_reason} />
      </div>

      <MatchProbability probability={data.match_probability} reasoning={data.match_reasoning} />

      <SeniorityCard seniority={data.seniority} />

      <InterviewPrepCard prep={data.interview_prep} score={score} />

      <div className="mini-cards" style={{ marginBottom: 10 }}>
        <MiniCard title={t('score_breakdown')} accent="#7b8cff">
          {[[t('keywords_60'), km.score??0, '#7b8cff'], [t('requirements_40'), req.score??0, '#4caf7d']].map(([label, val, color]) => (
            <div key={label} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color }}>{val}%</span>
              </div>
              <div style={{ height: 3, background: 'var(--border)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${val}%`, background: color, borderRadius: 2, transition: 'width 0.8s ease' }} />
              </div>
            </div>
          ))}
        </MiniCard>

        <MiniCard title={`${t('gaps')}${data.critical_gaps?.length ? ` (${data.critical_gaps.length})` : ''}`} accent="#ff6b6b">
          {data.critical_gaps?.length > 0 ? data.critical_gaps.map((g, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <span style={{ color: '#ff6b6b', flexShrink: 0, fontSize: 11 }}>✗</span>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{g}</p>
            </div>
          )) : <p style={{ fontSize: 11, color: '#4caf7d', marginTop: 4 }}>{t('no_critical_gaps')}</p>}
        </MiniCard>

        <MiniCard title={t('keywords')} accent="var(--accent)">
          {km.found?.length > 0 && <div style={{ marginBottom: 8 }}>
            <p style={{ fontSize: 10, color: '#4caf7d', marginBottom: 4, fontWeight: 600 }}>{t('found')}</p>
            {km.found.slice(0,6).map(k => <Tag key={k} label={k} type="found" />)}
          </div>}
          {km.missing_required?.length > 0 && <div style={{ marginBottom: 6 }}>
            <p style={{ fontSize: 10, color: '#ff7878', marginBottom: 4, fontWeight: 600 }}>{t('missing')}</p>
            {km.missing_required.slice(0,5).map(k => <Tag key={k} label={k} type="missing" />)}
          </div>}
          {km.missing_nice?.length > 0 && <div>
            <p style={{ fontSize: 10, color: '#f5a623', marginBottom: 4, fontWeight: 600 }}>{t('nice_to_have')}</p>
            {km.missing_nice.slice(0,3).map(k => <Tag key={k} label={k} type="nice" />)}
          </div>}
        </MiniCard>

        <MiniCard title={t('requirements')} accent="#f5a623">
          {req.met?.length > 0 && <div style={{ marginBottom: 8 }}>
            <p style={{ fontSize: 10, color: '#4caf7d', marginBottom: 4, fontWeight: 600 }}>{t('met')}</p>
            {req.met.slice(0,3).map((r,i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                <span style={{ color: '#4caf7d', fontSize: 11, flexShrink: 0 }}>✓</span>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{r}</p>
              </div>
            ))}
          </div>}
          {req.unmet?.length > 0 && <div>
            <p style={{ fontSize: 10, color: '#ff7878', marginBottom: 4, fontWeight: 600 }}>{t('unmet')}</p>
            {req.unmet.slice(0,3).map((r,i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                <span style={{ color: '#ff7878', fontSize: 11, flexShrink: 0 }}>✗</span>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{r}</p>
              </div>
            ))}
          </div>}
        </MiniCard>
      </div>

      {data.quick_wins?.length > 0 && (
        <div className="card" style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>{t('quick_wins')}</p>
          <div className="qw-grid">
            {data.quick_wins.map((w, i) => (
              <div key={i} style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 10, padding: '10px 12px', opacity: 0.95 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', display: 'block', marginBottom: 4 }}>#{i+1}</span>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{w}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.format_warnings?.filter(w => w?.length > 5).length > 0 && (
        <div style={{ background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#f5a623', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>{t('format_warnings')}</p>
          {data.format_warnings.filter(w => w?.length > 5).map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ color: '#f5a623', flexShrink: 0 }}>⚠</span>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{w}</p>
            </div>
          ))}
        </div>
      )}

      {user && saveStatus !== 'saved' && (
        <button onClick={handleSave} disabled={saveStatus === 'saving'} style={{
          width: '100%', padding: '13px', borderRadius: 12, marginBottom: 10,
          background: saveStatus === 'error' ? 'rgba(255,107,107,0.1)' : 'var(--bg-input)',
          border: `1px solid ${saveStatus === 'error' ? 'rgba(255,107,107,0.3)' : 'var(--border)'}`,
          color: saveStatus === 'error' ? '#ff6b6b' : 'var(--text-secondary)',
          fontSize: 13, cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
        }}>
          {saveStatus === 'saving'
            ? <><div style={{ width: 14, height: 14, border: '2px solid var(--border)', borderTop: '2px solid var(--text-secondary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/> {t('saving')}</>
            : saveStatus === 'error' ? t('save_failed')
            : t('save_history')}
        </button>
      )}
      {saveStatus === 'saved' && (
        <div style={{ background: 'rgba(76,175,125,0.08)', border: '1px solid rgba(76,175,125,0.2)', borderRadius: 12, padding: '11px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#4caf7d' }}>✓</span>
          <p style={{ fontSize: 13, color: '#4caf7d', margin: 0 }}>{t('saved_to_history')}</p>
        </div>
      )}

      <div className="btn-row">
        <button onClick={onReset} className="btn-primary" style={{ width: '100%' }}>{t('new_analysis')}</button>
        {jobUrl && (
          <a href={jobUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '14px', borderRadius: 12, background: isPassed ? '#4caf7d' : 'transparent', color: isPassed ? '#fff' : 'var(--text-secondary)', border: isPassed ? 'none' : '1px solid var(--border)', fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 600, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isPassed ? t('apply_now') : t('view_job')}
          </a>
        )}
      </div>
    </div>
  )
}
