/**
 * Normalizes Indian currency strings into a clean numeric value (in INR).
 * Examples:
 * "Rs. 1,25,000.00" -> 125000
 * "₹500" -> 500
 * "INR 35000.50" -> 35000.5
 */
export function extractAmount(text: string): { amount: number; amountMinor: number } | null {
  if (!text) return null;

  // Strip trailing available/clear balance clauses so we extract the transaction amount,
  // not a subsequent balance ("Avl Bal Rs 20000") when the verb amount has no currency prefix.
  const withoutBalance = text.replace(
    /(?:avl\.?\s*bal(?:ance)?|avail(?:able)?\s*bal(?:ance)?|clear\s*bal(?:ance)?|bal(?:ance)?\s*(?:is|:)?)\s*(?:rs\.?|inr|₹)?\s*[\d,]+(?:\.\d{1,2})?/gi,
    ' '
  );

  // Match patterns like:
  // ₹1,25,000.00 | Rs.1,250.00 | Rs 500 | INR 35000 | INR.500 | INR1000
  const currencyRegex = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi;
  // Fallback pattern: "debited by 500.0", "credited by Rs 500", "Dr. from ... 500", etc.
  const verbNumberRegex = /(?:debited|credited|dr\.?|cr\.?|paid|spent|transferred|withdrawn|received|added|amt|amount|val|value)(?:\s+(?:is|by|of|with|for|rs\.?|inr|₹))*\s*:?\s*([\d,]+(?:\.\d{1,2})?)/gi;

  let match = currencyRegex.exec(withoutBalance) || verbNumberRegex.exec(withoutBalance);
  if (!match) {
    currencyRegex.lastIndex = 0;
    verbNumberRegex.lastIndex = 0;
    match = currencyRegex.exec(text) || verbNumberRegex.exec(text);
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
