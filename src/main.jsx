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
