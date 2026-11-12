import { TransactionType } from '../types';

interface ClassificationResult {
  type: TransactionType;
  isSalary: boolean;
  isRefund: boolean;
  isTransfer: boolean;
  referenceNumber?: string;
  upiReference?: string;
}

/**
 * Classifies SMS as Expense, Income, Salary, Refund, or Transfer, and extracts reference IDs.
 */
export function classifyTransaction(body: string): ClassificationResult {
  const normBody = (body || '').toLowerCase();

  // Reference / UPI Transaction ID extraction
  let referenceNumber: string | undefined;
  let upiReference: string | undefined;

  const refMatch = /(?:ref|rrn|txn|transaction|utr)(?:\s*no\.?)?\s*:?\s*([a-zA-Z0-9]{8,18})/i.exec(body);
  if (refMatch && refMatch[1]) {
    referenceNumber = refMatch[1];
  }

  const upiMatch = /upi\s*(?:ref|rrn)?\s*(?:no\.?|id)?\s*:?\s*(\d{10,14})/i.exec(body);
  if (upiMatch && upiMatch[1]) {
    upiReference = upiMatch[1];
  }

  // 1. Salary Detection
  const salaryKeywords = ['salary', 'payroll', 'monthly salary', 'sal credited'];
  const isSalary = salaryKeywords.some((kw) => normBody.includes(kw));

  // 2. Refund & Reversal Detection
  const refundKeywords = ['refund', 'refunded', 'cashback credited', 'cashback received', 'reversal', 'reversed'];
  const isRefund = refundKeywords.some((kw) => normBody.includes(kw));

  // 3. Own Account & General Transfer Detection (keep "trf to" as normal debit/expense for UPI transfers)
  const transferKeywords = [
    'transferred from', 'transferred to', 'transfer to', 'transfer from',
    'self transfer', 'own account', 'transfer to a/c', 'fund transfer',
    'neft transfer', 'imps transfer', 'rtgs transfer', 'transfer of'
  ];
  const isTransfer = transferKeywords.some((kw) => normBody.includes(kw));

  // 4. Debit vs Credit Keywords & Shorthand Patterns
  // Check explicit sender-account debit verbs BEFORE "credited to" / "Cr. to" / "Credit Card"
  // so bank debit alerts like "A/C X1234 debited ... credited to ..." or "Rs.1 Dr. from ... Cr. to ..."
  // classify as 'expense' rather than 'income'.
  const hasDebitVerb =
    /\b(?:debited|withdrawn|spent|paid)\b/i.test(body) ||
    /\bdr\.?\s+(?:from|by)\b/i.test(body) ||
    /\bsent\s+(?:rs\.?|inr|₹)/i.test(body);
  const creditKeywords = ['credited', 'received', 'deposited', 'added'];

  let type: TransactionType = 'expense';

  if (isTransfer) {
    type = 'transfer';
  } else if (isRefund) {
    type = 'refund';
  } else if (isSalary) {
    type = 'income';
  } else if (hasDebitVerb) {
    type = 'expense';
  } else if (/\bcr\.?\b/i.test(body) && !/\bdr\.?\s+from\b/i.test(body)) {
    type = 'income';
  } else if (creditKeywords.some((kw) => normBody.includes(kw))) {
    type = 'income';
  } else {
    type = 'expense';
  }

  return {
    type,
    isSalary,
    isRefund,
    isTransfer,
    referenceNumber,
    upiReference,
  };
}
