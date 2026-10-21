// Google Consent Mode v2 (CNIL / GDPR). Loaded by index.html as a plain,
// blocking <script src>, so it still runs before anything else, exactly as
// it did inline. It is a file rather than an inline script so that the
// Content-Security-Policy can refuse every inline script: a script an
// attacker injected into a page could otherwise run. src/lib/csp.test.js
// holds that, and src/lib/claims.test.js executes THIS file to keep the
// consent promises (analytics only, nothing for advertising) true.
//
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;

// The only two consent states this site ever sets. Defined once so no
// path can grant something the banner never asked for.
window.DENIED_CONSENT = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied'
};
window.ANALYTICS_CONSENT = {
  analytics_storage: 'granted',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied'
};

// Default: all 4 Consent Mode v2 parameters denied until user acts
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  wait_for_update: 500
});

// Consent version — bump this when cookie categories change to re-ask users.
// Not bumped for the 2026-09 change: visitors consented to analytics, and
// analytics is now exactly what they get. Narrowing needs no re-ask.
window.CONSENT_VERSION = 'v2-2026-04';

// A stored "accepted" counts only if it is for the current version and
// under 13 months old, the CNIL ceiling for a consent's lifetime. Exposed
// so src/firebase-config.js applies the same test instead of its own.
window.hasStoredAnalyticsConsent = function() {
  try {
    var raw = localStorage.getItem('cookie_consent_v2');
    if (!raw) return false;
    var stored = JSON.parse(raw);
    if (!stored || stored.choice !== 'accepted') return false;
    if (stored.version !== window.CONSENT_VERSION) return false;
    var THIRTEEN_MONTHS_MS = 13 * 30 * 24 * 60 * 60 * 1000;
    if (!(Date.now() - stored.timestamp <= THIRTEEN_MONTHS_MS)) return false;
    return true;
  } catch (e) { return false; /* corrupted storage — banner will re-ask */ }
};

// Returning visitor who already accepted: apply it before anything loads.
if (window.hasStoredAnalyticsConsent()) {
  gtag('consent', 'update', window.ANALYTICS_CONSENT);
  loadGtagScript();
}

function loadGtagScript() {
  if (window.__gtag_loaded) return;
  window.__gtag_loaded = true;
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-MDRVRX854L';
  document.head.appendChild(s);
  gtag('js', new Date());
  // Belt and braces: the denied ad_* consent is the actual guarantee,
  // and these switch off Google signals and ad personalisation for this
  // measurement ID regardless of how the GA4 property is configured.
  gtag('config', 'G-MDRVRX854L', {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
}

// Called from React when user clicks Accept
window.enableAnalytics = function() {
  gtag('consent', 'update', window.ANALYTICS_CONSENT);
  loadGtagScript();
  // Propagate to Firebase Analytics SDK if initialised
  if (window.__firebaseAnalyticsSetConsent) {
    window.__firebaseAnalyticsSetConsent(window.ANALYTICS_CONSENT);
  }
};

// Called from React when user clicks Reject
window.disableAnalytics = function() {
  gtag('consent', 'update', window.DENIED_CONSENT);
  if (window.__firebaseAnalyticsSetConsent) {
    window.__firebaseAnalyticsSetConsent(window.DENIED_CONSENT);
  }
};

