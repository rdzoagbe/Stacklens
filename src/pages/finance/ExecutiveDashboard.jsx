import React from 'react';
import {
  AlertTriangle, ArrowDown, ArrowUp, Boxes, DollarSign, Download, TrendingUp,
} from 'lucide-react';
import { formatMoney, getCurrency } from '../../lib/dataUtils';
import { useLang } from '../../contexts/LangContext';
import { useTranslation } from '../../translations';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
  PieChart as RPieChart, Pie, Cell,
} from 'recharts';

export function ExecutiveDashboard({ data }) {
  const { language } = useLang();
  const t = useTranslation(language);
  const totalSpend = data?.tools?.reduce((sum, tool) => sum + (tool.cost_per_month || 0), 0) || 0;
  const annualSpend = totalSpend * 12;
  const unusedTools = data?.tools?.filter(tool => {
    const lastUsed = new Date(tool.last_used_date || 0);
    // eslint-disable-next-line react-hooks/purity
    const daysSinceUse = Math.floor((Date.now() - lastUsed) / (1000 * 60 * 60 * 24));
    return daysSinceUse > 90;
  }) || [];
  const potentialSavings = unusedTools.reduce((sum, tool) => sum + (tool.cost_per_month || 0), 0);
  const annualSavings = potentialSavings * 12;
  const roi = totalSpend > 0 ? ((potentialSavings / totalSpend) * 100).toFixed(1) : 0;
  const highRiskTools = data?.tools?.filter(tool => tool.derived_risk === 'high').length || 0;
  const efficiencyScore = Math.min(100, Math.max(0, 85 + (potentialSavings === 0 ? 10 : 0) - (highRiskTools * 2)));
  const criticalAlerts = data?.alerts?.filter(a => a.severity === 'critical').length || 0;
  const categorySpend = {};
  data?.tools?.forEach(tool => {
    const cat = tool.category || 'Other';
    categorySpend[cat] = (categorySpend[cat] || 0) + (tool.cost_per_month || 0);
  });
  const categoryData = Object.entries(categorySpend).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];
  const trendData = [
    { month: 'Jul', spend: totalSpend * 0.85, savings: potentialSavings * 0.6 },
    { month: 'Aug', spend: totalSpend * 0.90, savings: potentialSavings * 0.7 },
    { month: 'Sep', spend: totalSpend * 0.93, savings: potentialSavings * 0.8 },
    { month: 'Oct', spend: totalSpend * 0.97, savings: potentialSavings * 0.85 },
    { month: 'Nov', spend: totalSpend * 0.99, savings: potentialSavings * 0.92 },
    { month: 'Dec', spend: totalSpend, savings: potentialSavings },
  ];
  const topTools = [...(data?.tools || [])].sort((a, b) => (b.cost_per_month || 0) - (a.cost_per_month || 0)).slice(0, 10);
  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-end">
        <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-white">
          <Download className="h-5 w-5" /> Export Report
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: t('annual_saas_spend'), value: formatMoney(annualSpend, null, language), Icon: DollarSign, color: 'blue', trend: '+12%', trendUp: true },
          { label: t('annual_savings_potential'), value: formatMoney(annualSavings, null, language), Icon: TrendingUp, color: 'emerald', trend: roi + '%', trendUp: false },
          { label: t('saas_tools_tracked'), value: data?.tools?.length || 0, Icon: Boxes, color: 'purple' },
          { label: t('active_risk_items'), value: highRiskTools + criticalAlerts, Icon: AlertTriangle, color: 'orange' },
        ].map(({ label, value, Icon, color, trend, trendUp }) => (
          <div key={label} className={`bg-gradient-to-br from-${color}-500/10 to-${color}-600/10 border border-${color}-500/20 rounded-2xl p-6`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 bg-${color}-500/20 rounded-xl`}><Icon className={`h-6 w-6 text-${color}-400`} /></div>
              {trend && (trendUp
                ? <div className="flex items-center gap-1 text-sm"><ArrowUp className="h-4 w-4 text-red-400" /><span className="text-red-400">{trend}</span></div>
                : <div className="flex items-center gap-1 text-sm"><ArrowDown className="h-4 w-4 text-emerald-400" /><span className="text-emerald-400">{trend}</span></div>
              )}
            </div>
            <div className="text-2xl md:text-3xl font-black text-white mb-1">{value}</div>
            <div className="text-sm text-slate-400">{label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">{t('spend_trend_6m')}</h3>
          <div className='recharts-wrapper-fix' style={{position:'relative',width:'100%',minWidth:'0',overflow:'hidden'}}>
          <ResponsiveContainer width="100%" height={250} minWidth={0}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" tickFormatter={val => getCurrency(language) + (val/1000).toFixed(0) + "K"} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} formatter={val => [`${getCurrency(language)}${val.toLocaleString()}`, '']} />
              <Line type="monotone" dataKey="spend" stroke="#3b82f6" strokeWidth={3} />
              <Line type="monotone" dataKey="savings" stroke="#10b981" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">{t('spend_by_category_title')}</h3>
          <div className="recharts-wrapper-fix" style={{position:"relative",width:"100%",minWidth:"0",overflow:"hidden"}}>
          <ResponsiveContainer width="100%" height={250} minWidth={0}>
            <RPieChart>
              <Pie data={categoryData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={100} dataKey="value">
                {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} formatter={val => [`$${val.toLocaleString()}/mo`, '']} />
            </RPieChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6">{t('top_10_costly')}</h3>
        <div className="overflow-x-auto w-full">
        <table className="w-full">
          <thead><tr className="border-b border-slate-800">
            {['Tool','Category','Monthly','Annual','Risk'].map(h => (
              <th key={h} className={`py-3 px-4 text-sm font-semibold text-slate-400 ${h === 'Monthly' || h === 'Annual' ? 'text-right' : h === 'Risk' ? 'text-center' : 'text-left'}`}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {topTools.map((tool, idx) => (
              <tr key={idx} className="border-b border-slate-800/50">
                <td className="py-3 px-4 text-white font-medium">{tool.name}</td>
                <td className="py-3 px-4 text-slate-400">{tool.category || 'Other'}</td>
                <td className="py-3 px-4 text-right text-white">${(tool.cost_per_month || 0).toLocaleString()}</td>
                <td className="py-3 px-4 text-right text-emerald-400">${((tool.cost_per_month || 0) * 12).toLocaleString()}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${tool.derived_risk === 'high' ? 'bg-red-500/20 text-red-400' : tool.derived_risk === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {tool.derived_risk || 'low'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">{t('exec_summary_title')}</h3>
            <p className="text-slate-300">Spending <span className="font-bold text-white">{getCurrency(language)}{totalSpend.toLocaleString()}/month</span> on {data?.tools?.length || 0} tools. Identified <span className="font-bold text-emerald-400">${potentialSavings.toLocaleString()}/month</span> in savings.{highRiskTools > 0 && <span className="text-orange-400"> {highRiskTools} high-risk tools need attention.</span>}</p>
          </div>
          <div className="text-right"><div className="text-sm text-slate-400 mb-1">{t("hc_annual_roi")}</div><div className="text-2xl md:text-4xl font-black text-emerald-400">{roi}%</div></div>
        </div>
      </div>
    </div>
  );
}

