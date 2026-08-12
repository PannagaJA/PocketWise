/**
 * Normalizes Indian currency strings into a clean numeric value (in INR).
 * Examples:
 * "Rs. 1,25,000.00" -> 125000
 * "₹500" -> 500
 * "INR 35000.50" -> 35000.5
 */
export function extractAmount(text: string): { amount: number; amountMinor: number } | null {
  if (!text) return null;

  // Match patterns like:
  // ₹1,25,000.00 | Rs.1,250.00 | Rs 500 | INR 35000 | INR.500 | INR1000
  const currencyRegex = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi;
  
  let match = currencyRegex.exec(text);
  
  // Fallback pattern: "debited/credited by 500" or "for 500.00"
  if (!match) {
    const verbNumberRegex = /(?:debited|credited|paid|spent|transferred|withdrawn|received|added|ref|amt|amount|val|value)(?:\s+(?:by|of|with|for|rs|inr|₹))?\s*:?\s*([\d,]+(?:\.\d{1,2})?)/gi;
    match = verbNumberRegex.exec(text);
  }

  if (!match || !match[1]) return null;

  const rawAmountStr = match[1].replace(/,/g, '');
  const amount = parseFloat(rawAmountStr);

  if (isNaN(amount) || amount <= 0) return null;

  // Convert to minor units (paise) for internal store precision
  const amountMinor = Math.round(amount * 100);

  return {
    amount,
    amountMinor,
  };
}
