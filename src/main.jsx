import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.jsx'
import './index.css'

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
