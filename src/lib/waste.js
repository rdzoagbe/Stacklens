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

/** Active tools with their real active-grant count and unit economics. */
export function enrichToolCosts(db) {
  const tools = db?.tools || [];
  const access = db?.access || [];
  const activeByTool = new Map();
  for (const a of access) {
    if (a?.status !== 'active') continue;
    activeByTool.set(a.tool_id, (activeByTool.get(a.tool_id) || 0) + 1);
  }
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
