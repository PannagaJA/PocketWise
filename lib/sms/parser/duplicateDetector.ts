import { ParsedSmsTransaction } from '../types';

/**
 * Prevents duplicate transactions by checking reference IDs or creating fallback fingerprints.
 */
export function isDuplicateTransaction(
  newTx: ParsedSmsTransaction,
  existingTransactions: ParsedSmsTransaction[]
): boolean {
  if (!existingTransactions || existingTransactions.length === 0) {
    return false;
  }

  // 1. Strongest Check: Explicit Reference / UTR / UPI Reference Match
  if (newTx.referenceNumber) {
    const match = existingTransactions.find(
      (tx) => tx.referenceNumber && tx.referenceNumber === newTx.referenceNumber
    );
    if (match) return true;
  }

  if (newTx.upiReference) {
    const match = existingTransactions.find(
      (tx) => tx.upiReference && tx.upiReference === newTx.upiReference
    );
    if (match) return true;
  }

  // 2. Fallback Fingerprint Check: Same bank, account, amount, type, and close timestamp/date
  const newDateStr = newTx.transactionDate.split('T')[0]; // YYYY-MM-DD

  return existingTransactions.some((tx) => {
    const existingDateStr = tx.transactionDate.split('T')[0];
    const sameDate = existingDateStr === newDateStr;
    const sameAmount = tx.amountMinor === newTx.amountMinor;
    const sameType = tx.type === newTx.type;
    const sameBank = tx.bankId === newTx.bankId;
    const sameAccount = !newTx.maskedAccount || !tx.maskedAccount || tx.maskedAccount === newTx.maskedAccount;

    return sameDate && sameAmount && sameType && sameBank && sameAccount;
  });
}
