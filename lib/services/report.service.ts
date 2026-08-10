import { supabase } from '../supabase';

export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  savings: number;
  savingsRate: number;
}

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  amountMinor: number;
  percentage: number;
}

export interface MonthlyTrend {
  month: string; // e.g. "Aug"
  incomeMinor: number;
  expenseMinor: number;
}

export interface SubscriptionAnalytics {
  monthlyTotalMinor: number;
  annualTotalMinor: number;
  activeCount: number;
}

export interface UpcomingCommitments {
  subscriptionsMinor: number;
  billsMinor: number;
  totalMinor: number;
}

export const reportService = {
  async getFinancialSummary(userId: string, startDate: string, endDate: string): Promise<FinancialSummary> {
    const { data: txs, error } = await supabase
      .from('transactions')
      .select('type, amount_minor')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .is('deleted_at', null);

    if (error) throw error;

    let totalIncome = 0;
    let totalExpense = 0;

    (txs || []).forEach((tx) => {
      if (tx.type === 'income') {
        totalIncome += Number(tx.amount_minor);
      } else if (tx.type === 'expense') {
        totalExpense += Number(tx.amount_minor);
      }
      // Transfers do not affect income or expense totals
    });

    const savings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((savings / totalIncome) * 100)) : 0;

    return {
      totalIncome,
      totalExpense,
      savings,
      savingsRate,
    };
  },

  async getCategorySpending(userId: string, startDate: string, endDate: string): Promise<CategorySpending[]> {
    const { data: txs, error } = await supabase
      .from('transactions')
      .select('amount_minor, category_id, categories(name, color)')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('date', startDate)
      .lte('date', endDate)
      .is('deleted_at', null);

    if (error) throw error;
    if (!txs || txs.length === 0) return [];

    const map: Record<string, { name: string; color: string; amount: number }> = {};
    let grandTotal = 0;

    txs.forEach((tx) => {
      const catId = tx.category_id || 'unassigned';
      const catName = (tx as any).categories?.name || 'General';
      const catColor = (tx as any).categories?.color || '#6366F1';
      const amount = Number(tx.amount_minor);

      grandTotal += amount;

      if (!map[catId]) {
        map[catId] = { name: catName, color: catColor, amount: 0 };
      }
      map[catId].amount += amount;
    });

    const result: CategorySpending[] = Object.entries(map).map(([id, val]) => ({
      categoryId: id,
      categoryName: val.name,
      categoryColor: val.color,
      amountMinor: val.amount,
      percentage: grandTotal > 0 ? Math.round((val.amount / grandTotal) * 100) : 0,
    }));

    return result.sort((a, b) => b.amountMinor - a.amountMinor);
  },

  async getSubscriptionAnalytics(userId: string): Promise<SubscriptionAnalytics> {
    const { data: subs, error } = await supabase
      .from('subscriptions')
      .select('amount_minor, billing_cycle, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .is('deleted_at', null);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return { monthlyTotalMinor: 0, annualTotalMinor: 0, activeCount: 0 };
    }

    let monthlyTotal = 0;
    let annualTotal = 0;

    subs.forEach((s) => {
      const amt = Number(s.amount_minor);
      switch (s.billing_cycle) {
        case 'weekly':
          monthlyTotal += Math.round((amt * 52) / 12);
          annualTotal += amt * 52;
          break;
        case 'monthly':
          monthlyTotal += amt;
          annualTotal += amt * 12;
          break;
        case 'quarterly':
          monthlyTotal += Math.round(amt / 3);
          annualTotal += amt * 4;
          break;
        case 'half_yearly':
          monthlyTotal += Math.round(amt / 6);
          annualTotal += amt * 2;
          break;
        case 'yearly':
          monthlyTotal += Math.round(amt / 12);
          annualTotal += amt;
          break;
        default:
          monthlyTotal += amt;
          annualTotal += amt * 12;
      }
    });

    return {
      monthlyTotalMinor: monthlyTotal,
      annualTotalMinor: annualTotal,
      activeCount: subs.length,
    };
  },

  async getUpcomingCommitments(userId: string): Promise<UpcomingCommitments> {
    const subAnalytics = await this.getSubscriptionAnalytics(userId);

    const { data: unpaidBills, error: bErr } = await supabase
      .from('bills')
      .select('expected_amount_minor')
      .eq('user_id', userId)
      .eq('is_paid', false)
      .is('deleted_at', null);

    if (bErr) throw bErr;

    const billsTotal = (unpaidBills || []).reduce((sum, b) => sum + Number(b.expected_amount_minor), 0);
    const subTotal = subAnalytics.monthlyTotalMinor;

    return {
      subscriptionsMinor: subTotal,
      billsMinor: billsTotal,
      totalMinor: subTotal + billsTotal,
    };
  },
};
