/**
 * Calculates a confidence score (0-100) for a parsed transaction based on signal quality.
 */
export function calculateConfidenceScore(signals: {
  bankMethod: string;
  hasAmount: boolean;
  hasAccount: boolean;
  hasMerchant: boolean;
  hasReference: boolean;
  isFinancial: boolean;
}): { score: number; needsReview: boolean; reason?: string } {
  if (!signals.isFinancial || !signals.hasAmount) {
    return { score: 0, needsReview: true, reason: 'Not a valid financial transaction or missing amount' };
  }

  let score = 50; // Base score for valid financial SMS with amount

  // Bank detection signal strength
  if (signals.bankMethod === 'account_mapping') {
    score += 30;
  } else if (signals.bankMethod === 'sender_id') {
    score += 25;
  } else if (signals.bankMethod === 'body_explicit') {
    score += 15;
  } else {
    score -= 20; // Unknown bank
  }

  // Account extraction signal
  if (signals.hasAccount) {
    score += 10;
  }

  // Reference ID signal
  if (signals.hasReference) {
    score += 10;
  }

  // Merchant signal
  if (signals.hasMerchant) {
    score += 5;
  }

  // Cap score between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Determine review requirement threshold
  // Scores >= 80: Auto-save cleanly
  // Scores 60 - 79: Auto-save with badge / review card
  // Scores < 60: Request manual user review before adding
  let needsReview = score < 80;
  let reason: string | undefined;

  if (signals.bankMethod === 'unknown') {
    needsReview = true;
    reason = 'Bank not identified';
  } else if (!signals.hasAccount) {
    reason = 'Account number missing';
  }

  return { score, needsReview, reason };
}
