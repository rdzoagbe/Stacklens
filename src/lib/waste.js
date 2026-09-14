// ── One definition of recoverable spend ─────────────────────────────────────
//
// "Potential savings" was computed four different ways on four screens, so a
// single workspace was told four different numbers:
//
//   Finance → Overview     monthlySpend * 0.14
//   Finance → Cost         cost of flagged tools * 0.7
//   Dashboard              monthlySpend * 0.14, labelled "idle licenses"
//   Finance → Executive    cost of tools unused for 90+ days
//
// Three of those are a percentage of total spend, which is not a measurement
// of anything — it produces a savings figure for a workspace with nothing
// wrong with it, and it moves when spend moves rather than when waste does.
//
// This module replaces all four. Recoverable spend is the monthly cost of
// tools that nobody has active access to: the customer is paying and no one
// can log in. That is defensible line by line — a prospect can click through
// to the tools and check — and it is zero when there is nothing to recover.
//
// Tools that cost more than EXPENSIVE_PER_USER per active user are reported
// separately as review candidates. They are a real signal but they are not
// savings: the seats are in use, and whether the price is worth it is the
// customer's call, not ours.

export const EXPENSIVE_PER_USER = 200;

// ── What the customer pays per month ───────────────────────────────────────
//
// "Monthly spend" was computed in five places and three of them disagreed:
//
//   DashboardPage        every tool, no status filter
//   ExecutiveDashboard   every tool, no status filter
//   Finance → Analytics  status === 'active' only
//   weeklySummary email  status !== 'decommissioned'
//   waste.totalSpend     status === 'active' only
//
// On the demo workspace the Dashboard and the Analytics tab already show
// different figures for identical data, because the seed has two `orphaned`
// and two `unused` tools that cost money and Analytics drops them.
//
// The `active`-only readings are the wrong ones, and not by a little: a tool
// nobody owns or nobody opens is still on the card every month. That is the
// entire premise of the product. Excluding those from spend understates the
// bill by exactly the amount Stacklens exists to find.
//
// So spend is every tool that has not been decommissioned. Decommissioned is
// the one status that means the contract is over and the billing has stopped.
// It matches what the weekly summary email has been telling customers all
// along, and it leaves the Dashboard's headline unchanged on any workspace
// with no decommissioned tools — which is all of them today.
//
// Separate from computeWaste().totalSpend, deliberately: that one is the
// denominator of the waste analysis, which is about tools in use, and it is
// not what the customer pays.

/** The one status that means billing has stopped. */
export const NOT_BILLED_STATUS = 'decommissioned';

/**
 * The tools still being billed for.
 *
 * Array.isArray rather than `db?.tools || []`: a workspace blob is
 * client-written and reaches here from localStorage, an import, or another
 * tenant's export. `tools` arriving as a string makes `.filter` throw, and the
 * Dashboard computes spend during render — so one malformed blob would be a
 * blank page rather than a wrong number. The cross-implementation test caught
 * this in the client version while the server version already guarded it.
 */
function billedTools(db) {
  const tools = db && Array.isArray(db.tools) ? db.tools : [];
  return tools.filter(t => t && t.status !== NOT_BILLED_STATUS);
}

/** What this workspace pays per month, across every tool still billing. */
export function monthlySpend(db) {
  return billedTools(db).reduce((sum, t) => sum + (Number(t.cost_per_month) || 0), 0);
}

/** Tools still billing. The count that belongs beside the figure above. */
export function billedToolCount(db) {
  return billedTools(db).length;
}

/**
 * How many people actually hold a live grant on each tool, by tool id.
 *
 * Exported because it answers a question other screens need and must not
 * answer for themselves: "is anybody using this?" is the difference between a
 * subscription you can cancel and one you cannot. The audit report used to
 * call every unowned tool recoverable, which counted a tool twenty people use
 * daily as a saving because nobody had filled in the owner field.
 *
 * Only `active` grants count. A revoked one is somebody who used to have
 * access, which is the opposite of a reason to keep paying.
 */
export function activeGrantsByTool(db) {
  const counts = new Map();
  for (const a of (db?.access || [])) {
    if (a?.status !== 'active') continue;
    counts.set(a.tool_id, (counts.get(a.tool_id) || 0) + 1);
  }
  return counts;
}

/** Active tools with their real active-grant count and unit economics. */
export function enrichToolCosts(db) {
  const tools = db?.tools || [];
  const activeByTool = activeGrantsByTool(db);
  return tools
    .filter(t => t?.status === 'active')
    .map(tool => {
      const activeUsers = activeByTool.get(tool.id) || 0;
      const cost = Number(tool.cost_per_month) || 0;
      const costPerUser = activeUsers > 0 ? cost / activeUsers : cost;
      const noUsers = activeUsers === 0 && cost > 0;
      const expensive = activeUsers > 0 && costPerUser > EXPENSIVE_PER_USER;
      return {
        ...tool,
        activeUsers,
        cost,
        costPerUser,
        wasteFlag: noUsers || expensive,
        wasteReason: noUsers ? 'no-users' : expensive ? 'expensive' : null,
      };
    });
}

/**
 * The one savings figure. `recoverable` is what every screen shows; it counts
 * only tools with cost and no active users, so it is never an estimate.
 */
export function computeWaste(db) {
  const tools = enrichToolCosts(db);
  const sum = (list) => list.reduce((s, t) => s + t.cost, 0);

  const unusedTools = tools.filter(t => t.wasteReason === 'no-users');
  const expensiveTools = tools.filter(t => t.wasteReason === 'expensive');
  const flaggedTools = tools.filter(t => t.wasteFlag);

  const totalSpend = sum(tools);
  const recoverable = sum(unusedTools);

  return {
    tools,
    totalSpend,
    unusedTools,
    unusedCost: recoverable,
    expensiveTools,
    expensiveCost: sum(expensiveTools),
    flaggedTools,
    flaggedCost: sum(flaggedTools),
    recoverable,
    recoverableAnnual: recoverable * 12,
    wastePercent: totalSpend > 0 ? Math.round((recoverable / totalSpend) * 100) : 0,
  };
}
