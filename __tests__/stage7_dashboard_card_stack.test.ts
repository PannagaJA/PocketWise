import {
  computeActiveBalance,
  computeMonthlyCashflow,
  filterRecentTransactions,
  DashboardAccount,
  DashboardTransaction,
} from '../lib/dashboard/dashboard.calculations';

describe('Stage 7 — Dashboard Calculations & Card Stack Logic Tests', () => {
  const mockAccounts: DashboardAccount[] = [
    { id: 'acc_1', name: 'HDFC Salary', balance: 5000000 }, // ₹50,000.00
    { id: 'acc_2', name: 'ICICI Savings', balance: 2500000 }, // ₹25,000.00
  ];

  const mockTransactions: DashboardTransaction[] = [
    { id: 'tx_1', account_id: 'acc_1', type: 'income', amount_minor: 8500000, date: '2026-10-01' },
    { id: 'tx_2', account_id: 'acc_1', type: 'expense', amount_minor: 1200000, date: '2026-10-05' },
    { id: 'tx_3', account_id: 'acc_2', type: 'expense', amount_minor: 800000, date: '2026-10-10' },
    { id: 'tx_4', account_id: 'acc_1', type: 'transfer', amount_minor: 500000, date: '2026-10-12' },
    { id: 'tx_5', account_id: 'acc_2', type: 'expense', amount_minor: 250000, date: '2026-09-28' }, // Different month
  ];

  test('computeActiveBalance aggregates all accounts when selectedBankId is "all"', () => {
    const total = computeActiveBalance(mockAccounts, 'all');
    expect(total).toBe(7500000); // ₹75,000.00
  });

  test('computeActiveBalance filters to selected account correctly', () => {
    const acc1Balance = computeActiveBalance(mockAccounts, 'acc_1');
    expect(acc1Balance).toBe(5000000);

    const acc2Balance = computeActiveBalance(mockAccounts, 'acc_2');
    expect(acc2Balance).toBe(2500000);

    const nonExistent = computeActiveBalance(mockAccounts, 'non_existent');
    expect(nonExistent).toBe(0);
  });

  test('computeMonthlyCashflow calculates monthly income, expense, and net cashflow accurately', () => {
    const result = computeMonthlyCashflow(mockTransactions, '2026-10');
    expect(result.monthlyIncome).toBe(8500000);
    expect(result.monthlyExpense).toBe(2000000); // 1200000 + 800000
    expect(result.netCashflow).toBe(6500000);
  });

  test('filterRecentTransactions slices up to 5 transactions for "all" and account filter', () => {
    const allRecent = filterRecentTransactions(mockTransactions, 'all', 3);
    expect(allRecent.length).toBe(3);
    expect(allRecent[0].id).toBe('tx_1');

    const acc2Recent = filterRecentTransactions(mockTransactions, 'acc_2', 5);
    expect(acc2Recent.length).toBe(2);
    expect(acc2Recent.map((t) => t.id)).toEqual(['tx_3', 'tx_5']);
  });

  test('getAtmCardTheme accurately resolves bank identities, networks, and colors', () => {
    const { getAtmCardTheme } = require('../lib/dashboard/atmCardThemes');

    const hdfcTheme = getAtmCardTheme('HDFC Bank Salary');
    expect(hdfcTheme.bankId).toBe('hdfc');
    expect(hdfcTheme.bankName).toBe('HDFC BANK');
    expect(hdfcTheme.cardNetwork).toBe('visa');

    const sbiTheme = getAtmCardTheme('SBI Savings');
    expect(sbiTheme.bankId).toBe('sbi');
    expect(sbiTheme.cardNetwork).toBe('rupay');

    const iciciTheme = getAtmCardTheme('ICICI Current Account');
    expect(iciciTheme.bankId).toBe('icici');
    expect(iciciTheme.cardNetwork).toBe('visa');

    const axisTheme = getAtmCardTheme('Axis Priority');
    expect(axisTheme.bankId).toBe('axis');
    expect(axisTheme.cardNetwork).toBe('mastercard');

    const cashTheme = getAtmCardTheme('Cash in Wallet', 'cash');
    expect(cashTheme.bankId).toBe('cash');
    expect(cashTheme.cardNetwork).toBe('pocketwise');

    const combinedTheme = getAtmCardTheme('All Accounts Combined');
    expect(combinedTheme.bankId).toBe('all');
  });

  test('getDeterministicCardLast4 derives consistent 4 digits from account identifier', () => {
    const { getDeterministicCardLast4 } = require('../lib/dashboard/atmCardThemes');

    const explicit = getDeterministicCardLast4('HDFC Card 4829');
    expect(explicit).toBe('4829');

    const hashed1 = getDeterministicCardLast4('acc_hdfc_primary_id');
    const hashed2 = getDeterministicCardLast4('acc_hdfc_primary_id');
    expect(hashed1).toBe(hashed2);
    expect(hashed1.length).toBe(4);
    expect(/^\d{4}$/.test(hashed1)).toBe(true);
  });
});
