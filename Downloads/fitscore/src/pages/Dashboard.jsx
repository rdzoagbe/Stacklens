import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import UserMenu from '../components/UserMenu'
import ScoreHistoryChart from '../components/ScoreHistoryChart'
import NewAnalysisMenu from '../components/NewAnalysisMenu'
import LangSelector from '../components/LangSelector'



function ProgressBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color }}>{value}%</span>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 2, transition: 'width 1s ease' }} />
      </div>
    </div>
  )
}

export default function Dashboard({ onNewAnalysis, onSelectAnalysis }) {
  const { user, signOut } = useAuth()
  const { t, lang } = useLang()
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchAnalyses() }, [])

  const fetchAnalyses = async () => {
    const { data } = await supabase.from('analyses').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
    setAnalyses(data || [])
    setLoading(false)
  }

  const deleteAnalysis = async (id, e) => {
    e.stopPropagation()
    setDeleting(id)
    await supabase.from('analyses').delete().eq('id', id)
    setAnalyses(prev => prev.filter(a => a.id !== id))
    setDeleting(null)
  }

  const scoreColor = s => s>=70?'#4caf7d':s>=50?'#f5a623':'#ff6b6b'
  const verdictLabel = v => ({ likely_passed: t('likely_passed'), borderline: t('borderline'), likely_filtered: t('likely_filtered') })[v] || ''

  const avgScore = analyses.length ? Math.round(analyses.reduce((s,a) => s+a.score,0)/analyses.length) : null
  const bestScore = analyses.length ? Math.max(...analyses.map(a=>a.score)) : null
  const passedCount = analyses.filter(a => a.result?.overall_verdict === 'likely_passed').length

  const filtered = analyses.filter(a => {
    const matchFilter = filter === 'all' || a.result?.overall_verdict === filter
    const matchSearch = !search || (a.job_title||'').toLowerCase().includes(search.toLowerCase()) || (a.job_url||'').toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const FILTERS = [
    { value: 'all', label: t('filter_all') },
    { value: 'likely_passed', label: t('filter_passed') },
    { value: 'borderline', label: t('filter_borderline') },
    { value: 'likely_filtered', label: t('filter_filtered') },
  ]

  const localeMap = { en: 'en-US', fr: 'fr-FR', es: 'es-ES', de: 'de-DE', it: 'it-IT', pt: 'pt-PT' }
  const formatDate = (d) => new Date(d).toLocaleDateString(localeMap[lang] || 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="page page-enter">
      <header className="page-header">
        <div>
          <div className="logo">Fit<span className="acc">Score</span></div>
          <div className="tagline">{t('tagline')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <NewAnalysisMenu onNewWithCv={onNewAnalysis} onUploadNew={onNewAnalysis} />
          <UserMenu onViewDashboard={() => {}} />
        </div>
      </header>

      <main className="page-main">

        {/* User info row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <p style={{ fontSize: 'clamp(16px,4vw,20px)', fontWeight: 600, fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)', marginBottom: 3 }}>
              {user.email?.split('@')[0]}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {analyses.length} {t('analyses_count')}
              {avgScore !== null ? ` · ${t('avg_score')} ${avgScore}%` : ''}
              {passedCount > 0 ? ` · ${passedCount} ${t('passed')}` : ''}
            </p>
          </div>

        </div>

        {/* Stats cards */}
        {!loading && analyses.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: t('avg_score'), value: `${avgScore}%`, color: scoreColor(avgScore) },
              { label: t('best_score'), value: `${bestScore}%`, color: scoreColor(bestScore) },
              { label: t('passed'), value: `${passedCount}/${analyses.length}`, color: '#4caf7d' },
            ].map(s => (
              <div key={s.label} className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
                <p style={{ fontSize: 'clamp(16px,4vw,22px)', fontWeight: 700, color: s.color, fontFamily: 'Syne, sans-serif', marginBottom: 3 }}>{s.value}</p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Chart + breakdown side by side on desktop */}
        {!loading && analyses.length >= 2 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: 8, marginBottom: 20 }}>
            <div className="card"><ScoreHistoryChart analyses={analyses} t={t} /></div>
            <div className="card">
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>{t('verdict_breakdown')}</p>
              <ProgressBar label={t('likely_passed')} value={Math.round((analyses.filter(a=>a.result?.overall_verdict==='likely_passed').length/analyses.length)*100)} color="#4caf7d" />
              <ProgressBar label={t('borderline')} value={Math.round((analyses.filter(a=>a.result?.overall_verdict==='borderline').length/analyses.length)*100)} color="#f5a623" />
              <ProgressBar label={t('likely_filtered')} value={Math.round((analyses.filter(a=>a.result?.overall_verdict==='likely_filtered').length/analyses.length)*100)} color="#ff6b6b" />
            </div>
          </div>
        )}

        {/* SECTION TITLE for the saved analyses */}
        {!loading && analyses.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(15px,3.5vw,18px)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, letterSpacing: '-0.01em' }}>
              {t('saved_analyses_title')}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
              {t('saved_analyses_subtitle')}
            </p>

            <input type="text" placeholder={t('search_placeholder')} value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 10 }} />

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {FILTERS.map(f => (
                <button key={f.value} onClick={() => setFilter(f.value)} style={{
                  padding: '5px 12px', borderRadius: 20,
                  border: `1px solid ${filter===f.value?'var(--accent)':'var(--border)'}`,
                  background: filter===f.value?'var(--accent-bg)':'var(--bg-input)',
                  color: filter===f.value?'var(--accent)':'var(--text-secondary)',
                  fontSize: 12, cursor: 'pointer', transition: 'all 0.2s'
                }}>{f.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* Skeleton */}
        {loading && [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 72, marginBottom: 8 }} />)}

        {/* Empty state */}
        {!loading && analyses.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'clamp(48px,10vw,80px) 24px', background: 'var(--bg-card)', borderRadius: 18, border: '1px dashed var(--border)' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>📋</div>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 6, fontFamily: 'Syne, sans-serif' }}>{t('no_analyses')}</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 22, lineHeight: 1.6 }}>{t('no_analyses_desc')}</p>
            <button onClick={onNewAnalysis} className="btn-primary">{t('start_analyzing')}</button>
          </div>
        )}

        {/* No results from filter */}
        {!loading && analyses.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
            {t('no_match_filter')}
          </div>
        )}

        {/* History list */}
        {!loading && filtered.length > 0 && (
          <div className="history-grid">
            {filtered.map(a => {
              const color = scoreColor(a.score)
              const verdict = verdictLabel(a.result?.overall_verdict)
              const date = formatDate(a.created_at)
              const title = a.job_title || (() => { try { return new URL(a.job_url).hostname.replace('www.','') } catch { return 'Job' } })()

              return (
                <div key={a.id}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border-focus)'; e.currentTarget.style.transform='translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none' }}
                >
                  <div style={{ padding: 'clamp(12px,3vw,16px)', display: 'flex', alignItems: 'center', gap: 14 }} onClick={() => onSelectAnalysis(a)}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}12` }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'Syne, sans-serif', lineHeight: 1 }}>{a.score}%</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</p>
                      {a.result?.job_context?.company && a.result.job_context.company !== 'Not specified' && (
                        <p style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>@ {a.result.job_context.company}</p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: `${color}18`, color, border: `1px solid ${color}30` }}>{verdict}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{date}</span>
                        {a.result?.job_context?.location && a.result.job_context.location !== 'Not specified' && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· 📍 {a.result.job_context.location.split(',')[0]}</span>
                        )}
                      </div>
                    </div>
                    <button onClick={e => deleteAnalysis(a.id, e)} disabled={deleting===a.id}
                      style={{ background: 'none', border: 'none', color: 'var(--text-hint)', cursor: 'pointer', fontSize: 18, padding: '4px 6px', flexShrink: 0, lineHeight: 1 }}
                      onMouseEnter={e => e.currentTarget.style.color='#ff6b6b'}
                      onMouseLeave={e => e.currentTarget.style.color='var(--text-hint)'}
                    >×</button>
                  </div>
                  {a.score < 70 && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-input)' }}>
                      <button onClick={() => onSelectAnalysis(a)} style={{ fontSize: 11, fontWeight: 700, padding: '5px 14px', borderRadius: 20, background: 'var(--accent)', color: '#1A1B22', border: 'none', cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>
                        {t('improve_optimize') || 'IMPROVE & OPTIMIZE'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <a href="/privacy" style={{ fontSize: 11, color: 'var(--text-hint)', textDecoration: 'none' }}>{t('privacy')}</a>
        </div>
      </main>
    </div>
  )
}
