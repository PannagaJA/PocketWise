import { Share, Platform } from 'react-native';
import { Transaction } from './transaction.service';
import { FinancialSummary, CategorySpending } from './report.service';
import { formatMoney } from '../finance/core';

function escapeCSVField(value: string | number | undefined | null, isText: boolean = false): string {
  if (value === undefined || value === null) return '""';
  let str = String(value);
  if (isText && /^[\=\+\-\@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export const exportService = {
  /**
   * Generates standard RFC 4180 CSV string from transaction records.
   */
  generateTransactionsCSV(transactions: Transaction[]): string {
    const headers = [
      'Date',
      'Description',
      'Category',
      'Type',
      'Amount',
      'Currency',
      'Account',
      'Notes',
    ];

    const headerRow = headers.map((h) => escapeCSVField(h, true)).join(',');

    const dataRows = transactions.map((tx) => {
      const amountMajor = (Number(tx.amount_minor || 0) / 100).toFixed(2);
      const categoryName = tx.category?.name || 'General';
      const accountName = tx.account?.name || 'Default Account';

      return [
        escapeCSVField(tx.date, true),
        escapeCSVField(tx.description, true),
        escapeCSVField(categoryName, true),
        escapeCSVField(tx.type.toUpperCase(), true),
        escapeCSVField(amountMajor, false),
        escapeCSVField(tx.currency || 'INR', true),
        escapeCSVField(accountName, true),
        escapeCSVField(tx.notes || '', true),
      ].join(',');
    });

    return [headerRow, ...dataRows].join('\n');
  },

  /**
   * Generates a formatted text statement of financial metrics and category breakdowns.
   */
  generateFinancialSummaryText(params: {
    periodName: string;
    startDate: string;
    endDate: string;
    summary: FinancialSummary;
    categories: CategorySpending[];
    currency?: string;
  }): string {
    const { periodName, startDate, endDate, summary, categories, currency = 'INR' } = params;

    const incomeStr = formatMoney(summary.totalIncome, currency);
    const expenseStr = formatMoney(summary.totalExpense, currency);
    const savingsStr = formatMoney(summary.savings, currency);

    let report = `====================================\n`;
    report += `       POCKETWISE FINANCIAL REPORT\n`;
    report += `====================================\n`;
    report += `Period:     ${periodName.toUpperCase()} (${startDate} to ${endDate})\n`;
    report += `Generated:  ${new Date().toLocaleDateString()}\n`;
    report += `------------------------------------\n`;
    report += `Total Income:   ${incomeStr}\n`;
    report += `Total Expense:  ${expenseStr}\n`;
    report += `Net Savings:    ${savingsStr}\n`;
    report += `Savings Rate:   ${summary.savingsRate}%\n`;
    report += `------------------------------------\n`;
    report += `SPENDING BY CATEGORY:\n`;

    if (categories.length === 0) {
      report += `  (No expenses recorded in this period)\n`;
    } else {
      categories.forEach((cat, idx) => {
        const catAmountStr = formatMoney(cat.amountMinor, currency);
        report += `  ${idx + 1}. ${cat.categoryName.padEnd(16)}: ${catAmountStr} (${cat.percentage}%)\n`;
      });
    }

    report += `====================================\n`;
    return report;
  },

  /**
   * Universal share function using React Native Share.
   */
  async shareContent(content: string, title: string = 'PocketWise Statement'): Promise<boolean> {
    try {
      const result = await Share.share(
        Platform.OS === 'ios'
          ? { message: content }
          : { message: content, title }
      );
      return result.action === Share.sharedAction;
    } catch (error) {
      console.error('[ExportService] Share error:', error);
      return false;
    }
  },
};
