import { INDIAN_BANKS } from '../banks/bankRegistry';
import { extractAmount } from './amountParser';

/**
 * Filter out non-financial SMS (OTP, card expiry, loan offers, marketing).
 * Ensures only true financial transaction SMS are processed.
 */
export function isFinancialSms(sender: string, body: string): boolean {
  if (!body) return false;

  const normalizedBody = body.toLowerCase();
  const normalizedSender = (sender || '').toLowerCase();

  // 1. Explicit False Positive Filters (OTP, Expiry, Marketing, Due reminders)
  const falsePositiveKeywords = [
    'otp',
    'one time password',
    'verification code',
    'secret code',
    'never share',
    'do not share',
    'expiring',
    'expires',
    'will be debited', // Future promise, not actual transaction
    'will be credited',
    'pre-approved',
    'eligible for loan',
    'apply now',
    'click here',
    'reward points',
    'offer valid',
    'due on', // Bill due notice (not transaction yet)
  ];

  for (const fp of falsePositiveKeywords) {
    if (normalizedBody.includes(fp)) {
      return false;
    }
  }

  // 2. Must contain an amount
  const extracted = extractAmount(body);
  if (!extracted) return false;

  // 3. Must contain at least one strong financial transaction verb
  const financialVerbs = [
    'debited',
    'debit',
    'dr',
    'dr.',
    'spent',
    'withdrawn',
    'paid',
    'purchase',
    'transferred',
    'sent',
    'credited',
    'credit',
    'cr',
    'cr.',
    'received',
    'deposited',
    'refund',
    'cashback',
    'salary',
    'txn',
    'transaction',
  ];

  const hasFinancialVerb = financialVerbs.some((verb) => normalizedBody.includes(verb));
  if (!hasFinancialVerb) return false;

  // 4. Must be from a known bank sender or mention an account / bank keyword
  const isKnownBankSender = INDIAN_BANKS.some((bank) =>
    bank.senderPatterns.some((pattern) => pattern.test(normalizedSender))
  );

  const hasAccountOrBankKeywords = [
    'a/c',
    'acct',
    'account',
    'card',
    'upi',
    'vpa',
    'bank',
    'wallet',
    'avbl bal',
    'avail bal',
    'clear bal',
    'bal',
  ].some((kw) => normalizedBody.includes(kw));

  return isKnownBankSender || hasAccountOrBankKeywords;
}
