/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadDb, seedDbIfEmpty } from '../lib/db';

const TourContext = createContext(null);

const TOUR_STEPS = [
  {
    id: 'welcome',
    page: '/dashboard',
    target: 'tour-welcome',
    title: '👋 Welcome to Stacklens!',
    body: "This is your command centre. In the next 2 minutes we'll show you the 4 most powerful features — starting right here on your dashboard.",
    position: 'center',
    wide: true,
  },
  {
    id: 'kpi-strip',
    page: '/dashboard',
    target: 'tour-kpi-strip',
    title: '📊 Your SaaS health at a glance',
    body: 'These 4 KPIs update in real time — total spend, estimated waste, security risk level, and compliance readiness. Most teams are shocked by the waste number on day one.',
    position: 'bottom',
  },
  {
    id: 'ai-insights',
    page: '/dashboard',
    target: 'tour-ai-insights',
    title: '🤖 AI-powered recommendations',
    body: 'Claude AI analyses your stack and surfaces the highest-impact actions — unused licences to cancel, security gaps to close, contracts to renegotiate. Updated every time your data changes.',
    position: 'top',
  },
  {
    id: 'risk-alerts',
    page: '/dashboard',
    target: 'tour-risk-alerts',
    title: '🚨 Risk alerts panel',
    body: 'Critical issues bubble up here automatically — ex-employees with active access, tools with no owner, licences expiring soon. One click to resolve each one.',
    position: 'top',
  },
  {
    id: 'cost-intro',
    page: '/cost',
    target: 'tour-cost-header',
    title: '💸 Cost Management',
    body: "Now let's look at where your money is going. Stacklens maps every tool, its monthly cost, and how many people actually use it.",
    position: 'bottom',
  },
  {
    id: 'cost-waste',
    page: '/cost',
    target: 'tour-cost-waste',
    title: '🗑️ Waste detection',
    body: 'Tools flagged in red are waste — paid licences with zero or near-zero usage. Each row shows cost per active user so you can see exactly what to cut first.',
    position: 'top',
  },
  {
    id: 'access-intro',
    page: '/access',
    target: 'tour-access-header',
    title: '🔐 Access Control',
    body: "47% of ex-employees still have active SaaS access 30 days after leaving. This page shows you every access right across your stack — and lets you revoke them instantly.",
    position: 'bottom',
  },
  {
    id: 'access-risks',
    page: '/access',
    target: 'tour-access-risks',
    title: '⚠️ High-risk access flags',
    body: "Red rows mean former employees or unreviewed access. Click 'Revoke' to cut access with one click — no logging into each tool individually.",
    position: 'top',
  },
  {
    id: 'contracts-intro',
    page: '/contracts',
    target: 'tour-contracts-header',
    title: '📄 Contracts & Renewals',
    body: 'See every contract in one place — renewal dates, costs, auto-renew flags. Stacklens alerts you 90, 60 and 30 days before a renewal so you never get auto-charged.',
    position: 'bottom',
  },
  {
    id: 'contracts-ai',
    page: '/contracts',
    target: 'tour-contracts-ai',
    title: '🤖 AI Contract Comparison',
    body: "Upload two contracts and Claude AI compares them side-by-side — pricing, SLA terms, exit clauses, hidden fees. What used to take a lawyer 2 hours takes 30 seconds.",
    position: 'top',
  },
  {
    id: 'finish',
    page: '/contracts',
    target: 'tour-finish',
    title: "🎉 You're all set!",
    body: "That's Stacklens in a nutshell. Your dashboard is now loaded with sample data so you can explore freely. When you're ready, replace it with your real tools.",
    position: 'center',
    wide: true,
    isLast: true,
  },
];

const TOUR_LS_KEY = 'sg_tour_done';

