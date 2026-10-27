// ── After a sign-in: a full load of /dashboard ─────────────────────────────
//
// Not a router navigate: useAuth's onAuthChange loads the account's
// workspace from Firestore on a fresh page, and the dashboard must not
// render the landing page's in-memory state first. Google (useAuth.login) and
// Microsoft (TrialPage) both end here. Its own module so a test can see the
// call; jsdom does not let window.location.replace be replaced.
export function goToDashboard() {
  window.location.replace('/dashboard');
}
