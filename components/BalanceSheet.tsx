import React, { useState } from 'react';
import { Asset, Liability, AssetType, LiabilityType } from '../types';
import { generateId } from '../services/storageService';
import { getStockPrice } from '../services/geminiService';
import { Plus, Trash2, Building2, Briefcase, Wallet, CreditCard, DollarSign, Edit2, RefreshCw, TrendingUp, TrendingDown, Search } from 'lucide-react';

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
  const [assetValue, setAssetValue] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('cash');
  
  // Investment specific state
  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);

  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);

  // -- Liability Form State --
  const [liabilityName, setLiabilityName] = useState('');
  const [liabilityValue, setLiabilityValue] = useState('');
  const [liabilityType, setLiabilityType] = useState<LiabilityType>('credit_card');
  const [showLiabilityForm, setShowLiabilityForm] = useState(false);
  const [editingLiabilityId, setEditingLiabilityId] = useState<string | null>(null);

  // --- Asset Handlers ---

  const handleFetchPrice = async () => {
    if (!symbol) return;
    setIsFetchingPrice(true);
    const data = await getStockPrice(symbol);
    if (data) {
      setCurrentPrice(data.price.toString());
      if (!assetName) setAssetName(data.name || symbol.toUpperCase());
      
      // Auto calculate total value if shares exist
      if (shares) {
        const totalVal = data.price * parseFloat(shares);
        setAssetValue(totalVal.toFixed(2));
      }
    }
    setIsFetchingPrice(false);
  };

  // Recalculate value when shares or current price changes
  React.useEffect(() => {
    if (assetType === 'investment' && shares && currentPrice) {
       const val = parseFloat(shares) * parseFloat(currentPrice);
       setAssetValue(val.toFixed(2));
    }
  }, [shares, currentPrice, assetType]);

  const handleAddAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if(!assetName || !assetValue) return;

    const newAsset: Asset = {
      id: editingAssetId || generateId(),
      name: assetName,
      value: parseFloat(assetValue),
      type: assetType,
    };

    // Add investment details if applicable
    if (assetType === 'investment') {
      newAsset.symbol = symbol.toUpperCase();
      newAsset.shares = shares ? parseFloat(shares) : undefined;
      newAsset.purchasePrice = purchasePrice ? parseFloat(purchasePrice) : undefined;
      newAsset.currentPrice = currentPrice ? parseFloat(currentPrice) : undefined;
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
      case 'investment': return <Briefcase size={18} />;
      case 'cash': return <Wallet size={18} />;
      case 'crypto': return <DollarSign size={18} />; 
      default: return <DollarSign size={18} />;
    }
  };

  const getAssetTypeLabel = (type: AssetType) => {
      switch(type) {
          case 'cash': return '現金';
          case 'investment': return '投資';
          case 'property': return '不動產';
          case 'crypto': return '加密貨幣';
          case 'other': return '其他';
          default: return type;
      }
  }

  const getLiabilityTypeLabel = (type: LiabilityType) => {
    switch(type) {
        case 'credit_card': return '信用卡';
        case 'loan': return '貸款';
        case 'mortgage': return '房貸';
        case 'other': return '其他';
        default: return type;
    }
  }

  const renderInvestmentDetails = (asset: Asset) => {
    if (asset.type !== 'investment' || !asset.shares || !asset.currentPrice || !asset.purchasePrice) return null;
    
    const cost = asset.shares * asset.purchasePrice;
    const marketValue = asset.value; // Already shares * currentPrice
    const profitLoss = marketValue - cost;
    const percent = (profitLoss / cost) * 100;
    const isProfit = profitLoss >= 0;

    return (
      <div className="mt-2 flex items-center gap-3 text-xs font-mono bg-slate-900/40 p-2 rounded border border-slate-700/50">
        <div className="flex flex-col">
          <span className="text-slate-500">持股</span>
          <span className="text-slate-300">{asset.shares} 股</span>
        </div>
        <div className="flex flex-col">
          <span className="text-slate-500">成本</span>
          <span className="text-slate-300">${asset.purchasePrice}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-slate-500">現價</span>
          <span className="text-slate-300">${asset.currentPrice}</span>
        </div>
        <div className="flex-1 text-right">
          <span className={`flex items-center justify-end gap-1 font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
             {isProfit ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
             {percent.toFixed(2)}%
          </span>
          <span className={`${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
            {isProfit ? '+' : ''}{Math.round(profitLoss).toLocaleString()}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* ASSETS COLUMN */}
      <div className="space-y-4">
        <div className="flex justify-between items-end border-b border-emerald-500/30 pb-2">
          <h2 className="text-xl font-bold text-emerald-400 tracking-wide flex items-center gap-2">
             <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
             資產 (ASSETS)
          </h2>
          <span className="text-emerald-400 font-bold text-xl font-mono drop-shadow-[0_0_5px_rgba(16,185,129,0.4)]">
              ${totalAssets.toLocaleString()}
          </span>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-emerald-500/20 shadow-lg overflow-hidden">
          {assets.map(item => (
            <div key={item.id} className="p-4 border-b border-slate-800 last:border-0 hover:bg-slate-800/50 group transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-900/20 text-emerald-400 rounded-lg border border-emerald-500/20">
                    {getAssetIcon(item.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-200">{item.name}</p>
                      {item.symbol && <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300 font-mono">{item.symbol}</span>}
                    </div>
                    <p className="text-xs text-slate-500 font-mono">{getAssetTypeLabel(item.type)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                  <span className="font-semibold text-emerald-100 font-mono text-lg">${item.value.toLocaleString()}</span>
                  <div className="flex gap-1">
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
          <form onSubmit={handleAddAsset} className="bg-slate-900/80 p-4 rounded-xl border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)] animate-fade-in">
             <h3 className="text-xs font-bold text-emerald-500 mb-3 uppercase font-mono flex justify-between items-center">
                <span>{editingAssetId ? '// EDIT_ASSET' : '// NEW_ASSET'}</span>
                <span className="text-[10px] text-slate-500 font-normal">TYPE: {assetType.toUpperCase()}</span>
             </h3>
             
             <div className="space-y-3 mb-3">
               {/* Type Selector */}
               <select 
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  value={assetType}
                  onChange={e => setAssetType(e.target.value as AssetType)}
                >
                  <option value="cash">現金 (Cash)</option>
                  <option value="investment">投資 (Stock/ETF)</option>
                  <option value="property">不動產 (Property)</option>
                  <option value="crypto">加密貨幣 (Crypto)</option>
                  <option value="other">其他 (Other)</option>
                </select>

               {/* Investment Specific Fields */}
               {assetType === 'investment' && (
                 <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 grid grid-cols-2 gap-3 animate-fade-in">
                    <div className="col-span-2">
                       <label className="text-[10px] text-slate-400 mb-1 block">股票代號 (SYMBOL)</label>
                       <div className="flex gap-2">
                         <input 
                           className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm font-mono uppercase placeholder:normal-case" 
                           placeholder="例如: 2330, QQQ, TSLA" 
                           value={symbol} 
                           onChange={e => setSymbol(e.target.value)}
                         />
                         <button 
                           type="button"
                           onClick={handleFetchPrice}
                           disabled={!symbol || isFetchingPrice}
                           className="px-3 py-2 bg-cyan-900/30 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-colors disabled:opacity-50 flex items-center gap-1 whitespace-nowrap text-xs"
                         >
                           {isFetchingPrice ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                           查價
                         </button>
                       </div>
                    </div>
                    <div>
                       <label className="text-[10px] text-slate-400 mb-1 block">持有股數 (SHARES)</label>
                       <input 
                         type="number"
                         step="any"
                         className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm font-mono" 
                         placeholder="0" 
                         value={shares} 
                         onChange={e => setShares(e.target.value)}
                       />
                    </div>
                    <div>
                       <label className="text-[10px] text-slate-400 mb-1 block">平均成本 (AVG COST)</label>
                       <input 
                         type="number"
                         step="any"
                         className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm font-mono" 
                         placeholder="0.00" 
                         value={purchasePrice} 
                         onChange={e => setPurchasePrice(e.target.value)}
                       />
                    </div>
                    <div>
                       <label className="text-[10px] text-cyan-400 mb-1 block">當前股價 (PRICE)</label>
                       <input 
                         type="number"
                         step="any"
                         className="w-full px-3 py-2 bg-slate-800 border border-cyan-500/50 rounded-lg text-cyan-300 text-sm font-mono shadow-[inset_0_0_5px_rgba(6,182,212,0.1)]" 
                         placeholder="自動帶入..." 
                         value={currentPrice} 
                         onChange={e => setCurrentPrice(e.target.value)}
                       />
                    </div>
                 </div>
               )}

               <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-400 mb-1 block">資產名稱 (NAME)</label>
                    <input 
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none" 
                      placeholder="如: 台積電持股, 銀行存款" 
                      value={assetName} 
                      onChange={e => setAssetName(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-400 mb-1 block">總價值 (TOTAL VALUE)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                      <input 
                        type="number"
                        className={`w-full pl-6 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-mono ${assetType === 'investment' ? 'opacity-80 bg-slate-900' : ''}`} 
                        placeholder="價值" 
                        value={assetValue} 
                        onChange={e => setAssetValue(e.target.value)}
                        readOnly={assetType === 'investment' && !!(shares && currentPrice)}
                        required
                      />
                    </div>
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

      {/* LIABILITIES COLUMN (Unchanged mostly, just passed props) */}
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
            <div key={item.id} className="flex items-center justify-between p-4 border-b border-slate-800 last:border-0 hover:bg-slate-800/50 group transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-900/20 text-rose-400 rounded-lg border border-rose-500/20">
                  <CreditCard size={18} />
                </div>
                <div>
                  <p className="font-medium text-slate-200">{item.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{getLiabilityTypeLabel(item.type)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-4">
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
          <form onSubmit={handleAddLiability} className="bg-slate-900/80 p-4 rounded-xl border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)] animate-fade-in">
             <h3 className="text-xs font-bold text-rose-500 mb-3 uppercase font-mono">
                {editingLiabilityId ? '// EDIT_LIABILITY' : '// NEW_LIABILITY'}
             </h3>
             <div className="grid grid-cols-2 gap-3 mb-3">
                <input 
                  className="col-span-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:ring-1 focus:ring-rose-500 focus:border-rose-500 outline-none" 
                  placeholder="負債名稱 (如: 信用卡帳單)" 
                  value={liabilityName} 
                  onChange={e => setLiabilityName(e.target.value)}
                  required
                />
                <input 
                  type="number"
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:ring-1 focus:ring-rose-500 focus:border-rose-500 outline-none font-mono" 
                  placeholder="價值" 
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
                  <option value="loan">貸款</option>
                  <option value="mortgage">房貸</option>
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