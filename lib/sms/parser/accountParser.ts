/**
 * Extracts masked account or card numbers from bank SMS messages.
 * Examples:
 * A/c XX1234 -> XX1234
 * A/C 1234 -> XX1234
 * Acct ending 9988 -> XX9988
 * Card ending 5678 -> XX5678
 */
export function extractAccount(body: string): { maskedAccount: string; rawMatch: string } | null {
  if (!body) return null;

  // Patterns for account/card numbers
  const patterns = [
    /(?:a\/c|acct|account|card|a\/c no\.?|acc\.?|ac\.?)\s*(?:no\.?)?\s*(?:ending\s*)?:?\s*([xX.*]*\d{3,4}|\d{4})/i,
    /(?:credited|debited|transferred)?\s*(?:to|from|in)?\s*(?:\.{2,}|[xX*]{2,})(\d{3,4})/i,
    /(?:your account|account)\s+(?:is|has been)?\s*(?:credited|debited)/i,
    /(?:a\/c|account)\s*(?:[xX*.]+(\d{4}))/i,
    /ending\s+with\s+([xX.*]*\d{3,4}|\d{4})/i,
    /card\s+([xX.*]*\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(body);
    if (match && match[1]) {
      const digits = match[1].replace(/\D/g, '');
      if (digits.length >= 3 && digits.length <= 4) {
        return {
          maskedAccount: `XX${digits}`,
          rawMatch: match[0],
        };
      }
    }
  }

  return null;
}
