import { ParsedSmsTransaction } from '../types';
import { INDIAN_BANKS } from '../banks/bankRegistry';

export function createTransactionFingerprint(tx: {
  amountMinor: number;
  type: string;
  bankId?: string;
  maskedAccount?: string;
  transactionDate: string;
  referenceNumber?: string;
  upiReference?: string;
  merchant?: string;
  sourceMessageId?: string;
}): string {
  if (tx.referenceNumber && tx.referenceNumber.trim().length >= 6) {
    return `ref_${tx.referenceNumber.toUpperCase().trim()}`;
  }
  if (tx.upiReference && tx.upiReference.trim().length >= 6) {
    return `upi_${tx.upiReference.toUpperCase().trim()}`;
  }

  // Include merchant and unique message ID / time so multiple legitimate payments of same amount are NOT treated as identical
  const cleanBank = (tx.bankId || 'any').toLowerCase().trim();
  const cleanAcc = (tx.maskedAccount || 'any').replace(/\D/g, '').slice(-4);
  const cleanMerchant = (tx.merchant || 'any').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
  const dateOrTimeStr = tx.transactionDate || 'nodate';
  const msgId = tx.sourceMessageId && !tx.sourceMessageId.startsWith('sms_') && !tx.sourceMessageId.startsWith('tx_')
    ? `_id_${tx.sourceMessageId}`
    : '';

  return `fp_${cleanBank}_${cleanAcc}_${cleanMerchant}_${tx.amountMinor}_${tx.type}_${dateOrTimeStr}${msgId}`;
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
    const txNotesRef = (txNotes.match(/(?:ref|rrn|utr|upi\s*ref)(?:\s*:|\s+no\.?|\s+)?\s*([a-zA-Z0-9]{8,18})/i) || [])[1]?.toUpperCase().trim();
    const effectiveTxRef = txRef || txUpi || txNotesRef;

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
      // If both have explicit different reference numbers, they are definitely NOT duplicates
      if (newRef && effectiveTxRef && newRef !== effectiveTxRef) {
        continue;
      }
      if (newUpiRef && effectiveTxRef && newUpiRef !== effectiveTxRef) {
        continue;
      }

      // Check for conflicting distinct payee names
      const txDesc = (tx.description || '').toLowerCase().trim();
      const newMerchant = (newTx.merchant || '').toLowerCase().trim();

      const genericWords = [
        'bank transaction',
        'bank payment',
        'received payment',
        'payment',
        'transfer',
        'salary',
        'credit',
        'debit',
        'unknown',
        'upi',
      ];
      const isGeneric = (str: string) => !str || genericWords.some((w) => str.includes(w));

      // If both have distinct non-generic payee names, verify whether they match
      if (!isGeneric(txDesc) && !isGeneric(newMerchant)) {
        const cleanTxDesc = txDesc.replace(/[^a-z0-9]/g, '');
        const cleanNewMerchant = newMerchant.replace(/[^a-z0-9]/g, '');
        if (
          cleanTxDesc !== cleanNewMerchant &&
          !cleanTxDesc.includes(cleanNewMerchant) &&
          !cleanNewMerchant.includes(cleanTxDesc)
        ) {
          // Different payees! (e.g. Paid Rs 30 at Shop A vs Shop B) -> NOT duplicate!
          continue;
        }
      }

      const txAccountName = (tx.account?.name || tx.account_name || '').toLowerCase();
      const txBankId = (tx.bankId || tx.bank_id || '').toLowerCase();

      const regBank = newBankId ? INDIAN_BANKS.find((b) => b.id === newBankId) : null;
      const bankNames = [
        newBankId,
        newBankName,
        regBank?.name.toLowerCase(),
        regBank?.shortName.toLowerCase(),
      ].filter(Boolean) as string[];

      // Check if both reference the same bank or account if known
      const bankOrAccountMatches =
        !newBankId ||
        newBankId === 'unknown' ||
        !txAccountName ||
        bankNames.some((bn) => txAccountName.includes(bn)) ||
        (txBankId && (txBankId === newBankId || txBankId.includes(newBankId) || newBankId.includes(txBankId)));

      // If masked account is present in both, ensure it matches
      const txMasked = (tx.account?.account_number || tx.maskedAccount || '').replace(/\D/g, '').slice(-4);
      const maskedMatches = !newMasked || !txMasked || newMasked === txMasked;

      if (bankOrAccountMatches && maskedMatches) {
        return true;
      }
    }
  }

  return false;
}

