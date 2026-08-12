export interface RawSMS {
  id?: string;
  sender: string;
  body: string;
  timestamp: number; // ms
}

export type TransactionType = 'expense' | 'income' | 'transfer' | 'refund';

export type PaymentMethod = 
  | 'UPI' 
  | 'ATM' 
  | 'POS' 
  | 'Debit Card' 
  | 'Credit Card' 
  | 'NEFT' 
  | 'IMPS' 
  | 'RTGS' 
  | 'Bank Transfer' 
  | 'Cash' 
  | 'Unknown';

export interface BankDefinition {
  id: string;
  name: string;
  shortName: string;
  senderPatterns: RegExp[];
  messagePatterns: RegExp[];
  icon?: string;
  color?: string;
  isActive: boolean;
}

export interface AccountMapping {
  maskedAccount: string;
  bankId: string;
  bankName: string;
  userAccountId?: string;
  updatedAt: string;
}

export interface LearnedCategoryMapping {
  merchantKey: string; // uppercase normalized
  categoryName: string;
  updatedAt: string;
}

export interface ParsedSmsTransaction {
  sourceMessageId?: string;
  smsSender: string;
  rawText?: string;
  type: TransactionType;
  amount: number; // numeric INR value, e.g., 1250.50 or minor units in stored model
  amountMinor: number; // minor units (paise), e.g., 125050
  currency: 'INR';
  bankId: string;
  bankName: string;
  maskedAccount?: string;
  accountNumber?: string;
  merchant?: string;
  originalMerchant?: string;
  paymentMethod: PaymentMethod;
  category: string;
  transactionDate: string; // ISO String or YYYY-MM-DD
  referenceNumber?: string;
  upiReference?: string;
  confidenceScore: number; // 0 - 100
  isSalary: boolean;
  isRefund: boolean;
  isTransfer: boolean;
  transferFromBank?: string;
  transferToBank?: string;
  isAutoDetected: true;
  needsReview: boolean;
  reviewReason?: string;
}

export interface SmsTrackingSettings {
  autoTrackingEnabled: boolean;
  permissionGranted: boolean;
  lastSyncTimestamp?: number;
  totalDetectedCount: number;
}
