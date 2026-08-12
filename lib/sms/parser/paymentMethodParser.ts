import { PaymentMethod } from '../types';

/**
 * Detects the transaction payment channel/method used (UPI, ATM, POS, Cards, etc.)
 */
export function detectPaymentMethod(body: string): PaymentMethod {
  if (!body) return 'Unknown';

  const text = body.toUpperCase();

  if (text.includes('UPI') || text.includes('VPA') || text.includes('PAYTM') || text.includes('PHONEPE') || text.includes('GPAY')) {
    return 'UPI';
  }
  if (text.includes('ATM') || text.includes('CASH WDL') || text.includes('CASH WITHDRAWAL')) {
    return 'ATM';
  }
  if (text.includes('POS') || text.includes('SWIPE') || text.includes('MERCHANT')) {
    return 'POS';
  }
  if (text.includes('DEBIT CARD') || text.includes('DEBIT CARD ENDING')) {
    return 'Debit Card';
  }
  if (text.includes('CREDIT CARD') || text.includes('CREDIT CARD ENDING')) {
    return 'Credit Card';
  }
  if (text.includes('NEFT')) {
    return 'NEFT';
  }
  if (text.includes('IMPS')) {
    return 'IMPS';
  }
  if (text.includes('RTGS')) {
    return 'RTGS';
  }
  if (text.includes('BANK TRANSFER') || text.includes('TRANSFER')) {
    return 'Bank Transfer';
  }

  return 'Unknown';
}
