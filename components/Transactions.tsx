
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, Asset, Liability, CustomCategory, RecurringTransaction } from '../types';
import { generateId } from '../services/storageService';
import { suggestCategoryIcons } from '../services/geminiService';
import * as LucideIcons from 'lucide-react';
import { 
  Plus, ArrowDownCircle, ArrowUpCircle, Trash2, Search, ChevronLeft, ChevronRight, 
  Calendar as CalendarIcon, CreditCard, Utensils, Coffee, Bus, ShoppingBag, 
  Home, Gamepad2, Heart, GraduationCap, Users, FileText, TrendingDown, Shield, 
  Cat, Briefcase, Award, TrendingUp, PieChart, Clock, Building, Gift, RotateCcw, 
  MoreHorizontal, Smartphone, Plane, Wrench, Landmark, Baby, Edit3, RefreshCw, X, Check,
  Repeat, History, Settings, Infinity, ArrowRightLeft, ArrowRight, AlertCircle
} from 'lucide-react';

interface TransactionsProps {
  transactions: Transaction[];
  assets: Asset[];
  liabilities: Liability[];
  customCategories: CustomCategory[];
  recurringTransactions: RecurringTransaction[];
  onAddTransaction: (t: Transaction) => void;
  onUpdateTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onAddCustomCategory: (c: CustomCategory) => void;
  onAddRecurringTransaction: (r: RecurringTransaction) => void;
  onDeleteRecurringTransaction: (id: string, deleteAllHistory: boolean) => void;
}

// Define Category Lists with Icons
const DEFAULT_EXPENSE_CATEGORIES = [
  { name: '餐飲', iconName: 'Utensils' },
  { name: '飲料', iconName: 'Coffee' },
  { name: '交通', iconName: 'Bus' },
  { name: '購物', iconName: 'ShoppingBag' },
  { name: '居住', iconName: 'Home' },
  { name: '娛樂', iconName: 'Gamepad2' },
  { name: '通訊', iconName: 'Smartphone' },
  { name: '醫療', iconName: 'Heart' },
  { name: '教育', iconName: 'GraduationCap' },
  { name: '社交', iconName: 'Users' },
  { name: '帳單', iconName: 'FileText' },
  { name: '投資虧損', iconName: 'TrendingDown' },
  { name: '送禮', iconName: 'Gift' },
  { name: '保險', iconName: 'Shield' },
  { name: '寵物', iconName: 'Cat' },
  { name: '旅遊', iconName: 'Plane' },
  { name: '維修', iconName: 'Wrench' },
  { name: '稅務', iconName: 'Landmark' },
  { name: '育兒', iconName: 'Baby' },
  { name: '其他', iconName: 'MoreHorizontal' },
];

const DEFAULT_INCOME_CATEGORIES = [
  { name: '薪資', iconName: 'Briefcase' },
  { name: '獎金', iconName: 'Award' },
  { name: '投資獲利', iconName: 'TrendingUp' },
  { name: '股息', iconName: 'PieChart' },
  { name: '兼職', iconName: 'Clock' },
  { name: '房租收入', iconName: 'Building' },
  { name: '收禮/紅包', iconName: 'Gift' },
  { name: '退款', iconName: 'RotateCcw' },
  { name: '交易', iconName: 'ArrowDownCircle' },
  { name: '其他', iconName: 'MoreHorizontal' },
];

const DEFAULT_TRANSFER_CATEGORIES = [
  { name: '轉帳', iconName: 'ArrowRightLeft' },
  { name: '還款', iconName: 'CreditCard' },
  { name: '投資入金', iconName: 'TrendingUp' },
  { name: '儲蓄', iconName: 'PiggyBank' },
  { name: '提款', iconName: 'Banknote' },
  { name: '其他', iconName: 'MoreHorizontal' },
];

// Helper to safely get icon component
const getIconComponent = (iconName: string) => {
  // @ts-ignore
  const Icon = LucideIcons[iconName] || LucideIcons.HelpCircle;
  return Icon;
};

// Helper for compact number formatting
const formatCompactAmount = (num: number) => {
  const absNum = Math.abs(num);
  if (absNum < 10000) return num.toLocaleString(); // 9999 or -9999
  if (absNum < 1000000) return `${(num / 10000).toFixed(1)}萬`; // 1.1萬
  return `${(num / 1000000).toFixed(1)}M`; // 10.1M
};

