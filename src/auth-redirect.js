import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';

// MSAL v5 redirect-bridge: parses the auth response from the URL, broadcasts
// it to the parent window via BroadcastChannel, then calls window.close().
// For the full-page redirect flow it navigates to the origin URL instead.
// No clientId or PCA initialisation required.
broadcastResponseToMainFrame().catch((err) => {
  // No auth response in the URL (e.g. direct navigation) or parse error.
  // Close the popup so the parent receives popup_closed rather than timing out.
  console.error('MSAL redirect bridge error:', err);
  window.close();
});
