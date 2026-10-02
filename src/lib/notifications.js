// ── Settings → Notifications ───────────────────────────────────────────────
//
// Each switch here changes something. Six used to change nothing: "New tool
// detected", "Orphaned tool", "High-risk access", "Offboarding initiated",
// "Compliance" and "Invoice" were saved to a localStorage key that no code
// and no email ever read. They are gone until something sends them.
//
// What is left maps onto the emails dailyAlerts and weeklySummary send
// (functions/index.js), through the db.user field each one checks:
//   renewal   → renewal_alerts   renewals at 30 and 7 days
//   budget    → budget_alerts    department budgets at 80 % and 100 % (and the
//                                in-app banner when spend passes the cap)
//   access    → access_alerts    former employees whose access is still active
//   weekly    → weekly_summary   the weekly summary
// notifications.test.jsx holds this list, the page and the server to each other.
export const NOTIFICATION_SWITCHES = [
  { key: 'renewal', field: 'renewal_alerts', label: 'notif_renewal',  sub: 'notif_renewal_sub' },
  { key: 'budget',  field: 'budget_alerts',  label: 'budget_limit',   sub: 'notif_budget_sub' },
  { key: 'access',  field: 'access_alerts',  label: 'notif_access',   sub: 'notif_access_sub' },
  { key: 'weekly',  field: 'weekly_summary', label: 'notif_weekly',   sub: 'notif_weekly_sub' },
];
