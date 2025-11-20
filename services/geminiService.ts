import { GoogleGenAI } from "@google/genai";
import { FinancialData } from "../types";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY is missing");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeFinances = async (data: FinancialData, userQuery?: string): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "錯誤：缺少 API 金鑰。請配置您的環境變數。";

  // Calculate summary stats to send to AI
  const totalIncome = data.transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalExpense = data.transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalAssets = data.assets.reduce((sum, a) => sum + a.value, 0);
  const totalLiabilities = data.liabilities.reduce((sum, l) => sum + l.value, 0);
  const netWorth = totalAssets - totalLiabilities;

  // Prepare a summarized context to avoid token limits if data is huge
  const context = `
    你是一位專業的個人財務顧問，擁有賽博朋克風格的冷靜與理性。請根據以下提供的財務數據進行分析。請使用繁體中文（台灣用語）回答。
    
    **財務摘要：**
    - 淨資產：$${netWorth.toFixed(2)}
    - 總資產：$${totalAssets.toFixed(2)}
    - 總負債：$${totalLiabilities.toFixed(2)}
    - 總收入 (紀錄中)：$${totalIncome.toFixed(2)}
    - 總支出 (紀錄中)：$${totalExpense.toFixed(2)}

    **近期交易 (最近 20 筆)：**
    ${data.transactions.slice(0, 20).map(t => `- [${t.date}] ${t.type === 'income' ? '收入' : '支出'}: $${t.amount} (${t.category}) - ${t.note}`).join('\n')}

    **資產列表：**
    ${data.assets.map(a => `- ${a.name} (${a.type}): $${a.value} ${a.symbol ? `[${a.symbol} 損益: ${((a.currentPrice || 0) - (a.purchasePrice || 0)) * (a.shares || 0)}]` : ''}`).join('\n')}

    **負債列表：**
    ${data.liabilities.map(l => `- ${l.name} (${l.type}): $${l.value}`).join('\n')}

    ${userQuery ? `**用戶問題：** "${userQuery}"` : "**任務：** 請簡要評估我的財務健康狀況，識別消費模式，並提供 3 個具體可行的建議來增加淨資產。"}

    保持語氣專業、具備前瞻性，並使用 Markdown 格式。回答請精簡有力。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: context,
      config: {
        systemInstruction: "你是 WealthWise，一個具備高等智能的財務助理 AI。你的風格是冷靜、精確且帶有輕微的未來科技感。請使用繁體中文回答。",
      }
    });
    return response.text || "目前無法生成分析報告。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "抱歉，在分析您的數據時遇到系統錯誤。請檢查您的網路連接或神經網絡接口（API Key）。";
  }
};

export const suggestCategoryIcons = async (categoryName: string): Promise<string[]> => {
  const ai = getAiClient();
  if (!ai) return ["HelpCircle", "Tag", "Hash"]; // Fallback

  const prompt = `
    User wants a Lucide-React icon for the finance category: "${categoryName}".
    Return a JSON array containing exactly 3 distinct PascalCase icon names from the Lucide library that best represent this category.
    Example output: ["Coffee", "CupSoda", "GlassWater"]
    Do not include markdown code blocks. Return only the JSON string.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 1.2, // Higher temperature for variety on refreshes
      }
    });
    
    const text = response.text?.trim() || "[]";
    // Simple cleanup if the model adds markdown syntax despite instructions
    const jsonStr = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Icon Suggestion Error:", error);
    return ["HelpCircle", "Tag", "Hash"];
  }
};

export const getStockPrice = async (symbol: string): Promise<{ price: number, currency: string, name: string } | null> => {
  const ai = getAiClient();
  if (!ai) return null;

  const prompt = `
    Find the current stock price for ticker "${symbol}". 
    If it is a Taiwan stock (e.g. 2330), assume TWSE/TPEX. If US (e.g. QQQ, NVDA), assume US market.
    Return a purely JSON object with no markdown.
    Format: { "price": number, "currency": "string" (e.g. USD or TWD), "name": "string" (company name) }
    Example: { "price": 123.45, "currency": "USD", "name": "Apple Inc." }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });
    
    // With search grounding, we might get text or grounding metadata.
    // We rely on the model to synthesize the search result into the requested JSON format.
    const text = response.text?.trim();
    
    if (!text) return null;

    // Attempt to find JSON-like structure
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[0];
      return JSON.parse(jsonStr);
    }

    return null;
  } catch (error) {
    console.error("Gemini Stock Fetch Error:", error);
    return null;
  }
};