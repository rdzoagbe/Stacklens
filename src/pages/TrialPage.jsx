import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, ChevronDown, ChevronRight, Lock, Mail, Play, Shield } from 'lucide-react';
import { sendMagicLink, signInWithMicrosoft, signInWithEmail, resetPassword, registerWithEmail, authErrorKey } from '../firebase-config';
import { saveDb, seedDbIfEmpty } from '../lib/db';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { RDLogo, ScrollToTop } from '../components/ui';
import { LangSelectorCompact, _openCookieBanner } from '../components/AppShell';
import { usePlanPricing } from '../contexts/CurrencyContext';

export function TrialPage() {
  const navigate = useNavigate();
  const { language } = useLang();
  const t = useTranslation(language);
  const pricing = usePlanPricing();

  const { login, startDemo, isAuthed, firebaseUser } = useAuth();

  // If already authenticated on mount, redirect away from landing page
  useEffect(() => {
    // Use a small delay so Firebase auth state settles before we check
    const timer = setTimeout(() => {
      if (isAuthed || firebaseUser) {
        navigate('/dashboard', { replace: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  // Only run once on mount — intentionally omitting deps to prevent loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [showAuth, setShowAuth] = useState(false);
  const [, setShowEmailForm] = useState(false);
  const [authTab, setAuthTab] = useState('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirm, setAuthConfirm] = useState('');
  const [authName, setAuthName] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [, setCurrentTestimonial] = useState(0);
  const [loading, setLoading] = useState(false);

  // Analytics tracking helper
  const trackEvent = (eventName, params = {}) => {
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, params);
    }
  };

  // No fake testimonials — we're in early access. Real testimonials come from real customers.
  const testimonials = [];

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  // Handle SSO provider click
  const handleSSOClick = async (provider) => {
    setLoading(true);
    trackEvent('sso_clicked', { provider: provider.id });

    try {
      if (provider.id === 'google') {
        await login();
      } else if (provider.id === 'microsoft') {
        const { error } = await signInWithMicrosoft();
        if (error) {
          const key = authErrorKey(error);
          if (key) toast.error(t(key)); // '' = user closed the popup → stay silent
          setLoading(false);
        }
        // onAuthChange handles the rest if sign-in succeeded
      } else if (provider.id === 'magic') {
        setShowEmailForm(true);
        setLoading(false);
      } else {
        toast.info(`${provider.name} SSO coming soon.`);
        setLoading(false);
      }
    } catch (error) {
      console.error('Auth error:', error);
      const key = authErrorKey(error);
      if (key) toast.error(t(key));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Subtle background gradient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      {/* ── NAV ── */}
      <nav className="relative z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl sticky top-0">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RDLogo size="md" onClick={() => window.location.href = "/"} />
              <div className="text-xl font-bold text-white">Stacklens</div>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors">{t('lp_nav_pricing')}</a>
              <a href="#faq" className="text-sm text-slate-400 hover:text-white transition-colors">{t('lp_nav_faq')}</a>
              <LangSelectorCompact />
              <button
                onClick={() => setShowAuth(true)}
                className="text-sm text-slate-400 hover:text-white transition-colors">
                {t('lp_nav_sign_in')}
              </button>
              <button
                onClick={() => { trackEvent('cta_click', { location: 'nav' }); setShowAuth(true); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold text-white transition-colors">
                {t('lp_nav_start_free')}
              </button>
            </div>
            <button
              onClick={() => setShowAuth(true)}
              className="md:hidden px-4 py-2 bg-blue-600 rounded-lg text-sm font-semibold">
              {t('lp_nav_start_free')}
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative z-10 pt-20 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-800 bg-slate-900/60 mb-8">
            <span className="text-xs font-medium text-slate-400">{t('lp_hero_badge')}</span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-white mb-6 leading-[1.05]">
            {t('lp_hero_h1_line1')}
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">{t('lp_hero_h1_line2')}</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('lp_hero_body')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <button
              onClick={() => { trackEvent('cta_click', { location: 'hero_primary' }); setShowAuth(true); }}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-base font-semibold text-white transition-all hover:scale-[1.02] shadow-lg shadow-blue-900/40">
              {t('lp_cta_start')}
            </button>
            <button
              onClick={() => { trackEvent('cta_click', { location: 'hero_demo' }); startDemo(); navigate('/dashboard'); }}
              className="px-8 py-4 border border-slate-700 hover:border-slate-600 hover:bg-slate-900/60 rounded-xl text-base font-semibold text-slate-300 transition-all">
              {t('lp_cta_demo')}
            </button>
          </div>
          <p className="text-xs text-slate-500">{t('lp_hero_fine_print')}</p>
        </div>
      </section>

      {/* ── TRUST SIGNALS ── */}
      <section className="relative z-10 px-6 pb-8">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-500 mb-6">{t('lp_trust_heading')}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: '🇪🇺', label: t('lp_trust_1'), sub: t('lp_trust_1_sub') },
              { icon: '🔒', label: t('lp_trust_2'), sub: t('lp_trust_2_sub') },
              { icon: '💳', label: t('lp_trust_3'), sub: t('lp_trust_3_sub') },
              { icon: '✅', label: t('lp_trust_4'), sub: t('lp_trust_4_sub') },
            ].map((b) => (
              <div key={b.label} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-center hover:border-slate-700 transition-colors">
                <div className="text-2xl mb-1.5">{b.icon}</div>
                <div className="text-sm font-bold text-white">{b.label}</div>
                <div className="text-xs text-slate-500 mt-0.5 leading-snug">{b.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS — 3-step visual flow ── */}
      <section className="relative z-10 py-20 px-6 border-t border-slate-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">{t('lp_hiw_title')}</h2>
            <p className="text-slate-500">{t('hero_no_integrations')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: t('lp_step1_title'),
                desc: t('lp_step1_desc'),
                detail: t('lp_step1_detail'),
                color: 'from-blue-500/20 to-blue-600/10',
                border: 'border-blue-500/30',
                icon: '📤',
              },
              {
                step: '02',
                title: t('lp_step2_title'),
                desc: t('lp_step2_desc'),
                detail: t('lp_step2_detail'),
                color: 'from-amber-500/20 to-amber-600/10',
                border: 'border-amber-500/30',
                icon: '🔍',
              },
              {
                step: '03',
                title: t('lp_step3_title'),
                desc: t('lp_step3_desc'),
                detail: t('lp_step3_detail'),
                color: 'from-emerald-500/20 to-emerald-600/10',
                border: 'border-emerald-500/30',
                icon: '✅',
              },
            ].map((s, i) => (
              <div key={i} className={`rounded-2xl border ${s.border} bg-gradient-to-br ${s.color} p-6`}>
                <div className="text-3xl mb-4">{s.icon}</div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('lp_step_label')} {s.step}</div>
                <h3 className="text-xl font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-slate-400 mb-4 leading-relaxed">{s.desc}</p>
                <p className="text-xs text-slate-500 italic">{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT STACKLENS FINDS — concrete outcomes ── */}
      <section className="relative z-10 py-24 px-6 border-t border-slate-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">{t('lp_problems_section_label')}</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white leading-tight max-w-3xl mx-auto">
              {t('lp_problems_title')} <span className="text-blue-400">{t('lp_problems_title2')}</span>
            </h2>
            <p className="text-slate-500 mt-4 max-w-xl mx-auto">{t('lp_problems_sub')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                icon: '💸',
                title: t('lp_p1_title'),
                sub: t('lp_p1_sub'),
                action: t('lp_p1_action'),
                color: 'border-amber-500/30',
                bg: 'bg-amber-500/5',
              },
              {
                icon: '🔴',
                title: t('lp_p2_title'),
                sub: t('lp_p2_sub'),
                action: t('lp_p2_action'),
                color: 'border-red-500/30',
                bg: 'bg-red-500/5',
              },
              {
                icon: '📅',
                title: t('lp_p3_title'),
                sub: t('lp_p3_sub'),
                action: t('lp_p3_action'),
                color: 'border-blue-500/30',
                bg: 'bg-blue-500/5',
              },
              {
                icon: '👻',
                title: t('lp_p4_title'),
                sub: t('lp_p4_sub'),
                action: t('lp_p4_action'),
                color: 'border-purple-500/30',
                bg: 'bg-purple-500/5',
              },
              {
                icon: '🔓',
                title: t('lp_p5_title'),
                sub: t('lp_p5_sub'),
                action: t('lp_p5_action'),
                color: 'border-red-500/30',
                bg: 'bg-red-500/5',
              },
              {
                icon: '🏚️',
                title: t('lp_p6_title'),
                sub: t('lp_p6_sub'),
                action: t('lp_p6_action'),
                color: 'border-amber-500/30',
                bg: 'bg-amber-500/5',
              },
            ].map((item, i) => (
              <div key={i} className={`rounded-2xl border ${item.color} ${item.bg} p-5 hover:border-opacity-60 transition-colors`}>
                <div className="flex items-start gap-4">
                  <span className="text-2xl flex-shrink-0">{item.icon}</span>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-slate-400 mb-3">{item.sub}</p>
                    <span className="text-xs text-blue-400 font-semibold">{item.action}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <button
              onClick={() => { trackEvent('cta_click', { location: 'outcomes' }); setShowAuth(true); }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold text-white transition-all">
              {t('lp_find_hiding')}
            </button>
          </div>
        </div>
      </section>

      {/* ── WHO IT'S FOR ── */}
      <section className="relative z-10 py-20 px-6 border-t border-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t('accidental_saas_owner')}</h2>
          <p className="text-slate-400 max-w-2xl mx-auto mb-10">
            {t('lp_who_body')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { role: t('lp_persona1_role'), pain: t('lp_persona1_pain') },
              { role: t('lp_persona2_role'), pain: t('lp_persona2_pain') },
              { role: t('lp_persona3_role'), pain: t('lp_persona3_pain') },
            ].map((p, i) => (
              <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-left">
                <div className="text-sm font-bold text-blue-400 mb-2">{p.role}</div>
                <p className="text-sm text-slate-400 leading-relaxed">{p.pain}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="relative z-10 py-20 px-6 border-t border-slate-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">{t('transparent_pricing')}</h2>
            <p className="text-slate-500">{t('public_pricing')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { name: 'Free', eur: 0, sub: 'Forever', features: ['10 tools', '25 employees', 'Shadow IT discovery', 'Basic alerts'], cta: 'Start free', highlight: false },
              { name: 'Starter', eur: 29, sub: '/month', features: ['100 tools', '250 employees', 'Renewal alerts', 'CSV import', '5 team seats'], cta: 'Start trial', highlight: false },
              { name: 'HR & Finance', eur: 49, sub: '/month', features: ['Finance Board', 'People & HR Board', 'Access tracking', 'Offboarding queue', '10 team seats'], cta: 'Start trial', highlight: false, badge: 'NEW' },
              { name: 'Pro', eur: 79, sub: '/month', features: ['500 tools', '1,500 employees', 'AI recommendations', 'Full security suite', '15 team seats'], cta: 'Start trial', highlight: true },
              { name: 'Enterprise', eur: 299, sub: '/month', features: ['Unlimited everything', 'SSO / SAML', 'API access', 'Dedicated support'], cta: 'Contact sales', highlight: false },
            ].map((p, i) => (
              <div
                key={i}
                className={"rounded-2xl border p-6 transition-all relative " + (
                  p.highlight
                    ? 'border-blue-500/60 bg-gradient-to-b from-blue-500/10 to-slate-900/40'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                )}>
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-blue-500 text-[10px] font-bold text-white uppercase tracking-wider">
                    {t('lp_pricing_badge_popular')}
                  </div>
                )}
                {p.badge && !p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-teal-500 text-[10px] font-bold text-white uppercase tracking-wider">
                    {p.badge}
                  </div>
                )}
                <div className="text-sm font-semibold text-slate-400 mb-2">{p.name}</div>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-4xl font-black text-white">{pricing.format(p.eur)}</span>
                  <span className="text-sm text-slate-500">{p.sub}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-slate-300">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    trackEvent('cta_click', { location: 'pricing_' + p.name.toLowerCase() });
                    if (p.name === 'Enterprise') {
                      window.location.href = '/contact?subject=enterprise';
                    } else {
                      setShowAuth(true);
                    }
                  }}
                  className={"w-full py-2.5 rounded-lg text-sm font-semibold transition-colors " + (
                    p.highlight
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  )}>
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-slate-500 mt-8">
            {t('lp_pricing_fine_print')}
          </p>
          {pricing.isLocal && (
            <p className="text-center text-xs text-slate-600 mt-2">
              {t('lp_pricing_local_note').replace('{code}', pricing.code)}
            </p>
          )}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="relative z-10 py-20 px-6 border-t border-slate-900">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">{t('faq_title')}</h2>
            <p className="text-slate-500">{t('faq_subtitle')}</p>
          </div>
          <div className="space-y-3">
            {[
              { q: t('lp_faq2_q'), a: t('lp_faq2_a') },
              { q: t('lp_faq3_q'), a: t('lp_faq3_a') },
              { q: t('lp_faq4_q'), a: t('lp_faq4_a') },
              { q: t('lp_faq5_q'), a: t('lp_faq5_a') },
              { q: t('lp_faq6_q'), a: t('lp_faq6_a') },
              { q: t('lp_faq7_q'), a: t('lp_faq7_a') },
              { q: t('lp_faq8_q'), a: t('lp_faq8_a') },
            ].map((f, i) => (
              <details
                key={i}
                className="group rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-900/60 transition-colors list-none">
                  <span className="text-sm font-semibold text-white pr-4">{f.q}</span>
                  <ChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-5 text-sm text-slate-400 leading-relaxed">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative z-10 py-24 px-6 border-t border-slate-900">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t('get_started_in_minutes')}</h2>
          <p className="text-slate-400 mb-8">
            {t('lp_final_cta_body')}
          </p>
          <button
            onClick={() => { trackEvent('cta_click', { location: 'final' }); setShowAuth(true); }}
            className="px-10 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-base font-semibold text-white transition-all hover:scale-[1.02] shadow-lg shadow-blue-900/40">
            {t('lp_final_cta_btn')}
          </button>
          <p className="mt-4 text-xs text-slate-500">{t('lp_final_cta_note')}</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-slate-800 bg-slate-950/60 backdrop-blur-sm mt-16">
        <div className="max-w-6xl mx-auto px-6 py-14">
          {/* Main footer grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12 md:pr-20">
            {/* Brand column */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <RDLogo size="sm" onClick={() => window.location.href = "/"} />
                <div className="text-base font-bold text-white">Stacklens</div>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                {t('lp_footer_tagline')}
              </p>
              <div className="text-xs text-slate-500">🇪🇺 Built in France · Hosted in EU</div>
            </div>

            {/* Product */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">{t('lp_footer_product')}</div>
              <ul className="space-y-3 text-sm">
                <li><a href="#pricing" onClick={(e) => { e.preventDefault(); document.getElementById('pricing')?.scrollIntoView({behavior:'smooth'}); }} className="text-slate-300 hover:text-white transition-colors">{t('lp_nav_pricing')}</a></li>
                <li><a href="#faq" onClick={(e) => { e.preventDefault(); document.getElementById('faq')?.scrollIntoView({behavior:'smooth'}); }} className="text-slate-300 hover:text-white transition-colors">{t('lp_nav_faq')}</a></li>
                <li><button onClick={() => { startDemo(); navigate('/dashboard'); }} className="text-slate-300 hover:text-white transition-colors text-left">{t('lp_live_demo')}</button></li>
                <li><button onClick={() => setShowAuth(true)} className="text-slate-300 hover:text-white transition-colors text-left">{t('lp_nav_sign_in')}</button></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">{t('lp_footer_company')}</div>
              <ul className="space-y-3 text-sm">
                <li><Link to="/about" className="text-slate-300 hover:text-white transition-colors">{t('lp_footer_about')}</Link></li>
                <li><Link to="/contact" className="text-slate-300 hover:text-white transition-colors">Contact</Link></li>
                <li><Link to="/contact?subject=sales" className="text-slate-300 hover:text-white transition-colors">{t('lp_footer_sales')}</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">{t('lp_footer_legal')}</div>
              <ul className="space-y-3 text-sm">
                <li><Link to="/privacy" className="text-slate-300 hover:text-white transition-colors">{t('footer_privacy_policy')}</Link></li>
                <li><Link to="/terms" className="text-slate-300 hover:text-white transition-colors">{t('footer_terms_of_service')}</Link></li>
                <li><Link to="/legal" className="text-slate-300 hover:text-white transition-colors">{t('footer_legal_mentions')}</Link></li>
                <li><Link to="/dpa" className="text-slate-300 hover:text-white transition-colors">{t('lp_dpa_link')}</Link></li>
                <li><Link to="/sub-processors" className="text-slate-300 hover:text-white transition-colors">{t('lp_sub_processors_link')}</Link></li>
                <li><Link to="/security-info" className="text-slate-300 hover:text-white transition-colors">{t('lp_footer_security')}</Link></li>
                <li><Link to="/about" className="text-slate-300 hover:text-white transition-colors">GDPR</Link></li>
                <li>
                  <button
                    type="button"
                    onClick={() => { if (_openCookieBanner) _openCookieBanner(); }}
                    className="text-slate-300 hover:text-white transition-colors text-sm text-left"
                  >
                    {t('lp_footer_cookies')}
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-slate-800/60 flex flex-col md:flex-row items-center justify-between gap-4 md:pr-20">
            <div className="text-xs text-slate-500">
              {t('lp_footer_copyright')}
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>{t('lp_footer_made_in')}</span>
              <span className="text-slate-700">·</span>
              <Link to="/contact" className="hover:text-white transition-colors">hello@stacklens.fr</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ══════════════════════════════════════════════════════
           UNIFIED AUTH MODAL — Create Account / Sign In / SSO
          ══════════════════════════════════════════════════════ */}
      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{background:'rgba(2,6,23,0.85)', backdropFilter:'blur(12px)'}}>
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden"
            style={{boxShadow:'0 0 80px rgba(59,130,246,0.15)'}}>

            {/* Subtle top glow bar */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />

            {/* Close button */}
            <button onClick={() => { setShowAuth(false); setAuthError(''); setMagicSent(false); }}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all z-10">
              ✕
            </button>

            {/* Header */}
            <div className="px-4 md:px-8 pt-8 pb-0">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-lg font-black text-white">Stacklens</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">{t('hc_saas_intelligence_platform')}</div>
                </div>
              </div>

              {/* Tab switcher */}
              <div className="flex gap-1 p-1 bg-slate-800/80 rounded-2xl border border-slate-700/50 mb-6">
                {[
                  { id: 'signin',  label: t('lp_auth_signin_tab') },
                  { id: 'create',  label: t('lp_auth_create_tab') },
                  { id: 'sso',     label: t('lp_auth_sso_tab') },
                ].map(tab => (
                  <button key={tab.id} onClick={() => { setAuthTab(tab.id); setAuthError(''); setMagicSent(false); }}
                    className={"flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200 " +
                      (authTab === tab.id
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-slate-400 hover:text-slate-200")}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="px-4 md:px-8 pb-8">

              {/* ── SIGN IN TAB ── */}
              {authTab === 'signin' && (
                <div className="space-y-4">
                  {!magicSent ? (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{t("hc_work_email")}</label>
                        <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                          placeholder="you@company.com"
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{t('lp_password_label')}</label>
                        <div className="relative">
                          <input type={showPassword ? 'text' : 'password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12" />
                          <button type="button" onClick={() => setShowPassword(v => !v)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs">
                            {showPassword ? t('lp_hide_password') : t('lp_show_password')}
                          </button>
                        </div>
                      </div>
                      {authError && <div className="text-rose-400 text-xs px-1">{authError}</div>}
                      <button onClick={async () => {
                          setLoading(true); setAuthError('');
                          // Email/password sign-in via Google (same account) or magic link fallback
                          if (!authEmail) { setAuthError(t('lp_enter_email')); setLoading(false); return; }
                          if (!authPassword) { setAuthError(t('lp_enter_password')); setLoading(false); return; }
                          const { user, error } = await signInWithEmail(authEmail, authPassword);
                          if (error) {
                            setAuthError(t(authErrorKey(error) || 'err_auth_generic'));
                            setLoading(false); return;
                          }
                          if (user) {
                            const cur = seedDbIfEmpty();
                            cur.user = { ...cur.user, is_authenticated: true, is_demo: false, email: user.email, displayName: user.displayName || authEmail.split('@')[0], uid: user.uid };
                            saveDb(cur);
                            window.location.replace('/dashboard');
                          }
                          setLoading(false);
                        }}
                        disabled={loading || !authEmail || !authPassword}
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/20">
                        {loading ? t('lp_signing_in') : t('lp_sign_in_btn')}
                      </button>
                      <button onClick={async()=>{if(!authEmail){setAuthError(t('lp_enter_email_first'));return;}const{error}=await resetPassword(authEmail);if(!error)toast.success(t('password_reset_sent'));else setAuthError(t(authErrorKey(error) || 'err_auth_generic'));}} className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors mt-1 text-center block">{t('forgot_password')}</button>

                      {/* Divider */}
                      <div className="flex items-center gap-3 my-1">
                        <div className="flex-1 h-px bg-slate-700" />
                        <span className="text-xs text-slate-500">or</span>
                        <div className="flex-1 h-px bg-slate-700" />
                      </div>

                      {/* Magic link */}
                      <button onClick={async () => {
                          if (!authEmail) { setAuthError(t('lp_enter_email_first')); return; }
                          setLoading(true); setAuthError('');
                          const { error } = await sendMagicLink(authEmail);
                          if (!error) { setMagicSent(true); }
                          else { setAuthError(t(authErrorKey(error) || 'err_auth_generic')); }
                          setLoading(false);
                        }}
                        disabled={loading}
                        className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-blue-500/50 rounded-xl text-slate-300 hover:text-white font-semibold text-sm transition-all flex items-center justify-center gap-2">
                        <Mail className="w-4 h-4" />
                        {t('lp_magic_link_btn')}
                      </button>

                      {/* Google */}
                      <button onClick={() => handleSSOClick({ id: 'google', live: true })}
                        disabled={loading}
                        className="w-full py-3 bg-white hover:bg-slate-100 rounded-xl text-slate-900 font-bold text-sm transition-all flex items-center justify-center gap-3 shadow-sm">
                        <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        {t('lp_continue_google')}
                      </button>

                      {/* Microsoft */}
                      <button onClick={() => handleSSOClick({ id: 'microsoft', live: true })}
                        disabled={loading}
                        className="w-full py-3 bg-white hover:bg-slate-100 rounded-xl text-slate-900 font-bold text-sm transition-all flex items-center justify-center gap-3 shadow-sm">
                        <span className="w-4 h-4 grid grid-cols-2 gap-0.5"><span className="bg-[#F25022] rounded-sm"/><span className="bg-[#7FBA00] rounded-sm"/><span className="bg-[#00A4EF] rounded-sm"/><span className="bg-[#FFB900] rounded-sm"/></span>
                        {t('lp_continue_microsoft')}
                      </button>
                    </>
                  ) : (
                    /* Magic link sent state */
                    <div className="text-center py-6 space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                        <Mail className="w-8 h-8 text-blue-400" />
                      </div>
                      <div>
                        <div className="text-white font-bold text-lg mb-1">{t("hc_check_your_inbox")}</div>
                        <div className="text-slate-400 text-sm">{t("hc_we_sent_a_magic_link_to")}</div>
                        <div className="text-blue-400 font-semibold text-sm mt-1">{authEmail}</div>
                      </div>
                      <div className="text-slate-500 text-xs">{t('lp_magic_link_note')}</div>
                      <button onClick={() => setMagicSent(false)} className="text-sm text-slate-400 hover:text-white transition-colors underline underline-offset-2">
                        {t('lp_use_different_email')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── CREATE ACCOUNT TAB ── */}
              {authTab === 'create' && (
                <div className="space-y-4">
                  {!magicSent ? (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{t("hc_full_name")}</label>
                        <input type="text" value={authName} onChange={e => setAuthName(e.target.value)}
                          placeholder="Jane Smith"
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{t("hc_work_email")}</label>
                        <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                          placeholder="you@company.com"
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                      </div>

                      {authError && <div className="text-rose-400 text-xs px-1">{authError}</div>}

                      {/* Password field for registration */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{t('lp_password_label')}</label>
                        <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)}
                          placeholder={t('lp_min_chars')}
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                      </div>
                      {/* Confirm password */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{t('lp_confirm_password_label')}</label>
                        <input type="password" value={authConfirm} onChange={e => setAuthConfirm(e.target.value)}
                          placeholder={t('lp_confirm_password_ph')}
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                        {authConfirm && authPassword !== authConfirm && (
                          <div className="text-rose-400 text-xs px-1 mt-1">{t('lp_password_mismatch')}</div>
                        )}
                      </div>
                      {/* Terms acceptance — required at signup, proof of consent (LCEN + RGPD) */}
                      <label className="flex items-start gap-2 cursor-pointer group mt-1">
                        <input type="checkbox" id="signup-terms"
                          className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 flex-shrink-0"
                          onChange={e => { const btn = document.getElementById('signup-btn'); if (btn) btn.disabled = !e.target.checked; }} />
                        <span className="text-xs text-slate-400 leading-relaxed">
                          {language === 'fr'
                            ? <>{`J'accepte les `}<Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">{`CGU`}</Link>{` et la `}<Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">{`Politique de confidentialité`}</Link></>
                            : <>{'I agree to the '}<Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">{'Terms of Service'}</Link>{' and '}<Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">{'Privacy Policy'}</Link></>
                          }
                        </span>
                      </label>
                      <button id="signup-btn" onClick={async () => {
                          if (!authName) { setAuthError(t('lp_enter_name')); return; }
                          if (!authEmail) { setAuthError(t('lp_enter_email')); return; }
                          if (!authPassword || authPassword.length < 8) { setAuthError(t('lp_password_min')); return; }
                          if (authPassword !== authConfirm) { setAuthError(t('lp_password_mismatch')); return; }
                          setLoading(true); setAuthError('');
                          const { user, error } = await registerWithEmail(authEmail, authPassword, authName);
                          if (error) {
                            setAuthError(t(authErrorKey(error) || 'err_auth_generic'));
                            setLoading(false); return;
                          }
                          if (user) {
                            toast.success(t('account_created_verify'));
                            const cur = seedDbIfEmpty();
                            cur.user = { ...cur.user, is_authenticated: true, is_demo: false, email: user.email, displayName: authName, uid: user.uid };
                            saveDb(cur);
                            window.location.replace('/dashboard');
                          }
                          setLoading(false);
                        }}
                        disabled={loading || !authEmail || !authName || !authPassword || !authConfirm}
                        className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2">
                        {loading ? t('lp_creating_account') : t('lp_create_account_btn')}
                      </button>

                      <div className="flex items-center gap-3 my-1">
                        <div className="flex-1 h-px bg-slate-700" />
                        <span className="text-xs text-slate-500">{t('lp_or_sign_up_with')}</span>
                        <div className="flex-1 h-px bg-slate-700" />
                      </div>

                      <button onClick={() => handleSSOClick({ id: 'google', live: true })}
                        disabled={loading}
                        className="w-full py-3 bg-white hover:bg-slate-100 rounded-xl text-slate-900 font-bold text-sm transition-all flex items-center justify-center gap-3 shadow-sm">
                        <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        {t('lp_sign_up_google')}
                      </button>

                      <button onClick={() => handleSSOClick({ id: 'microsoft', live: true })}
                        disabled={loading}
                        className="w-full py-3 bg-white hover:bg-slate-100 rounded-xl text-slate-900 font-bold text-sm transition-all flex items-center justify-center gap-3 shadow-sm">
                        <span className="w-4 h-4 grid grid-cols-2 gap-0.5"><span className="bg-[#F25022] rounded-sm"/><span className="bg-[#7FBA00] rounded-sm"/><span className="bg-[#00A4EF] rounded-sm"/><span className="bg-[#FFB900] rounded-sm"/></span>
                        {t('lp_sign_up_microsoft')}
                      </button>

                      <p className="text-center text-[11px] text-slate-600 leading-relaxed">
                        {t('lp_terms_fine_print')}{' '}
                        <Link to="/terms" className="text-slate-400 hover:text-white underline" onClick={() => setShowAuth(false)}>Terms</Link>
                        {' '}{t('lp_terms_and')}{' '}
                        <Link to="/privacy" className="text-slate-400 hover:text-white underline" onClick={() => setShowAuth(false)}>{t("hc_privacy_policy")}</Link>
                      </p>
                    </>
                  ) : (
                    <div className="text-center py-6 space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <Mail className="w-8 h-8 text-emerald-400" />
                      </div>
                      <div>
                        <div className="text-white font-bold text-lg mb-1">Almost there, {authName.split(' ')[0]}!</div>
                        <div className="text-slate-400 text-sm">{t("hc_your_activation_link_is_on_its_way_")}</div>
                        <div className="text-emerald-400 font-semibold text-sm mt-1">{authEmail}</div>
                      </div>
                      <div className="text-slate-500 text-xs px-4">{t('click_link_activate')}</div>
                      <button onClick={() => { setMagicSent(false); setAuthName(''); setAuthEmail(''); }} className="text-sm text-slate-400 hover:text-white transition-colors underline underline-offset-2">
                        {t('lp_start_over')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── SSO TAB ── */}
              {authTab === 'sso' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 mb-4">{t('lp_sso_desc')}</p>
                  {[
                    { id: 'google',    name: 'Google Workspace', sub: 'G Suite / Google Cloud Identity', live: true,  logo: <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> },
                    { id: 'microsoft', name: 'Microsoft 365',    sub: 'Azure AD / Entra ID',            live: true,  logo: <div className="w-5 h-5 grid grid-cols-2 gap-0.5"><div className="bg-[#F25022] rounded-sm"/><div className="bg-[#7FBA00] rounded-sm"/><div className="bg-[#00A4EF] rounded-sm"/><div className="bg-[#FFB900] rounded-sm"/></div> },
                    { id: 'okta',      name: 'Okta',             sub: 'Enterprise SSO via Okta',         live: false, logo: <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[9px] font-black text-white">OK</div> },
                    { id: 'saml',      name: 'SAML 2.0',         sub: 'Custom SAML identity provider',   live: false, logo: <div className="w-5 h-5 rounded bg-slate-600 flex items-center justify-center"><Lock className="w-3 h-3 text-slate-300" /></div> },
                  ].map(p => (
                    <button key={p.id}
                      onClick={() => p.live ? handleSSOClick({ id: p.id, live: true }) : toast.info(p.name + ' SSO is coming soon. Use Google or magic link for now.')}
                      className={"w-full flex items-center justify-between p-4 rounded-2xl border transition-all group " +
                        (p.live ? "border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-blue-500/40" : "border-slate-800 bg-slate-800/20 opacity-50 cursor-not-allowed")}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center flex-shrink-0">{p.logo}</div>
                        <div className="text-left">
                          <div className={"text-sm font-semibold " + (p.live ? "text-white" : "text-slate-500")}>{p.name}</div>
                          <div className="text-xs text-slate-600">{p.sub}</div>
                        </div>
                      </div>
                      {p.live
                        ? <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
                        : <span className="text-[9px] font-bold text-slate-600 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-full uppercase tracking-widest">{t('lp_sso_soon')}</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Demo + divider ── */}
              <div className="mt-6 pt-5 border-t border-slate-800">
                <button onClick={() => { setShowAuth(false); startDemo(); navigate('/dashboard'); }}
                  className="w-full py-2.5 rounded-xl border border-emerald-600/30 bg-emerald-600/5 hover:bg-emerald-600/10 text-emerald-400 hover:text-emerald-300 text-sm font-semibold transition-all flex items-center justify-center gap-2">
                  <Play className="w-3.5 h-3.5" />
                  {t('lp_try_live_demo')}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Scroll to Top Button */}
      <ScrollToTop />
    </div>
  );
}
