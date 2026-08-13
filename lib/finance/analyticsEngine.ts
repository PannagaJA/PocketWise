import { notificationEngine } from '../notifications/notification.engine';
import { notificationService } from '../notifications/notification.service';

export interface SimpleTransactionItem {
  id: string;
  amount_minor?: number;
  amount?: number;
  type: string;
  category_name?: string;
  description?: string;
  date?: string;
}

export const financialAnalyticsEngine = {
  /**
   * Evaluates an incoming or saved transaction for Unusual Spending alerts.
   * Compares transaction amount against historical category/general transaction average.
   */
  async evaluateUnusualSpending(tx: SimpleTransactionItem, historicalTxs: SimpleTransactionItem[]): Promise<void> {
    const txAmount = tx.amount_minor ?? tx.amount ?? 0;
    if (tx.type !== 'expense' || txAmount <= 0) return;

    // Filter historical expense transactions excluding the current one
    const expenses = historicalTxs.filter((t) => t.type === 'expense' && t.id !== tx.id);
    if (expenses.length < 3) return; // Need at least 3 past transactions for baseline average

    // Calculate baseline average expense
    const totalPastExpense = expenses.reduce((sum, t) => sum + Number(t.amount_minor ?? t.amount ?? 0), 0);
    const avgExpense = totalPastExpense / expenses.length;

    // If transaction is > 2.5x the user's average transaction amount and at least Rs 1,000 (100,000 minor)
    if (txAmount >= Math.max(100000, avgExpense * 2.5)) {
      const formattedAmount = `₹${(txAmount / 100).toLocaleString('en-IN')}`;
      const categoryLabel = tx.category_name || 'spending';
      
      await notificationEngine.notify({
        eventId: `unusual_spend_${tx.id}`,
        category: 'unusual_spending',
        title: 'Unusual Spending Detected ⚠️',
        body: `${formattedAmount} spent on ${categoryLabel} is significantly higher than your average spend.`,
        priority: 'medium',
        data: { transactionId: tx.id, type: 'transaction' },
      });
    }
  },

  /**
   * Generates periodic financial insights (spending increase/decrease, top spending category).
   */
  async evaluateMonthlyAnalytics(currentMonthTxs: SimpleTransactionItem[], previousMonthTxs: SimpleTransactionItem[]): Promise<void> {
    const currentMonthKey = new Date().toISOString().substring(0, 7); // e.g. 2026-08

    const currentExpense = currentMonthTxs
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount_minor ?? t.amount ?? 0), 0);

    const prevExpense = previousMonthTxs
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount_minor ?? t.amount ?? 0), 0);

    // Only evaluate if user has meaningful activity this month
    if (currentExpense < 50000) return; // Rs 500 minimum

    if (prevExpense > 100000) { // Rs 1,000 min previous month to compare
      const diffRatio = (currentExpense - prevExpense) / prevExpense;
      const pct = Math.abs(Math.round(diffRatio * 100));

      if (diffRatio >= 0.25) { // 25%+ increase
        await notificationEngine.notify({
          eventId: `analytics_spending_increase_${currentMonthKey}`,
          category: 'analytics',
          title: 'Monthly Spending Insight 📈',
          body: `Your spending this month is ${pct}% higher than last month.`,
          priority: 'low',
          data: { type: 'analytics' },
        });
      } else if (diffRatio <= -0.20) { // 20%+ savings / lower spending
        await notificationEngine.notify({
          eventId: `analytics_spending_decrease_${currentMonthKey}`,
          category: 'analytics',
          title: 'Great Savings Progress! 🎉',
          body: `You spent ${pct}% less this month compared to last month. Keep it up!`,
          priority: 'low',
          data: { type: 'analytics' },
        });
      }
    }
  },

  /**
   * Generates Daily Financial Summary OS notification.
   */
  async generateDailySummary(txsToday: SimpleTransactionItem[], dailyBudgetRemainingMinor?: number): Promise<void> {
    const todayStr = new Date().toISOString().substring(0, 10);
    const eventId = `summary_daily_${todayStr}`;

    const incomeToday = txsToday
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount_minor ?? t.amount ?? 0), 0);

    const expenseToday = txsToday
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount_minor ?? t.amount ?? 0), 0);

    const formattedIncome = `₹${(incomeToday / 100).toLocaleString('en-IN')}`;
    const formattedExpense = `₹${(expenseToday / 100).toLocaleString('en-IN')}`;

    let body = `Today: ${formattedExpense} spent · ${formattedIncome} received (${txsToday.length} transactions)`;
    if (dailyBudgetRemainingMinor !== undefined && dailyBudgetRemainingMinor > 0) {
      body += ` · ₹${(dailyBudgetRemainingMinor / 100).toLocaleString('en-IN')} daily budget remaining.`;
    }

    await notificationEngine.notify({
      eventId,
      category: 'summary',
      title: "Today's Financial Summary 📊",
      body,
      priority: 'low',
      data: { type: 'summary', date: todayStr },
    });
  },

  /**
   * Schedules recurring offline Local System Notifications for Daily, Weekly, and Monthly digests.
   */
  async scheduleOfflineSummaryAlarms(): Promise<void> {
    const now = new Date();

    // Schedule Daily Digest at 21:00 (9:00 PM local time)
    const dailyTarget = new Date(now);
    dailyTarget.setHours(21, 0, 0, 0);
    if (dailyTarget <= now) {
      dailyTarget.setDate(dailyTarget.getDate() + 1);
    }
    const todayStr = dailyTarget.toISOString().substring(0, 10);

    await notificationService.scheduleDueDateReminder(
      `summary_daily_alarm_${todayStr}`,
      "Today's Financial Summary 📊",
      "Tap to view today's income, expenses, and category breakdown.",
      dailyTarget,
      'transaction'
    );
  },
};
