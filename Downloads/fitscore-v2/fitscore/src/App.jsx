import React, { useState, useRef, useCallback } from 'react'
import { useAnalyze } from './hooks/useAnalyze'
import ScoreRing from './components/ScoreRing'
import CategoryBars from './components/CategoryBars'
import KeywordTags from './components/KeywordTags'
import AdviceList from './components/AdviceList'

const LOADING_MSGS = [
  'Fetching job posting...',
  'Reading your CV...',
  'Running ATS simulation...',
  'Calculating your score...'
]

const ACCEPTED = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']

export default function App() {
  const [jobUrl, setJobUrl] = useState('')
  const [cvFile, setCvFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [msgIdx, setMsgIdx] = useState(0)
  const intervalRef = useRef(null)
  const resultRef = useRef(null)
  const fileInputRef = useRef(null)
  const { status, data, error, analyze, reset } = useAnalyze()

  const isValidUrl = (str) => {
    try { new URL(str); return true } catch { return false }
  }

  const handleFile = (file) => {
    if (!file) return
    if (!ACCEPTED.includes(file.type)) {
      alert('Please upload a PDF or Word (.docx) file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Maximum 10MB.')
      return
    }
    setCvFile(file)
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  const handleAnalyze = async () => {
    if (!jobUrl.trim() || !cvFile) return
    intervalRef.current = setInterval(() => setMsgIdx(i => (i + 1) % LOADING_MSGS.length), 1800)
    await analyze(jobUrl.trim(), cvFile)
    clearInterval(intervalRef.current)
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  const handleReset = () => {
    reset()
    setJobUrl('')
    setCvFile(null)
    setMsgIdx(0)
  }

  const canAnalyze = isValidUrl(jobUrl) && cvFile !== null

  const fileIcon = cvFile?.type === 'application/pdf' ? '📄' : '📝'

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>

      {/* Header */}
      <header style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#f0f0f0' }}>
            Fit<span style={{ color: 'var(--accent)' }}>Score</span>
          </h1>
          <p style={{ fontSize: 11, color: '#555', marginTop: 2, letterSpacing: '0.04em' }}>KNOW BEFORE YOU APPLY</p>
        </div>
        {status === 'done' && (
          <button onClick={handleReset} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20, padding: '7px 16px', color: '#888', fontSize: 13, cursor: 'pointer'
          }}>New analysis</button>
        )}
      </header>

      <main style={{ padding: '24px 20px 40px', maxWidth: 480, margin: '0 auto' }}>

        {status !== 'done' && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>

            {status === 'idle' && (
              <p style={{ fontSize: 14, color: '#666', marginBottom: 28, lineHeight: 1.7 }}>
                Paste a job offer URL and upload your CV — we'll run an instant ATS check and tell you exactly how to improve your chances.
              </p>
            )}

            {/* Job URL input */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Job offer URL
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#555' }}>🔗</span>
                <input
                  type="url"
                  value={jobUrl}
                  onChange={e => setJobUrl(e.target.value)}
                  placeholder="https://linkedin.com/jobs/view/... or any job board"
                  disabled={status === 'loading'}
                  style={{
                    width: '100%', background: 'var(--bg-input)',
                    border: `1px solid ${isValidUrl(jobUrl) ? 'rgba(200,245,66,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 10, color: '#f0f0f0', fontSize: 14,
                    padding: '13px 14px 13px 38px', outline: 'none',
                    fontFamily: 'var(--font-body)', transition: 'border-color 0.2s',
                    WebkitAppearance: 'none'
                  }}
                />
              </div>
              {jobUrl && !isValidUrl(jobUrl) && (
                <p style={{ fontSize: 12, color: '#ff7070', marginTop: 6 }}>Please enter a valid URL including https://</p>
              )}
              <p style={{ fontSize: 11, color: '#444', marginTop: 6 }}>
                Works with LinkedIn, Indeed, Welcome to the Jungle, Glassdoor, and most job boards.
              </p>
            </div>

            {/* CV Upload */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Your CV
              </label>

              {!cvFile ? (
                <div
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `1.5px dashed ${dragging ? 'rgba(200,245,66,0.5)' : 'rgba(255,255,255,0.12)'}`,
                    borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
                    background: dragging ? 'rgba(200,245,66,0.04)' : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 10 }}>📎</div>
                  <p style={{ fontSize: 14, color: '#888', marginBottom: 4 }}>Drop your CV here or tap to browse</p>
                  <p style={{ fontSize: 12, color: '#444' }}>PDF or Word (.docx) · Max 10MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    style={{ display: 'none' }}
                    onChange={e => handleFile(e.target.files[0])}
                  />
                </div>
              ) : (
                <div style={{
                  background: 'rgba(200,245,66,0.06)', border: '1px solid rgba(200,245,66,0.2)',
                  borderRadius: 12, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{fileIcon}</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#c8f542' }}>{cvFile.name}</p>
                      <p style={{ fontSize: 11, color: '#666' }}>{(cvFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCvFile(null)}
                    style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 18, padding: '4px 8px' }}
                  >×</button>
                </div>
              )}
            </div>

            {/* Loading */}
            {status === 'loading' && (
              <div style={{ textAlign: 'center', padding: '12px 0 24px', animation: 'fadeUp 0.3s ease' }}>
                <div style={{
                  width: 36, height: 36, border: '2px solid rgba(255,255,255,0.08)',
                  borderTop: '2px solid var(--accent)', borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite', margin: '0 auto 14px'
                }} />
                <p style={{ fontSize: 14, color: '#666', animation: 'pulse 1.8s ease infinite' }}>
                  {LOADING_MSGS[msgIdx]}
                </p>
              </div>
            )}

            {/* Error */}
            {status === 'error' && (
              <div style={{
                background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.2)',
                borderRadius: 12, padding: '14px 16px', marginBottom: 16
              }}>
                <p style={{ fontSize: 13, color: '#ff7070', lineHeight: 1.5 }}>⚠ {error}</p>
                <p style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                  Some job boards block automated access. Try copying the job URL directly from the address bar.
                </p>
              </div>
            )}

            {/* Analyze button */}
            {status !== 'loading' && (
              <button
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                style={{
                  width: '100%', padding: '16px', borderRadius: 14,
                  background: canAnalyze ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                  color: canAnalyze ? '#0f0f0f' : '#444',
                  border: 'none', fontFamily: 'var(--font-display)',
                  fontSize: 15, fontWeight: 700, cursor: canAnalyze ? 'pointer' : 'not-allowed',
                  letterSpacing: '-0.01em', transition: 'all 0.2s'
                }}
              >
                Analyze my CV →
              </button>
            )}
          </div>
        )}

        {/* Results */}
        {status === 'done' && data && (
          <div ref={resultRef} style={{ animation: 'fadeUp 0.5s ease' }}>

            <div style={{
              background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 20, padding: '28px 20px', marginBottom: 14, textAlign: 'center'
            }}>
              <ScoreRing score={data.score} />
              {data.verdict && (
                <p style={{ fontSize: 14, color: '#888', marginTop: 14, lineHeight: 1.5, maxWidth: 280, margin: '14px auto 0' }}>
                  {data.verdict}
                </p>
              )}
            </div>

            {data.score < 80 && (
              <div style={{
                background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.2)',
                borderRadius: 12, padding: '12px 16px', marginBottom: 14,
                display: 'flex', alignItems: 'center', gap: 10
              }}>
                <span>⚡</span>
                <p style={{ fontSize: 13, color: '#f5a623', lineHeight: 1.5 }}>
                  You need <strong>80%+</strong> to pass most ATS filters. Follow the recommendations below.
                </p>
              </div>
            )}

            {data.score >= 80 && (
              <div style={{
                background: 'rgba(76,175,125,0.08)', border: '1px solid rgba(76,175,125,0.2)',
                borderRadius: 12, padding: '12px 16px', marginBottom: 14,
                display: 'flex', alignItems: 'center', gap: 10
              }}>
                <span>✓</span>
                <p style={{ fontSize: 13, color: '#4caf7d', lineHeight: 1.5 }}>
                  Strong match — you're ready to apply!
                </p>
              </div>
            )}

            <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px', marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Score breakdown</p>
              <CategoryBars categories={data.categories} />
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px', marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Keywords</p>
              <KeywordTags found={data.found_keywords} missing={data.missing_keywords} />
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px', marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Recommendations</p>
              <AdviceList advice={data.advice} />
            </div>

            <button onClick={handleReset} style={{
              width: '100%', padding: '15px', borderRadius: 14,
              background: 'var(--accent)', color: '#0f0f0f',
              border: 'none', fontFamily: 'var(--font-display)',
              fontSize: 15, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em'
            }}>
              Analyze another job →
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
