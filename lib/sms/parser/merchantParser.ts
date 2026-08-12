import { LearnedCategoryMapping } from '../types';

interface MerchantResult {
  merchant: string;
  originalMerchant: string;
  category: string;
}

const CATEGORY_MAP: Record<string, string[]> = {
  'Food & Dining': ['SWIGGY', 'ZOMATO', 'DOMINOS', 'MCDONALDS', 'STARBUCKS', 'BURGER KING', 'DINE', 'RESTAURANT', 'CAFE', 'BAKERY', 'FOOD'],
  'Groceries': ['BLINKIT', 'ZEPTO', 'BIGBASKET', 'SUPERMARKET', 'GROCERY', 'MART', 'DMART', 'SPAR', 'NATURES BASKET'],
  'Shopping': ['AMAZON', 'FLIPKART', 'MYNTRA', 'AJIO', 'MEESHO', 'TATACLIQ', 'ZARA', 'UNIQLO', 'RELIANCE DIGITAL'],
  'Transportation': ['UBER', 'OLA', 'RAPIDO', 'METRO', 'IRCTC', 'REDCOUPON', 'ABHIBUS', 'CAB'],
  'Fuel': ['HPCL', 'BPCL', 'IOCL', 'SHELL', 'PETROL', 'DIESEL', 'FUEL', 'PETROLEUM'],
  'Bills & Utilities': ['BESCOM', 'AIRTEL', 'JIO', 'VI', 'TATA PLAY', 'ELECTRICITY', 'WATER', 'GAS', 'BILLPAY'],
  'Subscriptions': ['NETFLIX', 'SPOTIFY', 'PRIME', 'YOUTUBE', 'APPLE', 'DISNEY', 'HOTSTAR', 'CHATGPT'],
  'Healthcare': ['PHARMEASY', 'APOLLO', '1MG', 'MEDPLUS', 'HOSPITAL', 'CLINIC', 'LAB'],
  'Entertainment': ['BOOKMYSHOW', 'PVR', 'INOX', 'CINEMA', 'PLAYSTATION', 'STEAM'],
};

/**
 * Extracts merchant/payee and determines the expense category.
 */
export function extractMerchantAndCategory(
  body: string,
  learnedCategories: LearnedCategoryMapping[] = []
): MerchantResult {
  if (!body) {
    return { merchant: 'Unknown Payee', originalMerchant: '', category: 'Other' };
  }

  let rawExtracted = '';

  // 1. Regex pattern matches for merchant indicators
  const merchantPatterns = [
    /(?:refund\s+from)\s+([A-Za-z0-9\s._&-]+?)(?=\s+(?:to|on|ref|txn|val|bal|via|a\/c|card|link|dated|\.|\n|$))/i,
    /(?:paid\s+to|spent\s+at|cr\.?\s+to|to)\s+([a-zA-Z0-9._-]+@[a-zA-Z0-9]+|[A-Za-z0-9\s._&-]+?)(?=\s+(?:on|ref|txn|val|bal|via|using|a\/c|card|link|dated|\.|\n|$))/i,
    /vpa\s+([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)/i,
  ];

  for (const pattern of merchantPatterns) {
    const match = pattern.exec(body);
    if (match && match[1]) {
      const candidate = match[1].trim();
      // Filter out invalid generic noise
      if (candidate.length > 2 && !candidate.toLowerCase().includes('bank') && !candidate.toLowerCase().includes('account')) {
        rawExtracted = candidate;
        break;
      }
    }
  }

  // Normalize merchant name
  let cleanMerchant = rawExtracted.toUpperCase();
  // Handle UPI IDs e.g. "swiggy@icici" -> "SWIGGY"
  if (cleanMerchant.includes('@')) {
    cleanMerchant = cleanMerchant.split('@')[0];
  }
  // Remove technical prefixes
  cleanMerchant = cleanMerchant.replace(/^(INF|UPI|PAYTM|BILLDESK|RAZORPAY|CCAVENUE)\*/i, '').trim();

  if (!cleanMerchant) {
    return { merchant: 'Bank Transaction', originalMerchant: rawExtracted, category: 'Other' };
  }

  // Format nice display name (capitalized words)
  const formattedMerchant = cleanMerchant
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // 2. Check Learned Custom Mappings from User Edits
  const upperKey = cleanMerchant.toUpperCase();
  const learned = learnedCategories.find((lc) => lc.merchantKey === upperKey);
  if (learned) {
    return {
      merchant: formattedMerchant,
      originalMerchant: rawExtracted,
      category: learned.categoryName,
    };
  }

  // 3. Match against Default Keyword Categories
  for (const [categoryName, keywords] of Object.entries(CATEGORY_MAP)) {
    for (const kw of keywords) {
      if (upperKey.includes(kw)) {
        return {
          merchant: formattedMerchant,
          originalMerchant: rawExtracted,
          category: categoryName,
        };
      }
    }
  }

  return {
    merchant: formattedMerchant,
    originalMerchant: rawExtracted,
    category: 'Other',
  };
}
