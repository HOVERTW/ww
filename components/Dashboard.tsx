
import React, { useMemo } from 'react';
import { FinancialData } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Activity } from 'lucide-react';

interface DashboardProps {
  data: FinancialData;
}

// Cyberpunk Neon Palette
const COLORS = ['#22d3ee', '#e879f9', '#facc15', '#f472b6', '#4ade80', '#818cf8'];

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  
  const summary = useMemo(() => {
    const totalAssets = data.assets.reduce((acc, curr) => acc + curr.value, 0);
    const totalLiabilities = data.liabilities.reduce((acc, curr) => acc + curr.value, 0);
    const netWorth = totalAssets - totalLiabilities;
    
    const income = data.transactions
      .filter(t => t.type === 'income')
      .reduce((acc, t) => acc + t.amount, 0);
    
    const expenses = data.transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => acc + t.amount, 0);

    return { totalAssets, totalLiabilities, netWorth, income, expenses };
  }, [data]);

  const expenseByCategory = useMemo(() => {
    const categoryMap: Record<string, number> = {};
    data.transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
      });
    
    return Object.keys(categoryMap).map(key => ({
      name: key,
      value: categoryMap[key]
    })).sort((a, b) => b.value - a.value);
  }, [data.transactions]);

  // --- AI-Defined Historical Net Worth Logic ---
  const netWorthHistory = useMemo(() => {
    // 1. Initialize with current state
    const currentNetWorth = summary.netWorth;
    
    // If no transactions, just show a straight line for the last 30 days
    if (data.transactions.length === 0) {
      const result = [];
      const today = new Date();
      for(let i=29; i>=0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        result.push({
          date: d.toISOString().split('T')[0],
          netWorth: currentNetWorth,
          formattedDate: `${d.getMonth()+1}/${d.getDate()}`
        });
      }
      return result;
    }

    // 2. Sort transactions desc (newest first)
    const sortedTxns = [...data.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // 3. Determine Time Horizon (AI Adaptive Range)
    const lastDate = new Date();
    const firstTxnDate = new Date(sortedTxns[sortedTxns.length - 1].date);
    
    // Ensure at least 30 days for visual aesthetics
    let startDate = new Date(firstTxnDate);
    const minStart = new Date();
    minStart.setDate(minStart.getDate() - 30);
    if (startDate > minStart) startDate = minStart;

    // 4. Bucket daily changes
    const changesByDay: Record<string, number> = {};
    sortedTxns.forEach(t => {
      if (!t.sourceId) return; // Only count transactions linked to Assets/Liabilities
      const dateStr = t.date;
      // Calculate impact on Net Worth:
      // Asset Income (+), Asset Expense (-)
      // Liability Expense (- NW, as debt increases), Liability Income (+ NW, as debt decreases)
      let impact = 0;
      if (t.sourceType === 'asset') {
        impact = t.type === 'income' ? t.amount : -t.amount;
      } else if (t.sourceType === 'liability') {
        // Liability Expense (e.g. spending on credit card) INCREASES Liability, decreasing Net Worth
        // Liability Income (e.g. refund/payment) DECREASES Liability, increasing Net Worth
        impact = t.type === 'income' ? t.amount : -t.amount;
      }
      changesByDay[dateStr] = (changesByDay[dateStr] || 0) + impact;
    });

    // 5. Replay backwards
    const fullHistory = [];
    const iterDate = new Date(lastDate);
    iterDate.setHours(0,0,0,0);
    const startMs = startDate.getTime();
    let runningNW = currentNetWorth;

    // Cap at 5 years to prevent performance issues on extreme dates
    const safetyBreak = new Date();
    safetyBreak.setFullYear(safetyBreak.getFullYear() - 5);
    const safetyMs = safetyBreak.getTime();
    const effectiveStartMs = Math.max(startMs, safetyMs);

    while (iterDate.getTime() >= effectiveStartMs) {
      const dateStr = iterDate.toISOString().split('T')[0];
      
      fullHistory.unshift({
        date: dateStr,
        timestamp: iterDate.getTime(),
        netWorth: runningNW,
      });

      // Previous NW = Current NW - Change
      const change = changesByDay[dateStr] || 0;
      runningNW -= change;

      iterDate.setDate(iterDate.getDate() - 1);
    }

    // 6. AI Adaptive Downsampling (Smart Axis)
    const totalDays = fullHistory.length;
    let sampleRate = 1;
    let dateFormat = (d: Date) => `${d.getMonth()+1}/${d.getDate()}`;

    if (totalDays > 365 * 2) {
      sampleRate = 30; // Monthly
      dateFormat = (d: Date) => `${d.getFullYear()}.${d.getMonth()+1}`;
    } else if (totalDays > 365) {
      sampleRate = 14; // Bi-weekly
      dateFormat = (d: Date) => `${d.getMonth()+1}/${d.getDate()}`;
    } else if (totalDays > 90) {
      sampleRate = 7; // Weekly
      dateFormat = (d: Date) => `${d.getMonth()+1}/${d.getDate()}`;
    } else if (totalDays > 60) {
      sampleRate = 2; // Every other day
    }

    return fullHistory
      .filter((_, idx) => idx % sampleRate === 0 || idx === fullHistory.length - 1)
      .map(item => ({
        ...item,
        formattedDate: dateFormat(new Date(item.timestamp))
      }));

  }, [data, summary.netWorth]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-cyan-500/50 p-2 rounded shadow-[0_0_10px_rgba(6,182,212,0.3)]">
          <p className="text-slate-400 text-xs font-mono mb-1">{label}</p>
          <p className="text-cyan-100 text-sm font-mono font-bold">
             {payload[0].name}: ${payload[0].value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-200">
      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Net Worth */}
        <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-cyan-900/30 rounded-lg text-cyan-400 border border-cyan-500/30">
              <Wallet size={20} />
            </div>
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">淨資產</h3>
          </div>
          <p className={`text-2xl stat-value font-bold ${summary.netWorth >= 0 ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]' : 'text-rose-500 drop-shadow-[0_0_5px_rgba(244,63,94,0.5)]'}`}>
            ${summary.netWorth.toLocaleString()}
          </p>
        </div>

        {/* Total Assets */}
        <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-500"></div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-emerald-900/30 rounded-lg text-emerald-400 border border-emerald-500/30">
              <TrendingUp size={20} />
            </div>
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">總資產</h3>
          </div>
          <p className="text-2xl stat-value font-bold text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">${summary.totalAssets.toLocaleString()}</p>
        </div>

        {/* Total Liabilities */}
        <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-red-500"></div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-rose-900/30 rounded-lg text-rose-400 border border-rose-500/30">
              <TrendingDown size={20} />
            </div>
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">總負債</h3>
          </div>
          <p className="text-2xl stat-value font-bold text-rose-400 drop-shadow-[0_0_5px_rgba(251,113,133,0.5)]">${summary.totalLiabilities.toLocaleString()}</p>
        </div>
        
        {/* Saved */}
        <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-yellow-500"></div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-amber-900/30 rounded-lg text-amber-400 border border-amber-500/30">
              <PiggyBank size={20} />
            </div>
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">結餘 (收-支)</h3>
          </div>
          <p className={`text-2xl stat-value font-bold ${(summary.income - summary.expenses) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ${(summary.income - summary.expenses).toLocaleString()}
          </p>
        </div>
      </div>

      {/* NEW: Net Worth History Chart */}
      <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-lg h-[350px] flex flex-col relative">
          <div className="absolute top-0 right-0 p-2 flex flex-col items-end">
            <div className="text-xs text-cyan-500 font-tech animate-pulse">SYS.AI.TIMELINE_ACTIVE</div>
            <div className="text-[10px] text-slate-600 font-mono">AUTO_SCALE: {netWorthHistory.length > 60 ? 'ENABLED' : 'STANDBY'}</div>
          </div>
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-blue-500 inline-block"></span>
            <Activity size={18} className="text-blue-400" />
            淨資產趨勢 (Net Worth)
          </h3>
          <div className="flex-1 w-full">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netWorthHistory}>
                  <defs>
                    <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.5} />
                  <XAxis 
                    dataKey="formattedDate" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 10, fontFamily: 'Share Tech Mono'}} 
                    minTickGap={30}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 10, fontFamily: 'Share Tech Mono'}}
                    tickFormatter={(value) => `$${value >= 1000 ? (value/1000).toFixed(1) + 'k' : value}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="netWorth" 
                    name="淨資產"
                    stroke="#22d3ee" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorNetWorth)" 
                  />
                </AreaChart>
             </ResponsiveContainer>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Breakdown */}
        <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-lg h-[400px] flex flex-col relative">
          <div className="absolute top-0 right-0 p-2 text-xs text-slate-600 font-tech">SYS.DIAG.EXP</div>
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2"><span className="w-1 h-4 bg-fuchsia-500 inline-block"></span>支出類別分析</h3>
          {expenseByCategory.length > 0 ? (
            <div className="flex-1 w-full h-full">
               <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {expenseByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-sm">
              [ 無數據 ]
            </div>
          )}
          {expenseByCategory.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
               {expenseByCategory.slice(0, 6).map((item, idx) => (
                 <div key={item.name} className="flex items-center justify-between border-b border-slate-800 pb-1">
                   <div className="flex items-center">
                     <span className="w-2 h-2 rounded-sm mr-2 shadow-[0_0_5px_currentColor]" style={{ backgroundColor: COLORS[idx % COLORS.length], color: COLORS[idx % COLORS.length] }}></span>
                     <span className="truncate max-w-[100px] text-slate-400">{item.name}</span>
                   </div>
                   <span className="font-medium text-slate-300">${item.value.toLocaleString()}</span>
                 </div>
               ))}
            </div>
          )}
        </div>

        {/* Cash Flow Bar Chart */}
        <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-lg h-[400px] flex flex-col relative">
           <div className="absolute top-0 right-0 p-2 text-xs text-slate-600 font-tech">SYS.DIAG.FLOW</div>
           <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2"><span className="w-1 h-4 bg-cyan-500 inline-block"></span>現金流概覽</h3>
           <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: '收入', value: summary.income },
                    { name: '支出', value: summary.expenses }
                  ]}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontFamily: 'Share Tech Mono'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontFamily: 'Share Tech Mono'}} />
                  <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={50}>
                    {
                      [{ name: 'Income', value: summary.income }, { name: 'Expense', value: summary.expenses }].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.name === 'Income' ? '#10b981' : '#f43f5e'} strokeWidth={0} />
                      ))
                    }
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  );
};
