
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, Asset, Liability, CustomCategory, RecurringTransaction } from '../types';
import { generateId } from '../services/storageService';
import { suggestCategoryIcons } from '../services/geminiService';
import * as LucideIcons from 'lucide-react';
import { 
  Plus, Trash2, Search, ChevronLeft, ChevronRight, 
  Calendar as CalendarIcon, CreditCard, Utensils, Coffee, Bus, ShoppingBag, 
  Home, Gamepad2, Heart, GraduationCap, Users, FileText, TrendingDown, Shield, 
  Cat, Briefcase, Award, TrendingUp, PieChart, Clock, Building, Gift, RotateCcw, 
  MoreHorizontal, Smartphone, Plane, Wrench, Landmark, Baby, Edit3, RefreshCw, X,
  Repeat, Clock4, FilterX, AlertTriangle, Archive, ArrowRightLeft
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
  if (absNum < 10000) return num.toLocaleString();
  if (absNum < 1000000) return `${(num / 10000).toFixed(1)}萬`;
  return `${(num / 1000000).toFixed(1)}M`;
};

export const Transactions: React.FC<TransactionsProps> = ({ 
  transactions, assets, liabilities, customCategories, recurringTransactions,
  onAddTransaction, onUpdateTransaction, onDeleteTransaction, onAddCustomCategory,
  onAddRecurringTransaction, onDeleteRecurringTransaction
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState('');
  
  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Transaction Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [sourceId, setSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');

  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringCount, setRecurringCount] = useState<number | string>(12);

  // --- Custom Category Modal State ---
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<TransactionType>('expense');
  const [suggestedIcons, setSuggestedIcons] = useState<string[]>([]);
  const [selectedIcon, setSelectedIcon] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);

  // --- Delete Confirmation Modal State ---
  const [deleteModal, setDeleteModal] = useState<{
      isOpen: boolean;
      type: 'real' | 'projected';
      data: any; // Transaction or RecurringTransaction
  } | null>(null);

  // --- Helpers ---
  const resetForm = () => {
    setEditingId(null);
    setAmount('');
    setCategory(''); 
    setNote('');
    setSourceId('');
    setDestinationId('');
    setIsRecurring(false);
    setRecurringCount(12);
    setIsAdding(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount) {
        alert('請輸入金額 (AMOUNT)');
        return;
    }
    if (!category) {
        alert('請選擇一個類別 (CATEGORY)');
        return;
    }
    
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

    // Recurring Logic
    if (isRecurring && !editingId) {
       const dayOfMonth = new Date(date).getDate();
       const selectedDate = new Date(date);
       const today = new Date();
       today.setHours(0,0,0,0);
       const selectedDateOnly = new Date(selectedDate);
       selectedDateOnly.setHours(0,0,0,0);

       const isDueTodayOrPast = selectedDateOnly <= today;
       const countVal = typeof recurringCount === 'string' ? parseInt(recurringCount) || 12 : recurringCount;
       let remaining = countVal;

       if (isDueTodayOrPast && remaining > 0) {
         remaining = remaining - 1;
       }

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

       if (remaining >= 0) {
         onAddRecurringTransaction(recurring);
       }

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
           recurringRuleId: newRuleId,
           processed: true
         };
         onAddTransaction(newTransaction);
         alert(`已儲存週期設定，並自動新增了第一筆交易！`);
       } else {
         alert(`已儲存週期設定！第一筆交易將於 ${date} 自動執行。`);
       }

    } else {
      const transactionPayload: Transaction = {
        id: editingId || generateId(),
        date,
        type,
        amount: parseFloat(amount),
        category,
        note,
        sourceId: sourceId || undefined,
        sourceType,
        destinationId: destinationId || undefined,
        destinationType,
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
    setIsRecurring(false);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- Delete Handlers ---
  const handleDeleteRecurringClick = (projectedItem: any) => {
      setDeleteModal({
          isOpen: true,
          type: 'projected',
          data: projectedItem
      });
  };

  const handleDeleteTransactionClick = (id: string) => {
      const txn = transactions.find(t => t.id === id);
      if (txn && txn.recurringRuleId) {
         setDeleteModal({
             isOpen: true,
             type: 'real',
             data: txn
         });
      } else {
         const choice = window.confirm("確定要刪除這筆交易嗎？");
         if(choice) onDeleteTransaction(id);
      }
  };
  
  const handleConfirmDelete = (mode: 'single' | 'future') => {
    if (!deleteModal) return;
    const { type, data } = deleteModal;

    if (mode === 'single') {
        // "Delete This Occurrence" (Skip)
        if (type === 'real') {
            // If it's real, we just delete it. The rule has already moved on.
            onDeleteTransaction(data.id);
        } else {
            // If it's projected, we update the rule to start NEXT month
            const currentTargetDate = new Date(data.date);
            const nextDate = new Date(currentTargetDate);
            nextDate.setMonth(nextDate.getMonth() + 1);
            
            // We need to find the original rule to preserve its other props
            const originalRule = recurringTransactions.find(r => r.id === (data.recurringRuleId || data.id));
            if (originalRule) {
                const updatedRule: RecurringTransaction = {
                    ...originalRule,
                    nextDueDate: nextDate.toISOString().split('T')[0],
                    // Decrease occurrences if it's limited? 
                    // Usually skip means we consumed one occurrence without logging it, or we just push the date?
                    // Let's assume we just push the date and decrease remaining count to effectively "skip and burn".
                    remainingOccurrences: originalRule.remainingOccurrences !== undefined 
                        ? Math.max(0, originalRule.remainingOccurrences - 1) 
                        : undefined
                };
                onAddRecurringTransaction(updatedRule);
            }
        }
    } else if (mode === 'future') {
        // "Delete This and All Future" (Stop)
        if (type === 'real') {
            onDeleteTransaction(data.id);
            if (data.recurringRuleId) {
                onDeleteRecurringTransaction(data.recurringRuleId, false);
            }
        } else {
            // Projected items use the rule ID as ID usually, or we passed recurringRuleId
            onDeleteRecurringTransaction(data.recurringRuleId || data.id, false);
        }
    }
    setDeleteModal(null);
  };

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
    setSelectedDay(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDay(null);
  };

  const projectedTransactions = useMemo(() => {
     const projected: any[] = [];
     const viewYear = currentDate.getFullYear();
     const viewMonth = currentDate.getMonth(); 
     const today = new Date();
     today.setHours(0,0,0,0);
     
     recurringTransactions.forEach(rule => {
        if (!rule.active) return;
        const targetDate = new Date(viewYear, viewMonth, rule.dayOfMonth);
        if (targetDate.getMonth() !== viewMonth) return; // Handles invalid dates like Feb 30
        
        const dateString = targetDate.toISOString().split('T')[0];
        // Check if real txn exists
        const exists = transactions.some(t => t.recurringRuleId === rule.id && t.date === dateString);
        
        if (!exists && targetDate >= today) {
             projected.push({
                ...rule,
                isProjected: true,
                date: dateString,
                note: '(預計發生)',
                recurringRuleId: rule.id
            });
        }
     });
     return projected;
  }, [recurringTransactions, currentDate, transactions]);

  const transactionsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    
    transactions.forEach(t => {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    });

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

  const handleDayClick = (dateString: string) => {
    setDate(dateString);
    setSelectedDay(dateString);
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
      const isSelected = selectedDay === dateString;
      const netAmount = stat ? stat.income - stat.expense : 0;

      days.push(
        <div 
          key={d} 
          onClick={() => handleDayClick(dateString)}
          className={`min-h-[80px] sm:min-h-[100px] border p-1 relative group cursor-pointer transition-all overflow-hidden flex flex-col select-none active:bg-slate-800/80
            ${isSelected 
              ? 'border-cyan-500 bg-cyan-900/20 shadow-[inset_0_0_10px_rgba(6,182,212,0.3)] z-10 scale-[1.02]' 
              : 'border-slate-800 hover:border-slate-600 hover:bg-slate-800/50'}
            ${isToday ? 'bg-slate-800' : 'bg-slate-900/60'}
          `}
        >
          <div className={`text-xs font-mono mb-1 flex justify-between items-start flex-shrink-0`}>
             <span className={`${isToday ? 'text-cyan-400 font-bold' : 'text-slate-500'} ${isSelected ? 'text-cyan-300' : ''}`}>
                {d}
             </span>
             {isToday && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>}
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none space-y-0.5 mb-1 pointer-events-none">
             {dailyItems.map((t, idx) => (
               <div key={t.id || `proj-${idx}`} className={`flex justify-between items-center text-[9px] sm:text-[10px] font-mono leading-tight px-0.5 rounded 
                 ${(t.isProjected || t.processed === false) ? 'bg-slate-800/50 opacity-80' : 'bg-black/20'}
               `}>
                 <span className={`truncate w-full flex items-center gap-1 ${
                    t.type === 'income' ? 'text-emerald-300' : 
                    t.type === 'expense' ? 'text-rose-300' : 'text-blue-300'
                 }`}>
                   {(t.isProjected || t.processed === false) && <Clock4 size={9} className="text-amber-500 flex-shrink-0" />}
                   {t.isProjected && <Repeat size={9} className="text-slate-500 flex-shrink-0" />}
                   <span className="truncate">{t.category}</span>
                 </span>
               </div>
             ))}
          </div>
          
          {netAmount !== 0 && (
            <div className={`flex justify-center border-t border-slate-700/50 pt-0.5 mt-auto flex-shrink-0 font-mono text-[9px] sm:text-[10px] font-bold ${netAmount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
               {netAmount > 0 ? '+' : ''}{formatCompactAmount(netAmount)}
            </div>
          )}
        </div>
      );
    }
    return days;
  };

  const displayList = useMemo(() => {
     let list: any[] = [];
     if (selectedDay) {
        list = transactionsByDate[selectedDay] || [];
     } else {
        const prefix = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const real = transactions.filter(t => t.date.startsWith(prefix));
        const proj = projectedTransactions.filter(t => t.date.startsWith(prefix));
        list = [...real, ...proj];
     }

     if (filter) {
        list = list.filter(t => 
           (t.category.toLowerCase().includes(filter.toLowerCase()) || 
           t.note.toLowerCase().includes(filter.toLowerCase()))
        );
     }
     
     return list.sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (timeA !== timeB) return timeB - timeA;
        const aP = a.isProjected ? 1 : 0;
        const bP = b.isProjected ? 1 : 0;
        return aP - bP; 
     });

  }, [selectedDay, transactions, projectedTransactions, filter, currentDate]);

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

  const getCategoryIconName = (catName: string, tType: TransactionType) => {
     const custom = customCategories.find(c => c.name === catName && c.type === tType);
     if (custom) return custom.iconName;
     
     let defaults;
     if (tType === 'income') defaults = DEFAULT_INCOME_CATEGORIES;
     else if (tType === 'expense') defaults = DEFAULT_EXPENSE_CATEGORIES;
     else defaults = DEFAULT_TRANSFER_CATEGORIES;
     
     const found = defaults.find(d => d.name === catName);
     return found ? found.iconName : 'MoreHorizontal';
  }

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
    <div className="space-y-6 relative">
      {/* CALENDAR SECTION */}
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

      {/* TOOLBAR */}
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
          <Plus size={18} />
          <span className="relative">新增交易</span>
        </button>
      </div>

      {/* ADD/EDIT FORM */}
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
                <button type="button" onClick={() => { setType('income'); setCategory(''); }} className={`flex-1 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-all ${type === 'income' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>收入</button>
                <button type="button" onClick={() => { setType('expense'); setCategory(''); }} className={`flex-1 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-all ${type === 'expense' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>支出</button>
                <button type="button" onClick={() => { setType('transfer'); setCategory(''); }} className={`flex-1 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-all ${type === 'transfer' ? 'bg-slate-500 text-white' : 'text-slate-400'}`}>轉帳</button>
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-cyan-600 mb-2 font-mono">DATE (日期)</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500 text-sm font-mono" required />
            </div>

            <div>
              <label className="block text-xs font-medium text-cyan-600 mb-2 font-mono">AMOUNT (金額)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full pl-7 pr-3 py-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500 text-sm font-mono" required />
              </div>
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <div className="flex justify-between items-end mb-2">
                  <label className="block text-xs font-medium text-cyan-600 font-mono">CATEGORY (類別)</label>
                  <button type="button" onClick={() => setIsEditingCategory(true)} className="text-[10px] flex items-center gap-1 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded hover:bg-cyan-900/30"><Edit3 size={10} /> 編輯/新增類別</button>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 mb-3">
                  {currentCategories.map((cat) => {
                    const Icon = getIconComponent(cat.iconName);
                    return (
                      <button key={cat.name} type="button" onClick={() => setCategory(cat.name)} className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${category === cat.name ? 'bg-cyan-900/40 border-cyan-500 text-cyan-400' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}>
                        <Icon size={20} className="mb-1" /><span className="text-[10px] font-medium truncate w-full text-center">{cat.name}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {type === 'transfer' ? (
              <>
                <div>
                    <label className="block text-xs font-medium text-cyan-600 mb-2 font-mono">FROM</label>
                    <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-200 text-sm" required>{renderAccountOptions(destinationId)}</select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-cyan-600 mb-2 font-mono">TO</label>
                    <select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-200 text-sm" required>{renderAccountOptions(sourceId)}</select>
                </div>
              </>
            ) : (
              <div className="md:col-span-1 lg:col-span-2">
                  <label className="block text-xs font-medium text-cyan-600 mb-2 font-mono">ACCOUNT</label>
                  <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-200 text-sm"><option value="">不指定 (僅記錄)</option>{renderAccountOptions()}</select>
              </div>
            )}

            <div className={type === 'transfer' ? "md:col-span-2 lg:col-span-3" : "md:col-span-1 lg:col-span-1"}>
              <label className="block text-xs font-medium text-cyan-600 mb-2 font-mono">NOTE</label>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="說明..." className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-200 text-sm" />
            </div>

            <div className="md:col-span-2 lg:col-span-3 border-t border-slate-800 pt-4 mt-2">
              <div className="flex flex-col gap-4">
                {!editingId && (
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-10 h-6 rounded-full p-1 transition-colors duration-300 ${isRecurring ? 'bg-cyan-500' : 'bg-slate-700'}`}>
                        <div className={`bg-white w-4 h-4 rounded-full transform transition-transform duration-300 ${isRecurring ? 'translate-x-4' : 'translate-x-0'}`}></div>
                      </div>
                      <span className={`text-sm font-medium transition-colors ${isRecurring ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'}`}>{isRecurring ? `固定每月 ${new Date(date).getDate()} 日執行` : '設為固定週期'}</span>
                      <input type="checkbox" className="hidden" checked={isRecurring} onChange={() => setIsRecurring(!isRecurring)} />
                    </label>
                  </div>
                )}

                {!isRecurring && (
                    <div className="flex gap-3 w-full sm:w-auto justify-end">
                      <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-slate-400 hover:text-white">[取消]</button>
                      <button type="submit" className="px-6 py-2 text-sm font-medium text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg font-bold">&gt; {editingId ? '更新交易' : '儲存交易'}</button>
                    </div>
                )}

                {isRecurring && !editingId && (
                   <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                      <div>
                         <label className="block text-xs font-medium text-cyan-600 mb-2 font-mono">REPEAT COUNT ({typeof recurringCount === 'string' ? recurringCount : recurringCount} 期)</label>
                         <div className="flex items-center gap-3">
                            <input type="range" min="2" max="84" value={typeof recurringCount === 'number' ? recurringCount : 12} onChange={(e) => setRecurringCount(parseInt(e.target.value))} className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                            <input type="number" min="2" max="84" value={recurringCount} onChange={(e) => setRecurringCount(e.target.value)} className="w-16 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center text-sm font-mono focus:border-cyan-500 outline-none" />
                         </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-700 flex justify-end gap-3">
                         <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-slate-400 hover:text-white">[取消]</button>
                         <button type="submit" className="px-6 py-2 text-sm font-medium text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg font-bold">&gt; 儲存設定</button>
                      </div>
                   </div>
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TRANSACTION LIST */}
      <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-700 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/30">
           <h3 className="text-sm font-bold text-slate-300 font-mono flex items-center gap-2">
              <ListIcon /> 
              {selectedDay ? `DATE: ${selectedDay}` : `MONTH VIEW (${currentDate.getMonth()+1}/${currentDate.getFullYear()})`}
           </h3>
           {selectedDay && (
             <button onClick={() => setSelectedDay(null)} className="text-xs flex items-center gap-1 text-cyan-400 border border-cyan-500/30 px-2 py-1 rounded hover:bg-cyan-900/20">
                <FilterX size={12} /> SHOW ALL
             </button>
           )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-800/50 text-cyan-500 font-mono uppercase text-xs border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap w-[120px]">日期</th>
                <th className="px-4 py-3 whitespace-nowrap w-[100px]">類別</th>
                <th className="px-4 py-3 text-right whitespace-nowrap w-[120px]">金額</th>
                <th className="px-4 py-3 text-center whitespace-nowrap w-[100px]">操作</th>
                <th className="px-4 py-3 whitespace-nowrap">備註</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {displayList.length > 0 ? displayList.map((t) => {
                 const CategoryIcon = getIconComponent(getCategoryIconName(t.category, t.type));
                 return (
                    <tr key={t.id} className={`hover:bg-slate-800/50 transition-colors group ${(t.processed === false || t.isProjected) ? 'bg-slate-900/40 opacity-80 border-l-2 border-l-amber-500' : ''}`}>
                      {/* 1. DATE */}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-400 font-mono flex items-center gap-2">
                         {t.date}
                         {(t.processed === false || t.isProjected) && <Clock4 size={14} className="text-amber-500 flex-shrink-0" />}
                      </td>

                      {/* 2. CATEGORY */}
                      <td className="px-4 py-3 whitespace-nowrap">
                         <div className={`flex items-center gap-2 ${t.type === 'income' ? 'text-emerald-400' : t.type === 'expense' ? 'text-rose-400' : 'text-slate-400'}`}>
                            <CategoryIcon size={16} />
                            <span>{t.category}</span>
                         </div>
                      </td>

                      {/* 3. AMOUNT */}
                      <td className={`px-4 py-3 text-right font-semibold font-mono tracking-wide whitespace-nowrap ${t.type === 'income' ? 'text-emerald-400' : t.type === 'expense' ? 'text-slate-200' : 'text-slate-400'}`}>
                        {t.type === 'expense' && '-'}{t.type === 'transfer' && ''}{t.amount.toLocaleString()}
                      </td>

                      {/* 4. ACTION */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex gap-2 justify-center">
                            {t.isProjected ? (
                               <button onClick={() => handleDeleteRecurringClick(t)} title="刪除此循環規則" className="text-slate-600 hover:text-rose-500 transition-colors p-1"><Trash2 size={16} /></button>
                            ) : (
                               <>
                                 <button onClick={() => handleEditClick(t)} className="text-slate-600 hover:text-cyan-400 transition-colors p-1"><Edit3 size={16} /></button>
                                 <button onClick={() => handleDeleteTransactionClick(t.id)} className="text-slate-600 hover:text-rose-500 transition-colors p-1"><Trash2 size={16} /></button>
                               </>
                            )}
                        </div>
                      </td>

                      {/* 5. NOTE */}
                      <td className="px-4 py-3 font-medium text-slate-400">
                        <div className="flex items-center gap-2 max-w-[200px] sm:max-w-md">
                             <span className="truncate">{t.note || '-'}</span>
                             {t.isProjected && <span className="text-[10px] text-amber-500 bg-amber-900/20 px-1 rounded border border-amber-500/20 whitespace-nowrap">預計</span>}
                        </div>
                      </td>
                    </tr>
                 );
              }) : (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-mono">&lt; 查無交易 /&gt;</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CATEGORY MODAL (Existing) */}
      {isEditingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 w-full max-w-md border border-cyan-500/30 rounded-2xl shadow-2xl p-6 relative animate-scale-in">
             <button onClick={() => setIsEditingCategory(false)} className="absolute top-4 right-4 text-slate-500 hover:text-slate-200"><X size={20} /></button>
             <h3 className="text-lg font-bold text-cyan-400 mb-1 font-mono">ADD CUSTOM CATEGORY</h3>
             <div className="space-y-4 mt-4">
               <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="名稱" className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm" />
               <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                   <button onClick={() => setNewCatType('expense')} className={`flex-1 py-1.5 text-xs rounded font-medium ${newCatType === 'expense' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>支出</button>
                   <button onClick={() => setNewCatType('income')} className={`flex-1 py-1.5 text-xs rounded font-medium ${newCatType === 'income' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>收入</button>
                   <button onClick={() => setNewCatType('transfer')} className={`flex-1 py-1.5 text-xs rounded font-medium ${newCatType === 'transfer' ? 'bg-slate-500 text-white' : 'text-slate-400'}`}>轉帳</button>
               </div>
               <div>
                  <div className="flex justify-between items-end mb-2"><label className="block text-xs text-slate-400">圖示 (AI 建議)</label><button onClick={handleSuggestIcons} disabled={!newCatName || isSuggesting} className="text-[10px] flex items-center gap-1 text-cyan-400 disabled:opacity-50"><RefreshCw size={10} className={isSuggesting ? "animate-spin" : ""} /> 更新建議</button></div>
                  <div className="flex gap-3 min-h-[60px] items-center justify-center bg-slate-800/50 rounded-xl border border-dashed border-slate-700 p-2">
                     {suggestedIcons.length > 0 ? suggestedIcons.map(iconName => { const Icon = getIconComponent(iconName); return (<button key={iconName} onClick={() => setSelectedIcon(iconName)} className={`p-3 rounded-lg border relative group ${selectedIcon === iconName ? 'bg-cyan-900/50 border-cyan-500 text-cyan-400' : 'bg-slate-800 border-slate-600 text-slate-400'}`}><Icon size={24} /></button>); }) : <span className="text-xs text-slate-600">輸入名稱後點擊建議</span>}
                  </div>
               </div>
               <button onClick={handleSaveCustomCategory} disabled={!newCatName || !selectedIcon} className="w-full py-2.5 mt-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold font-mono">CONFIRM_ADD</button>
             </div>
          </div>
        </div>
      )}

      {/* DELETE RECURRING CONFIRMATION MODAL */}
      {deleteModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
             <div className="bg-slate-900 w-full max-w-sm border border-rose-500/30 rounded-2xl shadow-[0_0_30px_rgba(244,63,94,0.2)] p-6 relative animate-scale-in overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-rose-500"></div>
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none"></div>
                
                <div className="flex items-center gap-3 mb-4">
                   <div className="p-3 bg-rose-900/20 rounded-full text-rose-500 border border-rose-500/20">
                      <AlertTriangle size={24} />
                   </div>
                   <h3 className="text-lg font-bold text-slate-200">刪除週期性交易</h3>
                </div>
                
                <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                   這是一筆循環交易紀錄。請選擇您希望如何處理此刪除操作：
                </p>
                
                <div className="space-y-3">
                   <button 
                      onClick={() => handleConfirmDelete('single')}
                      className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 font-medium text-sm text-left flex items-center gap-3 transition-all"
                   >
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_5px_currentColor]"></span>
                      僅刪除該次交易 (跳過本期)
                   </button>
                   
                   <button 
                      onClick={() => handleConfirmDelete('future')}
                      className="w-full py-3 px-4 bg-rose-900/20 hover:bg-rose-900/40 text-rose-400 rounded-xl border border-rose-500/30 font-medium text-sm text-left flex items-center gap-3 transition-all"
                   >
                      <span className="w-1.5 h-1.5 bg-rose-500 rounded-full shadow-[0_0_5px_currentColor]"></span>
                      刪除這次之後的所有交易 (停止)
                   </button>
                   
                   <button 
                      onClick={() => setDeleteModal(null)}
                      className="w-full py-2 text-slate-500 hover:text-slate-300 text-xs mt-2 font-mono"
                   >
                      [ 取消 CANCEL ]
                   </button>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};

const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
);
