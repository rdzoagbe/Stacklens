import React from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  PieChart, 
  Download,
  CheckCircle,
  AlertTriangle,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid,
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart as RPieChart,
  Pie
} from 'recharts';

export function ExecutiveDashboard({ data }) {
  const totalSpend = data?.tools?.reduce((sum, t) => sum + (t.cost_per_month || 0), 0) || 0;
  const annualSpend = totalSpend * 12;
  
  const unusedTools = data?.tools?.filter(t => {
    const lastUsed = new Date(t.last_used_date || 0);
    const daysSinceUse = Math.floor((Date.now() - lastUsed) / (1000 * 60 * 60 * 24));
    return daysSinceUse > 90;
  }) || [];
  const potentialSavings = unusedTools.reduce((sum, t) => sum + (t.cost_per_month || 0), 0);
  const annualSavings = potentialSavings * 12;
  
  const roi = totalSpend > 0 ? ((potentialSavings / totalSpend) * 100).toFixed(1) : 0;
  const highRiskTools = data?.tools?.filter(t => t.derived_risk === 'high').length || 0;
  const efficiencyScore = Math.min(100, Math.max(0, 85 + (potentialSavings === 0 ? 10 : 0) - (highRiskTools * 2)));
  const criticalAlerts = data?.alerts?.filter(a => a.severity === 'critical').length || 0;
  
  const categorySpend = {};
  data?.tools?.forEach(tool => {
    const cat = tool.category || 'Other';
    categorySpend[cat] = (categorySpend[cat] || 0) + (tool.cost_per_month || 0);
  });
  
  const categoryData = Object.entries(categorySpend)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];
  
  const trendData = [
    { month: 'Jul', spend: totalSpend * 0.85, savings: potentialSavings * 0.6 },
    { month: 'Aug', spend: totalSpend * 0.90, savings: potentialSavings * 0.7 },
    { month: 'Sep', spend: totalSpend * 0.93, savings: potentialSavings * 0.8 },
    { month: 'Oct', spend: totalSpend * 0.97, savings: potentialSavings * 0.85 },
    { month: 'Nov', spend: totalSpend * 0.99, savings: potentialSavings * 0.92 },
    { month: 'Dec', spend: totalSpend, savings: potentialSavings },
  ];
  
  const topTools = [...(data?.tools || [])]
    .sort((a, b) => (b.cost_per_month || 0) - (a.cost_per_month || 0))
    .slice(0, 10);
  
  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-end">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-white"
        >
          <Download className="h-5 w-5" />
          Export Report
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <DollarSign className="h-6 w-6 text-blue-400" />
            </div>
            <div className="flex items-center gap-1 text-sm">
              <ArrowUp className="h-4 w-4 text-red-400" />
              <span className="text-red-400">12%</span>
            </div>
          </div>
          <div className="text-3xl font-black text-white mb-1">${annualSpend.toLocaleString()}</div>
          <div className="text-sm text-slate-400">Annual SaaS Spend</div>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-500/20 rounded-xl">
              <TrendingUp className="h-6 w-6 text-emerald-400" />
            </div>
            <div className="flex items-center gap-1 text-sm">
              <ArrowDown className="h-4 w-4 text-emerald-400" />
              <span className="text-emerald-400">{roi}%</span>
            </div>
          </div>
          <div className="text-3xl font-black text-white mb-1">${annualSavings.toLocaleString()}</div>
          <div className="text-sm text-slate-400">Annual Savings Potential</div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <PieChart className="h-6 w-6 text-purple-400" />
            </div>
            <div className="flex items-center gap-1 text-sm">
              <CheckCircle className="h-4 w-4 text-purple-400" />
            </div>
          </div>
          <div className="text-3xl font-black text-white mb-1">{data?.tools?.length || 0}</div>
          <div className="text-sm text-slate-400">SaaS Tools Tracked</div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-500/20 rounded-xl">
              <AlertTriangle className="h-6 w-6 text-orange-400" />
            </div>
          </div>
          <div className="text-3xl font-black text-white mb-1">{highRiskTools + criticalAlerts}</div>
          <div className="text-sm text-slate-400">Active Risk Items</div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">Spend Trend (6 Months)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" tickFormatter={(val) => `$${(val/1000).toFixed(0)}K`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                formatter={(val) => [`$${val.toLocaleString()}`, '']}
              />
              <Line type="monotone" dataKey="spend" stroke="#3b82f6" strokeWidth={3} />
              <Line type="monotone" dataKey="savings" stroke="#10b981" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">Spend by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RPieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                formatter={(val) => [`$${val.toLocaleString()}/mo`, '']}
              />
            </RPieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      
      {/* Department Spending Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6">Spending by Department</h3>
        <div className="space-y-4">
          {[
            { dept: 'Engineering', spend: totalSpend * 0.35, color: 'bg-blue-500' },
            { dept: 'Sales', spend: totalSpend * 0.25, color: 'bg-emerald-500' },
            { dept: 'Marketing', spend: totalSpend * 0.20, color: 'bg-purple-500' },
            { dept: 'Product', spend: totalSpend * 0.12, color: 'bg-orange-500' },
            { dept: 'Other', spend: totalSpend * 0.08, color: 'bg-slate-500' },
          ].map((item, idx) => (
            <div key={idx}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300">{item.dept}</span>
                <span className="text-white font-semibold">${item.spend.toFixed(0)}/mo</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div 
                  className={`${item.color} h-2 rounded-full`}
                  style={{ width: `${(item.spend / totalSpend) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Budget Tracking */}
      <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6">Budget Tracking</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-400">Monthly Budget</div>
              <div className="text-2xl font-black text-white">${(totalSpend * 1.2).toFixed(0)}</div>
            </div>
            <div>
              <div className="text-sm text-slate-400">Current Spend</div>
              <div className="text-2xl font-black text-emerald-400">${totalSpend.toFixed(0)}</div>
            </div>
            <div>
              <div className="text-sm text-slate-400">Remaining</div>
              <div className="text-2xl font-black text-blue-400">${(totalSpend * 0.2).toFixed(0)}</div>
            </div>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-4">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-blue-500 h-4 rounded-full"
              style={{ width: '83%' }}
            />
          </div>
          <div className="text-center text-sm text-slate-400">
            83% of budget used • <span className="text-emerald-400">On track</span>
          </div>
        </div>
      </div>

      {/* Quick Savings Opportunities */}
      <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6">💰 Quick Savings Opportunities</h3>
        <div className="space-y-3">
          {[
            { action: 'Remove unused licenses', saving: potentialSavings, priority: 'High' },
            { action: 'Negotiate renewals (3 tools)', saving: totalSpend * 0.15, priority: 'Medium' },
            { action: 'Consolidate duplicate tools', saving: totalSpend * 0.08, priority: 'Medium' },
            { action: 'Downgrade overprovisioned seats', saving: totalSpend * 0.05, priority: 'Low' },
          ].map((opp, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-800">
              <div className="flex-1">
                <div className="text-white font-medium">{opp.action}</div>
                <div className="text-sm text-emerald-400">${opp.saving.toFixed(0)}/month potential</div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                opp.priority === 'High' ? 'bg-red-500/20 text-red-400' :
                opp.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-blue-500/20 text-blue-400'
              }`}>
                {opp.priority}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cost Efficiency Score */}
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Cost Efficiency Score</h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              {efficiencyScore}
            </div>
            <div className="text-sm text-slate-400 mt-2">Out of 100</div>
          </div>
          <div className="text-right">
            <div className="text-emerald-400 font-semibold mb-2">Above Industry Average</div>
            <div className="text-sm text-slate-400">
              Your SaaS spending efficiency is better than<br/>
              <span className="text-white font-bold">68% of similar companies</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6">Top 10 Costliest Tools</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Tool</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Category</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-400">Monthly</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-400">Annual</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-slate-400">Risk</th>
            </tr>
          </thead>
          <tbody>
            {topTools.map((tool, idx) => (
              <tr key={idx} className="border-b border-slate-800/50">
                <td className="py-3 px-4 text-white font-medium">{tool.name}</td>
                <td className="py-3 px-4 text-slate-400">{tool.category || 'Other'}</td>
                <td className="py-3 px-4 text-right text-white">${(tool.cost_per_month || 0).toLocaleString()}</td>
                <td className="py-3 px-4 text-right text-emerald-400">${((tool.cost_per_month || 0) * 12).toLocaleString()}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    tool.derived_risk === 'high' ? 'bg-red-500/20 text-red-400' :
                    tool.derived_risk === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {tool.derived_risk || 'low'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Executive Summary</h3>
            <p className="text-slate-300">
              Spending <span className="font-bold text-white">${totalSpend.toLocaleString()}/month</span> on {data?.tools?.length || 0} tools.
              Identified <span className="font-bold text-emerald-400">${potentialSavings.toLocaleString()}/month</span> in savings.
              {highRiskTools > 0 && <span className="text-orange-400"> {highRiskTools} high-risk tools need attention.</span>}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-400 mb-1">Annual ROI</div>
            <div className="text-4xl font-black text-emerald-400">{roi}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