function TourProvider({ children }) {
  const navigate = useNavigate();
  const [active, setActive]       = useState(false);
  const [stepIdx, setStepIdx]     = useState(0);
  const [spotlight, setSpotlight] = useState(null);
  const rafRef = useRef(null);

  const currentStep = TOUR_STEPS[stepIdx];

  const measureTarget = useCallback((targetId) => {
    if (!targetId || targetId === 'tour-welcome' || targetId === 'tour-finish') {
      setSpotlight(null);
      return;
    }
    const el = document.querySelector('[data-tour="' + targetId + '"]');
    if (!el) { setSpotlight(null); return; }
    const r = el.getBoundingClientRect();
    setSpotlight({ top: r.top - 8, left: r.left - 8, width: r.width + 16, height: r.height + 16 });
  }, []);

  useEffect(() => {
    if (!active) return;
    const step = TOUR_STEPS[stepIdx];
    navigate(step.page);
    const t = setTimeout(() => measureTarget(step.target), 350);
    return () => clearTimeout(t);
  }, [active, stepIdx, navigate, measureTarget]);

  useEffect(() => {
    if (!active) return;
    const handler = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => measureTarget(currentStep?.target));
    };
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [active, currentStep, measureTarget]);

  const startTour = useCallback(() => {
    setStepIdx(0);
    setActive(true);
  }, []);

  const next = useCallback(() => {
    if (stepIdx < TOUR_STEPS.length - 1) setStepIdx(s => s + 1);
  }, [stepIdx]);

  const prev = useCallback(() => {
    if (stepIdx > 0) setStepIdx(s => s - 1);
  }, [stepIdx]);

  const finish = useCallback(() => {
    setActive(false);
    setSpotlight(null);
    localStorage.setItem(TOUR_LS_KEY, 'true');
    if (!loadDb()) seedDbIfEmpty();
    navigate('/dashboard');
  }, [navigate]);

  const skip = useCallback(() => {
    setActive(false);
    setSpotlight(null);
    navigate('/dashboard');
  }, [navigate]);

  return (
    <TourContext.Provider value={{ active, startTour, currentStep, stepIdx, totalSteps: TOUR_STEPS.length, next, prev, finish, skip, spotlight }}>
      {children}
      {active && <ProductTourOverlay />}
    </TourContext.Provider>
  );
}

function useTour() {
  return useContext(TourContext);
}

function ProductTourOverlay() {
  const { currentStep, stepIdx, totalSteps, next, prev, finish, skip, spotlight } = useTour();
  if (!currentStep) return null;

  const isCenter = currentStep.position === 'center';

  const popupStyle = (() => {
    if (isCenter || !spotlight) {
      return {
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
      };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popW = currentStep.wide ? 420 : 360;
    const popH = 220;
    let top, left;

    if (currentStep.position === 'bottom') {
      top  = spotlight.top + spotlight.height + 16;
      left = spotlight.left + spotlight.width / 2 - popW / 2;
    } else {
      top  = spotlight.top - popH - 16;
      left = spotlight.left + spotlight.width / 2 - popW / 2;
    }
    left = Math.max(16, Math.min(left, vw - popW - 16));
    top  = Math.max(16, Math.min(top,  vh - popH - 16));

    return { position: 'fixed', top, left, width: popW, zIndex: 9999 };
  })();

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9990, pointerEvents: 'none' }}
        onClick={e => e.stopPropagation()}
      >
        {spotlight ? (
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <mask id="sg-tour-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={spotlight.left} y={spotlight.top}
                  width={spotlight.width} height={spotlight.height}
                  rx="8" fill="black"
                />
              </mask>
            </defs>
            <rect
              width="100%" height="100%"
              fill="rgba(0,0,0,0.65)"
              mask="url(#sg-tour-mask)"
            />
            <rect
              x={spotlight.left} y={spotlight.top}
              width={spotlight.width} height={spotlight.height}
              rx="8" fill="none"
              stroke="#3b82f6" strokeWidth="2"
              style={{ filter: 'drop-shadow(0 0 8px #3b82f6)' }}
            />
          </svg>
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)' }} />
        )}
      </div>

      <div
        style={{
          ...popupStyle,
          background: 'linear-gradient(135deg, #0f1e3a 0%, #1a2f5a 100%)',
          border: '1px solid #3b82f6',
          borderRadius: 16,
          padding: '24px 28px',
          boxShadow: '0 0 40px rgba(59,130,246,0.3), 0 20px 60px rgba(0,0,0,0.5)',
          maxWidth: currentStep.wide ? 440 : 380,
          minWidth: 320,
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} style={{
                width: i === stepIdx ? 20 : 6, height: 6, borderRadius: 3,
                background: i === stepIdx ? '#3b82f6' : i < stepIdx ? '#1d4ed8' : '#334155',
                transition: 'all 0.3s',
              }} />
            ))}
          </div>
          <button
            onClick={skip}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12, padding: '2px 8px' }}
          >
            Skip tour ✕
          </button>
        </div>

        <h3 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, marginBottom: 10, lineHeight: 1.3 }}>
          {currentStep.title}
        </h3>
        <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
          {currentStep.body}
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#475569', fontSize: 12 }}>
            {stepIdx + 1} of {totalSteps}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {stepIdx > 0 && (
              <button
                onClick={prev}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid #334155',
                  background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13,
                }}
              >
                ← Back
              </button>
            )}
            {currentStep.isLast ? (
              <button
                onClick={finish}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                }}
              >
                Start exploring →
              </button>
            ) : (
              <button
                onClick={next}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                }}
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export { TourContext, TourProvider, useTour, ProductTourOverlay, TOUR_STEPS, TOUR_LS_KEY };
