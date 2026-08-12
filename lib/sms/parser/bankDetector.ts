import { INDIAN_BANKS } from '../banks/bankRegistry';
import { BankDefinition, AccountMapping } from '../types';

/**
 * Identifies the bank associated with an SMS payload using multiple weighted signals:
 * 1. Sender ID matching
 * 2. Explicit bank name in message body
 * 3. Pre-mapped account numbers
 * 4. Known bank-specific regex patterns
 */
export function identifyBank(
  sender: string,
  body: string,
  accountMappings: AccountMapping[] = [],
  extractedAccount?: string
): { bank: BankDefinition | null; confidence: number; method: string } {
  const normSender = (sender || '').toUpperCase();
  const normBody = (body || '').toUpperCase();

  // 1. Account Mapping (Highest Priority Signal if matching account found)
  if (extractedAccount && accountMappings.length > 0) {
    const normExtracted = extractedAccount.toUpperCase();
    const mapped = accountMappings.find(
      (m) => m.maskedAccount.toUpperCase() === normExtracted || normExtracted.endsWith(m.maskedAccount.replace(/\D/g, ''))
    );

    if (mapped) {
      const registeredBank = INDIAN_BANKS.find((b) => b.id === mapped.bankId);
      if (registeredBank) {
        return { bank: registeredBank, confidence: 100, method: 'account_mapping' };
      }
    }
  }

  // 2. Sender ID Matching
  for (const bank of INDIAN_BANKS) {
    for (const pattern of bank.senderPatterns) {
      if (pattern.test(normSender)) {
        return { bank, confidence: 90, method: 'sender_id' };
      }
    }
  }

  // 3. Explicit Bank Name In Message Body
  for (const bank of INDIAN_BANKS) {
    for (const pattern of bank.messagePatterns) {
      if (pattern.test(normBody)) {
        return { bank, confidence: 80, method: 'body_explicit' };
      }
    }
  }

  // 4. UNKNOWN Bank Fallback
  return {
    bank: null,
    confidence: 0,
    method: 'unknown',
  };
}
