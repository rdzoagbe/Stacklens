import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.jsx'
import './index.css'

// After a deploy, lazily-loaded chunk filenames change (content hash), so a tab
// that was already open 404s when it navigates to a lazy route ("Failed to fetch
// dynamically imported module"). Reload once to pick up the fresh index.html +
// asset filenames. The sessionStorage guard prevents an infinite reload loop if
// the chunk is genuinely missing.
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('sg_chunk_reloaded') !== '1') {
    sessionStorage.setItem('sg_chunk_reloaded', '1');
    window.location.reload();
  }
});
window.addEventListener('load', () => sessionStorage.removeItem('sg_chunk_reloaded'));

// Lightweight crash reporting — works with zero external accounts. Uncaught
// errors and promise rejections are POSTed to our own clientErrors function
// (size-capped, deduped, max 5 per session) so crashes on the live site are
// visible without waiting for a user to paste their console. Sentry below
// remains the richer upgrade path once a DSN is configured.
const _errSeen = new Set();
function reportCrash(message, stack) {
  try {
    const key = String(message || '').slice(0, 120);
    if (!key || _errSeen.has(key) || _errSeen.size >= 5) return;
    _errSeen.add(key);
    fetch('https://us-central1-accessguard-v2.cloudfunctions.net/clientErrors', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: String(message).slice(0, 500),
        stack: String(stack || '').slice(0, 1500),
        url: window.location.pathname,
        ua: navigator.userAgent.slice(0, 200),
      }),
    }).catch(() => {});
  } catch { /* reporting must never break the app */ }
}
window.addEventListener('error', (e) => reportCrash(e.message, e.error?.stack));
window.addEventListener('unhandledrejection', (e) =>
  reportCrash(e.reason?.message || String(e.reason || ''), e.reason?.stack));

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  // enabled guard fully disables SDK overhead (integrations, breadcrumbs, etc.)
  // when VITE_SENTRY_DSN is unset — an undefined DSN alone only stops sending
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  // browserTracingIntegration is required for tracesSampleRate to capture spans
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
  environment: import.meta.env.MODE,
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
