import { RawSMS, ParsedSmsTransaction, AccountMapping, LearnedCategoryMapping } from '../types';
import { isFinancialSms } from './transactionDetector';
import { extractAmount } from './amountParser';
import { identifyBank } from './bankDetector';
import { extractAccount } from './accountParser';
import { detectPaymentMethod } from './paymentMethodParser';
import { extractMerchantAndCategory } from './merchantParser';
import { classifyTransaction } from './transactionClassifier';
import { calculateConfidenceScore } from './confidenceScorer';

/**
 * Main SMS parsing orchestrator pipeline:
 * Raw SMS -> Financial Check -> Amount -> Bank -> Account -> Merchant -> Classification -> Confidence -> Parsed Result
 */
export function parseBankSms(
  sms: RawSMS,
  accountMappings: AccountMapping[] = [],
  learnedCategories: LearnedCategoryMapping[] = []
): ParsedSmsTransaction | null {
  if (!sms || !sms.body) return null;

  // 1. Financial Message Filter
  if (!isFinancialSms(sms.sender, sms.body)) {
    return null;
  }

  // 2. Amount Extraction
  const amountResult = extractAmount(sms.body);
  if (!amountResult) return null;

  // 3. Account Extraction
  const accountResult = extractAccount(sms.body);
  const maskedAccount = accountResult?.maskedAccount;

  // 4. Bank Identification (using sender, body, and mapped accounts)
  const bankResult = identifyBank(sms.sender, sms.body, accountMappings, maskedAccount);

  // 5. Merchant & Category Extraction
  const merchantResult = extractMerchantAndCategory(sms.body, learnedCategories);

  // 6. Payment Method Detection
  const paymentMethod = detectPaymentMethod(sms.body);

  // 7. Transaction Type & Classification
  const classification = classifyTransaction(sms.body);

  // 8. Confidence Scoring
  const confidence = calculateConfidenceScore({
    bankMethod: bankResult.method,
    hasAmount: true,
    hasAccount: !!maskedAccount,
    hasMerchant: merchantResult.merchant !== 'Bank Transaction' && merchantResult.merchant !== 'Unknown Payee',
    hasReference: !!classification.referenceNumber || !!classification.upiReference,
    isFinancial: true,
  });

  // Calculate Date ISO string
  const txDate = sms.timestamp ? new Date(sms.timestamp).toISOString() : new Date().toISOString();

  // Category resolution: Salary -> Refund -> Learned/Extracted
  let finalCategory = merchantResult.category;
  if (classification.isSalary) {
    finalCategory = 'Salary';
  } else if (classification.isTransfer) {
    finalCategory = 'Transfer';
  }

  // Return normalized parsed transaction object
  return {
    sourceMessageId: sms.id || `sms_${Date.now()}`,
    smsSender: sms.sender,
    rawText: undefined, // Discard raw text for privacy compliance unless stored temporarily
    type: classification.type,
    amount: amountResult.amount,
    amountMinor: amountResult.amountMinor,
    currency: 'INR',
    bankId: bankResult.bank?.id || 'unknown',
    bankName: bankResult.bank?.name || 'Unknown Bank',
    maskedAccount,
    merchant: merchantResult.merchant,
    originalMerchant: merchantResult.originalMerchant,
    paymentMethod,
    category: finalCategory,
    transactionDate: txDate,
    referenceNumber: classification.referenceNumber,
    upiReference: classification.upiReference,
    confidenceScore: confidence.score,
    isSalary: classification.isSalary,
    isRefund: classification.isRefund,
    isTransfer: classification.isTransfer,
    isAutoDetected: true,
    needsReview: confidence.needsReview,
    reviewReason: confidence.reason,
  };
}
