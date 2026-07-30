import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { completeMagicLinkSignIn, loadUserData } from '../firebase-config';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';

export function FinishSignUpPage() {
  const { language } = useLang();
  const t = useTranslation(language);
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState('');

  useEffect(() => {
    const completeSignIn = async () => {
      const { user, error } = await completeMagicLinkSignIn(window.location.href);

      if (user) {
        setStatus('success');
        // Check if user completed onboarding
        const loadedData = await loadUserData(user.uid);
        const userData = loadedData?.user || null;
        setTimeout(() => {
          if (userData && userData.onboardingCompleted) {
            navigate('/dashboard', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        }, 2000);
      } else {
        setStatus('error');
        setError(error || 'Sign-in failed');
        console.error('Email link sign-in error:', error);
      }
    };

    completeSignIn();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center text-white">
      <div className="text-center p-8">
        {status === 'processing' && (
          <>
            <div className="text-8xl mb-6 animate-pulse">⏳</div>
            <h1 className="text-4xl font-bold mb-4">{t("signing_in")}</h1>
            <p className="text-slate-400 text-lg">{t("hc_please_wait_a_moment")}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-8xl mb-6 animate-bounce">✅</div>
            <h1 className="text-4xl font-bold mb-4">{t("success")}</h1>
            <p className="text-slate-400 text-lg">{t("hc_welcome_to_accessguard")}</p>
            <p className="text-slate-500 mt-2">{t('redirecting_dashboard')}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-8xl mb-6">❌</div>
            <h1 className="text-4xl font-bold mb-4">{t("signin_failed")}</h1>
            <p className="text-slate-400 text-lg mb-6">
              {error === t('fsu_invalid_link')
                ? t('fsu_expired')
                : t('fsu_generic')}
            </p>
            <button
              onClick={() => window.location.href = "/dashboard"}
              className="px-4 md:px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-lg transition-colors"
            >
              {t('fsu_return_home')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
