/**
 * Dashboard Financial Metrics & Card Stack Calculation Helpers
 */

export interface DashboardAccount {
  id: string;
  name: string;
  balance: number; // in minor units
  color?: string;
}

export interface DashboardTransaction {
  id: string;
  account_id: string;
  type: 'income' | 'expense' | 'transfer';
  amount_minor: number;
  date: string;
}

export function computeActiveBalance(
  accounts: DashboardAccount[],
  selectedBankId: string
): number {
  if (selectedBankId === 'all') {
    return accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  }
  const acc = accounts.find((a) => a.id === selectedBankId);
  return acc?.balance || 0;
}

export function computeMonthlyCashflow(
  transactions: DashboardTransaction[],
  targetMonthIso: string // e.g. "2026-10"
): { monthlyIncome: number; monthlyExpense: number; netCashflow: number } {
  let monthlyIncome = 0;
  let monthlyExpense = 0;

  for (const tx of transactions) {
    if (tx.date && tx.date.startsWith(targetMonthIso)) {
      if (tx.type === 'income') {
        monthlyIncome += tx.amount_minor;
      } else if (tx.type === 'expense') {
        monthlyExpense += tx.amount_minor;
      }
    }
  }

  return {
    monthlyIncome,
    monthlyExpense,
    netCashflow: monthlyIncome - monthlyExpense,
  };
}

export function filterRecentTransactions(
  transactions: DashboardTransaction[],
  selectedBankId: string,
  limit: number = 5
): DashboardTransaction[] {
  const filtered =
    selectedBankId === 'all'
      ? transactions
      : transactions.filter((t) => t.account_id === selectedBankId);

  return filtered.slice(0, limit);
}
