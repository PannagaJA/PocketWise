import { INDIAN_BANKS } from '../banks/bankRegistry';
import { BankDefinition, AccountMapping } from '../types';

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/[\s_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Identifies the bank associated with an SMS payload using multiple weighted signals:
 * 1. Pre-mapped account numbers
 * 2. Sender ID matching with registered patterns (including 2-segment and 3-segment TRAI headers)
 * 3. Explicit bank name / keywords in message body (e.g., "From HDFC Bank A/C *5472")
 * 4. UPI VPA Handle Extraction (e.g., @okhdfcbank, @oksbi, @barodampay)
 * 5. Dynamic Bank Extraction from message body patterns (e.g., "From Saraswat Bank A/C")
 * 6. Sender ID Token Parsing (e.g., VM-HDFCBK-T, AD-KOTAKB, VK-BOBTXN, AD-CANBNK)
 * 7. Fallback with Extracted Account (e.g., Bank XX5472)
 */
export function identifyBank(
  sender: string,
  body: string,
  accountMappings: AccountMapping[] = [],
  extractedAccount?: string
): { bank: BankDefinition | null; confidence: number; method: string } {
  const normSender = (sender || '').trim().toUpperCase();
  const normBody = (body || '').trim().toUpperCase();

  // 1. Account Mapping (Highest Priority Signal if matching account found)
  if (extractedAccount && accountMappings.length > 0) {
    const normExtracted = extractedAccount.toUpperCase();
    const cleanExtractedDigits = normExtracted.replace(/\D/g, '');
    const mapped = accountMappings.find(
      (m) =>
        m.maskedAccount.toUpperCase() === normExtracted ||
        (cleanExtractedDigits.length >= 3 && cleanExtractedDigits.endsWith(m.maskedAccount.replace(/\D/g, '')))
    );

    if (mapped) {
      const registeredBank = INDIAN_BANKS.find((b) => b.id === mapped.bankId);
      if (registeredBank) {
        return { bank: registeredBank, confidence: 100, method: 'account_mapping' };
      }
      return {
        bank: {
          id: mapped.bankId,
          name: toTitleCase(mapped.bankName),
          shortName: mapped.bankName,
          senderPatterns: [],
          messagePatterns: [],
          isActive: true,
        },
        confidence: 95,
        method: 'account_mapping_dynamic',
      };
    }
  }

  // 2. Sender ID Matching with registered patterns
  for (const bank of INDIAN_BANKS) {
    for (const pattern of bank.senderPatterns) {
      if (pattern.test(normSender)) {
        return { bank, confidence: 95, method: 'sender_id' };
      }
    }
  }

  // 3. Explicit Bank Name / Keywords in Message Body (e.g., "From HDFC Bank A/C", "in your SBI account")
  for (const bank of INDIAN_BANKS) {
    for (const pattern of bank.messagePatterns) {
      if (pattern.test(normBody)) {
        return { bank, confidence: 90, method: 'body_explicit' };
      }
    }
  }

  // 4. UPI VPA Handle Extraction (e.g. UPI/P2A/.../@barodampay, @cnrb, @okhdfcbank, @oksbi)
  const vpaMatch = /@([A-Z0-9.\-_]+)/i.exec(body);
  if (vpaMatch && vpaMatch[1]) {
    const handle = vpaMatch[1].toLowerCase();
    for (const bank of INDIAN_BANKS) {
      for (const pattern of bank.messagePatterns) {
        if (pattern.test(handle)) {
          return { bank, confidence: 85, method: 'upi_vpa_handle' };
        }
      }
    }
  }

  // 5. Dynamic Bank Extraction from message body patterns (e.g. "From Saraswat Bank A/C", "in Saraswat Bank account")
  const bodyBankMatch =
    /(?:from|in|at|to|with)\s+([A-Za-z0-9\s]{2,25}?)\s+(?:bank\s+)?(?:a\/c|acct|account|card)/i.exec(body) ||
    /([A-Za-z0-9\s]{2,20}?)\s+bank\s+(?:a\/c|account|card)/i.exec(body);
  if (bodyBankMatch && bodyBankMatch[1]) {
    const rawExtractedName = bodyBankMatch[1].trim();
    if (
      rawExtractedName.length >= 2 &&
      !['YOUR', 'MY', 'OUR', 'THE', 'THIS', 'ANY', 'HDFC', 'SBI', 'ICICI', 'AXIS'].includes(rawExtractedName.toUpperCase())
    ) {
      const titleName = toTitleCase(rawExtractedName);
      const slug = rawExtractedName.toLowerCase().replace(/\s+/g, '_');
      const formattedName = titleName.toLowerCase().endsWith('bank')
        ? titleName
        : `${titleName} Bank`;

      return {
        bank: {
          id: slug,
          name: formattedName,
          shortName: titleName,
          senderPatterns: [],
          messagePatterns: [],
          isActive: true,
        },
        confidence: 80,
        method: 'body_dynamic_bank',
      };
    }
  }

  // 6. Sender ID Token Parsing with Indian TRAI prefixes/suffixes (e.g. VM-HDFCBK-T, AD-SBINB-S, VK-BOBTXN, AD-CANBNK, BZ-CANARA)
  const senderMatch =
    /^[A-Z]{2}-([A-Z0-9]+?)(?:-[A-Z0-9]+)?$/i.exec(normSender) ||
    /^([A-Z0-9]{3,8})(?:-[A-Z0-9]+)?$/i.exec(normSender);
  if (senderMatch && senderMatch[1]) {
    const rawBankCode = senderMatch[1].toUpperCase();

    // Check if rawBankCode matches any registered bank keywords
    for (const bank of INDIAN_BANKS) {
      if (
        rawBankCode.includes(bank.shortName.toUpperCase()) ||
        rawBankCode.includes(bank.id.toUpperCase()) ||
        bank.senderPatterns.some((p) => p.test(rawBankCode))
      ) {
        return { bank, confidence: 85, method: 'sender_token_match' };
      }
    }

    // Unlisted Bank code from sender
    const cleanName = rawBankCode.replace(/(BK|BNK|SMS|TXN|ALT|TP)$/i, '').trim();
    const titleName = toTitleCase(cleanName || rawBankCode);
    const formattedName = titleName.toLowerCase().endsWith('bank') ? titleName : `${titleName} Bank`;
    return {
      bank: {
        id: rawBankCode.toLowerCase(),
        name: formattedName,
        shortName: titleName,
        senderPatterns: [],
        messagePatterns: [],
        isActive: true,
      },
      confidence: 75,
      method: 'sender_prefix',
    };
  }

  // 7. Fallback with Extracted Account (e.g. Bank XX5472)
  if (extractedAccount) {
    return {
      bank: {
        id: `bank_${extractedAccount.toLowerCase()}`,
        name: `Bank (${extractedAccount})`,
        shortName: 'Bank',
        senderPatterns: [],
        messagePatterns: [],
        isActive: true,
      },
      confidence: 60,
      method: 'account_fallback',
    };
  }

  // 8. UNKNOWN Bank Fallback
  return {
    bank: null,
    confidence: 0,
    method: 'unknown',
  };
}
