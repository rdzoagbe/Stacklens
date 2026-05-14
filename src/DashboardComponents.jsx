import React from 'react';
import { LineChart, Line, PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

// ============================================================================
// DASHBOARD CHARTS COMPONENT
// ============================================================================
export function DashboardCharts({ spend, riskCounts, topTools }) {
  // Monthly spend trend data (last 6 months)
  const spendTrend = [
    { month: 'Sep', spend: spend * 0.85 },
    { month: 'Oct', spend: spend * 0.90 },
    { month: 'Nov', spend: spend * 0.95 },
    { month: 'Dec', spend: spend * 0.98 },
    { month: 'Jan', spend: spend * 1.02 },
    { month: 'Feb', spend: spend },
  ];

  // Risk distribution data
  const riskData = [
    { name: 'High Risk', value: riskCounts.high || 0, color: '#ef4444' },
    { name: 'Medium Risk', value: riskCounts.medium || 0, color: '#f59e0b' },
    { name: 'Low Risk', value: riskCounts.low || 0, color: '#10b981' },
  ].filter(item => item.value > 0);

  return (
    <div className="grid gap-6 md:grid-cols-2 mb-6">
      {/* Spend Trend Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Monthly Spend Trend</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={spendTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="month" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              formatter={(value) => [`$${value.toLocaleString()}`, 'Spend']}
            />
            <Line type="monotone" dataKey="spend" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Risk Distribution Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Risk Distribution</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={riskData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {riskData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================================================
// SMART RECOMMENDATIONS COMPONENT
// ============================================================================
export function SmartRecommendations({ tools, spend, unusedLicenses = 0 }) {
  const recommendations = [];

  // Calculate potential savings
  const potentialSavings = unusedLicenses * 50; // Assume $50 per unused license

  if (potentialSavings > 1000) {
    recommendations.push({
      icon: '💰',
      title: 'High Savings Opportunity',
      description: `You could save $${potentialSavings.toLocaleString()}/month by removing ${unusedLicenses} unused licenses`,
      action: 'Review Licenses',
      link: '/licenses',
      tone: 'green'
    });
  }

  // Check for tools without owners
  const unownedTools = tools?.filter(t => !t.owner_name || t.owner_name === 'Unassigned').length || 0;
  if (unownedTools > 0) {
    recommendations.push({
      icon: '⚠️',
      title: 'Unassigned Tools',
      description: `${unownedTools} tool${unownedTools > 1 ? 's have' : ' has'} no owner - assign owners to improve security`,
      action: 'Assign Owners',
      link: '/tools',
      tone: 'yellow'
    });
  }

  // Check for high spend
  if (spend > 40000) {
    recommendations.push({
      icon: '📊',
      title: 'Spend Optimization',
      description: `Your monthly SaaS spend is $${spend.toLocaleString()}. Review top tools for optimization opportunities.`,
      action: 'View Breakdown',
      link: '/finance',
      tone: 'blue'
    });
  }

  // Generic recommendation if none above
  if (recommendations.length === 0) {
    recommendations.push({
      icon: '✅',
      title: 'All Systems Good',
      description: 'No critical issues detected. Keep monitoring for optimization opportunities.',
      action: 'View Dashboard',
      link: '/dashboard',
      tone: 'green'
    });
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
      <h3 className="text-lg font-bold text-white mb-4">💡 Smart Recommendations</h3>
      <div className="space-y-3">
        {recommendations.map((rec, idx) => (
          <div 
            key={idx} 
            className={`p-4 rounded-xl border ${
              rec.tone === 'green' ? 'bg-emerald-500/10 border-emerald-500/20' :
              rec.tone === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/20' :
              'bg-blue-500/10 border-blue-500/20'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{rec.icon}</span>
              <div className="flex-1">
                <h4 className="font-semibold text-white mb-1">{rec.title}</h4>
                <p className="text-sm text-slate-300 mb-3">{rec.description}</p>
                <a 
                  href={rec.link}
                  className={`inline-block px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    rec.tone === 'green' ? 'bg-emerald-600 hover:bg-emerald-500' :
                    rec.tone === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-500' :
                    'bg-blue-600 hover:bg-blue-500'
                  }`}
                >
                  {rec.action} →
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// RECENT ACTIVITY FEED COMPONENT
// ============================================================================
export function RecentActivity() {
  const activities = [
    { 
      icon: '✅',
      action: 'Reviewed admin access',
      user: 'Sarah Chen',
      tool: 'GitHub',
      time: '2 minutes ago',
      type: 'review'
    },
    { 
      icon: '🔧',
      action: 'Assigned owner',
      user: 'System',
      tool: 'Figma → Mike Johnson',
      time: '15 minutes ago',
      type: 'assignment'
    },
    { 
      icon: '💰',
      action: 'Reclaimed licenses',
      user: 'System',
      tool: '3 unused Slack licenses',
      time: '1 hour ago',
      type: 'reclaim'
    },
    { 
      icon: '📝',
      action: 'Updated tool info',
      user: 'Emma Davis',
      tool: 'Zoom',
      time: '3 hours ago',
      type: 'update'
    },
    { 
      icon: '🚪',
      action: 'Revoked access',
      user: 'System',
      tool: 'John Doe (Former Employee)',
      time: '1 day ago',
      type: 'revoke'
    }
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <h3 className="text-lg font-bold text-white mb-4">📋 Recent Activity</h3>
      <div className="space-y-3">
        {activities.map((activity, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/30 border border-slate-800">
            <span className="text-xl">{activity.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">{activity.action}</div>
              <div className="text-xs text-slate-400 mt-0.5">{activity.tool}</div>
              <div className="text-xs text-slate-500 mt-1">{activity.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// CLICKABLE METRICS COMPONENT
// ============================================================================
export function ClickableMetric({ label, value, icon: Icon, onClick, tone = 'blue' }) {
  const toneClasses = {
    blue: 'hover:border-blue-500/50 hover:bg-blue-500/5',
    green: 'hover:border-emerald-500/50 hover:bg-emerald-500/5',
    red: 'hover:border-red-500/50 hover:bg-red-500/5',
    yellow: 'hover:border-yellow-500/50 hover:bg-yellow-500/5',
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/30 p-4 transition-all cursor-pointer ${toneClasses[tone]}`}
    >
      <div className="flex items-center gap-3">
        {Icon && <Icon className="h-5 w-5 text-slate-400" />}
        <div className="text-sm text-slate-400 text-left">{label}</div>
      </div>
      <div className="text-lg font-semibold text-white">{value}</div>
    </button>
  );
}

// ============================================================================
// AI INSIGHTS COMPONENT - Smart Recommendations
// ============================================================================
import { Sparkles, TrendingDown, AlertTriangle } from 'lucide-react';

export function AIInsights({ tools, employees, spend, accessData }) {
  const insights = [];

  // Unused licenses
  const unusedTools = tools?.filter(t => {
    const lastUsed = new Date(t.last_used_date || 0);
    const daysSinceUse = Math.floor((Date.now() - lastUsed) / (1000 * 60 * 60 * 24));
    return daysSinceUse > 90;
  }) || [];
  
  if (unusedTools.length > 0) {
    const savings = unusedTools.reduce((sum, t) => sum + (t.cost_per_month || 0), 0);
    insights.push({
      icon: TrendingDown,
      title: 'Unused License Opportunity',
      description: `${unusedTools.length} tools haven't been used in 90+ days. Potential savings: $${savings.toLocaleString()}/month`,
      savings,
      priority: 'high',
      action: 'Review Tools',
      link: '/tools'
    });
  }

  // Orphaned tools
  const orphanedTools = tools?.filter(t => !t.owner_name || t.owner_name === 'Unassigned') || [];
  if (orphanedTools.length > 0) {
    insights.push({
      icon: AlertTriangle,
      title: 'Unassigned Tools Detected',
      description: `${orphanedTools.length} tools have no owner. Security risk!`,
      priority: 'medium',
      action: 'Assign Owners',
      link: '/tools'
    });
  }

  // If no insights
  if (insights.length === 0) {
    insights.push({
      icon: Sparkles,
      title: 'All Systems Optimized',
      description: 'No immediate optimization opportunities detected!',
      priority: 'low',
      action: 'View Dashboard',
      link: '/dashboard'
    });
  }

  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const totalSavings = insights.filter(i => i.savings).reduce((sum, i) => sum + i.savings, 0);

  return (
    <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/20 rounded-2xl p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">AI-Powered Insights</h3>
          <p className="text-sm text-slate-300">Smart recommendations to optimize your SaaS stack</p>
        </div>
        {totalSavings > 0 && (
          <div className="text-right">
            <div className="text-2xl font-black text-emerald-400">${totalSavings.toLocaleString()}</div>
            <div className="text-xs text-slate-400">potential monthly savings</div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {insights.slice(0, 3).map((insight, idx) => {
          const Icon = insight.icon;
          const colors = {
            critical: 'from-red-500/20 border-red-500/30',
            high: 'from-orange-500/20 border-orange-500/30',
            medium: 'from-yellow-500/20 border-yellow-500/30',
            low: 'from-emerald-500/20 border-emerald-500/30'
          };

          return (
            <div key={idx} className={`p-4 rounded-xl border bg-gradient-to-br ${colors[insight.priority]}`}>
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 text-white mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-white mb-1">{insight.title}</h4>
                  <p className="text-sm text-slate-300 mb-3">{insight.description}</p>
                  <a href={insight.link} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold text-white">
                    {insight.action} →
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3 w-3" />
          <span>Powered by AccessGuard AI</span>
        </div>
        <div>Last updated: {new Date().toLocaleTimeString()}</div>
      </div>
    </div>
  );
}
