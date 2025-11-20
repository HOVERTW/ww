import React, { useState, useRef, useEffect } from 'react';
import { FinancialData } from '../types';
import { analyzeFinances } from '../services/geminiService';
import { Bot, Send, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AIAdvisorProps {
  data: FinancialData;
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  isThinking?: boolean;
}

export const AIAdvisor: React.FC<AIAdvisorProps> = ({ data }) => {
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: 'welcome', 
      role: 'ai', 
      content: "你好！我是 WealthWise，你的個人 AI 財務規劃師。我可以存取你的資產負債表和交易紀錄。今天有什麼可以幫你的嗎？" 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Simulate network/thinking delay slightly for UX
    const aiResponseText = await analyzeFinances(data, userMsg.content);

    const aiMsg: Message = { 
      id: (Date.now() + 1).toString(), 
      role: 'ai', 
      content: aiResponseText 
    };

    setMessages(prev => [...prev, aiMsg]);
    setIsLoading(false);
  };

  // Quick action to generate a full report without typing
  const generateReport = async () => {
    const prompt = "請產生一份詳盡的財務健康報告，包含 3 個具體可行的建議。";
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: "分析我的財務健康" };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    const aiResponseText = await analyzeFinances(data, prompt);
    const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'ai', content: aiResponseText };
    setMessages(prev => [...prev, aiMsg]);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-[600px] bg-slate-900/80 backdrop-blur-sm rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.1)] border border-slate-700 overflow-hidden relative">
       {/* Grid overlay effect */}
       <div className="absolute inset-0 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImgridIiB4PSIwIiB5PSIwIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxwYXRoIGQ9Ik0gNDAgMCBMIDAgMCAwIDQwIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMTAwLCAxMTYsIDEzOSwgMC4xKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIiAvPjwvc3ZnPg==')] opacity-50"></div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-xl relative ${
              msg.role === 'user' 
                ? 'bg-cyan-700/30 border border-cyan-500/40 text-cyan-50 rounded-br-none shadow-[0_0_10px_rgba(6,182,212,0.2)]' 
                : 'bg-slate-800/80 border border-slate-600 text-slate-200 rounded-bl-none shadow-lg'
            }`}>
              {msg.role === 'ai' && (
                 <div className="flex items-center gap-2 mb-2 text-cyan-400 font-bold text-xs uppercase tracking-widest font-mono">
                   <Bot size={14} /> WealthWise AI v2.0
                 </div>
              )}
              <div className={`prose prose-sm max-w-none prose-invert ${msg.role === 'user' ? 'text-cyan-50' : 'text-slate-300'}`}>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-slate-800/80 border border-slate-600 p-4 rounded-xl rounded-bl-none shadow-sm flex items-center gap-3">
               <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
               <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse delay-100"></div>
               <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse delay-200"></div>
               <span className="text-xs text-cyan-500 font-mono ml-2">CALCULATING...</span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-slate-900 border-t border-slate-700 relative z-10">
        {messages.length === 1 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
             <button onClick={generateReport} className="flex items-center gap-2 px-4 py-2 bg-cyan-900/30 text-cyan-400 border border-cyan-500/30 rounded-lg text-sm font-medium hover:bg-cyan-500/20 transition-all whitespace-nowrap hover:shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                <Sparkles size={16} /> 分析我的財務健康
             </button>
             <button onClick={() => { setInput("我要如何存更多錢？"); handleSend(); }} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-400 border border-slate-600 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors whitespace-nowrap">
                我要如何存更多錢？
             </button>
          </div>
        )}
        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="輸入指令或問題..."
            disabled={isLoading}
            className="w-full pl-4 pr-12 py-3 bg-slate-800 border border-slate-600 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all font-mono text-sm"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)]"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};