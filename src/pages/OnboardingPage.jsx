import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { loadUserData, saveUserData } from '../firebase-config';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { RDLogo } from '../components/ui';

async function getUserProfile(uid) {
  const data = await loadUserData(uid);
  return { user: data?.user || null, error: null };
}

async function completeOnboarding(uid, profileData) {
  try {
    const db = await loadUserData(uid) || { tools: [], employees: [], access: [], user: {} };
    db.user = { ...db.user, ...profileData, onboardingCompleted: true };
    await saveUserData(uid, db);
    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, firebaseUser } = useAuth();
  const { language } = useLang();
  const t = useTranslation(language);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    workEmail: firebaseUser?.email || '',
    fullName: firebaseUser?.displayName || '',
    companyName: '',
    jobTitle: '',
    companySize: '',
    numTools: 50
  });

  // If no user, redirect to home
  useEffect(() => {
    if (!firebaseUser) {
      navigate('/', { replace: true });
    }
  }, [firebaseUser, navigate]);

  // Check if user already completed onboarding (localStorage is instant, no Firestore race)
  useEffect(() => {
    if (firebaseUser) {
      const onboardingKey = 'sg_onboarded_' + firebaseUser.uid;
      if (localStorage.getItem(onboardingKey) === 'true') {
        navigate('/dashboard', { replace: true });
        return;
      }
      // Fallback: also check Firestore in case they signed in on another device
      getUserProfile(firebaseUser.uid).then(({ user: userData }) => {
        if (userData?.onboardingCompleted) {
          localStorage.setItem(onboardingKey, 'true');
          navigate('/dashboard', { replace: true });
        }
      });
    }
  }, [firebaseUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Save onboarding data to Firestore
      const { success, error } = await completeOnboarding(firebaseUser.uid, {
        ...formData,
        onboardingCompleted: true,
        onboardingDate: new Date().toISOString()
      });

      if (success) {
        // Mark onboarding done in localStorage so redirect handler works instantly next time
        localStorage.setItem('sg_onboarded_' + firebaseUser.uid, 'true');
        navigate('/dashboard', { replace: true });
      } else {
        // Firestore save failed — still let them in, flag locally
        localStorage.setItem('sg_onboarded_' + firebaseUser.uid, 'true');
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      console.error('Onboarding error:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <RDLogo size="lg" onClick={() => window.location.href = "/dashboard"} />
            <div className="text-xl md:text-3xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Stacklens
            </div>
          </div>
          <h1 className="text-2xl md:text-4xl font-black text-white mb-3">{t('tell_us_about_yourself')}</h1>
          <p className="text-xl text-slate-400">{t('personalize_experience')}</p>
        </div>

        {/* Onboarding Form */}
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-8 md:p-12">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Work Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">
                Work Email
              </label>
              <input
                type="email"
                value={formData.workEmail}
                onChange={(e) => setFormData({ ...formData, workEmail: e.target.value })}
                className="w-full px-6 py-4 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-lg focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="you@company.com"
                required
                disabled
              />
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">
                Full Name
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-6 py-4 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-lg focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="John Doe"
                required
              />
            </div>

            {/* Company Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">
                Company Name
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-6 py-4 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-lg focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="Acme Corporation"
                required
              />
            </div>

            {/* Job Title */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">
                Job Title
              </label>
              <select
                value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                className="w-full px-6 py-4 bg-slate-950 border border-slate-700 rounded-xl text-white text-lg focus:border-blue-500 focus:outline-none transition-colors"
                required
              >
                <option value="">{t('select_role')}</option>
                <option value="CTO">CTO</option>
                <option value="VP of IT">{t("hc_vp_of_it")}</option>
                <option value="IT Manager">{t("hc_it_manager")}</option>
                <option value="IT Director">{t("hc_it_director")}</option>
                <option value="CEO">CEO</option>
                <option value="CFO">CFO</option>
                <option value="Operations Manager">{t("hc_operations_manager")}</option>
                <option value="Security Manager">{t("hc_security_manager")}</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Company Size */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">
                Company Size
              </label>
              <select
                value={formData.companySize}
                onChange={(e) => setFormData({ ...formData, companySize: e.target.value })}
                className="w-full px-6 py-4 bg-slate-950 border border-slate-700 rounded-xl text-white text-lg focus:border-blue-500 focus:outline-none transition-colors"
                required
              >
                <option value="">{t('select_company_size')}</option>
                <option value="1-50">1-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="201-500">201-500 employees</option>
                <option value="501-1000">501-1,000 employees</option>
                <option value="1000+">1,000+ employees</option>
              </select>
            </div>

            {/* Number of SaaS Tools */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">
                Estimated Number of SaaS Tools
              </label>
              <input
                type="range"
                min="5"
                max="200"
                value={formData.numTools}
                onChange={(e) => setFormData({ ...formData, numTools: parseInt(e.target.value) })}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="mt-3 text-center text-2xl font-bold text-white">{formData.numTools} tools</div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full px-8 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl text-white font-bold text-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  Setting up your workspace...
                </>
              ) : (
                <>
                  Continue to Dashboard
                  <ChevronRight className="w-6 h-6" />
                </>
              )}
            </button>

            {/* Terms */}
            <p className="text-center text-sm text-slate-500 mt-6">
              By continuing, you agree to our{' '}
              <Link to="/terms" className="text-blue-400 hover:underline">{t("hc_terms_of_service")}</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-blue-400 hover:underline">{t("hc_privacy_policy")}</Link>
            </p>
          </form>
        </div>

        {/* Skip Option (for demo) */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            Skip for now →
          </button>
        </div>
      </div>
    </div>
  );
}
