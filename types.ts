
export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  category: string;
  note: string;
  sourceId?: string; // ID of the Asset or Liability
  sourceType?: 'asset' | 'liability';
}

export interface RecurringTransaction {
  id: string;
  name: string; // User friendly name e.g. "Mortgage"
  amount: number;
  type: TransactionType;
  category: string;
  sourceId?: string;
  sourceType?: 'asset' | 'liability';
  frequency: 'monthly'; // Currently support monthly
  dayOfMonth: number; // 1-31
  nextDueDate: string; // YYYY-MM-DD
  lastProcessedDate?: string;
  active: boolean;
  remainingOccurrences?: number; // If defined, stops after 0. If undefined, runs forever.
}

export type AssetType = 'cash' | 'investment' | 'property' | 'crypto' | 'other';
export type LiabilityType = 'credit_card' | 'loan' | 'mortgage' | 'other';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  value: number;
  // Investment specific fields
  symbol?: string;
  shares?: number;
  purchasePrice?: number;
  currentPrice?: number;
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
  ADVISOR = 'ADVISOR'
}
