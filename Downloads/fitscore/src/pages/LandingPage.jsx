import React, { useState } from 'react'
import { useLang } from '../context/LangContext'
import LangSelector from '../components/LangSelector'
import ThemeToggle from '../components/ThemeToggle'
import AuthModal from '../components/AuthModal'

function FeatureCard({ icon, title, desc, accent }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: 'clamp(20px,4vw,28px)', transition: 'all 0.2s', height: '100%' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 14, border: `1px solid ${accent}30` }}>
        {icon}
      </div>
      <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{desc}</p>
    </div>
  )
}

export default function LandingPage() {
  const { t } = useLang()
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('signup')

  const openAuth = (mode) => { setAuthMode(mode); setAuthOpen(true) }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh' }}>

      {/* Sticky header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50, background: 'rgba(26,27,34,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: 'clamp(12px,2vw,16px) clamp(16px,5vw,48px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1200, margin: '0 auto'
      }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(18px,4vw,22px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Fit<span style={{ color: 'var(--accent)' }}>Score</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <LangSelector />
          <ThemeToggle />
          <button onClick={() => openAuth('signin')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('sign_in')}
          </button>
          <button onClick={() => openAuth('signup')} style={{ background: 'var(--accent)', color: '#1A1B22', border: 'none', borderRadius: 20, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>
            {t('get_started') || 'Get started'}
          </button>
        </div>
      </header>

      {/* HERO */}
      <section style={{ padding: 'clamp(40px,8vw,80px) clamp(20px,5vw,48px) clamp(60px,10vw,100px)', maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 20, background: 'var(--accent-bg)', border: '1px solid var(--accent)', marginBottom: 24 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.05em' }}>
            ✨ {t('landing_badge') || 'AI-powered ATS scoring + interview coach'}
          </span>
        </div>

        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(32px,7vw,56px)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 20 }}>
          {t('landing_h1_part1') || 'Beat the algorithm.'}<br/>
          <span style={{ color: 'var(--accent)' }}>{t('landing_h1_part2') || 'Get hired.'}</span>
        </h1>

        <p style={{ fontSize: 'clamp(15px,3vw,18px)', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 600, margin: '0 auto 32px' }}>
          {t('landing_subtitle') || 'Stop guessing. FitScore tells you exactly why your CV gets filtered, what to fix in 5 minutes, and how to win the interview if you apply.'}
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => openAuth('signup')} className="btn-primary" style={{ padding: '15px 28px', fontSize: 15 }}>
            {t('landing_cta_primary') || 'Run a free analysis →'}
          </button>
          <button onClick={() => openAuth('signin')} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 12, padding: '15px 28px', fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            {t('sign_in')}
          </button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {t('landing_no_card') || 'No credit card · 30 free analyses per day'}
        </p>

        {/* Demo preview card */}
        <div style={{ marginTop: 56, padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 24, maxWidth: 720, margin: '56px auto 0', textAlign: 'left', boxShadow: '0 20px 60px var(--shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0, border: '3px solid #4caf7d', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(76,175,125,0.1)' }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#4caf7d', fontFamily: 'Syne, sans-serif' }}>84%</span>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>{t('job_offer')}</p>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif', marginBottom: 2 }}>Senior Product Designer</p>
              <p style={{ fontSize: 13, color: 'var(--accent)' }}>@ Notion Labs · Paris</p>
            </div>
          </div>
          <div style={{ background: 'rgba(76,175,125,0.08)', border: '1px solid rgba(76,175,125,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#4caf7d', display: 'flex', alignItems: 'center', gap: 8 }}>
            ✓ <span>{t('landing_demo_verdict') || 'Likely to pass ATS — strong fit, missing 2 keywords'}</span>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: 'clamp(40px,8vw,80px) clamp(20px,5vw,48px)', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
            {t('landing_features_kicker') || 'How it works'}
          </p>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(24px,5vw,36px)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {t('landing_features_h2') || 'Three signals real recruiters use'}
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,260px), 1fr))', gap: 16 }}>
          <FeatureCard
            icon="🎯" accent="#FF8E6B"
            title={t('landing_feat1_title') || 'Real ATS simulation'}
            desc={t('landing_feat1_desc') || 'We mimic Workday, Greenhouse, Taleo — the same systems Fortune 500 companies use to filter you out.'}
          />
          <FeatureCard
            icon="📊" accent="#7b8cff"
            title={t('landing_feat2_title') || 'Seniority alignment'}
            desc={t('landing_feat2_desc') || 'Find out if you are at the right level, stretching, or overqualified — before you waste 2 hours on the application.'}
          />
          <FeatureCard
            icon="🎤" accent="#4caf7d"
            title={t('landing_feat3_title') || 'Interview prep'}
            desc={t('landing_feat3_desc') || '5 specific questions tailored to your CV gaps, your edges to lean on, and salary negotiation tactics.'}
          />
        </div>
      </section>

      {/* HOW IT WORKS - 3 steps */}
      <section style={{ padding: 'clamp(40px,8vw,80px) clamp(20px,5vw,48px)', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 24, padding: 'clamp(28px,5vw,48px)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12, textAlign: 'center' }}>
            {t('landing_steps_kicker') || '60 seconds to clarity'}
          </p>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(22px,4.5vw,32px)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2, textAlign: 'center', marginBottom: 36 }}>
            {t('landing_steps_h2') || 'Three steps. No excuses.'}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,200px), 1fr))', gap: 24 }}>
            {[
              { n: '01', t: t('landing_step1_title') || 'Upload your CV', d: t('landing_step1_desc') || 'PDF or Word. Stored on your device, encrypted.' },
              { n: '02', t: t('landing_step2_title') || 'Paste a job URL', d: t('landing_step2_desc') || 'LinkedIn, Indeed, WTTJ, Glassdoor — works on all major boards.' },
              { n: '03', t: t('landing_step3_title') || 'Get your full report', d: t('landing_step3_desc') || 'ATS score, gaps, quick wins, interview questions — in 30 seconds.' },
            ].map((s) => (
              <div key={s.n}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: 8 }}>{s.n}</div>
                <h4 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{s.t}</h4>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: 'clamp(40px,8vw,80px) clamp(20px,5vw,48px)', maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(24px,5vw,36px)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 16 }}>
          {t('landing_cta_h2') || 'Stop applying blind.'}
        </h2>
        <p style={{ fontSize: 'clamp(14px,3vw,16px)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 28 }}>
          {t('landing_cta_desc') || 'Free forever for individual job seekers. No credit card. No spam. Just better applications.'}
        </p>
        <button onClick={() => openAuth('signup')} className="btn-primary" style={{ padding: '15px 32px', fontSize: 15 }}>
          {t('landing_cta_primary') || 'Run a free analysis →'}
        </button>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: 'clamp(32px,5vw,48px) clamp(20px,5vw,48px)', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,160px), 1fr))', gap: 28, marginBottom: 32 }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Fit<span style={{ color: 'var(--accent)' }}>Score</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {t('footer_tagline') || 'Beat the algorithm. Get hired.'}
            </p>
          </div>

          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>{t('footer_product') || 'Product'}</p>
            <a onClick={() => openAuth('signup')} style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', cursor: 'pointer', marginBottom: 8 }}>{t('get_started') || 'Get started'}</a>
            <a onClick={() => openAuth('signin')} style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', cursor: 'pointer' }}>{t('sign_in')}</a>
          </div>

          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>{t('footer_legal') || 'Legal'}</p>
            <a href="/privacy" style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 8 }}>{t('privacy_policy')}</a>
            <a href="/terms" style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 8 }}>{t('footer_terms') || 'Terms of service'}</a>
            <a href="/cookies" style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>{t('footer_cookies') || 'Cookies'}</a>
          </div>

          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>{t('footer_contact') || 'Contact'}</p>
            <a href="mailto:hello@fitscore.app" style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 8 }}>hello@fitscore.app</a>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{t('footer_made_in') || 'Made in France 🇫🇷'}</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 24, borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: 11, color: 'var(--text-hint)' }}>
            © {new Date().getFullYear()} FitScore. {t('footer_rights') || 'All rights reserved.'}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-hint)' }}>
            {t('footer_rgpd_note') || 'RGPD-compliant · Data stored in EU'}
          </p>
        </div>
      </footer>

      {authOpen && <AuthModal initialMode={authMode} onClose={() => setAuthOpen(false)} />}
    </div>
  )
}
