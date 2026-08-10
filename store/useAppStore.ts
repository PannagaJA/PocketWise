import { create } from 'zustand';

export interface Profile {
  id: string;
  display_name: string;
  currency: string;
  timezone: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'credit_card' | 'wallet' | 'investment' | 'other';
  balance: number; // minor units e.g. paise
  currency: string;
  icon?: string;
  color?: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  account_name?: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number; // minor units e.g. paise
  currency: string;
  category_name?: string;
  category_color?: string;
  description: string;
  date: string;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billing_cycle: 'monthly' | 'yearly' | 'weekly';
  next_billing_date: string;
  icon?: string;
  color?: string;
  auto_renew: boolean;
}

export interface Budget {
  id: string;
  category_name: string;
  amount_limit: number;
  amount_spent: number;
  period: 'monthly' | 'yearly';
}

interface AppStore {
  profile: Profile;
  accounts: Account[];
  transactions: Transaction[];
  subscriptions: Subscription[];
  budgets: Budget[];
  setAccounts: (accounts: Account[]) => void;
  addTransaction: (tx: Transaction) => void;
  addSubscription: (sub: Subscription) => void;
  fetchMockData: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  profile: {
    id: 'user_1',
    display_name: 'Pannaga',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
  },
  accounts: [
    { id: 'acc_1', name: 'HDFC Savings', type: 'bank', balance: 4500000, currency: 'INR', color: '#10B981' },
    { id: 'acc_2', name: 'ICICI Credit Card', type: 'credit_card', balance: 1250000, currency: 'INR', color: '#EF4444' },
    { id: 'acc_3', name: 'Cash Wallet', type: 'cash', balance: 350000, currency: 'INR', color: '#F59E0B' },
  ],
  transactions: [
    { id: 'tx_1', account_id: 'acc_1', account_name: 'HDFC Savings', type: 'expense', amount: 45000, currency: 'INR', category_name: 'Groceries', category_color: '#EF4444', description: 'Supermarket supplies', date: '2026-08-09' },
    { id: 'tx_2', account_id: 'acc_1', account_name: 'HDFC Savings', type: 'income', amount: 15000000, currency: 'INR', category_name: 'Salary', category_color: '#10B981', description: 'Monthly Salary Credit', date: '2026-08-01' },
    { id: 'tx_3', account_id: 'acc_2', account_name: 'ICICI Credit Card', type: 'expense', amount: 199900, currency: 'INR', category_name: 'Subscriptions', category_color: '#6366F1', description: 'Netflix Premium 4K', date: '2026-08-05' },
    { id: 'tx_4', account_id: 'acc_1', account_name: 'HDFC Savings', type: 'expense', amount: 250000, currency: 'INR', category_name: 'Dining', category_color: '#F59E0B', description: 'Weekend Dinner out', date: '2026-08-08' },
  ],
  subscriptions: [
    { id: 'sub_1', name: 'Netflix Premium', amount: 64900, currency: 'INR', billing_cycle: 'monthly', next_billing_date: '2026-08-15', color: '#E50914', auto_renew: true },
    { id: 'sub_2', name: 'Spotify Duo', amount: 14900, currency: 'INR', billing_cycle: 'monthly', next_billing_date: '2026-08-18', color: '#1DB954', auto_renew: true },
    { id: 'sub_3', name: 'Amazon Prime', amount: 149900, currency: 'INR', billing_cycle: 'yearly', next_billing_date: '2026-09-02', color: '#00A8E1', auto_renew: true },
    { id: 'sub_4', name: 'ChatGPT Plus', amount: 199900, currency: 'INR', billing_cycle: 'monthly', next_billing_date: '2026-08-22', color: '#10A37F', auto_renew: true },
  ],
  budgets: [
    { id: 'b_1', category_name: 'Food & Dining', amount_limit: 1500000, amount_spent: 850000, period: 'monthly' },
    { id: 'b_2', category_name: 'Shopping', amount_limit: 1000000, amount_spent: 420000, period: 'monthly' },
    { id: 'b_3', category_name: 'Subscriptions', amount_limit: 500000, amount_spent: 299700, period: 'monthly' },
  ],
  setAccounts: (accounts) => set({ accounts }),
  addTransaction: (tx) => set((state) => ({ transactions: [tx, ...state.transactions] })),
  addSubscription: (sub) => set((state) => ({ subscriptions: [...state.subscriptions, sub] })),
  fetchMockData: () => {},
}));
