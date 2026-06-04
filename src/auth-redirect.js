import { PublicClientApplication } from '@azure/msal-browser';

// Minimal MSAL init for popup redirect page.
// MSAL v5 requires handleRedirectPromise() to run in the popup window
// so it can broadcast the auth code back to the parent via BroadcastChannel.
const msalInstance = new PublicClientApplication({
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || '',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin + '/auth-redirect.html',
  },
});

msalInstance.initialize().then(() => {
  msalInstance.handleRedirectPromise().catch(console.error);
});
