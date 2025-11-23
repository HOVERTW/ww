
import React, { useState, useEffect } from 'react';
import { Asset, Liability, AssetType, LiabilityType } from '../types';
import { generateId } from '../services/storageService';
import { getStockPrice, getExchangeRate } from '../services/geminiService';
import { Plus, Trash2, Building2, Briefcase, Wallet, CreditCard, DollarSign, Edit2, RefreshCw, TrendingUp, TrendingDown, Search, Globe, Bitcoin, LineChart, Zap, Shield } from 'lucide-react';

interface BalanceSheetProps {
  assets: Asset[];
  liabilities: Liability[];
  onUpdateAsset: (a: Asset) => void;
  onDeleteAsset: (id: string) => void;
  onUpdateLiability: (l: Liability) => void;
  onDeleteLiability: (id: string) => void;
}

export const BalanceSheet: React.FC<BalanceSheetProps> = ({ 
  assets, liabilities, onUpdateAsset, onDeleteAsset, onUpdateLiability, onDeleteLiability 
}) => {
  
  // -- Asset Form State --
  const [assetName, setAssetName] = useState('');
  const [assetValue, setAssetValue] = useState(''); // Final TWD Value
  const [assetType, setAssetType] = useState<AssetType>('cash');
  
  // Investment specific state
  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState('');
  
  // Price & FX State
  const [currency, setCurrency] = useState<'TWD' | 'USD'>('TWD');
  const [purchasePrice, setPurchasePrice] = useState(''); // Original Currency
  const [currentPrice, setCurrentPrice] = useState('');   // Original Currency
  const [purchaseExchangeRate, setPurchaseExchangeRate] = useState('');
  const [currentExchangeRate, setCurrentExchangeRate] = useState('');
  
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [isFetchingFX, setIsFetchingFX] = useState(false);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);

  // -- Liability Form State --
  const [liabilityName, setLiabilityName] = useState('');
  const [liabilityValue, setLiabilityValue] = useState('');
  const [liabilityType, setLiabilityType] = useState<LiabilityType>('credit_card');
  const [showLiabilityForm, setShowLiabilityForm] = useState(false);
  const [editingLiabilityId, setEditingLiabilityId] = useState<string | null>(null);

  // --- Auto Set Currency based on Type ---
  useEffect(() => {
    if (assetType === 'us_stock' || assetType === 'crypto') {
      setCurrency('USD');
      // Set default FX if empty (approximate default)
      if (!currentExchangeRate) setCurrentExchangeRate('32.5'); 
      if (!purchaseExchangeRate) setPurchaseExchangeRate('32.5');
    } else if (assetType === 'tw_stock') {
      setCurrency('TWD');
      setPurchaseExchangeRate('1');
      setCurrentExchangeRate('1');
    } else {
      setCurrency('TWD');
    }
  }, [assetType]);

  // --- Asset Logic Handlers ---

  const handleFetchPrice = async () => {
    if (!symbol) return;
    setIsFetchingPrice(true);
    const data = await getStockPrice(symbol);
    if (data) {
      setCurrentPrice(data.price.toString());
      if (!assetName) setAssetName(data.name || symbol.toUpperCase());
      
      // Update currency and FX if detected
      if (data.currency === 'USD') {
         // If it was set to tw_stock but returns USD, suggest us_stock or crypto
         if (assetType === 'tw_stock') setAssetType('us_stock'); 
         
         setCurrency('USD');
         if (data.estimatedFxRate) {
            setCurrentExchangeRate(data.estimatedFxRate.toString());
            // Optional: If purchase FX is empty, pre-fill with current (user can edit)
            if (!purchaseExchangeRate) setPurchaseExchangeRate(data.estimatedFxRate.toString());
         }
      } else {
         setAssetType('tw_stock');
         setCurrency('TWD');
         setCurrentExchangeRate('1');
         setPurchaseExchangeRate('1');
      }
    }
    setIsFetchingPrice(false);
  };

  const handleFetchFX = async () => {
    setIsFetchingFX(true);
    // Always fetch USD to TWD for now if currency is USD, can be expanded later
    const rate = await getExchangeRate(currency, 'TWD');
    if (rate) {
      setCurrentExchangeRate(rate.toString());
      // If purchase FX is empty, optionally fill it too for convenience
      if (!purchaseExchangeRate) setPurchaseExchangeRate(rate.toString());
    }
    setIsFetchingFX(false);
  };

  // Auto calculate total value (TWD) when inputs change
  useEffect(() => {
    const isInvestment = ['tw_stock', 'us_stock', 'crypto', 'investment'].includes(assetType);
    
    if (isInvestment && shares && currentPrice) {
       const price = parseFloat(currentPrice);
       const qty = parseFloat(shares);
       
       // TWD Value = Qty * Price * CurrentFX
       const fx = currency === 'USD' ? (parseFloat(currentExchangeRate) || 32) : 1;
       
       const totalValTWD = qty * price * fx;
       setAssetValue(totalValTWD.toFixed(0)); // Store as integer TWD usually better for display
    }
  }, [shares, currentPrice, currentExchangeRate, assetType, currency]);

  const handleAddAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if(!assetName || !assetValue) return;

    const newAsset: Asset = {
      id: editingAssetId || generateId(),
      name: assetName,
      value: parseFloat(assetValue), // This is the Final TWD Value
      type: assetType,
    };

    // Add investment details if applicable
    if (['tw_stock', 'us_stock', 'crypto', 'investment'].includes(assetType)) {
      newAsset.symbol = symbol.toUpperCase();
      newAsset.shares = shares ? parseFloat(shares) : undefined;
      newAsset.purchasePrice = purchasePrice ? parseFloat(purchasePrice) : undefined;
      newAsset.currentPrice = currentPrice ? parseFloat(currentPrice) : undefined;
      newAsset.currency = currency;
      
      if (currency === 'USD') {
        newAsset.purchaseExchangeRate = purchaseExchangeRate ? parseFloat(purchaseExchangeRate) : 1;
        newAsset.currentExchangeRate = currentExchangeRate ? parseFloat(currentExchangeRate) : 1;
      } else {
        // Ensure TWD stays 1:1
        newAsset.purchaseExchangeRate = 1;
        newAsset.currentExchangeRate = 1;
      }
      newAsset.lastUpdated = new Date().toISOString();
    }

    onUpdateAsset(newAsset);
    resetAssetForm();
  };

  const handleEditAsset = (asset: Asset) => {
    setAssetName(asset.name);
    setAssetValue(asset.value.toString());
    setAssetType(asset.type);
    
    // Populate investment fields
    setSymbol(asset.symbol || '');
    setShares(asset.shares?.toString() || '');
    setPurchasePrice(asset.purchasePrice?.toString() || '');
    setCurrentPrice(asset.currentPrice?.toString() || '');
    
    setCurrency(asset.currency as 'TWD'|'USD' || 'TWD');
    setPurchaseExchangeRate(asset.purchaseExchangeRate?.toString() || '1');
    setCurrentExchangeRate(asset.currentExchangeRate?.toString() || '1');

    setEditingAssetId(asset.id);
    setShowAssetForm(true);
  };

  const resetAssetForm = () => {
    setShowAssetForm(false);
    setEditingAssetId(null);
    setAssetName('');
    setAssetValue('');
    setAssetType('cash');
    setSymbol('');
    setShares('');
    setPurchasePrice('');
    setCurrentPrice('');
    setCurrency('TWD');
    setPurchaseExchangeRate('');
    setCurrentExchangeRate('');
  };

  // --- Liability Handlers ---

  const handleAddLiability = (e: React.FormEvent) => {
    e.preventDefault();
    if(!liabilityName || !liabilityValue) return;
    onUpdateLiability({
      id: editingLiabilityId || generateId(),
      name: liabilityName,
      value: parseFloat(liabilityValue),
      type: liabilityType
    });
    resetLiabilityForm();
  };

  const handleEditLiability = (liability: Liability) => {
    setLiabilityName(liability.name);
    setLiabilityValue(liability.value.toString());
    setLiabilityType(liability.type);
    setEditingLiabilityId(liability.id);
    setShowLiabilityForm(true);
  };

  const resetLiabilityForm = () => {
    setShowLiabilityForm(false);
    setEditingLiabilityId(null);
    setLiabilityName('');
    setLiabilityValue('');
    setLiabilityType('credit_card');
  };

  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.value, 0);

  const getAssetIcon = (type: AssetType) => {
    switch(type) {
      case 'property': return <Building2 size={18} />;
      case 'tw_stock': return <LineChart size={18} />;
      case 'us_stock': return <Globe size={18} />;
      case 'crypto': return <Bitcoin size={18} />;
      case 'investment': return <Briefcase size={18} />;
      case 'insurance': return <Shield size={18} />;
      case 'cash': return <Wallet size={18} />;
      default: return <DollarSign size={18} />;
    }
  };

  const getAssetTypeLabel = (type: AssetType) => {
      switch(type) {
          case 'cash': return '現金/存款';
          case 'tw_stock': return '台股';
          case 'us_stock': return '美股';
          case 'crypto': return '加密貨幣';
          case 'investment': return '其他投資';
          case 'insurance': return '保險';
          case 'property': return '不動產';
          case 'other': return '其他';
          default: return type;
      }
  }

  const getAssetPlaceholder = (type: AssetType) => {
      switch(type) {
          case 'cash': return '例如：中信薪轉戶、台新 Richart、皮夾現金...';
          case 'tw_stock': return '例如：台積電庫存、0050 持倉...';
          case 'us_stock': return '例如：Firstrade 帳戶、NVDA 持倉...';
          case 'crypto': return '例如：Binance BTC、冷錢包 ETH、USDT...';
          case 'property': return '例如：台北市大安區公寓、台中土地...';
          case 'insurance': return '例如：儲蓄險保單價值、投資型保單現值...';
          case 'other': return '例如：汽車、借出款項...';
          default: return '資產名稱';
      }
  }

  const getLiabilityTypeLabel = (type: LiabilityType) => {
    switch(type) {
        case 'credit_card': return '信用卡';
        case 'loan': return '信用貸款';
        case 'mortgage': return '房屋貸款';
        case 'other': return '其他負債';
        default: return type;
    }
  }

  const renderInvestmentDetails = (asset: Asset) => {
    const isInvest = ['tw_stock', 'us_stock', 'crypto', 'investment'].includes(asset.type);
    if (!isInvest || !asset.shares || !asset.currentPrice || !asset.purchasePrice) return null;
    
    const isForeign = asset.currency === 'USD' || asset.type === 'us_stock' || asset.type === 'crypto';
    
    // Calculate Cost in TWD (Using Purchase FX)
    const purchaseFx = asset.purchaseExchangeRate || 1;
    const costTWD = asset.shares * asset.purchasePrice * purchaseFx;
    
    // Calculate Current Market Value in TWD (Using Current FX)
    const currentFx = asset.currentExchangeRate || 1;
    const marketValueTWD = asset.shares * asset.currentPrice * currentFx;
    
    // Total Profit/Loss (Price Diff + FX Diff)
    const profitLossTWD = marketValueTWD - costTWD;
    const percent = costTWD !== 0 ? (profitLossTWD / costTWD) * 100 : 0;
    const isProfit = profitLossTWD >= 0;

    return (
      <div className="mt-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
         <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-4 text-xs font-mono">
            <div className="flex flex-col">
              <span className="text-slate-500">持有數量</span>
              <span className="text-slate-300 font-bold">{asset.shares}</span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-slate-500">原始成本 (TWD)</span>
              <span className="text-slate-400">
                 ${Math.round(costTWD).toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-600">
                 (@ {isForeign ? '$' : 'NT$'}{asset.purchasePrice.toLocaleString()} × {purchaseFx})
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-slate-500">當前價值 (TWD)</span>
              <span className="text-slate-200 font-bold">
                 ${Math.round(marketValueTWD).toLocaleString()}
              </span>
              <span className="text-[10px] text-cyan-600/70">
                 (@ {isForeign ? '$' : 'NT$'}{asset.currentPrice.toLocaleString()} × {currentFx})
              </span>
            </div>

            <div className="flex flex-col items-end justify-center bg-slate-800/30 rounded p-1">
               <span className="text-[10px] text-slate-500 mb-0.5">總損益 (含匯差)</span>
               <span className={`font-bold text-sm flex items-center gap-1 ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {percent.toFixed(2)}%
               </span>
               <span className={`text-xs ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isProfit ? '+' : ''}${Math.round(profitLossTWD).toLocaleString()}
               </span>
            </div>
         </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
      {/* ASSETS COLUMN */}
      <div className="space-y-4">
        <div className="flex justify-between items-end border-b border-emerald-500/30 pb-2">
          <h2 className="text-xl font-bold text-emerald-400 tracking-wide flex items-center gap-2">
             <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
             資產 (ASSETS)
          </h2>
          <span className="text-emerald-400 font-bold text-xl font-mono drop-shadow-[0_0_5px_rgba(16,185,129,0.4)]">
              ${totalAssets.toLocaleString()} <span className="text-xs text-emerald-600 ml-1">TWD</span>
          </span>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-emerald-500/20 shadow-lg overflow-hidden">
          {assets.map(item => (
            <div key={item.id} className="p-4 border-b border-slate-800 last:border-0 hover:bg-slate-800/50 group transition-all">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2 bg-emerald-900/20 text-emerald-400 rounded-lg border border-emerald-500/20 flex-shrink-0">
                    {getAssetIcon(item.type)}
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-200 truncate">{item.name}</p>
                      {item.symbol && <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300 font-mono flex-shrink-0">{item.symbol}</span>}
                    </div>
                    <p className="text-xs text-slate-500 font-mono truncate">{getAssetTypeLabel(item.type)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                  <div className="text-right">
                    <span className="font-semibold text-emerald-100 font-mono text-lg">${item.value.toLocaleString()}</span>
                    {(item.currency === 'USD' || item.type === 'us_stock' || item.type === 'crypto') && (
                      <p className="text-[10px] text-slate-500 font-mono text-right">TWD Eq.</p>
                    )}
                  </div>
                  
                  <div className="flex gap-1 flex-col sm:flex-row">
                      <button onClick={() => handleEditAsset(item)} className="text-slate-600 hover:text-emerald-400 transition-colors p-1 opacity-60 group-hover:opacity-100">
                          <Edit2 size={16} />
                      </button>
                      <button onClick={() => onDeleteAsset(item.id)} className="text-slate-600 hover:text-rose-500 transition-colors p-1 opacity-60 group-hover:opacity-100">
                          <Trash2 size={16} />
                      </button>
                  </div>
                </div>
              </div>
              {renderInvestmentDetails(item)}
            </div>
          ))}
          {assets.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm font-mono">
              &lt; 無資產紀錄 /&gt;
            </div>
          )}
        </div>

        {showAssetForm ? (
          <form onSubmit={handleAddAsset} className="bg-slate-900/80 p-4 rounded-xl border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)] animate-fade-in relative overflow-hidden">
             <div className="absolute top-0 right-0 p-2 text-[10px] text-emerald-900/50 font-tech">ASSET.ENTRY.MODE</div>
             <h3 className="text-xs font-bold text-emerald-500 mb-3 uppercase font-mono flex justify-between items-center">
                <span>{editingAssetId ? '// EDIT_ASSET' : '// NEW_ASSET'}</span>
                <span className="text-[10px] text-slate-500 font-normal">BASE CURRENCY: TWD</span>
             </h3>
             
             <div className="space-y-4 mb-3">
               {/* Type Selector */}
               <div>
                 <label className="text-[10px] text-slate-400 mb-1 block">資產類型 (TYPE)</label>
                 <select 
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    value={assetType}
                    onChange={e => setAssetType(e.target.value as AssetType)}
                  >
                    <option value="cash">現金 / 銀行存款 (Cash & Bank)</option>
                    <option value="tw_stock">台股 (Taiwan Stock)</option>
                    <option value="us_stock">美股 (US Stock)</option>
                    <option value="crypto">加密貨幣 (Crypto)</option>
                    <option value="insurance">保險 (Insurance)</option>
                    <option value="property">不動產 (Real Estate)</option>
                    <option value="investment">其他投資 (Other Investment)</option>
                    <option value="other">其他 (Other)</option>
                  </select>
               </div>

               {/* Investment Specific Fields */}
               {['tw_stock', 'us_stock', 'crypto', 'investment'].includes(assetType) && (
                 <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 grid grid-cols-2 gap-3 animate-fade-in">
                    <div className="col-span-2">
                       <label className="text-[10px] text-slate-400 mb-1 block">代號 (SYMBOL) - 自動查價</label>
                       {/* Unified Input Group for Stock Search */}
                       <div className="flex items-stretch bg-slate-800 rounded-lg border border-slate-700 focus-within:border-emerald-500 overflow-hidden transition-colors">
                         <input 
                           className="flex-1 px-3 py-2 bg-transparent border-none text-slate-200 text-sm font-mono uppercase placeholder:normal-case focus:ring-0 placeholder-slate-600" 
                           placeholder={assetType === 'tw_stock' ? "如: 2330, 0050" : (assetType === 'crypto' ? "如: BTC, ETH" : "如: AAPL, TSLA")}
                           value={symbol} 
                           onChange={e => setSymbol(e.target.value)}
                         />
                         <button 
                           type="button"
                           onClick={handleFetchPrice}
                           disabled={!symbol || isFetchingPrice}
                           className="px-3 bg-slate-700/50 hover:bg-emerald-600/20 text-emerald-400 border-l border-slate-700 hover:border-emerald-500/50 transition-all disabled:opacity-50 flex items-center gap-1.5 text-xs font-medium"
                         >
                           {isFetchingPrice ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                           <span className="hidden sm:inline">GET PRICE</span>
                         </button>
                       </div>
                    </div>
                    
                    <div className="col-span-2 grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400 mb-1 block">持有數量 (SHARES/UNITS)</label>
                        <input 
                          type="number"
                          step="any"
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm font-mono focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none" 
                          placeholder="0" 
                          value={shares} 
                          onChange={e => setShares(e.target.value)}
                        />
                      </div>
                      <div>
                         <label className="text-[10px] text-slate-500 mb-1 block text-right">自動算算台幣總值</label>
                         <div className="text-right text-emerald-400 font-mono text-sm pt-2 font-bold">
                            ≈ ${assetValue ? parseFloat(assetValue).toLocaleString() : '0'}
                         </div>
                      </div>
                    </div>

                    {/* Price Row */}
                    <div>
                       <label className="text-[10px] text-slate-400 mb-1 block">買入成本 ({currency})</label>
                       <input 
                         type="number"
                         step="any"
                         className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm font-mono focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none" 
                         placeholder="0.00" 
                         value={purchasePrice} 
                         onChange={e => setPurchasePrice(e.target.value)}
                       />
                    </div>
                    <div>
                       <label className="text-[10px] text-cyan-400 mb-1 block">當前市價 ({currency})</label>
                       <input 
                         type="number"
                         step="any"
                         className="w-full px-3 py-2 bg-slate-800 border border-cyan-500/30 rounded-lg text-cyan-300 text-sm font-mono shadow-[inset_0_0_5px_rgba(6,182,212,0.1)] focus:border-cyan-500 outline-none" 
                         placeholder="自動帶入" 
                         value={currentPrice} 
                         onChange={e => setCurrentPrice(e.target.value)}
                       />
                    </div>

                    {/* Exchange Rate Row (Only for Foreign) */}
                    {(currency === 'USD') && (
                       <>
                         <div className="col-span-2 border-t border-slate-700/50 my-1"></div>
                         <div>
                            <label className="text-[10px] text-slate-400 mb-1 block">買入時匯率 (Buy FX)</label>
                            <input 
                              type="number"
                              step="any"
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm font-mono focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none" 
                              placeholder="如: 30.5" 
                              value={purchaseExchangeRate} 
                              onChange={e => setPurchaseExchangeRate(e.target.value)}
                            />
                         </div>
                         <div>
                            <label className="text-[10px] text-cyan-400 mb-1 flex justify-between items-center">
                               <span>當前匯率 (Current FX)</span>
                               <span className="text-[9px] text-cyan-600/80 font-mono">AUTO-FETCH</span>
                            </label>
                            {/* Unified Input Group for FX Rate - FIXED LAYOUT */}
                            <div className="flex items-stretch bg-slate-800 rounded-lg border border-cyan-500/30 focus-within:border-cyan-400 overflow-hidden shadow-[inset_0_0_5px_rgba(6,182,212,0.1)] transition-colors">
                               <input 
                                 type="number"
                                 step="any"
                                 className="flex-1 px-3 py-2 bg-transparent border-none text-cyan-300 text-sm font-mono focus:ring-0 placeholder-cyan-700/50" 
                                 placeholder="32.5" 
                                 value={currentExchangeRate} 
                                 onChange={e => setCurrentExchangeRate(e.target.value)}
                               />
                               <button 
                                 type="button"
                                 onClick={handleFetchFX}
                                 disabled={isFetchingFX}
                                 className="px-3 bg-cyan-950/50 hover:bg-cyan-500/20 border-l border-cyan-500/30 text-cyan-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                                 title="自動更新匯率"
                               >
                                 {isFetchingFX ? <RefreshCw size={14} className="animate-spin" /> : <Globe size={14} />}
                                 <span className="hidden sm:inline text-[10px] font-mono">GET RATE</span>
                               </button>
                            </div>
                         </div>
                         <div className="col-span-2 text-[10px] text-slate-500 text-center pt-1">
                           註：系統將自動計算匯差與價差的綜合損益
                         </div>
                       </>
                    )}
                 </div>
               )}

               {/* Generic Fields */}
               <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-400 mb-1 block">名稱 / 帳戶名 (NAME)</label>
                    <input 
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none" 
                      placeholder={getAssetPlaceholder(assetType)}
                      value={assetName} 
                      onChange={e => setAssetName(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-400 mb-1 block">最終台幣總價值 (TWD)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">NT$</span>
                      <input 
                        type="number"
                        className={`w-full pl-10 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-mono ${['tw_stock','us_stock','crypto'].includes(assetType) ? 'bg-slate-900 opacity-80' : ''}`} 
                        placeholder="價值" 
                        value={assetValue} 
                        onChange={e => setAssetValue(e.target.value)}
                        readOnly={['tw_stock','us_stock','crypto'].includes(assetType) && !!(shares && currentPrice)}
                        required
                      />
                    </div>
                    {currency === 'USD' && (
                      <p className="text-[10px] text-slate-500 mt-1 text-right">
                         公式: USD ${currentPrice || 0} × {shares || 0} × FX {currentExchangeRate || 1}
                      </p>
                    )}
                  </div>
               </div>
             </div>

             <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
               <button type="button" onClick={resetAssetForm} className="text-xs font-medium text-slate-400 px-3 py-2 hover:text-slate-200">取消</button>
               <button type="submit" className="text-xs font-medium bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                 {editingAssetId ? '更新資產' : '新增資產'}
               </button>
             </div>
          </form>
        ) : (
          <button 
            onClick={() => setShowAssetForm(true)}
            className="w-full py-3 border border-dashed border-emerald-500/30 rounded-xl text-emerald-500/70 hover:border-emerald-400 hover:text-emerald-400 hover:bg-emerald-900/10 transition-all flex items-center justify-center gap-2 font-medium text-sm uppercase tracking-wider"
          >
            <Plus size={18} /> 新增資產項目
          </button>
        )}
      </div>

      {/* LIABILITIES COLUMN */}
      <div className="space-y-4">
        <div className="flex justify-between items-end border-b border-rose-500/30 pb-2">
          <h2 className="text-xl font-bold text-rose-400 tracking-wide flex items-center gap-2">
             <span className="w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
             負債 (LIABILITIES)
          </h2>
          <span className="text-rose-400 font-bold text-xl font-mono drop-shadow-[0_0_5px_rgba(244,63,94,0.4)]">
              ${totalLiabilities.toLocaleString()}
          </span>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-rose-500/20 shadow-lg overflow-hidden">
          {liabilities.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-2 p-4 border-b border-slate-800 last:border-0 hover:bg-slate-800/50 group transition-all">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="p-2 bg-rose-900/20 text-rose-400 rounded-lg border border-rose-500/20 flex-shrink-0">
                  <CreditCard size={18} />
                </div>
                <div className="truncate">
                  <p className="font-medium text-slate-200 truncate">{item.name}</p>
                  <p className="text-xs text-slate-500 font-mono truncate">{getLiabilityTypeLabel(item.type)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                <span className="font-semibold text-rose-100 font-mono">${item.value.toLocaleString()}</span>
                <div className="flex gap-1">
                    <button onClick={() => handleEditLiability(item)} className="text-slate-600 hover:text-rose-400 transition-colors p-1 opacity-60 group-hover:opacity-100">
                        <Edit2 size={16} />
                    </button>
                    <button onClick={() => onDeleteLiability(item.id)} className="text-slate-600 hover:text-rose-500 transition-colors p-1 opacity-60 group-hover:opacity-100">
                        <Trash2 size={16} />
                    </button>
                </div>
              </div>
            </div>
          ))}
          {liabilities.length === 0 && (
             <div className="p-8 text-center text-slate-500 text-sm font-mono">
              &lt; 無負債紀錄 /&gt;
            </div>
          )}
        </div>

        {showLiabilityForm ? (
          <form onSubmit={handleAddLiability} className="bg-slate-900/80 p-4 rounded-xl border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)] animate-fade-in relative overflow-hidden">
             <div className="absolute top-0 right-0 p-2 text-[10px] text-rose-900/50 font-tech">DEBT.ENTRY.MODE</div>
             <h3 className="text-xs font-bold text-rose-500 mb-3 uppercase font-mono">
                {editingLiabilityId ? '// EDIT_LIABILITY' : '// NEW_LIABILITY'}
             </h3>
             <div className="grid grid-cols-2 gap-3 mb-3">
                <input 
                  className="col-span-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:ring-1 focus:ring-rose-500 focus:border-rose-500 outline-none" 
                  placeholder="負債名稱 (如: 信用卡帳單、車貸)" 
                  value={liabilityName} 
                  onChange={e => setLiabilityName(e.target.value)}
                  required
                />
                <input 
                  type="number"
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:ring-1 focus:ring-rose-500 focus:border-rose-500 outline-none font-mono" 
                  placeholder="金額" 
                  value={liabilityValue} 
                  onChange={e => setLiabilityValue(e.target.value)}
                  required
                />
                <select 
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:ring-1 focus:ring-rose-500 focus:border-rose-500 outline-none"
                  value={liabilityType}
                  onChange={e => setLiabilityType(e.target.value as LiabilityType)}
                >
                  <option value="credit_card">信用卡</option>
                  <option value="loan">信用貸款</option>
                  <option value="mortgage">房屋貸款</option>
                  <option value="other">其他</option>
                </select>
             </div>
             <div className="flex justify-end gap-2">
               <button type="button" onClick={resetLiabilityForm} className="text-xs font-medium text-slate-400 px-3 py-2 hover:text-slate-200">取消</button>
               <button type="submit" className="text-xs font-medium bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]">
                 {editingLiabilityId ? '確認更新' : '確認新增'}
               </button>
             </div>
          </form>
        ) : (
          <button 
            onClick={() => setShowLiabilityForm(true)}
            className="w-full py-3 border border-dashed border-rose-500/30 rounded-xl text-rose-500/70 hover:border-rose-400 hover:text-rose-400 hover:bg-rose-900/10 transition-all flex items-center justify-center gap-2 font-medium text-sm uppercase tracking-wider"
          >
            <Plus size={18} /> 新增負債項目
          </button>
        )}
      </div>
    </div>
  );
};
