
import React, { useMemo } from 'react';
import { FinancialData } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Activity, Calendar } from 'lucide-react';

interface DashboardProps {
  data: FinancialData;
}

// Cyberpunk Neon Palette
const COLORS = ['#22d3ee', '#e879f9', '#facc15', '#f472b6', '#4ade80', '#818cf8', '#fb923c'];

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  
  const summary = useMemo(() => {
    const totalAssets = data.assets.reduce((acc, curr) => acc + curr.value, 0);
    const totalLiabilities = data.liabilities.reduce((acc, curr) => acc + curr.value, 0);
    const netWorth = totalAssets - totalLiabilities;
    
    // --- Monthly Cash Flow ---
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const currentMonthTransactions = data.transactions.filter(t => t.date.startsWith(currentMonthPrefix));

    const income = currentMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((acc, t) => acc + t.amount, 0);
    
    const expenses = currentMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => acc + t.amount, 0);

    // --- Yearly Cash Flow ---
    const currentYearPrefix = `${now.getFullYear()}-`;
    const currentYearTransactions = data.transactions.filter(t => t.date.startsWith(currentYearPrefix));

    const yearIncome = currentYearTransactions
      .filter(t => t.type === 'income')
      .reduce((acc, t) => acc + t.amount, 0);

    const yearExpenses = currentYearTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => acc + t.amount, 0);

    return { totalAssets, totalLiabilities, netWorth, income, expenses, yearIncome, yearExpenses };
  }, [data]);

  const expenseByCategory = useMemo(() => {
    const categoryMap: Record<string, number> = {};
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    data.transactions
      .filter(t => t.type === 'expense' && t.date.startsWith(currentMonthPrefix))
      .forEach(t => {
        categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
      });

    return Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data.transactions]);

  // Generate simple history for Net Worth trend based on transactions (Backwards simulation)
  const chartData = useMemo(() => {
     // Create last 30 days
     const days = 30;
     const result = [];
     const today = new Date();
     
     // 1. Group ALL transactions by date to lookup
     const txMap: Record<string, number> = {};
     data.transactions.forEach(t => {
        // Only Income and Expense affect Net Worth (Transfers don't change Total Net Worth, just move asset<->asset or asset<->liability)
        // Wait, Repaying liability (Transfer Asset->Liability) reduces Asset and reduces Liability by same amount => Net Worth stays same.
        // Spending (Expense) reduces Asset => Net Worth decreases.
        // Earning (Income) increases Asset => Net Worth increases.
        const d = t.date;
        if (!txMap[d]) txMap[d] = 0;
        if (t.type === 'income') txMap[d] += t.amount;
        if (t.type === 'expense') txMap[d] -= t.amount;
     });

     let currentNW = summary.netWorth;

     // 2. Loop Backwards
     for (let i = 0; i < days; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        // Push the END OF DAY Net Worth for this date
        result.push({
           name: `${d.getMonth()+1}/${d.getDate()}`,
           netWorth: currentNW
        });

        // To get Yesterday's End NW, we must subtract today's change from Today's End NW.
        // If today I earned 100, NW increased 100. So Yesterday was Today - 100.
        // Change = Income - Expense.
        // PrevNW = CurrNW - Change
        const change = txMap[dateStr] || 0;
        currentNW = currentNW - change;
     }

     return result.reverse();
  }, [data.transactions, summary.netWorth]);

  // --- Gradient Split Calculation ---
  const gradientOffset = () => {
    const dataMax = Math.max(...chartData.map((i) => i.netWorth));
    const dataMin = Math.min(...chartData.map((i) => i.netWorth));
  
    if (dataMax <= 0) {
      return 0; // Everything is negative -> All red
    }
    if (dataMin >= 0) {
      return 1; // Everything is positive -> All cyan
    }
  
    return dataMax / (dataMax - dataMin);
  };
  
  const off = gradientOffset();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* SUMMARY CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* 1. Net Worth */}
        <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-2xl border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
             <Wallet size={40} className="text-cyan-400" />
          </div>
          <h3 className="text-slate-400 text-xs font-bold font-mono tracking-wider uppercase mb-1">淨資產 (Net Worth)</h3>
          <p className="text-2xl font-bold text-cyan-400 font-mono tracking-tight drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
             ${summary.netWorth.toLocaleString()}
          </p>
          <div className="mt-2 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
             <div className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.8)]" style={{ width: '75%' }}></div>
          </div>
        </div>

        {/* 2. Assets */}
        <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-2xl border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)] relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
             <TrendingUp size={40} className="text-emerald-400" />
          </div>
          <h3 className="text-slate-400 text-xs font-bold font-mono tracking-wider uppercase mb-1">總資產 (Assets)</h3>
          <p className="text-2xl font-bold text-emerald-400 font-mono tracking-tight">
             ${summary.totalAssets.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-mono">資產配置：優良</p>
        </div>

        {/* 3. Liabilities */}
        <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-2xl border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.15)] relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
             <TrendingDown size={40} className="text-rose-400" />
          </div>
          <h3 className="text-slate-400 text-xs font-bold font-mono tracking-wider uppercase mb-1">總負債 (Debts)</h3>
          <p className="text-2xl font-bold text-rose-400 font-mono tracking-tight">
             ${summary.totalLiabilities.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-mono">負債比: {((summary.totalLiabilities / (summary.totalAssets || 1))*100).toFixed(1)}%</p>
        </div>

        {/* 4. Monthly Balance */}
        <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-2xl border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)] relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
             <PiggyBank size={40} className="text-amber-400" />
          </div>
          <h3 className="text-slate-400 text-xs font-bold font-mono tracking-wider uppercase mb-1">當月結餘</h3>
          <p className={`text-2xl font-bold font-mono tracking-tight ${(summary.income - summary.expenses) >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
             ${(summary.income - summary.expenses).toLocaleString()}
          </p>
          <div className="flex gap-2 text-[10px] mt-1 font-mono">
             <span className="text-emerald-400/80">收: {summary.income.toLocaleString()}</span>
             <span className="text-rose-400/80">支: {summary.expenses.toLocaleString()}</span>
          </div>
        </div>

        {/* 5. Yearly Balance (NEW) */}
        <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-2xl border border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.15)] relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
             <Calendar size={40} className="text-violet-400" />
          </div>
          <h3 className="text-slate-400 text-xs font-bold font-mono tracking-wider uppercase mb-1">當年結餘</h3>
          <p className={`text-2xl font-bold font-mono tracking-tight ${(summary.yearIncome - summary.yearExpenses) >= 0 ? 'text-violet-400' : 'text-rose-400'}`}>
             ${(summary.yearIncome - summary.yearExpenses).toLocaleString()}
          </p>
           <div className="flex gap-2 text-[10px] mt-1 font-mono">
             <span className="text-emerald-400/80">年收: {((summary.yearIncome)/10000).toFixed(1)}萬</span>
             <span className="text-rose-400/80">年支: {((summary.yearExpenses)/10000).toFixed(1)}萬</span>
          </div>
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* NET WORTH TREND CHART */}
        <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-sm p-6 rounded-2xl border border-slate-700 shadow-lg relative">
           <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50"></div>
           <div className="flex items-center justify-between mb-6">
              <h3 className="text-slate-200 font-bold font-mono flex items-center gap-2">
                 <Activity size={18} className="text-cyan-400" />
                 淨資產趨勢 (30天)
              </h3>
              <span className="text-[10px] text-slate-500 font-mono bg-slate-800 px-2 py-1 rounded">即時數據</span>
           </div>
           
           <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      {/* Split Gradient Definition */}
                      <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset={off} stopColor="#22d3ee" stopOpacity={0.3}/>
                        <stop offset={off} stopColor="#f43f5e" stopOpacity={0.3}/>
                      </linearGradient>
                      {/* Optional: Split Stroke if we want line color to change exactly at 0 */}
                       <linearGradient id="splitStroke" x1="0" y1="0" x2="0" y2="1">
                        <stop offset={off} stopColor="#22d3ee" stopOpacity={1}/>
                        <stop offset={off} stopColor="#f43f5e" stopOpacity={1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                       dataKey="name" 
                       stroke="#64748b" 
                       fontSize={10} 
                       tickLine={false} 
                       axisLine={false} 
                       tickMargin={10}
                    />
                    <YAxis 
                       stroke="#64748b" 
                       fontSize={10} 
                       tickLine={false} 
                       axisLine={false}
                       tickFormatter={(value) => `${(value / 10000).toFixed(0)}萬`}
                    />
                    <Tooltip 
                       contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                       itemStyle={{ color: '#22d3ee', fontFamily: 'monospace' }}
                       formatter={(value: number) => [`$${value.toLocaleString()}`, '淨資產']}
                    />
                    {/* Zero Line Reference */}
                    <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                    
                    <Area 
                      type="monotone" 
                      dataKey="netWorth" 
                      stroke="url(#splitStroke)" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#splitColor)" 
                    />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* EXPENSE PIE CHART */}
        <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-2xl border border-slate-700 shadow-lg relative">
           <div className="absolute top-0 left-0 w-1 h-full bg-rose-500/50"></div>
           <h3 className="text-slate-200 font-bold font-mono mb-6 flex items-center gap-2">
              <Activity size={18} className="text-rose-400" />
              本月支出分佈
           </h3>
           <div className="h-[300px] w-full relative">
              {expenseByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {expenseByCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.5)" />
                        ))}
                      </Pie>
                      <Tooltip 
                         contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                         itemStyle={{ color: '#e2e8f0', fontFamily: 'monospace' }}
                         formatter={(value: number) => `$${value.toLocaleString()}`}
                      />
                    </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                   <p className="font-mono text-xs">無數據</p>
                </div>
              )}
              
              {/* Center Text Overlay */}
              {expenseByCategory.length > 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                   <div className="text-center">
                      <span className="text-xs text-slate-500 font-mono block">總計</span>
                      <span className="text-xl font-bold text-slate-200 font-mono">${summary.expenses.toLocaleString()}</span>
                   </div>
                </div>
              )}
           </div>
           
           {/* Legend */}
           <div className="mt-4 max-h-[150px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 pr-2">
              {expenseByCategory.map((entry, index) => (
                 <div key={index} className="flex items-center justify-between py-1.5 border-b border-slate-800/50 last:border-0">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: COLORS[index % COLORS.length], color: COLORS[index % COLORS.length] }}></div>
                       <span className="text-xs text-slate-300 font-mono">{entry.name}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-400 font-mono">${entry.value.toLocaleString()}</span>
                 </div>
              ))}
           </div>
        </div>

      </div>
    </div>
  );
};
