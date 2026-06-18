import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Shield, Lock, Download } from 'lucide-react';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { submitContactForm, mailtoFallback } from '../lib/contact';
import { RDLogo } from '../components/ui';
import { LangSelectorCompact } from '../components/AppShell';

export function NotFound() {
  return <Navigate to="/" replace />;
}

export function ContactPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const initialSubject = params.get('subject') || 'general';
  const [form, setForm] = useState({ name: '', email: '', subject: initialSubject, message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const subjects = [
    { value: 'general', label: t('contact_subject_general') },
    { value: 'sales', label: t('contact_subject_sales') },
    { value: 'support', label: t('contact_subject_support') },
    { value: 'feedback', label: t('contact_subject_feedback') },
    { value: 'partnership', label: t('contact_subject_partnership') },
    { value: 'enterprise', label: t('contact_subject_enterprise') },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setSending(true);
    const subjectLabel = subjects.find(s => s.value === form.subject)?.label || form.subject;
    const payload = { name: form.name, email: form.email, subject: form.subject, message: `Subject: ${subjectLabel}\n\n${form.message}` };
    try {
      await submitContactForm(payload);
      setSent(true);
      setForm({ name: '', email: '', subject: 'general', message: '' });
    } catch {
      mailtoFallback(payload);
    }
    setSending(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-6">✉️</div>
          <h1 className="text-3xl font-bold mb-4">{t('contact_sent_title')}</h1>
          <p className="text-slate-400 mb-8">{t('contact_sent_body')}</p>
          <button onClick={() => navigate('/')} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold text-white transition-all">
            {t('contact_back_home')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-white flex items-center gap-1">
            ← {t('back')}
          </button>
          <LangSelectorCompact />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Left — form */}
          <div className="lg:col-span-3">
            <h1 className="text-3xl font-bold mb-2">{t('contact_title')}</h1>
            <p className="text-slate-400 mb-8">{t('contact_subtitle')}</p>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">{t('contact_full_name')} *</label>
                  <input
                    type="text" required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                    placeholder={t('contact_your_name')}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">{t('contact_work_email')} *</label>
                  <input
                    type="email" required value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                    placeholder={t('contact_your_email')}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">{t('contact_subject')}</label>
                <select
                  value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value}))}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  {subjects.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">{t('contact_message')} *</label>
                <textarea
                  required rows={6} value={form.message} onChange={e => setForm(f => ({...f, message: e.target.value}))}
                  placeholder={t('contact_how_help')}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={sending || !form.name || !form.email || !form.message}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white transition-all"
              >
                {sending ? t('contact_sending') : t('contact_send')}
              </button>
            </div>
          </div>

          {/* Right — info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <h3 className="text-sm font-bold text-white mb-4">{t('contact_other_ways')}</h3>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{t('contact_general')}</div>
                  <a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a>
                </div>
                <div>
                  <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Support</div>
                  <a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a>
                </div>
                <div>
                  <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{t('contact_sales_enterprise')}</div>
                  <a href="mailto:sales@stacklens.fr" className="text-blue-400 hover:text-blue-300">sales@stacklens.fr</a>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <h3 className="text-sm font-bold text-white mb-3">{t('contact_response_time')}</h3>
              <div className="space-y-2 text-sm text-slate-400">
                <div className="flex justify-between"><span>{t('contact_general_q')}</span><span className="text-slate-300">{'< 24h'}</span></div>
                <div className="flex justify-between"><span>Support</span><span className="text-slate-300">{'< 12h'}</span></div>
                <div className="flex justify-between"><span>{t('contact_sales_label')}</span><span className="text-slate-300">{'< 4h'}</span></div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <h3 className="text-sm font-bold text-white mb-3">{t('contact_based_in')}</h3>
              <p className="text-sm text-slate-400">Paris, France 🇫🇷</p>
              <p className="text-xs text-slate-500 mt-2">{t('contact_timezone')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Legal Mentions (Mentions Légales — required by French LCEN law) ──
// ============================================================================
// DPA — Data Processing Agreement (GDPR Article 28 compliant)
// Required before any B2B customer can be signed
// ============================================================================
export function DpaPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-white flex items-center gap-1">← {t('back')}</button>
          <LangSelectorCompact />
        </div>
        <h1 className="text-3xl font-bold mb-2">{t('dpa_title')}</h1>
        <p className="text-slate-400 text-sm mb-2">{t('dpa_subtitle')} · {t('dpa_version')} 1.0 · {t('dpa_effective')} May 2026</p>
        <p className="text-slate-400 text-sm mb-10">{t('dpa_auto_accepted')}</p>

        <div className="space-y-8 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s1_title')}</h2>
            <p>{t('dpa_s1_body')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s2_title')}</h2>
            <p>{t('dpa_s2_body')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s3_title')}</h2>
            <p>{t('dpa_s3_intro')}</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-400">
              <li>{t('dpa_s3_item1')}</li>
              <li>{t('dpa_s3_item2')}</li>
              <li>{t('dpa_s3_item3')}</li>
              <li>{t('dpa_s3_item4')}</li>
              <li>{t('dpa_s3_item5')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s4_title')}</h2>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>{t('dpa_s4_item1')}</li>
              <li>{t('dpa_s4_item2')}</li>
              <li>{t('dpa_s4_item3')}</li>
              <li>{t('dpa_s4_item4')}</li>
              <li>{t('dpa_s4_item5')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s5_title')}</h2>
            <p>{t('dpa_s5_body')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s6_title')}</h2>
            <p className="mb-2">{t('dpa_s6_intro')}</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>{t('dpa_s6_item1')}</li>
              <li>{t('dpa_s6_item2')}</li>
              <li>{t('dpa_s6_item3')}</li>
              <li>{t('dpa_s6_item4')}</li>
              <li>{t('dpa_s6_item5')}</li>
              <li>{t('dpa_s6_item6')}</li>
              <li>{t('dpa_s6_item7')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s7_title')}</h2>
            <p>{t('dpa_s7_body')}</p>
            <p className="mt-2"><Link to="/sub-processors" className="text-blue-400 hover:text-blue-300">{t('dpa_s7_link')}</Link></p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s8_title')}</h2>
            <p>{t('dpa_s8_body')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s9_title')}</h2>
            <p>{t('dpa_s9_body')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s10_title')}</h2>
            <p>{t('dpa_s10_body')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s11_title')}</h2>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>{t('dpa_s11_item1')}</li>
              <li>{t('dpa_s11_item2')}</li>
              <li>{t('dpa_s11_item3')}</li>
              <li>{t('dpa_s11_item4')}</li>
              <li>{t('dpa_s11_item5')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s12_title')}</h2>
            <p>{t('dpa_s12_body')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s13_title')}</h2>
            <p>{t('dpa_s13_body')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('dpa_s14_title')}</h2>
            <p>{t('dpa_s14_body')}</p>
          </section>

          <section className="bg-slate-900/60 border border-slate-700 rounded-xl p-5">
            <h2 className="text-base font-semibold text-white mb-2">{t('dpa_contact_title')}</h2>
            <p className="text-slate-400">{t('dpa_contact_body')}</p>
            <p className="mt-2"><a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a></p>
            <p className="mt-1 text-xs text-slate-500">{t('dpa_response_time')}</p>
          </section>

          <div className="pt-8 border-t border-slate-800 text-xs text-slate-500 flex flex-wrap gap-4">
            <Link to="/privacy" className="text-blue-400 hover:text-blue-300">{t('dpa_footer_privacy')}</Link>
            <Link to="/sub-processors" className="text-blue-400 hover:text-blue-300">{t('dpa_footer_subproc')}</Link>
            <Link to="/legal" className="text-blue-400 hover:text-blue-300">{t('dpa_footer_legal')}</Link>
            <Link to="/terms" className="text-blue-400 hover:text-blue-300">{t('dpa_footer_terms')}</Link>
            <span className="ml-auto">{t('dpa_footer_updated')}: May 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-PROCESSORS PAGE
// ============================================================================
export function SubProcessorsPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const navigate = useNavigate();

  const processors = [
    { name: 'Google Firebase', purpose: t('subproc_firebase_purpose'), location: 'EU (Belgique / Belgium)', link: 'https://firebase.google.com/support/privacy', transfer: t('subproc_firebase_transfer') },
    { name: 'Google Cloud Platform', purpose: t('subproc_gcp_purpose'), location: 'EU', link: 'https://cloud.google.com/privacy', transfer: t('subproc_gcp_transfer') },
    { name: 'Stripe', purpose: t('subproc_stripe_purpose'), location: 'EU (Irlande / Ireland)', link: 'https://stripe.com/privacy', transfer: t('subproc_stripe_transfer') },
    { name: 'Anthropic (Claude AI)', purpose: t('subproc_anthropic_purpose'), location: 'USA', link: 'https://www.anthropic.com/privacy', transfer: t('subproc_anthropic_transfer') },
    { name: 'OVHcloud', purpose: t('subproc_ovh_purpose'), location: 'EU (France)', link: 'https://www.ovhcloud.com/fr/personal-data-protection/', transfer: t('subproc_ovh_transfer') },
    { name: 'Google Analytics', purpose: t('subproc_ga_purpose'), location: 'EU', link: 'https://support.google.com/analytics/answer/6004245', transfer: t('subproc_ga_transfer') },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-white flex items-center gap-1">← {t('back')}</button>
          <LangSelectorCompact />
        </div>
        <h1 className="text-3xl font-bold mb-2">{t('subproc_title')}</h1>
        <p className="text-slate-400 text-sm mb-2">{t('subproc_last_updated')}: May 2026</p>
        <p className="text-slate-400 text-sm mb-10">{t('subproc_intro')}</p>

        <div className="space-y-4">
          {processors.map((p, i) => (
            <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-semibold text-white text-base">{p.name}</h3>
                  <p className="text-slate-400 text-sm mt-1">{p.purpose}</p>
                </div>
                <div className="text-right text-xs text-slate-500 min-w-[140px]">
                  <div className="font-medium text-slate-300">📍 {p.location}</div>
                  <div className="mt-1">{p.transfer}</div>
                </div>
              </div>
              <div className="mt-3">
                <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">
                  {t('subproc_privacy_policy_link')}
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-2">{t('subproc_change_notif_title')}</h2>
          <p className="text-slate-400 text-sm">{t('subproc_change_notif_body')}</p>
          <p className="text-sm mt-3">{t('subproc_questions')} <a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a></p>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-800 text-xs text-slate-500 flex flex-wrap gap-4">
          <Link to="/dpa" className="text-blue-400 hover:text-blue-300">{t('subproc_dpa_link')}</Link>
          <Link to="/privacy" className="text-blue-400 hover:text-blue-300">{t('subproc_privacy_link')}</Link>
          <Link to="/legal" className="text-blue-400 hover:text-blue-300">{t('subproc_legal_link')}</Link>
        </div>
      </div>
    </div>
  );
}

export function LegalMentionsPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-white flex items-center gap-1">
            ← {t('back')}
          </button>
          <LangSelectorCompact />
        </div>
        <h1 className="text-3xl font-bold mb-8">{t('legal_title')}</h1>

        <div className="space-y-8 text-sm text-slate-300 leading-relaxed">
          {/* SECTION 1 — Éditeur (LCEN Art. 6 III — REQUIRED) */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_publisher_title')}</h2>
            <p><strong>Stacklens</strong></p>
            <p>{t('legal_published_by')}: Roland Dzoagbe</p>
            <p>{t('legal_status')}: {t('legal_status_value')}</p>
            <p>SIRET : 10483872700014</p>
            <p>Email : <a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a></p>
            <p>{t('legal_phone')}: 09 53 26 97 91</p>
            <p>{t('legal_address')}: Paris, France</p>
          </section>

          {/* SECTION 2 — Directeur de publication */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_publication_director_title')}</h2>
            <p>Roland Dzoagbe</p>
            <p>Email : <a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a></p>
          </section>

          {/* SECTION 3 — Hébergement */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_hosting_title')}</h2>
            <p><strong>Google Firebase / Google Cloud Platform</strong></p>
            <p>Google Ireland Limited</p>
            <p>Gordon House, Barrow Street, Dublin 4, Ireland</p>
            <p>Tél. : +353 1 543 1000</p>
            <p>{t('legal_website')}: <a href="https://firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">firebase.google.com</a></p>
          </section>

          {/* SECTION 4 — Domaine */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_domain_title')}</h2>
            <p><strong>stacklens.fr</strong></p>
            <p>Registrar : OVHcloud</p>
            <p>OVH SAS, 2 rue Kellermann, 59100 Roubaix, France</p>
            <p>Tél. : +33 9 72 10 10 07</p>
          </section>

          {/* SECTION 5 — Paiements */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_payment_title')}</h2>
            <p><strong>Stripe</strong></p>
            <p>Stripe Payments Europe, Limited</p>
            <p>1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Ireland</p>
            <p>{t('legal_website')}: <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">stripe.com</a></p>
          </section>

          {/* SECTION 6 — IA (EU AI Act transparency) */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_ai_title')}</h2>
            <p>{t('legal_ai_body')}</p>
            <p className="mt-2">{t('legal_ai_provider')}: Anthropic, PBC — 548 Market St, San Francisco, CA 94104, USA</p>
          </section>

          {/* SECTION 7 — Propriété intellectuelle */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_ip_title')}</h2>
            <p>{t('legal_ip_body')}</p>
          </section>

          {/* SECTION 8 — RGPD / CNIL */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_gdpr_title')}</h2>
            <p>{t('legal_gdpr_body')}</p>
            <p className="mt-2">{t('legal_exercise_rights')}: <a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a></p>
            <p className="mt-1">{t('legal_cnil_complaint')}</p>
            <p className="mt-1">{t('legal_see_our')} <Link to="/privacy" className="text-blue-400 hover:text-blue-300">{t('legal_privacy_link')}</Link> {t('legal_and_our')} <Link to="/dpa" className="text-blue-400 hover:text-blue-300">{t('legal_dpa_link')}</Link></p>
          </section>

          {/* SECTION 9 — Cookies */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_cookies_title')}</h2>
            <p>{t('legal_cookies_body')}</p>
          </section>

          {/* SECTION 10 — Droit applicable */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">{t('legal_law_title')}</h2>
            <p>{t('legal_law_body')}</p>
          </section>

          <div className="pt-8 border-t border-slate-800 text-xs text-slate-500">
            <p>{t('legal_last_updated')}: May 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================

export function AboutPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <nav className="border-b border-white/5 bg-slate-950/50 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-4 cursor-pointer">
            <RDLogo size="md" />
            <div className="text-2xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Stacklens</div>
          </Link>
          <div className="flex items-center gap-4">
            <LangSelectorCompact />
            <Link to="/" className="text-slate-300 hover:text-white transition-colors">← Back to Home</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-20">
        {/* Hero */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 mb-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">{t('about_our_mission')}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            SaaS control, <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">for everyone else.</span>
          </h1>
          <p className="text-xl text-slate-400 leading-relaxed">
            Enterprise-grade SaaS management, built for small and mid-sized European companies that can&apos;t justify €30,000 a year for software visibility.
          </p>
        </div>

        {/* The problem */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-4">{t('about_the_problem')}</h2>
          <div className="space-y-4 text-slate-300 leading-relaxed">
            <p>
              The average 100-person company now pays for more than 80 SaaS tools. Licences get forgotten. Employees leave and retain their access. Contracts auto-renew at inflated prices. For most organisations, nobody owns the full picture — and the cost of that ambiguity is material.
            </p>
            <p>
              The tools that solve this problem at enterprise scale — Zylo, Torii, Lumos — are excellent. They also charge between €30,000 and €50,000 per year and require dedicated procurement teams to operate. That leaves every company under 500 employees with two options: pay for chaos, or hire someone to chase it full-time.
            </p>
          </div>
        </section>

        {/* The solution */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-4">{t('about_our_approach')}</h2>
          <div className="space-y-4 text-slate-300 leading-relaxed">
            <p>
              Stacklens is the third option. We deliver the core 80% of enterprise SaaS management — visibility, waste detection, renewal alerts, contract analysis — engineered specifically for small and mid-sized European organisations.
            </p>
            <p>
              Transparent pricing from €29 per month. Hosted in the EU. GDPR-native. No annual commitments. No sales calls. One clear mission: give every SMB the SaaS control that used to be reserved for the Fortune 500.
            </p>
          </div>
        </section>

        {/* Principles */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-6">{t('about_what_we_stand_for')}</h2>
          <div className="grid gap-4">
            {[
              { title: 'Transparent pricing', body: 'Public plans, no "contact sales" tier. You see the price before you sign up — including at enterprise level.' },
              { title: 'European by design', body: 'Hosted in the EU. GDPR-native from day one. Built for the regulatory and linguistic context of European SMBs.' },
              { title: 'Focused scope', body: 'We deliver the 80% of SaaS management that matters most. We do not try to be an HR suite, an IT ticketing system, or a SCIM/PAM platform.' },
              { title: 'Accessible support', body: 'Direct communication with the team that builds the product. No tier-one queues, no 48-hour SLAs.' },
            ].map((p, i) => (
              <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                <div className="text-base font-semibold text-white mb-1">{p.title}</div>
                <div className="text-sm text-slate-400 leading-relaxed">{p.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact / CTA */}
        <section className="mb-14 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">{t('about_start_in_minutes')}</h2>
          <p className="text-slate-400 mb-6 max-w-xl mx-auto">
            Free plan includes up to 10 tools and 25 employees. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/" className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold text-white transition-all">
              Get started free
            </Link>
            <a href="mailto:hello@stacklens.fr" className="px-6 py-3 border border-slate-700 hover:border-slate-600 rounded-xl text-sm font-semibold text-slate-300 transition-all">
              Contact us
            </a>
          </div>
        </section>

        <div className="text-center text-xs text-slate-600">
          Stacklens · Built in France · Hosted in the EU · © 2026
        </div>
      </div>
    </div>
  );
}

export function PrivacyPage() {
  const navigate = useNavigate();
  const { language } = useLang();
  const t = useTranslation(language);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <nav className="border-b border-white/5 bg-slate-950/50 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div onClick={() => window.location.href = "/"} className="flex items-center gap-4 cursor-pointer">
            <RDLogo size="md" />
            <div className="text-2xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Stacklens</div>
          </div>
          <div className="flex items-center gap-4">
            <LangSelectorCompact />
            <button onClick={() => navigate(-1)} className="text-slate-300 hover:text-white transition-colors">← {t('back')}</button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-3xl md:text-5xl font-black mb-4 text-white">{t('privacy_title')}</h1>
        <p className="text-slate-400 mb-12">{t('privacy_last_updated')}: April 17, 2026</p>

        <div className="space-y-10 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s1_title')}</h2>
            <p>{t('privacy_s1_body')}</p>
            <p className="mt-2"><strong>Stacklens</strong> — Roland Dzoagbe<br/>Paris, France<br/>Email: <a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a></p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s2_title')}</h2>
            <p className="mb-3">{t('privacy_s2_intro')}</p>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="font-semibold text-white mb-1">{t('privacy_s2_account_title')}</div>
                <p>{t('privacy_s2_account_body')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('privacy_s2_account_legal')}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="font-semibold text-white mb-1">{t('privacy_s2_saas_title')}</div>
                <p>{t('privacy_s2_saas_body')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('privacy_s2_saas_legal')}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="font-semibold text-white mb-1">{t('privacy_s2_payment_title')}</div>
                <p>{t('privacy_s2_payment_body')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('privacy_s2_payment_legal')}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="font-semibold text-white mb-1">{t('privacy_s2_analytics_title')}</div>
                <p>{t('privacy_s2_analytics_body')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('privacy_s2_analytics_legal')}</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s3_title')}</h2>
            <p className="mb-3">{t('privacy_s3_intro')}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-700 text-slate-400">
                  <th className="text-left py-2 pr-4">{t('privacy_s3_col_service')}</th>
                  <th className="text-left py-2 pr-4">{t('privacy_s3_col_purpose')}</th>
                  <th className="text-left py-2">{t('privacy_s3_col_location')}</th>
                </tr></thead>
                <tbody className="text-slate-300">
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">Firebase (Google)</td><td className="py-2 pr-4">{t('privacy_s3_firebase_purpose')}</td><td className="py-2">EU (Belgium)</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">Stripe</td><td className="py-2 pr-4">{t('privacy_s3_stripe_purpose')}</td><td className="py-2">EU (Ireland)</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">Anthropic (Claude AI)</td><td className="py-2 pr-4">{t('privacy_s3_anthropic_purpose')}</td><td className="py-2">USA</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">Google Analytics</td><td className="py-2 pr-4">{t('privacy_s3_ga_purpose')}</td><td className="py-2">EU</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">OVHcloud</td><td className="py-2 pr-4">{t('privacy_s3_ovh_purpose')}</td><td className="py-2">EU (France)</td></tr>
                  <tr><td className="py-2 pr-4">Web3Forms</td><td className="py-2 pr-4">{t('privacy_s3_web3forms_purpose')}</td><td className="py-2">USA</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s4_title')}</h2>
            <p>{t('privacy_s4_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s5_title')}</h2>
            <p>{t('privacy_s5_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s6_title')}</h2>
            <p className="mb-3">{t('privacy_s6_intro')}</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>{t('privacy_s6_right1')}</li>
              <li>{t('privacy_s6_right2')}</li>
              <li>{t('privacy_s6_right3')}</li>
              <li>{t('privacy_s6_right4')}</li>
              <li>{t('privacy_s6_right5')}</li>
              <li>{t('privacy_s6_right6')}</li>
            </ul>
            <p className="mt-3">{t('privacy_s6_exercise')} <a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a></p>
            <p className="mt-2">{t('privacy_s6_cnil')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s7_title')}</h2>
            <p>{t('privacy_s7_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s8_title')}</h2>
            <p>{t('privacy_s8_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s9_title')}</h2>
            <p>{t('privacy_s9_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('privacy_s10_title')}</h2>
            <p>{t('privacy_s10_body')}</p>
            <p className="mt-2"><a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a></p>
            <p className="mt-1"><Link to="/contact" className="text-blue-400 hover:text-blue-300">{t('privacy_contact_form')}</Link></p>
          </section>
        </div>
      </div>
    </div>
  );
}

export function TermsPage() {
  const navigate = useNavigate();
  const { language } = useLang();
  const t = useTranslation(language);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <nav className="border-b border-white/5 bg-slate-950/50 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div onClick={() => window.location.href = "/"} className="flex items-center gap-4 cursor-pointer">
            <RDLogo size="md" />
            <div className="text-2xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Stacklens</div>
          </div>
          <div className="flex items-center gap-4">
            <LangSelectorCompact />
            <button onClick={() => navigate(-1)} className="text-slate-300 hover:text-white transition-colors">← {t('back')}</button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-3xl md:text-5xl font-black mb-4 text-white">{t('terms_title')}</h1>
        <p className="text-slate-400 mb-12">{t('terms_last_updated')}: April 17, 2026</p>

        <div className="space-y-10 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s1_title')}</h2>
            <p>{t('terms_s1_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s2_title')}</h2>
            <p className="mb-3">{t('terms_s2_intro')}</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>{t('terms_s2_item1')}</li>
              <li>{t('terms_s2_item2')}</li>
              <li>{t('terms_s2_item3')}</li>
              <li>{t('terms_s2_item4')}</li>
              <li>{t('terms_s2_item5')}</li>
            </ul>
            <p className="mt-3">{t('terms_s2_reserve')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s3_title')}</h2>
            <p>{t('terms_s3_intro')}</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>{t('terms_s3_item1')}</li>
              <li>{t('terms_s3_item2')}</li>
              <li>{t('terms_s3_item3')}</li>
              <li>{t('terms_s3_item4')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s4_title')}</h2>
            <p className="mb-3">{t('terms_s4_intro')}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-700 text-slate-400">
                  <th className="text-left py-2 pr-4">Plan</th>
                  <th className="text-left py-2 pr-4">{t('terms_s4_col_price')}</th>
                  <th className="text-left py-2">{t('terms_s4_col_limits')}</th>
                </tr></thead>
                <tbody className="text-slate-300">
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">Free</td><td className="py-2 pr-4">€0</td><td className="py-2">10 {t('terms_s4_tools')}, 25 {t('terms_s4_employees')}</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">Starter</td><td className="py-2 pr-4">€29/{t('terms_s4_month')}</td><td className="py-2">100 {t('terms_s4_tools')}, 250 {t('terms_s4_employees')}</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2 pr-4">Pro</td><td className="py-2 pr-4">€79/{t('terms_s4_month')}</td><td className="py-2">500 {t('terms_s4_tools')}, 1500 {t('terms_s4_employees')}</td></tr>
                  <tr><td className="py-2 pr-4">Enterprise</td><td className="py-2 pr-4">€299/{t('terms_s4_month')}</td><td className="py-2">{t('terms_s4_unlimited')}</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">{t('terms_s4_pricing_note')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s5_title')}</h2>
            <p className="mb-2">{t('terms_s5_billing')}</p>
            <p className="mb-2 font-semibold text-white">{t('terms_s5_autorenew')}</p>
            <p className="mb-4">{t('terms_s5_cancel')}</p>
            {/* One-click cancellation — mandatory from June 19, 2026 (ordonnance n° 2026-2) */}
            <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-5">
              <p className="text-sm font-semibold text-white mb-1">{t('terms_s5_cancel_title')}</p>
              <p className="text-xs text-slate-400 mb-3">{t('terms_s5_cancel_law')}</p>
              <Link to="/app/settings?tab=billing" className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-400 text-sm font-medium rounded-lg transition-colors">
                🔴 {t('terms_s5_cancel_btn')}
              </Link>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s6_title')}</h2>
            <p>{t('terms_s6_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s7_title')}</h2>
            <p>{t('terms_s7_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s8_title')}</h2>
            <p>{t('terms_s8_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s9_title')}</h2>
            <p>{t('terms_s9_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s10_title')}</h2>
            <p>{t('terms_s10_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s11_title')}</h2>
            <p>{t('terms_s11_body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-white">{t('terms_s12_title')}</h2>
            <p>{t('terms_s12_body')}</p>
            <p className="mt-2"><a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:text-blue-300">hello@stacklens.fr</a></p>
            <p className="mt-1"><Link to="/contact" className="text-blue-400 hover:text-blue-300">{t('terms_contact_form')}</Link></p>
          </section>
        </div>
      </div>
    </div>
  );
}

export function SecurityPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-white/5 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div onClick={() => window.location.href = "/"} className="flex items-center gap-3 cursor-pointer">
            <RDLogo size="sm" />
            <span className="text-lg font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Stacklens</span>
          </div>
          <div className="flex items-center gap-4">
            <LangSelectorCompact />
            <button onClick={() => window.history.back()} className="text-sm text-slate-400 hover:text-white transition-colors">← Back</button>
          </div>
        </div>
      </nav>
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 mb-6">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">{t('security_trust_centre')}</span>
          </div>
          <h1 className="text-2xl md:text-5xl font-black mb-4 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">{t("hc_your_data_is_safe_with_us")}</h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">Enterprise-grade security and compliance — built in from day one, not bolted on later.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {[
            { icon: "🛡️", label: "SOC 2 Type II", sub: "Annually audited" },
            { icon: "🇪🇺", label: "GDPR", sub: "EU data residency" },
            { icon: "🔐", label: "ISO 27001", sub: "Framework aligned" },
            { icon: "🏥", label: "HIPAA", sub: "Ready on request" },
          ].map(b => (
            <div key={b.label} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center hover:border-emerald-500/40 transition-all">
              <div className="text-4xl mb-2">{b.icon}</div>
              <div className="font-bold text-white text-sm">{b.label}</div>
              <div className="text-xs text-emerald-400 mt-1">{b.sub}</div>
            </div>
          ))}
        </div>

        <div className="space-y-5 mb-16">
          {[
            { icon: "🔒", title: "End-to-End Encryption", body: "All data encrypted in transit using TLS 1.3 and at rest using AES-256. Your SaaS inventory, employee records, and access data are never stored in plaintext. Encryption keys are rotated quarterly." },
            { icon: "🏗️", title: "Infrastructure & Hosting", body: "Stacklens runs on Google Cloud Platform (Firebase/GCP), hosted in the EU (europe-west1) by default. We use isolated, per-organisation Firestore databases. No data is ever co-mingled between customers." },
            { icon: "👤", title: "Data Access Controls", body: "Only you and users you explicitly invite can access your workspace. Stacklens staff have zero access to your data by default. Any internal access requires approval, is time-limited, and fully audit-logged." },
            { icon: "🔑", title: "Authentication & SSO", body: "We support Google OAuth 2.0, Magic Link (passwordless), and SAML 2.0 for enterprise plans. Multi-factor authentication (MFA) is available on all plans and can be enforced organisation-wide by admins." },
            { icon: "📋", title: "Tamper-Proof Audit Logs", body: "Every action in Stacklens — logins, access grants, revocations, data exports — is logged with timestamp, user identity, and IP. Logs are immutable and retained for 12 months (Enterprise: 7 years)." },
            { icon: "🗑️", title: "Data Portability & Deletion", body: "You own your data. Export everything in CSV or JSON at any time from Settings. When you cancel, all your data is permanently deleted within 30 days. We do not sell or share your data with any third party." },
            { icon: "🔍", title: "Vulnerability Disclosure", body: "We take every security report seriously. If you discover a vulnerability, email hello@stacklens.fr with details. We aim to respond within 48 hours and acknowledge responsible disclosure." },
            { icon: "📡", title: "Uptime & Reliability", body: "Stacklens runs on Google Firebase infrastructure with automatic scaling and redundancy. We target 99.5% uptime. For any service issues, contact hello@stacklens.fr." },
          ].map(item => (
            <div key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 hover:border-slate-700 transition-all">
              <div className="flex items-start gap-4">
                <div className="text-3xl flex-shrink-0 mt-0.5">{item.icon}</div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{item.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-8 mb-8 text-center">
          <h3 className="text-xl font-bold text-white mb-2">{t('found_security_issue')}</h3>
          <p className="text-slate-400 mb-4 max-w-lg mx-auto">We take every security report seriously. We aim to respond within 48 hours. Responsible disclosure is always acknowledged.</p>
          <a href="mailto:hello@stacklens.fr" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-colors text-white">
            <Lock className="w-4 h-4" />
            hello@stacklens.fr
          </a>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <h3 className="text-xl font-bold text-white mb-2">{t("hc_download_security_whitepaper")}</h3>
          <p className="text-slate-400 mb-4">{t('security_full_docs')}</p>
          <a
            href="mailto:hello@stacklens.fr?subject=Security%20Documentation%20Request&body=Hi%2C%0A%0AI%20would%20like%20to%20receive%20the%20Stacklens%20security%20documentation.%0A%0ACompany%3A%20%0AUse%20case%3A%20"
            className="inline-flex items-center gap-2 px-6 py-3 border border-white/20 hover:border-white/40 rounded-xl font-semibold text-white transition-colors"
          >
            <Download className="w-4 h-4" />
            Request Security Documentation
          </a>
        </div>

        <div className="mt-10 text-center text-xs text-slate-600">
          Last updated: May 2026 · Questions? <a href="mailto:hello@stacklens.fr" className="text-blue-400 hover:underline">hello@stacklens.fr</a>
        </div>
      </div>
    </div>
  );
}