export const Transactions: React.FC<TransactionsProps> = ({ 
  transactions, assets, liabilities, customCategories, recurringTransactions,
  onAddTransaction, onUpdateTransaction, onDeleteTransaction, onAddCustomCategory,
  onAddRecurringTransaction, onDeleteRecurringTransaction
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'recurring'>('history');
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState('');
  
  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateDetail, setSelectedDateDetail] = useState<string | null>(null); // For Modal

  // Transaction Form State
  const [editingId, setEditingId] = useState<string | null>(null); // If null, we are adding. If set, we are editing.
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Source (From)
  const [sourceId, setSourceId] = useState('');
  // Destination (To) - for Transfers
  const [destinationId, setDestinationId] = useState('');

  // Recurring State in Form
  const [isRecurring, setIsRecurring] = useState(false);
  // REMOVED: recurringLimit state (now always fixed)
  const [recurringCount, setRecurringCount] = useState<number | string>(12); // Allow string for input handling

  // --- Custom Category Modal State ---
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<TransactionType>('expense');
  const [suggestedIcons, setSuggestedIcons] = useState<string[]>([]);
  const [selectedIcon, setSelectedIcon] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);

  // --- Helpers ---
  const resetForm = () => {
    setEditingId(null);
    setAmount('');
    setCategory(''); 
    setNote('');
    setSourceId('');
    setDestinationId('');
    setIsRecurring(false);
    setRecurringCount(12); // Reset to default
    setIsAdding(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Basic Validation with Alerts
    if (!amount) {
        alert('請輸入金額 (AMOUNT)');
        return;
    }
    if (!category) {
        alert('請選擇一個類別 (CATEGORY)');
        return;
    }
    
    // 2. Transfer Validation
    if (type === 'transfer') {
        if (!sourceId || !destinationId) {
          alert('轉帳必須選擇「來源帳戶」與「轉入帳戶」');
          return;
        }
        if (sourceId === destinationId) {
          alert('來源與轉入帳戶不能相同');
          return;
        }
    }

    // 3. Account Mapping
    let sourceType: 'asset' | 'liability' | undefined = undefined;
    let destinationType: 'asset' | 'liability' | undefined = undefined;
    
    if (sourceId) {
      if (assets.some(a => a.id === sourceId)) sourceType = 'asset';
      else if (liabilities.some(l => l.id === sourceId)) sourceType = 'liability';
    }

    if (destinationId) {
      if (assets.some(a => a.id === destinationId)) destinationType = 'asset';
      else if (liabilities.some(l => l.id === destinationId)) destinationType = 'liability';
    }

    // 4. Recurring Logic (Only available when adding new, not editing existing to recurring)
    if (isRecurring && !editingId) {
       const dayOfMonth = new Date(date).getDate();
       const selectedDate = new Date(date);
       const today = new Date();
       today.setHours(0,0,0,0);
       selectedDate.setHours(0,0,0,0);

       const isDueTodayOrPast = selectedDate <= today;

       // ALWAYS use the count, no infinite option anymore
       const countVal = typeof recurringCount === 'string' ? parseInt(recurringCount) || 12 : recurringCount;
       let remaining = countVal;

       // If we execute one immediately, reduce count
       if (isDueTodayOrPast && remaining > 0) {
         remaining = remaining - 1;
       }

       // Calculate next due date
       let nextDue = date;
       if (isDueTodayOrPast) {
         const d = new Date(date);
         d.setMonth(d.getMonth() + 1);
         nextDue = d.toISOString().split('T')[0];
       }
       
       const newRuleId = generateId();

       const recurring: RecurringTransaction = {
          id: newRuleId,
          name: note || category,
          amount: parseFloat(amount),
          type,
          category,
          sourceId: sourceId || undefined,
          sourceType,
          destinationId: destinationId || undefined,
          destinationType,
          frequency: 'monthly',
          dayOfMonth,
          nextDueDate: nextDue, 
          active: true,
          remainingOccurrences: remaining
       };

       // Add the rule
       if (remaining >= 0) {
         onAddRecurringTransaction(recurring);
       }

       // If the start date is today or past, add the first transaction immediately
       if (isDueTodayOrPast) {
         const newTransaction: Transaction = {
           id: generateId(),
           date,
           type,
           amount: parseFloat(amount),
           category,
           note: `[自動扣款首筆] ${note} (共 ${countVal} 期)`,
           sourceId: sourceId || undefined,
           sourceType,
           destinationId: destinationId || undefined,
           destinationType,
           recurringRuleId: newRuleId
         };
         onAddTransaction(newTransaction);
         alert(`已儲存週期設定，並自動新增了第一筆交易！(共 ${countVal} 期)`);
       } else {
         alert(`已儲存週期設定！第一筆交易將於 ${date} 自動執行。(共 ${countVal} 期)`);
       }

    } else {
      // 5. Standard Transaction (Add or Update)
      const transactionPayload: Transaction = {
        id: editingId || generateId(), // Use existing ID if editing
        date,
        type,
        amount: parseFloat(amount),
        category,
        note,
        sourceId: sourceId || undefined,
        sourceType,
        destinationId: destinationId || undefined,
        destinationType,
        // Preserve existing recurring link if we are editing a transaction that belongs to a rule
        recurringRuleId: editingId ? transactions.find(t => t.id === editingId)?.recurringRuleId : undefined
      };

      if (editingId) {
        onUpdateTransaction(transactionPayload);
      } else {
        onAddTransaction(transactionPayload);
      }
    }

    resetForm();
  };

  const handleEditClick = (t: Transaction) => {
    setEditingId(t.id);
    setDate(t.date);
    setType(t.type);
    setAmount(t.amount.toString());
    setCategory(t.category);
    setNote(t.note);
    setSourceId(t.sourceId || '');
    setDestinationId(t.destinationId || '');
    setIsRecurring(false); // Editing existing transaction doesn't change recurring rule directly
    setIsAdding(true);
    setSelectedDateDetail(null); // Close modal if open
  };

  // Handle Recurring Deletion
  const handleDeleteRecurringClick = (id: string) => {
    const choice = window.confirm("是否確定要取消此循環交易設定？\n\n點擊「確定」繼續下一步。");
    if (!choice) return;

    const deleteHistory = window.confirm("【請選擇取消範圍】\n\n您希望如何處理過去已經產生的交易紀錄？\n\n【確定】= 「從頭到尾都取消」 (刪除設定 + 清除所有歷史紀錄)\n【取消】= 「從這次以後都取消」 (僅刪除未來設定，保留歷史紀錄)");
    
    onDeleteRecurringTransaction(id, deleteHistory);
  };

  // Handle Single Transaction Deletion that might be linked
  const handleDeleteTransactionClick = (id: string) => {
      const txn = transactions.find(t => t.id === id);
      if (txn && txn.recurringRuleId) {
         const choice = window.confirm("這是一筆「循環交易」產生的紀錄。\n\n您希望：\n【確定】= 僅刪除這一筆 (例外處理)\n【取消】= 什麼都不做 (取消操作)");
         if(choice) onDeleteTransaction(id);
      } else {
         const choice = window.confirm("確定要刪除這筆交易嗎？");
         if(choice) onDeleteTransaction(id);
      }
  };

  // Custom Category Logic
  const handleSuggestIcons = async () => {
    if (!newCatName) return;
    setIsSuggesting(true);
    setSuggestedIcons([]);
    setSelectedIcon('');
    const icons = await suggestCategoryIcons(newCatName);
    setSuggestedIcons(icons);
    if (icons.length > 0) setSelectedIcon(icons[0]);
    setIsSuggesting(false);
  };

  const handleSaveCustomCategory = () => {
    if (!newCatName || !selectedIcon) return;
    onAddCustomCategory({
      id: generateId(),
      name: newCatName,
      type: newCatType,
      iconName: selectedIcon
    });
    setNewCatName('');
    setSuggestedIcons([]);
    setSelectedIcon('');
    setIsEditingCategory(false);
  };

  // --- Calendar Logic ---
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Calculate Future/Projected Transactions for the current View Month
  const projectedTransactions = useMemo(() => {
     const projected: any[] = [];
     const viewYear = currentDate.getFullYear();
     const viewMonth = currentDate.getMonth(); // 0-11
     
     recurringTransactions.forEach(rule => {
        if (!rule.active) return;
        
        // We want to show the projection for this month's specific day
        // Note: If the "nextDueDate" is in a future month, it means this month is already processed or skipped.
        // But for visual calendar consistency, users expect to see the recurring item on the Nth day of EVERY month.
        
        // Simple logic: If the rule is active, show a ghost item on 'dayOfMonth' of the current view month
        // UNLESS: 
        // 1. The date is in the past relative to "Next Due Date" (meaning it's already done or skipped)
        // 2. The date is in the past relative to "Today" (don't project past ghost items, rely on actual history)
        
        const targetDate = new Date(viewYear, viewMonth, rule.dayOfMonth);
        const nextDue = new Date(rule.nextDueDate);
        const today = new Date();
        today.setHours(0,0,0,0);

        // If the target date for this month is invalid (e.g. Feb 30), skip
        if (targetDate.getMonth() !== viewMonth) return;

        const dateString = targetDate.toISOString().split('T')[0];

        // Only show projection if:
        // 1. The target date is >= Today (Future or Today)
        // 2. We haven't already generated a real transaction for this rule on this date (deduplication)
        
        const exists = transactions.some(t => t.recurringRuleId === rule.id && t.date === dateString);
        
        if (!exists && targetDate >= today) {
            // Check remaining occurrences if fixed
            // This is a simplified visual check. Accurate check requires iterating from nextDueDate.
            // For UI simplicity, we just show it if active.
            projected.push({
                ...rule,
                isProjected: true,
                date: dateString,
                note: '(預計發生)'
            });
        }
     });
     return projected;
  }, [recurringTransactions, currentDate, transactions]);

  // Group transactions by date for the calendar
  const transactionsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    
    // 1. Real Transactions
    transactions.forEach(t => {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    });

    // 2. Projected Transactions
    projectedTransactions.forEach(p => {
        if (!map[p.date]) map[p.date] = [];
        map[p.date].push(p);
    });

    return map;
  }, [transactions, projectedTransactions]);

  const dailyStats = useMemo(() => {
    const stats: Record<string, { income: number; expense: number }> = {};
    transactions.forEach(t => {
      if (!stats[t.date]) stats[t.date] = { income: 0, expense: 0 };
      if (t.type === 'income') stats[t.date].income += t.amount;
      else if (t.type === 'expense') stats[t.date].expense += t.amount;
    });
    return stats;
  }, [transactions]);

  const formatDuration = (val: number | string) => {
    const months = typeof val === 'string' ? parseInt(val) || 0 : val;
    if (months < 12) return `${months} 個月`;
    const y = Math.floor(months / 12);
    const m = months % 12;
    if (m === 0) return `${y} 年`;
    return `${y} 年 ${m} 個月`;
  };

  const renderCalendarDays = () => {
    const days = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="min-h-[80px] sm:min-h-[100px] h-auto bg-slate-900/30 border border-slate-800/50"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const stat = dailyStats[dateString];
      const dailyItems = transactionsByDate[dateString] || [];
      const isToday = new Date().toISOString().split('T')[0] === dateString;
      const isSelected = date === dateString;

      // Calculate Net for the day (Income - Expense)
      const netAmount = stat ? stat.income - stat.expense : 0;

      days.push(
        <div 
          key={d} 
          onClick={() => {
             setDate(dateString);
             setSelectedDateDetail(dateString);
          }}
          className={`min-h-[80px] sm:min-h-[100px] border p-1 relative group cursor-pointer transition-all overflow-hidden flex flex-col
            ${isSelected 
              ? 'border-cyan-500 bg-cyan-900/10 shadow-[inset_0_0_10px_rgba(6,182,212,0.2)]' 
              : 'border-slate-800 hover:border-slate-600 hover:bg-slate-800/50'}
            ${isToday ? 'bg-slate-800' : 'bg-slate-900/60'}
          `}
        >
          {/* Header: Date */}
          <div className={`text-xs font-mono mb-1 flex justify-between items-start flex-shrink-0`}>
             <span className={`${isToday ? 'text-cyan-400 font-bold' : 'text-slate-500'} ${isSelected ? 'text-cyan-300' : ''}`}>
                {d}
             </span>
             {isToday && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>}
          </div>

          {/* Scrollable Transaction Items */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none space-y-0.5 mb-1">
             {dailyItems.map((t, idx) => (
               <div key={t.id || `proj-${idx}`} className={`flex justify-between items-center text-[9px] sm:text-[10px] font-mono leading-tight px-0.5 rounded ${t.isProjected ? 'bg-slate-800/30 border border-dashed border-slate-700/50 opacity-70' : 'bg-black/20'}`}>
                 <span className={`truncate w-full ${
                    t.type === 'income' ? 'text-emerald-300' : 
                    t.type === 'expense' ? 'text-rose-300' : 'text-blue-300'
                 }`}>
                   {t.isProjected && <span className="text-[8px] mr-1">↺</span>}
                   {t.type === 'transfer' ? '⇄ ' : ''}{t.category}
                 </span>
               </div>
             ))}
          </div>
          
          {/* Daily Net Summary - Single Number */}
          {netAmount !== 0 && (
            <div className={`flex justify-center border-t border-slate-700/50 pt-0.5 mt-auto flex-shrink-0 font-mono text-[9px] sm:text-[10px] font-bold ${netAmount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
               {netAmount > 0 ? '+' : ''}{formatCompactAmount(netAmount)}
            </div>
          )}

          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"></div>
        </div>
      );
    }
    return days;
  };

  const filteredTransactions = transactions
    .filter(t => 
      (t.category.toLowerCase().includes(filter.toLowerCase()) || 
      t.note.toLowerCase().includes(filter.toLowerCase()))
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getSourceName = (sourceId: string | undefined, sourceType: string | undefined) => {
    if (!sourceId) return '-';
    if (sourceType === 'asset') {
      return assets.find(a => a.id === sourceId)?.name || '未知資產';
    }
    if (sourceType === 'liability') {
      return liabilities.find(l => l.id === sourceId)?.name || '未知負債';
    }
    return '-';
  };

  // Merge defaults with customs
  const currentCategories = useMemo(() => {
    let defaults;
    if (type === 'income') defaults = DEFAULT_INCOME_CATEGORIES;
    else if (type === 'expense') defaults = DEFAULT_EXPENSE_CATEGORIES;
    else defaults = DEFAULT_TRANSFER_CATEGORIES;

    const customs = customCategories
      .filter(c => c.type === type)
      .map(c => ({ name: c.name, iconName: c.iconName }));
    return [...defaults, ...customs];
  }, [type, customCategories]);

  // Group options for selects
  const renderAccountOptions = (excludeId?: string) => (
    <>
      <option value="">請選擇帳戶</option>
      {assets.length > 0 && (
        <optgroup label="資產 (Assets)">
          {assets.filter(a => a.id !== excludeId).map(a => (
            <option key={a.id} value={a.id}>{a.name} (${a.value.toLocaleString()})</option>
          ))}
        </optgroup>
      )}
      {liabilities.length > 0 && (
        <optgroup label="負債 (Liabilities)">
          {liabilities.filter(l => l.id !== excludeId).map(l => (
            <option key={l.id} value={l.id}>{l.name} (${l.value.toLocaleString()})</option>
          ))}
        </optgroup>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      
      {/* --- Tab Switcher --- */}
      <div className="flex space-x-4 border-b border-slate-700 pb-1 overflow-x-auto scrollbar-none">
        <button 
           onClick={() => setActiveTab('history')}
           className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'history' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
           <History size={16} /> 交易紀錄
        </button>
        <button 
           onClick={() => setActiveTab('recurring')}
           className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'recurring' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
           <Repeat size={16} /> 週期性設定 (自動扣款)
        </button>
      </div>

      {activeTab === 'history' && (
        <>
          {/* --- Calendar Section --- */}
          <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700 rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/30">
              <div className="flex items-center gap-2 text-cyan-400 font-mono font-bold">
                <CalendarIcon size={18} />
                <span>{currentDate.getFullYear()} 年 {currentDate.getMonth() + 1} 月</span>
              </div>
              <div className="flex gap-2">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-cyan-400 transition-colors">
                  <ChevronLeft size={20} />
                </button>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-cyan-400 transition-colors">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 bg-slate-800 border-b border-slate-700">
              {['日', '一', '二', '三', '四', '五', '六'].map((day, i) => (
                <div key={day} className={`py-2 text-center text-xs font-bold font-mono ${i === 0 || i === 6 ? 'text-rose-500/70' : 'text-slate-500'}`}>
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 auto-rows-fr bg-slate-950">
              {renderCalendarDays()}
            </div>
          </div>

          {/* --- Controls & List --- */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-64 group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl opacity-20 group-focus-within:opacity-75 transition duration-500"></div>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="搜尋交易..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="relative w-full pl-10 pr-4 py-2 bg-slate-900 rounded-xl border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 text-sm font-mono"
              />
            </div>
            <button
              onClick={() => { setIsAdding(!isAdding); setEditingId(null); }}
              className="relative w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_20px_rgba(6,182,212,0.6)] transition-all overflow-hidden group bg-cyan-600 text-white hover:bg-cyan-500"
            >
              <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
              <Plus size={18} />
              <span className="relative">新增交易</span>
            </button>
          </div>

          {/* --- ADD/EDIT TRANSACTION FORM --- */}
          {isAdding && (
            <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-xl border border-cyan-500/30 shadow-2xl animate-fade-in-down relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 text-[10px] text-cyan-900/50 font-tech">INPUT.STREAM.ACTIVE</div>
              <h3 className="text-lg font-bold text-cyan-400 mb-4 tracking-wide font-mono border-b border-slate-800 pb-2">
                {editingId ? `// EDIT_TRANSACTION (ID: ${editingId.slice(0,4)}...)` : '// NEW_TRANSACTION'}
              </h3>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-cyan-600 mb-2 font-mono">TYPE (類型)</label>
                  <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                    <button
                      type="button"
                      onClick={() => { setType('income'); setCategory(''); }}
                      className={`flex-1 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-all ${type === 'income' ? 'bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      收入
                    </button>
                    <button
                      type="button"
                      onClick={() => { setType('expense'); setCategory(''); }}
                      className={`flex-1 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-all ${type === 'expense' ? 'bg-rose-600 text-white shadow-[0_0_10px_rgba(225,29,72,0.5)]' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      支出
                    </button>
                    <button
                      type="button"
                      onClick={() => { setType('transfer'); setCategory(''); }}
                      className={`flex-1 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-all ${type === 'transfer' ? 'bg-slate-500 text-white shadow-[0_0_10px_rgba(148,163,184,0.5)]' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      轉帳
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-cyan-600 mb-2 font-mono">DATE (日期)</label>
                  <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm font-mono"
                      required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-cyan-600 mb-2 font-mono">AMOUNT (金額)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm font-mono"
                        required
                    />
                  </div>
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <div className="flex justify-between items-end mb-2">
                      <label className="block text-xs font-medium text-cyan-600 font-mono">CATEGORY (類別)</label>
                      <button 
                        type="button" 
                        onClick={() => setIsEditingCategory(true)}
                        className="text-[10px] flex items-center gap-1 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded hover:bg-cyan-900/30 transition-colors"
                      >
                        <Edit3 size={10} /> 編輯/新增類別
                      </button>
                  </div>
                  
                  {/* Category Grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 mb-3">
                      {currentCategories.map((cat) => {
                        const Icon = getIconComponent(cat.iconName);
                        return (
                          <button
                            key={cat.name}
                            type="button"
                            onClick={() => setCategory(cat.name)}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all group relative
                              ${category === cat.name 
                                ? 'bg-cyan-900/40 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)] scale-105' 
                                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700 hover:border-slate-500'
                              }
                            `}
                          >
                            <Icon size={20} className="mb-1" />
                            <span className="text-[10px] font-medium truncate w-full text-center">{cat.name}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Source / Destination Logic */}
                {type === 'transfer' ? (
                  <>
                    <div>
                        <label className="block text-xs font-medium text-cyan-600 mb-2 font-mono">FROM (來源帳戶)</label>
                        <select
                          value={sourceId}
                          onChange={(e) => setSourceId(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm"
                          required
                        >
                          {renderAccountOptions(destinationId)}
                        </select>
                    </div>
                    <div className="flex items-center justify-center pt-6 text-slate-500">
                        <ArrowRight size={24} className="text-cyan-500 animate-pulse" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-cyan-600 mb-2 font-mono">TO (轉入/還款帳戶)</label>
                        <select
                          value={destinationId}
                          onChange={(e) => setDestinationId(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm"
                          required
                        >
                          {renderAccountOptions(sourceId)}
                        </select>
                    </div>
                  </>
                ) : (
                  <div className="md:col-span-1 lg:col-span-2">
                      <label className="block text-xs font-medium text-cyan-600 mb-2 font-mono">ACCOUNT (帳戶)</label>
                      <select
                        value={sourceId}
                        onChange={(e) => setSourceId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm"
                      >
                        <option value="">不指定 (僅記錄)</option>
                        {renderAccountOptions()}
                      </select>
                  </div>
                )}

                <div className={type === 'transfer' ? "md:col-span-2 lg:col-span-3" : "md:col-span-1 lg:col-span-1"}>
                  <label className="block text-xs font-medium text-cyan-600 mb-2 font-mono">NOTE (備註 - 選填)</label>
                  <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="說明..."
                      className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm"
                  />
                </div>

                <div className="md:col-span-2 lg:col-span-3 border-t border-slate-800 pt-4 mt-2">
                  <div className="flex flex-col gap-4">
                     {/* Recurring Toggle (Only show if Adding New) */}
                    {!editingId && (
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className={`w-10 h-6 rounded-full p-1 transition-colors duration-300 ${isRecurring ? 'bg-cyan-500' : 'bg-slate-700'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${isRecurring ? 'translate-x-4' : 'translate-x-0'}`}></div>
                          </div>
                          <span className={`text-sm font-medium transition-colors ${isRecurring ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                            {isRecurring ? `固定每月 ${new Date(date).getDate()} 日執行` : '設為固定週期'}
                          </span>
                          <input type="checkbox" className="hidden" checked={isRecurring} onChange={() => setIsRecurring(!isRecurring)} />
                        </label>
                      </div>
                    )}

                    {!isRecurring && (
                        <div className="flex gap-3 w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            onClick={resetForm}
                            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors font-mono"
                          >
                            [取消]
                          </button>
                          <button
                            type="submit"
                            className="px-6 py-2 text-sm font-medium text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-[0_0_10px_rgba(34,211,238,0.4)] transition-all font-bold font-mono"
                          >
                            &gt; {editingId ? '更新交易' : '儲存交易'}
                          </button>
                        </div>
                    )}

                    {/* Recurring Detail Settings - FIXED 2-84 COUNT ONLY */}
                    {isRecurring && !editingId && (
                       <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 animate-fade-in">
                          <div>
                             <label className="block text-xs font-medium text-cyan-600 mb-2 font-mono">
                               REPEAT COUNT (設定期數: {typeof recurringCount === 'string' ? recurringCount : recurringCount} 期)
                             </label>
                             <div className="flex items-center gap-3">
                                <input 
                                  type="range" 
                                  min="2" 
                                  max="84" 
                                  value={typeof recurringCount === 'number' ? recurringCount : 12} 
                                  onChange={(e) => setRecurringCount(parseInt(e.target.value))}
                                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                                <input 
                                  type="number" 
                                  min="2" 
                                  max="84" 
                                  value={recurringCount}
                                  onChange={(e) => setRecurringCount(e.target.value)}
                                  className="w-16 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center text-sm font-mono focus:border-cyan-500 outline-none"
                                />
                             </div>
                             <p className="text-[10px] text-slate-500 mt-1 text-right">範圍: 2 ~ 84 期 (7年)</p>
                          </div>
                          
                          <div className="mt-4 pt-4 border-t border-slate-700 flex justify-end gap-3">
                             <button
                                type="button"
                                onClick={resetForm}
                                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors font-mono"
                             >
                                [取消]
                             </button>
                             <button
                                type="submit"
                                className="px-6 py-2 text-sm font-medium text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-[0_0_10px_rgba(34,211,238,0.4)] transition-all font-bold font-mono"
                             >
                                &gt; 儲存設定
                             </button>
                          </div>
                       </div>
                    )}
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* --- Transaction List --- */}
          <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-700 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-800/50 text-cyan-500 font-mono uppercase text-xs border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">日期</th>
                    <th className="px-4 py-3 whitespace-nowrap">類別</th>
                    <th className="px-4 py-3 whitespace-nowrap">資金流向</th>
                    <th className="px-4 py-3 whitespace-nowrap">備註</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">金額</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredTransactions.length > 0 ? filteredTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/50 transition-colors group">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-400 font-mono">{t.date}</td>
                      <td className="px-4 py-3 font-medium text-slate-200 flex items-center gap-2 whitespace-nowrap">
                        {t.type === 'income' && <ArrowUpCircle size={16} className="text-emerald-500 flex-shrink-0" />}
                        {t.type === 'expense' && <ArrowDownCircle size={16} className="text-rose-500 flex-shrink-0" />}
                        {t.type === 'transfer' && <ArrowRightLeft size={16} className="text-slate-400 flex-shrink-0" />}
                        {t.category}
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">
                         {t.type === 'transfer' ? (
                           <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-slate-800 rounded border border-slate-700 truncate max-w-[80px]">
                                {getSourceName(t.sourceId, t.sourceType)}
                              </span>
                              <ArrowRight size={12} className="text-cyan-500 flex-shrink-0" />
                              <span className="px-2 py-1 bg-slate-800 rounded border border-slate-700 truncate max-w-[80px]">
                                {getSourceName(t.destinationId, t.destinationType)}
                              </span>
                           </div>
                         ) : (
                           t.sourceId ? (
                             <span className="flex items-center gap-1 px-2 py-1 bg-slate-800 rounded border border-slate-700 w-fit max-w-[150px] truncate">
                                 <CreditCard size={12} className="flex-shrink-0" /> 
                                 <span className="truncate">{getSourceName(t.sourceId, t.sourceType)}</span>
                             </span>
                           ) : <span className="opacity-30">-</span>
                         )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 min-w-[120px] max-w-[200px] truncate">{t.note}</td>
                      <td className={`px-4 py-3 text-right font-semibold font-mono tracking-wide whitespace-nowrap ${
                        t.type === 'income' ? 'text-emerald-400' : 
                        t.type === 'expense' ? 'text-slate-200' : 'text-slate-400'
                      }`}>
                        {t.type === 'expense' && '-'}{t.type === 'transfer' && ''}{t.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap flex gap-2 justify-center">
                        <button 
                          onClick={() => handleEditClick(t)}
                          className="text-slate-600 hover:text-cyan-400 transition-colors p-1 opacity-50 group-hover:opacity-100"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteTransactionClick(t.id)}
                          className="text-slate-600 hover:text-rose-500 transition-colors p-1 opacity-50 group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-mono">
                        &lt; 查無數據 /&gt; <br/> 請新增交易紀錄
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'recurring' && (
        <div className="space-y-6 animate-fade-in">
           <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-lg">
              <h3 className="text-lg font-bold text-cyan-400 mb-2 font-mono">RECURRING RULES</h3>
              <p className="text-sm text-slate-500 mb-6">
                 這裡列出您設定的所有自動化週期性交易（如信貸、房租、固定轉帳）。系統會在每次開啟時檢查並自動補上到期的交易。
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {recurringTransactions.map(rule => (
                    <div key={rule.id} className={`bg-slate-800/50 border ${rule.active ? 'border-slate-700' : 'border-slate-800 opacity-60'} p-4 rounded-xl relative group`}>
                       {!rule.active && <div className="absolute top-2 right-10 text-[10px] bg-slate-700 text-slate-400 px-1 rounded font-mono">INACTIVE</div>}
                       <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                             <div className={`p-2 rounded-lg ${rule.type === 'income' ? 'bg-emerald-900/20 text-emerald-400' : (rule.type === 'transfer' ? 'bg-slate-700/50 text-slate-300' : 'bg-rose-900/20 text-rose-400')}`}>
                                <Repeat size={18} />
                             </div>
                             <div>
                                <h4 className="font-bold text-slate-200">{rule.name || rule.category}</h4>
                                <p className="text-xs text-slate-500 font-mono">每月 {rule.dayOfMonth} 日</p>
                             </div>
                          </div>
                          <button 
                             onClick={() => handleDeleteRecurringClick(rule.id)}
                             className="text-slate-600 hover:text-rose-500 p-2 rounded-full hover:bg-slate-700/50 transition-colors"
                          >
                             <Trash2 size={16} />
                          </button>
                       </div>
                       
                       <div className="flex items-center justify-between text-sm mt-3 pt-3 border-t border-slate-700/50">
                          <span className="text-slate-400">金額</span>
                          <span className={`font-mono font-bold ${rule.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                             ${rule.amount.toLocaleString()}
                          </span>
                       </div>
                       {rule.type === 'transfer' ? (
                         <div className="flex items-center justify-between text-sm mt-1">
                            <span className="text-slate-400">轉帳路徑</span>
                            <div className="flex items-center gap-1 text-xs">
                              <span className="text-slate-300 bg-slate-900 px-2 py-0.5 rounded">{getSourceName(rule.sourceId, rule.sourceType)}</span>
                              <ArrowRight size={10} className="text-cyan-500" />
                              <span className="text-slate-300 bg-slate-900 px-2 py-0.5 rounded">{getSourceName(rule.destinationId, rule.destinationType)}</span>
                            </div>
                         </div>
                       ) : (
                         <div className="flex items-center justify-between text-sm mt-1">
                            <span className="text-slate-400">連結帳戶</span>
                            <span className="text-slate-300 text-xs bg-slate-900 px-2 py-0.5 rounded">
                               {getSourceName(rule.sourceId, rule.sourceType)}
                            </span>
                         </div>
                       )}
                       
                       {rule.active ? (
                         <>
                            <div className="flex items-center justify-between text-sm mt-1">
                                <span className="text-slate-400">下次執行</span>
                                <span className="text-cyan-500 text-xs font-mono">
                                  {rule.nextDueDate}
                                </span>
                            </div>
                            {rule.remainingOccurrences !== undefined && (
                                <div className="flex items-center justify-between text-sm mt-1">
                                  <span className="text-slate-400">剩餘次數</span>
                                  <span className="text-amber-400 text-xs font-mono">
                                      {rule.remainingOccurrences}
                                  </span>
                                </div>
                            )}
                         </>
                       ) : (
                         <div className="text-center mt-2 text-xs text-slate-500 font-mono border-t border-slate-700/50 pt-1">
                           [ 已結束 / 完成 ]
                         </div>
                       )}
                    </div>
                 ))}
                 {recurringTransactions.length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                       <Repeat className="mx-auto mb-2 opacity-50" size={32} />
                       <p>尚未設定自動週期性交易</p>
                       <p className="text-xs mt-1">在「交易紀錄」新增交易時，勾選「設為固定週期」即可加入。</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* --- Custom Category Modal --- */}
      {isEditingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 w-full max-w-md border border-cyan-500/30 rounded-2xl shadow-2xl p-6 relative animate-scale-in">
             <button onClick={() => setIsEditingCategory(false)} className="absolute top-4 right-4 text-slate-500 hover:text-slate-200">
                <X size={20} />
             </button>
             <h3 className="text-lg font-bold text-cyan-400 mb-1 font-mono">ADD CUSTOM CATEGORY</h3>
             <p className="text-xs text-slate-500 mb-6">新增自定義類別，AI 將自動建議圖示。</p>
             
             <div className="space-y-4">
               <div>
                 <label className="block text-xs text-slate-400 mb-1.5">類別名稱</label>
                 <input 
                   type="text" 
                   value={newCatName}
                   onChange={(e) => setNewCatName(e.target.value)}
                   placeholder="例如：線上課程、健身房..."
                   className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:border-cyan-500 outline-none"
                 />
               </div>
               
               <div>
                 <label className="block text-xs text-slate-400 mb-1.5">適用類型</label>
                 <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                   <button 
                     onClick={() => setNewCatType('expense')}
                     className={`flex-1 py-1.5 text-xs rounded font-medium ${newCatType === 'expense' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}
                   >支出</button>
                   <button 
                     onClick={() => setNewCatType('income')}
                     className={`flex-1 py-1.5 text-xs rounded font-medium ${newCatType === 'income' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
                   >收入</button>
                   <button 
                     onClick={() => setNewCatType('transfer')}
                     className={`flex-1 py-1.5 text-xs rounded font-medium ${newCatType === 'transfer' ? 'bg-slate-500 text-white' : 'text-slate-400'}`}
                   >轉帳</button>
                 </div>
               </div>

               {/* AI Icon Suggestions */}
               <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-xs text-slate-400">圖示 (AI 建議)</label>
                    <button 
                      onClick={handleSuggestIcons}
                      disabled={!newCatName || isSuggesting}
                      className="text-[10px] flex items-center gap-1 text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
                    >
                      <RefreshCw size={10} className={isSuggesting ? "animate-spin" : ""} /> 
                      {suggestedIcons.length > 0 ? "更新建議" : "取得建議"}
                    </button>
                  </div>
                  
                  <div className="flex gap-3 min-h-[60px] items-center justify-center bg-slate-800/50 rounded-xl border border-dashed border-slate-700 p-2">
                     {isSuggesting ? (
                        <div className="text-xs text-cyan-500 animate-pulse font-mono">PROCESSING...</div>
                     ) : suggestedIcons.length > 0 ? (
                        suggestedIcons.map(iconName => {
                          const Icon = getIconComponent(iconName);
                          return (
                            <button
                              key={iconName}
                              onClick={() => setSelectedIcon(iconName)}
                              className={`p-3 rounded-lg border transition-all relative group ${
                                selectedIcon === iconName 
                                ? 'bg-cyan-900/50 border-cyan-500 text-cyan-400' 
                                : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
                              }`}
                            >
                              <Icon size={24} />
                              {selectedIcon === iconName && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full flex items-center justify-center">
                                  <Check size={8} className="text-black" />
                                </div>
                              )}
                            </button>
                          );
                        })
                     ) : (
                        <div className="text-xs text-slate-600 font-mono">輸入名稱後點擊「取得建議」</div>
                     )}
                  </div>
               </div>

               <button 
                 onClick={handleSaveCustomCategory}
                 disabled={!newCatName || !selectedIcon}
                 className="w-full py-2.5 mt-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg font-bold font-mono shadow-lg transition-all"
               >
                 CONFIRM_ADD
               </button>
             </div>
          </div>
        </div>
      )}

      {/* --- Day Detail Modal --- */}
      {selectedDateDetail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-fade-in">
          <div className="bg-slate-900 w-full sm:max-w-md max-h-[85vh] sm:rounded-2xl rounded-t-2xl border-t sm:border border-slate-700 shadow-[0_-10px_40px_rgba(0,0,0,0.7)] flex flex-col relative overflow-hidden">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
               <div className="flex items-center justify-between mb-2">
                 <h3 className="text-xl font-bold text-cyan-400 font-mono tracking-wide">
                   {selectedDateDetail}
                 </h3>
                 <button 
                   onClick={() => setSelectedDateDetail(null)}
                   className="p-2 bg-slate-800 text-slate-400 rounded-full hover:text-white transition-colors"
                 >
                   <X size={20} />
                 </button>
               </div>
               
               {/* Daily Stats */}
               <div className="flex gap-4 text-sm font-mono">
                  <div className="flex flex-col">
                     <span className="text-[10px] text-emerald-500/70 uppercase">INCOME</span>
                     <span className="text-emerald-400 font-bold">+${dailyStats[selectedDateDetail]?.income.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] text-rose-500/70 uppercase">EXPENSE</span>
                     <span className="text-rose-400 font-bold">-${dailyStats[selectedDateDetail]?.expense.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex flex-col ml-auto text-right">
                     <span className="text-[10px] text-cyan-500/70 uppercase">NET</span>
                     <span className={`font-bold ${(dailyStats[selectedDateDetail]?.income - dailyStats[selectedDateDetail]?.expense) >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                        ${((dailyStats[selectedDateDetail]?.income || 0) - (dailyStats[selectedDateDetail]?.expense || 0)).toLocaleString()}
                     </span>
                  </div>
               </div>
            </div>

            {/* Transaction List for the Day */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
               {/* Actual Transactions */}
               {(transactionsByDate[selectedDateDetail]?.filter((t: any) => !t.isProjected) || []).map((t: any) => (
                 <div key={t.id} className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50 flex flex-col gap-2 group hover:border-slate-600 transition-all">
                    <div className="flex justify-between items-start">
                       <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${t.type === 'income' ? 'bg-emerald-900/20 text-emerald-400' : t.type === 'expense' ? 'bg-rose-900/20 text-rose-400' : 'bg-slate-700/50 text-slate-300'}`}>
                             {t.type === 'income' ? <ArrowUpCircle size={18} /> : t.type === 'expense' ? <ArrowDownCircle size={18} /> : <ArrowRightLeft size={18} />}
                          </div>
                          <div>
                             <p className="font-bold text-slate-200 text-sm">{t.category}</p>
                             {t.note && <p className="text-xs text-slate-500">{t.note}</p>}
                          </div>
                       </div>
                       <p className={`font-mono font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-slate-200'}`}>
                          {t.type === 'expense' && '-'}{t.amount.toLocaleString()}
                       </p>
                    </div>
                    
                    <div className="flex justify-end gap-3 mt-1 pt-2 border-t border-slate-700/30 opacity-50 group-hover:opacity-100 transition-opacity">
                       <button 
                          onClick={() => handleEditClick(t)}
                          className="text-xs flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                       >
                          <Edit3 size={12} /> 編輯
                       </button>
                       <button 
                          onClick={() => {
                              handleDeleteTransactionClick(t.id);
                              // Only close if it was the last item? No, keep open to see update.
                              // Actually data updates will re-render this.
                          }}
                          className="text-xs flex items-center gap-1 text-rose-500 hover:text-rose-400"
                       >
                          <Trash2 size={12} /> 刪除
                       </button>
                    </div>
                 </div>
               ))}

               {/* Projected Transactions */}
               {(transactionsByDate[selectedDateDetail]?.filter((t: any) => t.isProjected) || []).map((t: any, idx: number) => (
                 <div key={`proj-${idx}`} className="bg-slate-800/30 rounded-xl p-3 border border-dashed border-slate-700 flex flex-col gap-2 opacity-75">
                    <div className="flex justify-between items-start">
                       <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-slate-700/30 text-slate-500">
                             <Repeat size={18} />
                          </div>
                          <div>
                             <p className="font-bold text-slate-400 text-sm flex items-center gap-2">
                                {t.category} 
                                <span className="text-[9px] bg-slate-700 px-1 rounded text-slate-300">未來預計</span>
                             </p>
                             <p className="text-xs text-slate-600">由循環設定自動產生</p>
                          </div>
                       </div>
                       <p className="font-mono font-bold text-slate-500">
                          ${t.amount.toLocaleString()}
                       </p>
                    </div>
                    <div className="flex justify-end gap-3 mt-1 pt-2 border-t border-slate-700/30">
                       <button 
                          onClick={() => {
                             setActiveTab('recurring');
                             setSelectedDateDetail(null);
                          }}
                          className="text-xs flex items-center gap-1 text-slate-400 hover:text-cyan-400"
                       >
                          <Settings size={12} /> 管理循環設定
                       </button>
                    </div>
                 </div>
               ))}

               {(!transactionsByDate[selectedDateDetail] || transactionsByDate[selectedDateDetail].length === 0) && (
                  <div className="text-center py-8 text-slate-500 font-mono text-sm">
                     &lt; 本日無交易紀錄 /&gt;
                  </div>
               )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/80 pb-safe">
               <button 
                 onClick={() => {
                    setDate(selectedDateDetail);
                    setSelectedDateDetail(null);
                    setEditingId(null);
                    setIsAdding(true);
                 }}
                 className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold font-mono flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
               >
                 <Plus size={18} /> 新增今日交易
               </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
