
export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  category: string;
  note: string;
  
  // Source (From)
  sourceId?: string; // ID of the Asset or Liability
  sourceType?: 'asset' | 'liability';
  
  // Destination (To) - Only for transfers
  destinationId?: string;
  destinationType?: 'asset' | 'liability';

  // Link to parent recurring rule
  recurringRuleId?: string;

  // Ledger Status
  processed?: boolean; // If true, balance has been updated. If false/undefined, it is pending (future).
}

export interface RecurringTransaction {
  id: string;
  name: string; // User friendly name e.g. "Mortgage"
  amount: number;
  type: TransactionType;
  category: string;
  
  sourceId?: string;
  sourceType?: 'asset' | 'liability';
  
  destinationId?: string;
  destinationType?: 'asset' | 'liability';

  frequency: 'monthly'; // Currently support monthly
  dayOfMonth: number; // 1-31
  nextDueDate: string; // YYYY-MM-DD
  lastProcessedDate?: string;
  active: boolean;
  remainingOccurrences?: number; // If defined, stops after 0. If undefined, runs forever.
}

// Updated AssetType to distinguish markets and include insurance
export type AssetType = 'cash' | 'tw_stock' | 'us_stock' | 'crypto' | 'property' | 'investment' | 'insurance' | 'other';
export type LiabilityType = 'credit_card' | 'loan' | 'mortgage' | 'other';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  value: number; // Always in TWD (Base Currency)
  
  // Investment specific fields
  symbol?: string;
  shares?: number;
  
  // Price details
  purchasePrice?: number; // In Original Currency (TWD, USD, etc.)
  currentPrice?: number;  // In Original Currency
  
  // FX details (For US Stock / Crypto)
  currency?: 'TWD' | 'USD' | 'USDT' | 'OTHER';
  purchaseExchangeRate?: number; // e.g. 30.5 (at time of buy)
  currentExchangeRate?: number;  // e.g. 32.1 (now)
  
  lastUpdated?: string;
}

export interface Liability {
  id: string;
  name: string;
  type: LiabilityType;
  value: number;
}

export interface CustomCategory {
  id: string;
  name: string;
  type: TransactionType;
  iconName: string;
}

export interface FinancialData {
  transactions: Transaction[];
  assets: Asset[];
  liabilities: Liability[];
  customCategories?: CustomCategory[];
  recurringTransactions?: RecurringTransaction[];
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  TRANSACTIONS = 'TRANSACTIONS',
  BALANCE_SHEET = 'BALANCE_SHEET',
  ADVISOR = 'ADVISOR',
  SETTINGS = 'SETTINGS'
}
