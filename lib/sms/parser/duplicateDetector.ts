import { ParsedSmsTransaction } from '../types';

export function createTransactionFingerprint(tx: {
  amountMinor: number;
  type: string;
  bankId?: string;
  maskedAccount?: string;
  transactionDate: string;
  referenceNumber?: string;
  upiReference?: string;
}): string {
  if (tx.referenceNumber) return `ref_${tx.referenceNumber.toUpperCase().trim()}`;
  if (tx.upiReference) return `upi_${tx.upiReference.toUpperCase().trim()}`;

  const dateStr = tx.transactionDate ? tx.transactionDate.split('T')[0] : 'nodate';
  const cleanBank = (tx.bankId || 'unknown').toLowerCase().trim();
  const cleanAcc = (tx.maskedAccount || 'any').replace(/\D/g, '').slice(-4);
  return `fp_${cleanBank}_${cleanAcc}_${tx.amountMinor}_${tx.type}_${dateStr}`;
}

/**
 * Prevents duplicate transactions by checking reference IDs or creating fallback fingerprints.
 */
export function isDuplicateTransaction(
  newTx: ParsedSmsTransaction,
  existingTransactions: any[]
): boolean {
  if (!existingTransactions || existingTransactions.length === 0) {
    return false;
  }

  const newRef = newTx.referenceNumber?.toUpperCase().trim();
  const newUpiRef = newTx.upiReference?.toUpperCase().trim();
  const newDateStr = newTx.transactionDate ? newTx.transactionDate.split('T')[0] : '';
  const newAmount = newTx.amountMinor;

  for (const tx of existingTransactions) {
    const txRef = (tx.referenceNumber || tx.reference_number || '')?.toUpperCase().trim();
    const txUpi = (tx.upiReference || tx.upi_reference || '')?.toUpperCase().trim();
    const txNotes = (tx.notes || tx.description || '')?.toUpperCase();

    // 1. Explicit Reference / UTR check
    if (newRef) {
      if (txRef === newRef || (txNotes && txNotes.includes(newRef))) {
        return true;
      }
    }

    if (newUpiRef) {
      if (txUpi === newUpiRef || (txNotes && txNotes.includes(newUpiRef))) {
        return true;
      }
    }

    // 2. Fallback Fingerprint Check (Same date, amount, type, and bank/account)
    const txAmount = tx.amountMinor ?? tx.amount_minor ?? tx.amount ?? 0;
    const txDateStr = (tx.transactionDate || tx.date || '').split('T')[0];
    const txType = tx.type || 'expense';

    if (txAmount === newAmount && txType === newTx.type && txDateStr === newDateStr) {
      const txBankId = (tx.bankId || tx.bank_id || tx.account_id || '').toLowerCase();
      const newBankId = (newTx.bankId || '').toLowerCase();

      // If bank matches or is generic
      const bankMatches = !newBankId || !txBankId || txBankId === newBankId || txBankId.includes(newBankId) || newBankId.includes(txBankId);
      if (bankMatches) {
        return true;
      }
    }
  }

  return false;
}
