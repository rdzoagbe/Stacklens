import { PublicClientApplication } from '@azure/msal-browser';

// Minimal MSAL init for popup redirect page.
// MSAL v5 requires handleRedirectPromise() in the popup so it can broadcast
// the auth code back to the parent via BroadcastChannel, then the parent
// closes the popup. If anything here fails the popup must still close so the
// parent receives popup_closed (handled gracefully) instead of timing out.

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;

if (!clientId) {
  // No client ID baked into this build — cannot process the auth response.
  // Close the popup immediately so the parent gets popup_closed rather than
  // a timed_out error that would leave the popup window hanging.
  window.close();
} else {
  const msalInstance = new PublicClientApplication({
    auth: {
      clientId,
      authority: 'https://login.microsoftonline.com/organizations',
      redirectUri: window.location.origin + '/auth-redirect.html',
    },
  });

  msalInstance.initialize()
    .then(() => msalInstance.handleRedirectPromise())
    .catch(console.error)
    .finally(() => {
      // Ensure the popup closes even if handleRedirectPromise() throws.
      // MSAL normally closes the popup from the parent side after receiving
      // the BroadcastChannel message, but this is a safety net.
      window.close();
    });
}
