
import React, { useMemo } from 'react';
import { FinancialData } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
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

  const assetsByType = useMemo(() => {
    const typeMap: Record<string, number> = {};
    const labelMap: Record<string, string> = {
       'cash': '現金存款',
       'tw_stock': '台股',
       'us_stock': '美股',
       'crypto': '加密貨幣',
       'property': '不動產',
       'investment': '其他投資',
       'other': '其他'
    };

    data.assets.forEach(a => {
       const label = labelMap[a.type] || a.type;
       typeMap[label] = (typeMap[label] || 0) + a.value;
    });

    return Object.keys(typeMap).map(key => ({
       name: key,
       value: typeMap[key]
    })).sort((a, b) => b.value - a.value);

  }, [data.assets]);

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
    
    // 3. Determine Time Horizon
    const oldestTxn = sortedTxns[sortedTxns.length - 1];
    const oldestDate = new Date(oldestTxn.date);
    const today = new Date();
    
    // Calculate span in days
    const timeSpanDays = Math.ceil((today.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // AI Adaptive Logic: Define sampling rate based on history length
    let sampleStep = 1; // Default daily
    let dateFormat = (d: Date) => `${d.getMonth()+1}/${d.getDate()}`; // Default MM/DD

    if (timeSpanDays > 365 * 2) {
       // > 2 Years: Monthly samples
       sampleStep = 30;
       dateFormat = (d: Date) => `${d.getFullYear()}.${d.getMonth()+1}`;
    } else if (timeSpanDays > 180) {
       // > 6 Months: Weekly samples
       sampleStep = 7;
       dateFormat = (d: Date) => `${d.getMonth()+1}/${d.getDate()}`;
    } else if (timeSpanDays > 60) {
       // > 2 Months: Every 3 days
       sampleStep = 3;
    }

    // 4. Build Daily Change Map
    const changesByDay: Record<string, number> = {};
    sortedTxns.forEach(t => {
      let impact = 0;
      if (t.type === 'income') impact = t.amount;
      if (t.type === 'expense') impact = -t.amount;
      // Transfers impact = 0

      const dateStr = t.date; // YYYY-MM-DD
      changesByDay[dateStr] = (changesByDay[dateStr] || 0) + impact;
    });

    // 5. Replay Backwards from Today
    const fullHistory = [];
    let runningNW = currentNetWorth;
    
    const iterDate = new Date(today);
    iterDate.setHours(0,0,0,0);
    const endDateMs = oldestDate.getTime();

    let safetyCounter = 0;
    
    while (iterDate.getTime() >= endDateMs && safetyCounter < 365 * 5) {
       const dateStr = iterDate.toISOString().split('T')[0];
       
       fullHistory.unshift({
          timestamp: iterDate.getTime(),
          date: dateStr,
          netWorth: runningNW
       });

       const changeToday = changesByDay[dateStr] || 0;
       runningNW = runningNW - changeToday; 
       
       iterDate.setDate(iterDate.getDate() - 1);
       safetyCounter++;
    }

    const startStr = iterDate.toISOString().split('T')[0];
    fullHistory.unshift({
        timestamp: iterDate.getTime(),
        date: startStr,
        netWorth: runningNW
    });

    // 6. Downsample based on AI Logic
    return fullHistory
      .filter((_, idx) => idx % sampleStep === 0 || idx === fullHistory.length - 1)
      .map(item => ({
        ...item,
        formattedDate: dateFormat(new Date(item.timestamp))
      }));

  }, [data, summary.netWorth]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 border border-cyan-500/50 p-3 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.3)] backdrop-blur-xl z-50">
          <p className="text-slate-400 text-xs font-mono mb-1 border-b border-slate-800 pb-1">{label || payload[0].name}</p>
          <p className="text-cyan-400 text-sm font-mono font-bold flex items-center gap-2">
             <span className="w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_5px_rgba(34,211,238,0.8)]"></span>
             ${payload[0].value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-200 pb-8">
      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Net Worth */}
        <div className="bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group hover:border-cyan-500/50 transition-colors">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-cyan-900/30 rounded-lg text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              <Wallet size={20} />
            </div>
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider font-mono">淨資產 (Net Worth)</h3>
          </div>
          <p className={`text-2xl stat-value font-bold ${summary.netWorth >= 0 ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]' : 'text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]'}`}>
            ${summary.netWorth.toLocaleString()}
          </p>
        </div>

        {/* Total Assets */}
        <div className="bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-500"></div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-emerald-900/30 rounded-lg text-emerald-400 border border-emerald-500/30">
              <TrendingUp size={20} />
            </div>
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider font-mono">總資產 (Assets)</h3>
          </div>
          <p className="text-2xl stat-value font-bold text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">${summary.totalAssets.toLocaleString()}</p>
        </div>

        {/* Total Liabilities */}
        <div className="bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group hover:border-rose-500/50 transition-colors">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-red-500"></div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-rose-900/30 rounded-lg text-rose-400 border border-rose-500/30">
              <TrendingDown size={20} />
            </div>
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider font-mono">總負債 (Liabilities)</h3>
          </div>
          <p className="text-2xl stat-value font-bold text-rose-400 drop-shadow-[0_0_5px_rgba(251,113,133,0.5)]">${summary.totalLiabilities.toLocaleString()}</p>
        </div>
        
        {/* Saved */}
        <div className="bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group hover:border-amber-500/50 transition-colors">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-yellow-500"></div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-amber-900/30 rounded-lg text-amber-400 border border-amber-500/30">
              <PiggyBank size={20} />
            </div>
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider font-mono">現金流結餘 (Savings)</h3>
          </div>
          <p className={`text-2xl stat-value font-bold ${(summary.income - summary.expenses) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ${(summary.income - summary.expenses).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Net Worth History Chart */}
      <div className="bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-slate-700 shadow-lg h-[350px] flex flex-col relative group">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500 to-transparent opacity-50"></div>
          
          <div className="absolute top-4 right-4 flex flex-col items-end pointer-events-none hidden sm:flex">
            <div className="text-[10px] text-cyan-500 font-tech animate-pulse flex items-center gap-1">
               <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>
               AI_TIMELINE_ADAPTIVE
            </div>
            <div className="text-[9px] text-slate-600 font-mono mt-1">
               SAMPLES: {netWorthHistory.length} // RANGE: AUTO
            </div>
          </div>

          <h3 className="text-base sm:text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2 font-mono tracking-wide">
            <Activity size={18} className="text-cyan-400" />
            淨資產趨勢曲線 (NET WORTH)
          </h3>
          
          <div className="flex-1 w-full">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netWorthHistory} margin={{ top: 10, right: 10, left: -20, bottom: 45 }}>
                  <defs>
                    <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis 
                    dataKey="formattedDate" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 10, fontFamily: 'Share Tech Mono', dy: 10}} 
                    minTickGap={30}
                    tickMargin={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 10, fontFamily: 'Share Tech Mono'}}
                    tickFormatter={(value) => `$${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                  />
                  <Tooltip cursor={{stroke: '#22d3ee', strokeWidth: 1, strokeDasharray: '5 5'}} content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="netWorth" 
                    name="淨資產"
                    stroke="#22d3ee" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorNetWorth)"
                    animationDuration={1500}
                  />
                </AreaChart>
             </ResponsiveContainer>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Allocation Pie Chart */}
        <div className="bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-slate-700 shadow-lg h-[400px] flex flex-col relative">
          <div className="absolute top-0 right-0 p-2 text-xs text-slate-600 font-tech hidden sm:block">SYS.DIAG.ASSET</div>
          <h3 className="text-base sm:text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2 font-mono">
             <span className="w-1 h-4 bg-emerald-500 inline-block"></span>
             資產配置 (Allocation)
          </h3>
          {assetsByType.length > 0 ? (
            <div className="flex-1 w-full h-full">
               <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={assetsByType}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {assetsByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
             <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-sm border border-dashed border-slate-800 rounded-lg">
              [ 無資產數據 ]
            </div>
          )}
          {assetsByType.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
               {assetsByType.slice(0, 6).map((item, idx) => (
                 <div key={item.name} className="flex items-center justify-between border-b border-slate-800 pb-1">
                   <div className="flex items-center min-w-0">
                     <span className="w-2 h-2 rounded-sm mr-2 shadow-[0_0_5px_currentColor] flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length], color: COLORS[idx % COLORS.length] }}></span>
                     <span className="truncate text-slate-400">{item.name}</span>
                   </div>
                   <span className="font-medium text-slate-300 ml-2">${item.value.toLocaleString()}</span>
                 </div>
               ))}
            </div>
          )}
        </div>

        {/* Expense Breakdown (Existing) */}
        <div className="bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-slate-700 shadow-lg h-[400px] flex flex-col relative">
          <div className="absolute top-0 right-0 p-2 text-xs text-slate-600 font-tech hidden sm:block">SYS.DIAG.EXP</div>
          <h3 className="text-base sm:text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2 font-mono">
             <span className="w-1 h-4 bg-fuchsia-500 inline-block"></span>
             支出類別分析
          </h3>
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
            <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-sm border border-dashed border-slate-800 rounded-lg">
              [ 無支出數據 ]
            </div>
          )}
          {expenseByCategory.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
               {expenseByCategory.slice(0, 6).map((item, idx) => (
                 <div key={item.name} className="flex items-center justify-between border-b border-slate-800 pb-1">
                   <div className="flex items-center min-w-0">
                     <span className="w-2 h-2 rounded-sm mr-2 shadow-[0_0_5px_currentColor] flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length], color: COLORS[idx % COLORS.length] }}></span>
                     <span className="truncate text-slate-400">{item.name}</span>
                   </div>
                   <span className="font-medium text-slate-300 ml-2">${item.value.toLocaleString()}</span>
                 </div>
               ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
