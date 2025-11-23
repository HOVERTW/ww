
import React, { useRef, useState } from 'react';
import { FinancialData } from '../types';
import { validateImportData } from '../services/storageService';
import { Download, Upload, AlertTriangle, CheckCircle, Save, Database, HardDrive, RefreshCw } from 'lucide-react';

interface SettingsProps {
  data: FinancialData;
  onImportData: (data: FinancialData) => void;
}

export const Settings: React.FC<SettingsProps> = ({ data, onImportData }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const handleExport = () => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `WealthWise_Backup_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (validateImportData(json)) {
          onImportData(json);
          setImportStatus('success');
          setStatusMsg(`成功還原 ${json.transactions.length} 筆交易與資產資料。`);
        } else {
          setImportStatus('error');
          setStatusMsg('檔案格式錯誤：這不是有效的 WealthWise 備份檔。');
        }
      } catch (err) {
        setImportStatus('error');
        setStatusMsg('解析錯誤：無法讀取檔案內容。');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
    setImportStatus('idle');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden">
         <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
         <h2 className="text-xl font-bold text-slate-100 flex items-center gap-3 font-mono mb-4">
            <Database size={24} className="text-cyan-400" />
            系統資料管理 (SYSTEM_DATA)
         </h2>
         <p className="text-slate-400 text-sm mb-6">
            您的資料目前僅存儲在本地瀏覽器中。為了防止資料遺失（如清除快取或更換裝置），請定期執行資料備份。
         </p>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* BACKUP CARD */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 flex flex-col items-center text-center hover:border-cyan-500/50 transition-colors group">
               <div className="w-16 h-16 bg-cyan-900/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Download size={32} className="text-cyan-400" />
               </div>
               <h3 className="text-lg font-bold text-slate-200 mb-2">匯出備份 (Backup)</h3>
               <p className="text-xs text-slate-500 mb-6 px-4">
                  下載完整的 JSON 格式資料檔。包含所有交易紀錄、資產、負債與自定義設定。
               </p>
               <button 
                  onClick={handleExport}
                  className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-mono font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2"
               >
                  <Save size={18} /> DOWNLOAD_DATA
               </button>
            </div>

            {/* RESTORE CARD */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 flex flex-col items-center text-center hover:border-emerald-500/50 transition-colors group">
               <div className="w-16 h-16 bg-emerald-900/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Upload size={32} className="text-emerald-400" />
               </div>
               <h3 className="text-lg font-bold text-slate-200 mb-2">還原資料 (Restore)</h3>
               <p className="text-xs text-slate-500 mb-6 px-4">
                  讀取先前匯出的 JSON 檔案。注意：這將<span className="text-rose-400 font-bold">覆蓋</span>當前所有資料。
               </p>
               <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".json" 
                  className="hidden" 
               />
               <button 
                  onClick={triggerFileInput}
                  className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-mono font-bold border border-slate-600 transition-all flex items-center justify-center gap-2"
               >
                  <HardDrive size={18} /> LOAD_BACKUP
               </button>
            </div>
         </div>

         {/* STATUS MESSAGE */}
         {importStatus !== 'idle' && (
            <div className={`mt-6 p-4 rounded-lg border flex items-start gap-3 animate-fade-in ${
               importStatus === 'success' 
               ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400' 
               : 'bg-rose-900/20 border-rose-500/30 text-rose-400'
            }`}>
               {importStatus === 'success' ? <CheckCircle className="flex-shrink-0" /> : <AlertTriangle className="flex-shrink-0" />}
               <div>
                  <h4 className="font-bold text-sm font-mono">{importStatus === 'success' ? 'SYSTEM_RESTORE_COMPLETE' : 'SYSTEM_ERROR'}</h4>
                  <p className="text-xs opacity-90 mt-1">{statusMsg}</p>
               </div>
            </div>
         )}
      </div>

      <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-lg">
         <h3 className="text-sm font-bold text-slate-400 mb-4 font-mono uppercase tracking-wider">Application Info</h3>
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="flex justify-between border-b border-slate-800 pb-2">
               <span className="text-slate-500">VERSION</span>
               <span className="text-cyan-500">v2.1.0 (Cyberpunk)</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
               <span className="text-slate-500">BUILD_ENV</span>
               <span className="text-slate-300">PWA / REACT</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
               <span className="text-slate-500">STORAGE_MODE</span>
               <span className="text-amber-400">LOCAL_STORAGE (OFFLINE)</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
               <span className="text-slate-500">AI_CORE</span>
               <span className="text-fuchsia-400">GEMINI-2.5-FLASH</span>
            </div>
         </div>
      </div>
    </div>
  );
};
