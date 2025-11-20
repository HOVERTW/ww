
import React, { useState, useEffect } from 'react';
import { loadData, saveData, generateId } from './services/storageService';
import { FinancialData, AppView, Transaction, Asset, Liability, CustomCategory, RecurringTransaction } from './types';
import { Dashboard } from './components/Dashboard';
import { Transactions } from './components/Transactions';
import { BalanceSheet } from './components/BalanceSheet';
import { AIAdvisor } from './components/AIAdvisor';
import { LayoutDashboard, List, Scale, Sparkles, Download } from 'lucide-react';

function App() {
  const [data, setData] = useState<FinancialData>({ 
    transactions: [], 
    assets: [], 
    liabilities: [],
    customCategories: [],
    recurringTransactions: []
  });
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const storedData = loadData();
    // Ensure fields exist for backward compatibility
    if (!storedData.customCategories) storedData.customCategories = [];
    if (!storedData.recurringTransactions) storedData.recurringTransactions = [];
    
    // Process Recurring Transactions
    const processedData = processRecurringTransactions(storedData);
    
    setData(processedData);
    setIsLoaded(true);
    
    // Capture the PWA install prompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    });
  }, []);

  useEffect(() => {
    if (isLoaded) {
      saveData(data);
    }
  }, [data, isLoaded]);

  // --- Core Logic: Process Recurring Transactions ---
  const processRecurringTransactions = (currentData: FinancialData): FinancialData => {
    const today = new Date();
    // Set time to 0 to compare dates only
    today.setHours(0, 0, 0, 0);

    let newTransactions: Transaction[] = [];
    let updatedAssets = [...currentData.assets];
    let updatedLiabilities = [...currentData.liabilities];

    const updatedRecurring = currentData.recurringTransactions?.map(rule => {
      if (!rule.active) return rule;

      let nextDue = new Date(rule.nextDueDate);
      let modified = false;
      let ruleClone = { ...rule };

      // While next due date is today or in the past
      while (nextDue <= today) {
        // Check remaining occurrences limit
        if (ruleClone.remainingOccurrences !== undefined && ruleClone.remainingOccurrences <= 0) {
           ruleClone.active = false;
           break; 
        }

        modified = true;
        
        // Create the transaction
        const newTxn: Transaction = {
          id: generateId(),
          date: nextDue.toISOString().split('T')[0],
          type: rule.type,
          amount: rule.amount,
          category: rule.category,
          note: `[自動扣款] ${rule.name} ${ruleClone.remainingOccurrences !== undefined ? `(剩餘 ${ruleClone.remainingOccurrences - 1} 期)` : ''}`,
          sourceId: rule.sourceId,
          sourceType: rule.sourceType
        };
        newTransactions.push(newTxn);

        // Decrement occurrence if finite
        if (ruleClone.remainingOccurrences !== undefined) {
          ruleClone.remainingOccurrences -= 1;
          // If we hit 0, deactivate immediately after this one is generated
          if (ruleClone.remainingOccurrences <= 0) {
             ruleClone.active = false;
          }
        }

        // Apply asset/liability impact immediately
        if (newTxn.sourceId) {
          if (newTxn.sourceType === 'asset') {
            const idx = updatedAssets.findIndex(a => a.id === newTxn.sourceId);
            if (idx !== -1) {
              updatedAssets[idx] = {
                ...updatedAssets[idx],
                value: updatedAssets[idx].value + (newTxn.type === 'income' ? newTxn.amount : -newTxn.amount)
              };
            }
          } else if (newTxn.sourceType === 'liability') {
            const idx = updatedLiabilities.findIndex(l => l.id === newTxn.sourceId);
            if (idx !== -1) {
               updatedLiabilities[idx] = {
                ...updatedLiabilities[idx],
                value: updatedLiabilities[idx].value + (newTxn.type === 'expense' ? newTxn.amount : -newTxn.amount)
              };
            }
          }
        }

        // Advance to next month
        nextDue.setMonth(nextDue.getMonth() + 1);
        
        // If deactivated, stop the loop
        if (!ruleClone.active) break;
      }

      if (modified) {
        ruleClone.nextDueDate = nextDue.toISOString().split('T')[0];
        ruleClone.lastProcessedDate = new Date().toISOString().split('T')[0];
      }
      return ruleClone;
    });

    if (newTransactions.length > 0) {
      return {
        ...currentData,
        transactions: [...newTransactions, ...currentData.transactions], // Add new ones to top
        recurringTransactions: updatedRecurring,
        assets: updatedAssets,
        liabilities: updatedLiabilities
      };
    }

    return currentData;
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  // --- Handlers ---

  const handleAddTransaction = (t: Transaction) => {
    let newAssets = [...data.assets];
    let newLiabilities = [...data.liabilities];

    if (t.sourceId) {
      if (t.sourceType === 'asset') {
        const assetIndex = newAssets.findIndex(a => a.id === t.sourceId);
        if (assetIndex !== -1) {
          if (t.type === 'income') newAssets[assetIndex].value += t.amount;
          else newAssets[assetIndex].value -= t.amount;
        }
      } else if (t.sourceType === 'liability') {
        const liabIndex = newLiabilities.findIndex(l => l.id === t.sourceId);
        if (liabIndex !== -1) {
          if (t.type === 'expense') newLiabilities[liabIndex].value += t.amount;
          else newLiabilities[liabIndex].value -= t.amount;
        }
      }
    }

    setData(prev => ({ 
      ...prev, 
      transactions: [t, ...prev.transactions],
      assets: newAssets,
      liabilities: newLiabilities
    }));
  };

  const handleDeleteTransaction = (id: string) => {
    const transaction = data.transactions.find(t => t.id === id);
    if (!transaction) return;

    let newAssets = [...data.assets];
    let newLiabilities = [...data.liabilities];

    if (transaction.sourceId) {
      if (transaction.sourceType === 'asset') {
        const assetIndex = newAssets.findIndex(a => a.id === transaction.sourceId);
        if (assetIndex !== -1) {
          if (transaction.type === 'income') newAssets[assetIndex].value -= transaction.amount;
          else newAssets[assetIndex].value += transaction.amount;
        }
      } else if (transaction.sourceType === 'liability') {
        const liabIndex = newLiabilities.findIndex(l => l.id === transaction.sourceId);
        if (liabIndex !== -1) {
          if (transaction.type === 'expense') newLiabilities[liabIndex].value -= transaction.amount;
          else newLiabilities[liabIndex].value += transaction.amount;
        }
      }
    }

    setData(prev => ({ 
      ...prev, 
      transactions: prev.transactions.filter(t => t.id !== id),
      assets: newAssets,
      liabilities: newLiabilities
    }));
  };

  const handleUpdateAsset = (a: Asset) => {
    setData(prev => {
      const exists = prev.assets.some(item => item.id === a.id);
      if (exists) {
        return { ...prev, assets: prev.assets.map(item => item.id === a.id ? a : item) };
      }
      return { ...prev, assets: [...prev.assets, a] };
    });
  };
  
  const handleDeleteAsset = (id: string) => {
    setData(prev => ({ ...prev, assets: prev.assets.filter(a => a.id !== id) }));
  };

  const handleUpdateLiability = (l: Liability) => {
    setData(prev => {
      const exists = prev.liabilities.some(item => item.id === l.id);
      if (exists) {
        return { ...prev, liabilities: prev.liabilities.map(item => item.id === l.id ? l : item) };
      }
      return { ...prev, liabilities: [...prev.liabilities, l] };
    });
  };
  
  const handleDeleteLiability = (id: string) => {
    setData(prev => ({ ...prev, liabilities: prev.liabilities.filter(l => l.id !== id) }));
  };

  const handleAddCustomCategory = (c: CustomCategory) => {
    setData(prev => ({
      ...prev,
      customCategories: [...(prev.customCategories || []), c]
    }));
  };

  const handleAddRecurringTransaction = (r: RecurringTransaction) => {
    setData(prev => ({
      ...prev,
      recurringTransactions: [...(prev.recurringTransactions || []), r]
    }));
  };

  const handleDeleteRecurringTransaction = (id: string) => {
    setData(prev => ({
      ...prev,
      recurringTransactions: (prev.recurringTransactions || []).filter(r => r.id !== id)
    }));
  };

  const navItems = [
    { id: AppView.DASHBOARD, label: '財務總覽', icon: <LayoutDashboard size={20} /> },
    { id: AppView.TRANSACTIONS, label: '記帳管理', icon: <List size={20} /> },
    { id: AppView.BALANCE_SHEET, label: '資產負債', icon: <Scale size={20} /> },
    { id: AppView.ADVISOR, label: 'AI 智能顧問', icon: <Sparkles size={20} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-20 md:pb-0 md:pl-64 selection:bg-cyan-500/30">
      
      {/* Background effects */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-900/10 rounded-full blur-[120px]"></div>
      </div>

      {/* Sidebar (Desktop) */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900/90 backdrop-blur-xl border-r border-slate-800 hidden md:flex flex-col z-20">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.5)] font-mono text-xl">
              W
            </div>
            <h1 className="text-xl font-bold text-slate-100 tracking-wider font-mono">WealthWise<span className="text-cyan-500">.AI</span></h1>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-medium border ${
                view === item.id 
                ? 'bg-cyan-900/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.15)]' 
                : 'border-transparent text-slate-500 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        
        <div className="px-4 pb-4 space-y-4">
          {/* Install App Button (Only shows if supported and not installed) */}
          {showInstallBtn && (
            <button 
              onClick={handleInstallClick}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-medium hover:bg-emerald-600/30 transition-all hover:shadow-[0_0_10px_rgba(16,185,129,0.2)]"
            >
              <Download size={16} />
              安裝 App
            </button>
          )}

          <div className="p-4 bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 rounded-2xl text-indigo-200 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
             <p className="text-xs font-medium opacity-80 mb-1 text-indigo-400 font-mono">SYS.MSG // HINT</p>
             <p className="text-sm font-medium leading-snug text-shadow">設定週期性交易，讓您的固定支出自動化執行。</p>
          </div>
        </div>
      </aside>

      {/* Header (Mobile) */}
      <header className="md:hidden bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-30 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">W</div>
            <h1 className="text-lg font-bold text-slate-100 font-mono">WealthWise<span className="text-cyan-500">.AI</span></h1>
         </div>
         {showInstallBtn && (
            <button 
              onClick={handleInstallClick}
              className="p-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium animate-pulse"
            >
              <Download size={18} />
            </button>
         )}
      </header>

      {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 z-30 pb-safe">
        <div className="flex justify-around p-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
                view === item.id ? 'text-cyan-400' : 'text-slate-600'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium mt-1">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto p-4 md:p-8 pt-6 relative z-10">
        <header className="mb-8 hidden md:block border-b border-slate-800 pb-4">
          <h2 className="text-3xl font-bold text-slate-100 tracking-tight font-mono">
             <span className="text-cyan-500 mr-2">&gt;</span> 
             {navItems.find(i => i.id === view)?.label}
          </h2>
          <p className="text-slate-500 mt-1 font-mono text-sm">本地加密存儲，絕對掌控您的數位財富。</p>
        </header>

        {view === AppView.DASHBOARD && <Dashboard data={data} />}
        
        {view === AppView.TRANSACTIONS && (
          <Transactions 
            transactions={data.transactions} 
            assets={data.assets}
            liabilities={data.liabilities}
            customCategories={data.customCategories || []}
            recurringTransactions={data.recurringTransactions || []}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onAddCustomCategory={handleAddCustomCategory}
            onAddRecurringTransaction={handleAddRecurringTransaction}
            onDeleteRecurringTransaction={handleDeleteRecurringTransaction}
          />
        )}

        {view === AppView.BALANCE_SHEET && (
          <BalanceSheet 
            assets={data.assets}
            liabilities={data.liabilities}
            onUpdateAsset={handleUpdateAsset}
            onDeleteAsset={handleDeleteAsset}
            onUpdateLiability={handleUpdateLiability}
            onDeleteLiability={handleDeleteLiability}
          />
        )}

        {view === AppView.ADVISOR && <AIAdvisor data={data} />}
      </main>
    </div>
  );
}

export default App;
