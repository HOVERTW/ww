import { FinancialData, Transaction, Asset, Liability } from "../types";

const STORAGE_KEY = 'wealthwise_data_v1';

const INITIAL_DATA: FinancialData = {
  transactions: [],
  assets: [],
  liabilities: [],
  recurringTransactions: []
};

export const loadData = (): FinancialData => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : INITIAL_DATA;
  } catch (e) {
    console.error("Failed to load data", e);
    return INITIAL_DATA;
  }
};

export const saveData = (data: FinancialData) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save data", e);
  }
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const validateImportData = (data: any): boolean => {
  if (!data || typeof data !== 'object') return false;
  
  // Basic structural check
  const hasTransactions = Array.isArray(data.transactions);
  const hasAssets = Array.isArray(data.assets);
  const hasLiabilities = Array.isArray(data.liabilities);
  
  return hasTransactions && hasAssets && hasLiabilities;
};
