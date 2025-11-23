
import React, { useState, useEffect } from 'react';
import { loadData, saveData, generateId } from './services/storageService';
import { FinancialData, AppView, Transaction, Asset, Liability, CustomCategory, RecurringTransaction } from './types';
import { Dashboard } from './components/Dashboard';
import { Transactions } from './components/Transactions';
import { BalanceSheet } from './components/BalanceSheet';
import { AIAdvisor } from './components/AIAdvisor';
import { Settings } from './components/Settings';
import { LayoutDashboard, List, Scale, Sparkles, Download, AlertTriangle, Share, Menu, X, Settings as SettingsIcon } from 'lucide-react';

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
  
  // Mobile Warning State
  const [showPwaWarning, setShowPwaWarning] = useState(false);

  useEffect(() => {
    const storedData = loadData();
    // Ensure fields exist for backward compatibility
    if (!storedData.customCategories) storedData.customCategories = [];
    if (!storedData.recurringTransactions) storedData.recurringTransactions = [];
    
    // 1. Process Recurring Rules (Generate new txns if due)
    let processedData = processRecurringTransactions(storedData);

    // 2. Process Pending Future Transactions (Check if any future txn is now due)
    processedData = processPendingTransactions(processedData);
    
    setData(processedData);
    setIsLoaded(true);
    
    // Capture the PWA install prompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    });

    // --- Native App Detection ---
    const isCapacitor = (window as any).Capacitor !== undefined;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone || isCapacitor;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile && !isStandalone && !isCapacitor) {
      setTimeout(() => setShowPwaWarning(true), 1000);
    }

  }, []);

  useEffect(() => {
    if (isLoaded) {
      saveData(data);
    }
  }, [data, isLoaded]);

  // --- Helper to update balance ---
  const updateBalance = (
    assets: Asset[], 
    liabilities: Liability[], 
    id: string | undefined, 
    type: 'asset' | 'liability' | undefined, 
    amountChange: number // Positive adds value/debt, Negative subtracts
  ) => {
    if (!id || !type) return;

    if (type === 'asset') {
      const idx = assets.findIndex(a => a.id === id);
      if (idx !== -1) {
        assets[idx] = { ...assets[idx], value: assets[idx].value + amountChange };
      }
    } else if (type === 'liability') {
      const idx = liabilities.findIndex(l => l.id === id);
      if (idx !== -1) {
        liabilities[idx] = { ...liabilities[idx], value: liabilities[idx].value + amountChange };
      }
    }
  };

  // --- Core Logic: Process Pending Transactions (Future -> Present) ---
  const processPendingTransactions = (currentData: FinancialData): FinancialData => {
    const todayStr = new Date().toISOString().split('T')[0];
    let newAssets = [...currentData.assets];
    let newLiabilities = [...currentData.liabilities];
    let hasChanges = false;

    const updatedTransactions = currentData.transactions.map(t => {
      // Treat undefined processed as true for legacy data to avoid double counting
      // Only explicitly 'false' means it was a future transaction waiting to happen
      if (t.processed === false && t.date <= todayStr) {
        hasChanges = true;
        // Apply Balance NOW
        applyTransactionEffect(t, newAssets, newLiabilities);
        return { ...t, processed: true };
      }
      return t;
    });

    if (!hasChanges) return currentData;

    return {
      ...currentData,
      transactions: updatedTransactions,
      assets: newAssets,
      liabilities: newLiabilities
    };
  };

  // Reusable function to apply transaction effect
  const applyTransactionEffect = (t: Transaction, assets: Asset[], liabilities: Liability[]) => {
    if (t.type === 'income') {
      if (t.sourceType === 'asset') updateBalance(assets, liabilities, t.sourceId, t.sourceType, t.amount);
      else updateBalance(assets, liabilities, t.sourceId, t.sourceType, -t.amount);
    } else if (t.type === 'expense') {
      if (t.sourceType === 'asset') updateBalance(assets, liabilities, t.sourceId, t.sourceType, -t.amount);
      else updateBalance(assets, liabilities, t.sourceId, t.sourceType, t.amount);
    } else if (t.type === 'transfer') {
      // Source Out
      if (t.sourceType === 'asset') updateBalance(assets, liabilities, t.sourceId, t.sourceType, -t.amount);
      else updateBalance(assets, liabilities, t.sourceId, t.sourceType, t.amount);
      // Destination In
      if (t.destinationType === 'asset') updateBalance(assets, liabilities, t.destinationId, t.destinationType, t.amount);
      else updateBalance(assets, liabilities, t.destinationId, t.destinationType, -t.amount);
    }
  };

  // Reverse transaction effect (for undo/delete)
  const reverseTransactionEffect = (t: Transaction, assets: Asset[], liabilities: Liability[]) => {
    if (t.type === 'income') {
       if (t.sourceType === 'asset') updateBalance(assets, liabilities, t.sourceId, t.sourceType, -t.amount);
       else updateBalance(assets, liabilities, t.sourceId, t.sourceType, t.amount);
    } else if (t.type === 'expense') {
       if (t.sourceType === 'asset') updateBalance(assets, liabilities, t.sourceId, t.sourceType, t.amount);
       else updateBalance(assets, liabilities, t.sourceId, t.sourceType, -t.amount);
    } else if (t.type === 'transfer') {
       // Reverse Source
       if (t.sourceType === 'asset') updateBalance(assets, liabilities, t.sourceId, t.sourceType, t.amount);
       else updateBalance(assets, liabilities, t.sourceId, t.sourceType, -t.amount);
       // Reverse Dest
       if (t.destinationType === 'asset') updateBalance(assets, liabilities, t.destinationId, t.destinationType, -t.amount);
       else updateBalance(assets, liabilities, t.destinationId, t.destinationType, t.amount);
    }
  };

  // --- Core Logic: Process Recurring Transactions ---
  const processRecurringTransactions = (currentData: FinancialData): FinancialData => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    let newTransactions: Transaction[] = [];
    let updatedAssets = [...currentData.assets];
    let updatedLiabilities = [...currentData.liabilities];

    const updatedRecurring = currentData.recurringTransactions?.map(rule => {
      if (!rule.active) return rule;

      let nextDue = new Date(rule.nextDueDate);
      let modified = false;
      let ruleClone = { ...rule };

      // Loop to catch up all missed recurrences up to today
      while (nextDue <= today) {
        if (ruleClone.remainingOccurrences !== undefined && ruleClone.remainingOccurrences <= 0) {
           ruleClone.active = false;
           break; 
        }

        modified = true;
        const nextDueStr = nextDue.toISOString().split('T')[0];
        
        // Generate the transaction
        // Note: Since nextDue <= today, these are processed immediately
        const newTxn: Transaction = {
          id: generateId(),
          date: nextDueStr,
          type: rule.type,
          amount: rule.amount,
          category: rule.category,
          note: `[自動扣款] ${rule.name} ${ruleClone.remainingOccurrences !== undefined ? `(剩餘 ${ruleClone.remainingOccurrences - 1} 期)` : ''}`,
          sourceId: rule.sourceId,
          sourceType: rule.sourceType,
          destinationId: rule.destinationId,
          destinationType: rule.destinationType,
          recurringRuleId: rule.id,
          processed: true // Immediate processing for catch-up
        };
        newTransactions.push(newTxn);
        
        // Apply Balance immediately since it's due/past
        applyTransactionEffect(newTxn, updatedAssets, updatedLiabilities);

        if (ruleClone.remainingOccurrences !== undefined) {
          ruleClone.remainingOccurrences -= 1;
          if (ruleClone.remainingOccurrences <= 0) {
             ruleClone.active = false;
          }
        }

        // Advance date
        nextDue.setMonth(nextDue.getMonth() + 1);
        if (!ruleClone.active) break;
      }

      if (modified) {
        ruleClone.nextDueDate = nextDue.toISOString().split('T')[0];
        ruleClone.lastProcessedDate = todayStr;
      }
      return ruleClone;
    });

    if (newTransactions.length > 0) {
      return {
        ...currentData,
        transactions: [...newTransactions, ...currentData.transactions],
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

  const handleImportData = (newData: FinancialData) => {
    setData(newData);
    saveData(newData);
  };

  // --- CRUD Handlers ---

  const handleAddTransaction = (t: Transaction) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const isFuture = t.date > todayStr;

    let newAssets = [...data.assets];
    let newLiabilities = [...data.liabilities];

    // Only apply balance effect if NOT future
    if (!isFuture) {
      applyTransactionEffect(t, newAssets, newLiabilities);
    }

    const newTransaction = { ...t, processed: !isFuture };

    setData(prev => ({ 
      ...prev, 
      transactions: [newTransaction, ...prev.transactions],
      assets: newAssets,
      liabilities: newLiabilities
    }));
  };

  const handleUpdateTransaction = (updatedT: Transaction) => {
    const oldT = data.transactions.find(t => t.id === updatedT.id);
    if (!oldT) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const isFuture = updatedT.date > todayStr;

    let newAssets = [...data.assets];
    let newLiabilities = [...data.liabilities];

    // 1. Revert Old Transaction (Only if it was processed)
    // Legacy data undefined processed = true
    if (oldT.processed !== false) {
        reverseTransactionEffect(oldT, newAssets, newLiabilities);
    }

    // 2. Apply New Transaction (Only if NOT future)
    if (!isFuture) {
        applyTransactionEffect(updatedT, newAssets, newLiabilities);
    }

    const finalT = { ...updatedT, processed: !isFuture };

    setData(prev => ({
        ...prev,
        transactions: prev.transactions.map(t => t.id === updatedT.id ? finalT : t),
        assets: newAssets,
        liabilities: newLiabilities
    }));
  };

  const handleDeleteTransaction = (id: string) => {
    const transaction = data.transactions.find(t => t.id === id);
    if (!transaction) return;

    let newAssets = [...data.assets];
    let newLiabilities = [...data.liabilities];

    // Only reverse effect if it was processed
    if (transaction.processed !== false) {
        reverseTransactionEffect(transaction, newAssets, newLiabilities);
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
    setData(prev => {
      const list = prev.recurringTransactions || [];
      const index = list.findIndex(i => i.id === r.id);
      if (index !== -1) {
         // Update existing
         const newList = [...list];
         newList[index] = r;
         return { ...prev, recurringTransactions: newList };
      }
      // Add new
      return { ...prev, recurringTransactions: [...list, r] };
    });
  };

  const handleDeleteRecurringTransaction = (id: string, deleteAllHistory: boolean) => {
    let newAssets = [...data.assets];
    let newLiabilities = [...data.liabilities];
    let updatedTransactions = [...data.transactions];

    if (deleteAllHistory) {
      const linkedTransactions = updatedTransactions.filter(t => t.recurringRuleId === id);
      
      // Revert balances only for processed transactions
      linkedTransactions.forEach(transaction => {
        if (transaction.processed !== false) {
            reverseTransactionEffect(transaction, newAssets, newLiabilities);
        }
      });

      updatedTransactions = updatedTransactions.filter(t => t.recurringRuleId !== id);
    }

    setData(prev => ({
      ...prev,
      transactions: updatedTransactions,
      assets: newAssets,
      liabilities: newLiabilities,
      recurringTransactions: (prev.recurringTransactions || []).filter(r => r.id !== id)
    }));
  };

  const navItems = [
    { id: AppView.DASHBOARD, label: '財務總覽', icon: <LayoutDashboard size={20} /> },
    { id: AppView.TRANSACTIONS, label: '記帳管理', icon: <List size={20} /> },
    { id: AppView.BALANCE_SHEET, label: '資產負債', icon: <Scale size={20} /> },
    { id: AppView.ADVISOR, label: 'AI 智能顧問', icon: <Sparkles size={20} /> },
    { id: AppView.SETTINGS, label: '系統設定', icon: <SettingsIcon size={20} /> },
  ];

  const CyberpunkLogo = ({ className = "w-10 h-10" }: { className?: string }) => (
    <div className={`${className} relative bg-slate-900 rounded-lg border border-slate-700 flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(6,182,212,0.3)] group`}>
       <div className="absolute inset-0 bg-cyan-900/20 group-hover:bg-cyan-500/10 transition-colors"></div>
       <div className="absolute inset-0 flex items-center justify-center translate-x-[-1px] translate-y-0 opacity-80">
          <span className="font-mono font-black text-xl sm:text-2xl text-cyan-400 tracking-tighter flex leading-none">
            <span>W</span><span className="-ml-1">W</span>
          </span>
       </div>
       <div className="absolute inset-0 flex items-center justify-center translate-x-[1px] translate-y-[1px] opacity-80 mix-blend-screen">
          <span className="font-mono font-black text-xl sm:text-2xl text-fuchsia-500 tracking-tighter flex leading-none">
            <span>W</span><span className="-ml-1">W</span>
          </span>
       </div>
       <div className="relative z-10 flex items-center justify-center mix-blend-overlay">
          <span className="font-mono font-black text-xl sm:text-2xl text-white tracking-tighter flex leading-none">
            <span>W</span><span className="-ml-1">W</span>
          </span>
       </div>
    </div>
  );

  return (
    <div className="h-full bg-slate-950 text-slate-200 font-sans md:pl-64 selection:bg-cyan-500/30 relative flex flex-col">
      
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-900/10 rounded-full blur-[120px]"></div>
      </div>

      {showPwaWarning && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 w-full sm:max-w-md border-t sm:border border-rose-500/50 sm:rounded-2xl shadow-[0_0_50px_rgba(244,63,94,0.3)] p-6 relative overflow-hidden mb-safe sm:mb-0">
             <div className="absolute top-0 left-0 w-full h-1 bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.8)] animate-scan-line"></div>
             <div className="absolute top-0 right-0 p-4 text-[10px] text-rose-900 font-tech font-bold">SECURITY_PROTOCOL_OVERRIDE</div>

             <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-rose-900/20 border border-rose-500/50 rounded-lg text-rose-500 animate-pulse">
                   <AlertTriangle size={32} />
                </div>
                <div>
                   <h3 className="text-xl font-bold text-rose-500 font-mono tracking-wide">SYSTEM NOTICE</h3>
                   <p className="text-xs text-rose-300/80 font-mono mt-1">UNSECURE_ENV_DETECTED</p>
                </div>
             </div>

             <div className="space-y-4 text-slate-300 text-sm">
                <p>
                   偵測到您正在使用手機瀏覽器開啟。為了防止資料因瀏覽器清除快取而遺失，<span className="text-cyan-400 font-bold">請務必將此應用程式加入主畫面</span>。
                </p>
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                   <p className="text-xs text-slate-400 mb-2 font-mono uppercase">Install Instructions:</p>
                   <ol className="list-decimal list-inside space-y-2 text-slate-200">
                      <li className="flex items-center gap-2">
                         點擊瀏覽器選單 <span className="text-slate-500 text-xs">(分享 <Share size={12} className="inline"/> 或選單 <Menu size={12} className="inline"/>)</span>
                      </li>
                      <li>選擇 <span className="text-cyan-400 font-bold">「加入主畫面」</span> (Add to Home Screen)</li>
                      <li>從主畫面開啟 <span className="font-bold font-mono">WW</span> 圖示開始使用</li>
                   </ol>
                </div>
             </div>

             <div className="mt-6 flex gap-3">
                <button 
                  onClick={() => setShowPwaWarning(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl font-mono text-xs border border-slate-700 transition-colors"
                >
                   暫時忽略 (資料不安全)
                </button>
             </div>
          </div>
        </div>
      )}

      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900/90 backdrop-blur-xl border-r border-slate-800 hidden md:flex flex-col z-20">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <CyberpunkLogo />
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

      <header className="md:hidden bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-30 flex items-center justify-between shadow-lg pt-safe">
         <div className="flex items-center gap-2">
            <CyberpunkLogo className="w-9 h-9" />
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

      <main className="flex-1 overflow-y-auto max-w-5xl w-full mx-auto p-4 md:p-8 pt-6 pb-28 md:pb-8 relative z-10 scrollbar-none">
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
            onUpdateTransaction={handleUpdateTransaction}
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

        {view === AppView.SETTINGS && <Settings data={data} onImportData={handleImportData} />}
      </main>

      <nav className="md:hidden flex-none bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 z-30 pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.5)] fixed bottom-0 left-0 w-full">
        <div className="flex justify-around p-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-col items-center p-2 rounded-xl transition-colors flex-1 ${
                view === item.id ? 'text-cyan-400' : 'text-slate-600'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium mt-1">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default App;