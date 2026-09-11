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
  const cleanBank = (tx.bankId || 'any').toLowerCase().trim();
  const cleanAcc = (tx.maskedAccount || 'any').replace(/\D/g, '').slice(-4);
  return `fp_${cleanBank}_${cleanAcc}_${tx.amountMinor}_${tx.type}_${dateStr}`;
}

/**
 * Prevents duplicate transactions by checking reference IDs, UPI UTRs, or fallback transaction fingerprints.
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
  const newType = newTx.type || 'expense';
  const newBankId = (newTx.bankId || '').toLowerCase().trim();
  const newBankName = (newTx.bankName || '').toLowerCase().trim();
  const newMasked = (newTx.maskedAccount || '').replace(/\D/g, '').slice(-4);

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

    // 2. Exact amount + type + date check
    const txAmount = tx.amountMinor ?? tx.amount_minor ?? (typeof tx.amount === 'number' ? Math.round(tx.amount * 100) : 0);
    const txDateStr = (tx.transactionDate || tx.date || '').split('T')[0];
    const txType = tx.type || 'expense';

    if (txAmount === newAmount && txType === newType && txDateStr === newDateStr) {
      const txAccountName = (tx.account?.name || tx.account_name || '').toLowerCase();
      const txBankId = (tx.bankId || tx.bank_id || '').toLowerCase();

      // Check if both reference the same bank or account if known
      const bankOrAccountMatches =
        !newBankId ||
        newBankId === 'unknown' ||
        !txAccountName ||
        (newBankId && txAccountName.includes(newBankId)) ||
        (newBankName && txAccountName.includes(newBankName)) ||
        (txBankId && (txBankId === newBankId || txBankId.includes(newBankId) || newBankId.includes(txBankId)));

      // If masked account is present in both, ensure it matches
      const txMasked = (tx.account?.account_number || tx.maskedAccount || '').replace(/\D/g, '').slice(-4);
      const maskedMatches = !newMasked || !txMasked || newMasked === txMasked;

      if (bankOrAccountMatches && maskedMatches) {
        return true;
      }

      // If both are exact same amount on same date and type, and description has overlap or auto-detected tag
      if (txNotes && (txNotes.includes('AUTO DETECTED') || (newBankName && txNotes.includes(newBankName.toUpperCase())))) {
        return true;
      }

      // If both have identical amount, type, date and at least one is without bank detail
      if (!txBankId && !txAccountName) {
        return true;
      }
    }
  }

  return false;
}

