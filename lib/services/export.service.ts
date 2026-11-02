import { Share, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
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

function escapeHtml(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface StatementPdfParams {
  periodName: string;
  startDate: string;
  endDate: string;
  summary: FinancialSummary;
  categories: CategorySpending[];
  transactions?: Transaction[];
  currency?: string;
  userName?: string;
  userEmail?: string;
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
   * Generates an executive, beautifully styled HTML document formatted for PDF export.
   */
  generateFinancialStatementHtml(params: StatementPdfParams): string {
    const {
      periodName,
      startDate,
      endDate,
      summary,
      categories,
      transactions = [],
      currency = 'INR',
      userName,
      userEmail,
    } = params;

    const incomeFormatted = formatMoney(summary.totalIncome, currency);
    const expenseFormatted = formatMoney(summary.totalExpense, currency);
    const savingsFormatted = formatMoney(summary.savings, currency);
    const savingsRate = summary.savingsRate ?? 0;
    const isSurplus = summary.savings >= 0;

    const nowFormatted = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    // Generate Category Rows
    const categoryRowsHtml = categories.length === 0
      ? `<div class="empty-state">No categorized expenses recorded in this period.</div>`
      : categories
          .map((cat, idx) => {
            const catColor = cat.categoryColor || '#6366F1';
            const catAmount = formatMoney(cat.amountMinor, currency);
            const pct = Math.min(Math.max(cat.percentage, 0), 100);

            return `
              <div class="cat-row">
                <div class="cat-header">
                  <div class="cat-name-wrap">
                    <span class="cat-dot" style="background-color: ${catColor};"></span>
                    <span class="cat-name">${escapeHtml(cat.categoryName)}</span>
                    <span class="cat-pct">${pct}%</span>
                  </div>
                  <span class="cat-amount">${catAmount}</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" style="width: ${pct}%; background-color: ${catColor};"></div>
                </div>
              </div>
            `;
          })
          .join('');

    // Generate Transactions Table Rows (Itemized list)
    let transactionsTableHtml = '';
    if (transactions.length > 0) {
      const txRows = transactions.map((tx, idx) => {
        const isIncome = tx.type === 'income';
        const isExpense = tx.type === 'expense';
        const amountFormatted = formatMoney(tx.amount_minor, tx.currency || currency);
        const prefix = isIncome ? '+' : isExpense ? '-' : '';
        const amountClass = isIncome ? 'amount-income' : isExpense ? 'amount-expense' : 'amount-transfer';
        const typePillClass = isIncome ? 'type-income' : isExpense ? 'type-expense' : 'type-transfer';
        const catName = tx.category?.name || 'General';
        const accName = tx.account?.name || 'Default Account';

        return `
          <tr>
            <td style="color: #64748b; font-weight: 600;">${idx + 1}</td>
            <td style="font-weight: 600; white-space: nowrap;">${escapeHtml(tx.date)}</td>
            <td style="max-width: 180px; font-weight: 500;">${escapeHtml(tx.description || 'Transaction')}</td>
            <td><span class="pill">${escapeHtml(catName)}</span></td>
            <td style="color: #64748b; white-space: nowrap;">${escapeHtml(accName)}</td>
            <td><span class="type-pill ${typePillClass}">${tx.type.toUpperCase()}</span></td>
            <td style="text-align: right; white-space: nowrap;" class="${amountClass}">${prefix}${amountFormatted}</td>
          </tr>
        `;
      }).join('');

      transactionsTableHtml = `
        <div class="tx-section">
          <div class="section-title">
            <span>Itemized Transactions</span>
            <span class="section-badge">${transactions.length} record${transactions.length === 1 ? '' : 's'}</span>
          </div>
          <table class="tx-table">
            <thead>
              <tr>
                <th style="width: 28px;">#</th>
                <th style="width: 80px;">Date</th>
                <th>Description</th>
                <th style="width: 110px;">Category</th>
                <th style="width: 110px;">Account</th>
                <th style="width: 75px;">Type</th>
                <th style="text-align: right; width: 100px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${txRows}
            </tbody>
          </table>
        </div>
      `;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PocketWise Statement - ${escapeHtml(startDate)} to ${escapeHtml(endDate)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 12mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    @media print {
      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
      }
      .no-print {
        display: none !important;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background-color: #ffffff;
      margin: 0;
      padding: 16px 20px;
      font-size: 12px;
      line-height: 1.5;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 16px;
      border-bottom: 2px solid #e2e8f0;
      margin-bottom: 20px;
    }
    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo-container {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      overflow: hidden;
      filter: drop-shadow(0 3px 6px rgba(11, 27, 51, 0.18));
      flex-shrink: 0;
    }
    .brand-name {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      margin: 0;
      line-height: 1.1;
    }
    .brand-tagline {
      font-size: 11px;
      color: #64748b;
      margin: 3px 0 0 0;
      font-weight: 500;
    }
    .statement-meta {
      text-align: right;
    }
    .meta-title {
      font-size: 14px;
      font-weight: 800;
      color: #4f46e5;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin: 0 0 4px 0;
    }
    .period-badge {
      display: inline-block;
      padding: 3px 10px;
      background: #eef2ff;
      color: #4338ca;
      font-size: 11px;
      font-weight: 700;
      border-radius: 9999px;
      margin-bottom: 3px;
      letter-spacing: 0.3px;
    }
    .meta-date {
      font-size: 11px;
      color: #64748b;
      margin: 2px 0 0 0;
    }

    /* User details strip */
    .account-strip {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 14px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .account-info {
      font-size: 11px;
      color: #475569;
    }
    .account-info strong {
      color: #0f172a;
    }
    .account-badge {
      font-size: 10px;
      font-weight: 700;
      color: #059669;
      background: #d1fae5;
      padding: 3px 8px;
      border-radius: 6px;
      letter-spacing: 0.3px;
    }

    /* KPI Cards */
    .kpi-grid {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
    }
    .kpi-card {
      flex: 1;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }
    .kpi-card.income {
      border-color: #bbf7d0;
      background: #f0fdf4;
    }
    .kpi-card.expense {
      border-color: #fecdd3;
      background: #fff1f2;
    }
    .kpi-card.savings {
      border-color: #c7d2fe;
      background: #eef2ff;
    }
    .kpi-card.rate {
      border-color: #ddd6fe;
      background: #faf5ff;
    }
    .kpi-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .kpi-card.income .kpi-label { color: #166534; }
    .kpi-card.expense .kpi-label { color: #9f1239; }
    .kpi-card.savings .kpi-label { color: #3730a3; }
    .kpi-card.rate .kpi-label { color: #5b21b6; }
    .kpi-value {
      font-size: 17px;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 2px;
      white-space: nowrap;
    }
    .kpi-card.income .kpi-value { color: #15803d; }
    .kpi-card.expense .kpi-value { color: #e11d48; }
    .kpi-card.savings .kpi-value { color: #4338ca; }
    .kpi-card.rate .kpi-value { color: #7c3aed; }
    .kpi-subtext {
      font-size: 10px;
      color: #64748b;
      font-weight: 500;
    }

    /* Section Headings */
    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 10px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .section-badge {
      font-size: 10px;
      font-weight: 600;
      color: #64748b;
      text-transform: none;
    }

    /* Categories Table */
    .category-section {
      margin-bottom: 24px;
      break-inside: avoid;
    }
    .category-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 14px;
      background: #ffffff;
    }
    .cat-row {
      margin-bottom: 10px;
    }
    .cat-row:last-child {
      margin-bottom: 0;
    }
    .cat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      margin-bottom: 4px;
    }
    .cat-name-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .cat-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .cat-name {
      font-weight: 700;
      color: #1e293b;
    }
    .cat-pct {
      font-size: 10px;
      font-weight: 600;
      color: #64748b;
      margin-left: 4px;
    }
    .cat-amount {
      font-weight: 800;
      color: #0f172a;
    }
    .progress-track {
      height: 6px;
      background: #f1f5f9;
      border-radius: 9999px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      border-radius: 9999px;
    }

    /* Transactions Table */
    .tx-section {
      margin-bottom: 24px;
      break-inside: auto;
    }
    table.tx-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    table.tx-table th {
      background: #f8fafc;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 9.5px;
      letter-spacing: 0.5px;
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    table.tx-table td {
      padding: 7px 10px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
    }
    table.tx-table tr:nth-child(even) td {
      background-color: #fafbfc;
    }
    .pill {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 6px;
      background: #f1f5f9;
      color: #334155;
      font-size: 9.5px;
      font-weight: 600;
    }
    .type-pill {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 6px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .type-income {
      background: #dcfce7;
      color: #15803d;
    }
    .type-expense {
      background: #ffe4e6;
      color: #be123c;
    }
    .type-transfer {
      background: #f1f5f9;
      color: #475569;
    }
    .amount-income {
      color: #16a34a;
      font-weight: 700;
    }
    .amount-expense {
      color: #e11d48;
      font-weight: 700;
    }
    .amount-transfer {
      color: #475569;
      font-weight: 700;
    }
    .empty-state {
      padding: 16px;
      text-align: center;
      color: #64748b;
      font-size: 11px;
      background: #f8fafc;
      border-radius: 8px;
    }

    /* Footer */
    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9.5px;
      color: #94a3b8;
      break-inside: avoid;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="brand-wrap">
      <div class="brand-logo-container">
        <svg width="44" height="44" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="squircleBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#132B4F" />
              <stop offset="45%" stop-color="#0B1B33" />
              <stop offset="100%" stop-color="#071120" />
            </linearGradient>
            <linearGradient id="squircleStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#254B82" stop-opacity="0.8" />
              <stop offset="100%" stop-color="#0E2342" stop-opacity="0.3" />
            </linearGradient>
            <linearGradient id="monogramWhiteGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#FFFFFF" />
              <stop offset="75%" stop-color="#F8FAFC" />
              <stop offset="100%" stop-color="#E2E8F0" />
            </linearGradient>
            <linearGradient id="chartGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#06B6D4" />
              <stop offset="55%" stop-color="#10B981" />
              <stop offset="100%" stop-color="#34D399" />
            </linearGradient>
            <linearGradient id="arrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#10B981" />
              <stop offset="100%" stop-color="#34D399" />
            </linearGradient>
          </defs>
          <rect x="10" y="10" width="140" height="140" rx="36" fill="url(#squircleBg)" />
          <rect x="10.5" y="10.5" width="139" height="139" rx="35.5" stroke="url(#squircleStroke)" stroke-width="1.5" />
          <path d="M 44 54 C 44 41 53 34 68 34 L 98 34 C 114 34 124 44 124 58 C 124 72 114 82 98 82 L 68 82 L 68 116 C 68 118 64 120 60 119 L 46 114 C 44 113 44 111 44 109 Z M 68 50 L 68 66 L 94 66 C 101 66 106 63 106 58 C 106 53 101 50 94 50 Z" fill="url(#monogramWhiteGrad)" />
          <path d="M 38 130 L 58 108 L 74 120 L 100 92 L 114 102 L 126 84" stroke="url(#chartGrad)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M 112 80 L 132 76 L 128 96 Z" fill="url(#arrowGrad)" stroke="url(#arrowGrad)" stroke-width="2" stroke-linejoin="round" />
        </svg>
      </div>
      <div>
        <h1 class="brand-name">PocketWise</h1>
        <p class="brand-tagline">Personal Wealth &amp; Expense Statement</p>
      </div>
    </div>
    <div class="statement-meta">
      <div class="meta-title">Financial Statement</div>
      <div class="period-badge">${escapeHtml(periodName.toUpperCase())}</div>
      <div class="meta-date">${escapeHtml(startDate)} &mdash; ${escapeHtml(endDate)}</div>
      <div class="meta-date">Generated on ${escapeHtml(nowFormatted)}</div>
    </div>
  </div>

  <!-- Account / User strip -->
  <div class="account-strip">
    <div class="account-info">
      Statement for: <strong>${escapeHtml(userName || userEmail || 'Account Holder')}</strong>
      ${userEmail && userName ? ` &bull; <span>${escapeHtml(userEmail)}</span>` : ''}
    </div>
    <div class="account-badge">&bull; Verified Offline Storage</div>
  </div>

  <!-- KPI Overview Cards -->
  <div class="kpi-grid">
    <div class="kpi-card income">
      <div class="kpi-label">Total Income</div>
      <div class="kpi-value">+${incomeFormatted}</div>
      <div class="kpi-subtext">Cash inflows</div>
    </div>
    <div class="kpi-card expense">
      <div class="kpi-label">Total Expense</div>
      <div class="kpi-value">-${expenseFormatted}</div>
      <div class="kpi-subtext">Total spending</div>
    </div>
    <div class="kpi-card savings">
      <div class="kpi-label">Net Savings</div>
      <div class="kpi-value">${savingsFormatted}</div>
      <div class="kpi-subtext">${isSurplus ? 'Net Surplus' : 'Net Deficit'}</div>
    </div>
    <div class="kpi-card rate">
      <div class="kpi-label">Savings Rate</div>
      <div class="kpi-value">${savingsRate}%</div>
      <div class="kpi-subtext">Retained wealth</div>
    </div>
  </div>

  <!-- Category Spending Breakdown -->
  <div class="category-section">
    <div class="section-title">
      <span>Spending By Category</span>
      <span class="section-badge">${categories.length} Categor${categories.length === 1 ? 'y' : 'ies'}</span>
    </div>
    <div class="category-card">
      ${categoryRowsHtml}
    </div>
  </div>

  <!-- Itemized Transactions Ledger -->
  ${transactionsTableHtml}

  <!-- Footer -->
  <div class="footer">
    <div>PocketWise Financial Management &bull; End-to-end On-Device Privacy</div>
    <div>Page 1 &bull; Strictly Confidential</div>
  </div>
</body>
</html>`;
  },

  /**
   * Generates a beautifully formatted PDF statement and triggers native share / save.
   */
  async exportPDFStatement(params: StatementPdfParams): Promise<boolean> {
    const html = this.generateFinancialStatementHtml(params);

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      return new Promise<boolean>((resolve) => {
        try {
          // Create isolated hidden iframe so printing captures ONLY the statement,
          // avoiding printing the app screen, UI shell, or active modal.
          const iframe = document.createElement('iframe');
          iframe.style.position = 'fixed';
          iframe.style.right = '0';
          iframe.style.bottom = '0';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = '0';
          iframe.style.opacity = '0';
          iframe.style.pointerEvents = 'none';
          document.body.appendChild(iframe);

          const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
          if (!frameDoc || !iframe.contentWindow) {
            if (document.body.contains(iframe)) document.body.removeChild(iframe);
            resolve(false);
            return;
          }

          frameDoc.open();
          frameDoc.write(html);
          frameDoc.close();

          const triggerPrint = () => {
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
              resolve(true);
            } catch (printErr) {
              console.warn('[ExportService] Web print error:', printErr);
              resolve(false);
            } finally {
              setTimeout(() => {
                if (document.body.contains(iframe)) {
                  document.body.removeChild(iframe);
                }
              }, 2500);
            }
          };

          if (iframe.contentWindow.document.readyState === 'complete') {
            setTimeout(triggerPrint, 300);
          } else {
            iframe.onload = () => setTimeout(triggerPrint, 300);
            setTimeout(triggerPrint, 600); // Fallback
          }
        } catch (err) {
          console.warn('[ExportService] Web print error:', err);
          resolve(false);
        }
      });
    }

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (!uri) throw new Error('PDF generation produced empty uri');

      let canShare = false;
      try {
        canShare = await Sharing.isAvailableAsync();
      } catch {
        canShare = false;
      }

      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'PocketWise Financial Statement (PDF)',
          UTI: 'com.adobe.pdf',
        });
        return true;
      } else {
        const result = await Share.share(
          Platform.OS === 'ios'
            ? { url: uri }
            : { title: 'PocketWise Financial Statement', message: uri }
        );
        return result.action === Share.sharedAction;
      }
    } catch (error: any) {
      if (
        error?.name === 'AbortError' ||
        error?.message?.includes('canceled') ||
        error?.message?.includes('cancelled') ||
        error?.message?.includes('dismissed')
      ) {
        return false;
      }
      console.warn('[ExportService] PDF export error:', error?.message || error);
      throw error;
    }
  },

  /**
   * Exports transactions CSV as a physical file attachment on mobile and download on web.
   */
  async exportTransactionsCSV(
    transactions: Transaction[],
    filename: string = 'PocketWise_Transactions.csv'
  ): Promise<boolean> {
    const csvContent = this.generateTransactionsCSV(transactions);

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    }

    try {
      if (FileSystem && FileSystem.cacheDirectory) {
        const fileUri = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: (FileSystem as any).EncodingType?.UTF8 || 'utf8',
        });

        let canShare = false;
        try {
          canShare = await Sharing.isAvailableAsync();
        } catch {
          canShare = false;
        }

        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'PocketWise Transactions Statement (CSV)',
            UTI: 'public.comma-separated-values-text',
          });
          return true;
        }
      }
    } catch (fileErr) {
      console.warn('[ExportService] FileSystem write error, falling back to Share:', fileErr);
    }

    return this.shareContent(csvContent, 'PocketWise Transactions Statement');
  },

  /**
   * Universal share and download function for mobile and web.
   */
  async shareContent(content: string, title: string = 'PocketWise Statement'): Promise<boolean> {
    try {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        try {
          if (typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
            await navigator.share({ title, text: content });
            return true;
          }
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError' || shareErr?.message?.includes('canceled') || shareErr?.message?.includes('cancelled')) {
            return false;
          }
        }

        // Web download fallback: create a download link for seamless CSV/text file save
        const isCsv = content.includes('"Date","Description"') || title.toLowerCase().includes('statement') || title.toLowerCase().includes('csv');
        const defaultFilename = isCsv ? 'PocketWise_Transactions.csv' : 'PocketWise_Financial_Summary.txt';
        const mimeType = isCsv ? 'text/csv;charset=utf-8;' : 'text/plain;charset=utf-8;';
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', defaultFilename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return true;
      }

      const result = await Share.share(
        Platform.OS === 'ios'
          ? { message: content }
          : { message: content, title }
      );
      return result.action === Share.sharedAction;
    } catch (error: any) {
      if (
        error?.name === 'AbortError' ||
        error?.message?.includes('canceled') ||
        error?.message?.includes('cancelled') ||
        error?.message?.includes('dismissed')
      ) {
        return false;
      }
      console.warn('[ExportService] Share error:', error?.message || error);
      return false;
    }
  },
};
