import React, { useState } from 'react'
import { useLang } from '../context/LangContext'

export default function Onboarding({ onDone }) {
  const { t } = useLang()
  const [step, setStep] = useState(0)
  const STEPS = [
    { icon: '🔗', title: t('onb_step1_title'), desc: t('onb_step1_desc') },
    { icon: '📄', title: t('onb_step2_title'), desc: t('onb_step2_desc') },
    { icon: '🎯', title: t('onb_step3_title'), desc: t('onb_step3_desc') },
    { icon: '📈', title: t('onb_step4_title'), desc: t('onb_step4_desc') }
  ]
  const isLast = step === STEPS.length - 1
  const s = STEPS[step]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 24, padding: 'clamp(28px,6vw,44px)', maxWidth: 400, width: '100%', textAlign: 'center', animation: 'fadeUp 0.3s ease' }}>
        <div style={{ fontSize: 52, marginBottom: 20 }}>{s.icon}</div>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(18px,4vw,22px)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, lineHeight: 1.3 }}>{s.title}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 32 }}>{s.desc}</p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 28 }}>
          {STEPS.map((_, i) => (
            <div key={i} onClick={() => setStep(i)} style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 3, background: i === step ? 'var(--accent)' : 'var(--border)', transition: 'all 0.3s', cursor: 'pointer' }} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s-1)} style={{ flex: 1, padding: '13px', borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}>
              {t('onb_back')}
            </button>
          )}
          <button onClick={() => isLast ? onDone() : setStep(s => s+1)} style={{ flex: 2, padding: '13px', borderRadius: 12, background: 'var(--accent)', border: 'none', color: '#1A1B22', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>
            {isLast ? t('onb_get_started') : t('onb_next')}
          </button>
        </div>

        <button onClick={onDone} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', marginTop: 16, padding: 4 }}>
          {t('onb_skip')}
        </button>
      </div>
    </div>
  )
}
