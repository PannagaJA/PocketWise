import { INDIAN_BANKS } from '../banks/bankRegistry';
import { extractAmount } from './amountParser';

/**
 * Filter out non-financial SMS (OTP, card expiry, loan offers, marketing, promotional cashback).
 * Ensures ONLY true, executed financial transaction SMS (Debits & Credits) are processed.
 */
export function isFinancialSms(sender: string, body: string): boolean {
  if (!body) return false;

  const normalizedBody = body.toLowerCase();
  const normalizedSender = (sender || '').toLowerCase().trim();

  // 1. Filter out TRAI Promotional Sender IDs (Ending with '-P' or '_P', or having promotional header tokens)
  const isTraiPromo = normalizedSender.endsWith('-p') || normalizedSender.endsWith('_p');
  const senderTokens = normalizedSender.split(/[-_]/);
  const isPromoHeader = senderTokens.some(
    (tok) => tok === 'promo' || tok === 'offer' || tok === 'offers' || tok === 'deal' || tok === 'deals'
  );

  if (isTraiPromo || isPromoHeader) {
    return false;
  }

  // Pre-check for past-tense transaction actions
  const hasPostedAction = /\b(?:debited|spent|withdrawn|paid|transferred|sent|credited|deposited|refunded)\b/i.test(body);

  // 2. Explicit False Positive / Marketing / Promotional Keyword Filters
  const marketingAndFalsePositivePatterns = [
    // OTP & Security
    'otp',
    'one time password',
    'verification code',
    'secret code',
    'never share',
    'do not share',

    // Promotional & Marketing Phrases
    'good news',
    'congratulations',
    'special offer',
    'exclusive offer',
    'limited period',
    'get up to',
    'get upto',
    'win up to',
    'win upto',
    'win cash',
    'earn up to',
    'earn upto',
    'cashback on your',
    'cashback on next',
    'cashback on recharge',
    'cashback of up to',
    'recharge now',
    'recharge via',
    'recharge with',
    'recharge on',
    'apply now',
    'apply today',
    'click here',
    'reward points',
    'offer valid',
    'use code',
    'promo code',
    'coupon code',
    'avail now',
    'avail offer',
    'grab now',
    'scratch card',
    'bonus cash',
    'jackpot',
    't&c apply',
    'terms and conditions',
    'tnc apply',

    // Loans & Pre-approvals
    'pre-approved',
    'eligible for loan',
    'instant loan',
    'personal loan',
    'credit limit increased',
    'upgrade your card',

    // Due reminders & future promises
    'due on',
    'will be debited',
    'will be credited',
    'schedule for debit',
    'scheduled for debit',
    'minimum amount due',
    'payment due',
  ];

  for (const pattern of marketingAndFalsePositivePatterns) {
    if (pattern === 'due on' || pattern === 'payment due') {
      if (hasPostedAction) continue;
    }
    if (normalizedBody.includes(pattern)) {
      return false;
    }
  }

  // 3. Must contain a valid amount
  const extracted = extractAmount(body);
  if (!extracted) return false;

  // 4. Must contain an explicit past-tense transaction action (DEBIT or CREDIT)
  const isDebit = /\b(?:debited|debit|dr|dr\.|spent|withdrawn|paid|transferred|sent)\b/i.test(body);
  const isCredit = /\b(?:credited|credit|cr|cr\.|received|deposited|salary|refunded|refund)\b/i.test(body);

  if (!isDebit && !isCredit) {
    return false;
  }

  // 5. Must contain account, card, VPA, balance, or bank association keyword
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
    'avl bal',
    'bal:',
    'balance',
    'ending',
    'xx',
    'x x',
  ].some((kw) => normalizedBody.includes(kw));

  // Also check if sender matches registered banks
  const isKnownBankSender = INDIAN_BANKS.some((bank) =>
    bank.senderPatterns.some((pattern) => pattern.test(normalizedSender))
  );

  return isKnownBankSender || hasAccountOrBankKeywords;
}
