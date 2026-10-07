import { LearnedCategoryMapping } from '../types';

interface MerchantResult {
  merchant: string;
  originalMerchant: string;
  category: string;
}

const CATEGORY_MAP: Record<string, string[]> = {
  'Food & Dining': [
    'SWIGGY', 'ZOMATO', 'DOMINOS', 'MCDONALDS', 'STARBUCKS', 'BURGER KING', 'DINE', 'RESTAURANT',
    'CAFE', 'BAKERY', 'FOOD', 'CHAAYOS', 'CHAI POINT', 'HALDIRAM', 'KFC', 'PIZZA HUT', 'SUBWAY',
    'EATS', 'BIRYANI', 'DHABA', 'SWEETS'
  ],
  'Groceries': [
    'BLINKIT', 'ZEPTO', 'BIGBASKET', 'INSTAMART', 'SUPERMARKET', 'GROCERY', 'MART', 'DMART',
    'SPAR', 'NATURES BASKET', 'KIRANA', 'GENERAL STORE', 'VEGETABLES', 'FRUITS', 'MILK', 'DAIRY'
  ],
  'Shopping': [
    'AMAZON', 'FLIPKART', 'MYNTRA', 'AJIO', 'MEESHO', 'TATACLIQ', 'ZARA', 'UNIQLO',
    'RELIANCE DIGITAL', 'CROMA', 'NYKAA', 'PURPLLE', 'H&M', 'DECATHLON', 'LIFESTYLE', 'SHOP'
  ],
  'Transportation': [
    'UBER', 'OLA', 'RAPIDO', 'METRO', 'IRCTC', 'REDCOUPON', 'ABHIBUS', 'CAB', 'AUTO',
    'MAKEMYTRIP', 'GOIBIBO', 'YATRA', 'INDIGO', 'AIR INDIA', 'TOLL', 'FASTAG'
  ],
  'Fuel': [
    'HPCL', 'BPCL', 'IOCL', 'SHELL', 'PETROL', 'DIESEL', 'FUEL', 'PETROLEUM', 'AUTO GAS', 'CNG'
  ],
  'Bills & Utilities': [
    'BESCOM', 'AIRTEL', 'JIO', 'VI', 'TATA PLAY', 'ELECTRICITY', 'WATER', 'GAS', 'BILLPAY',
    'BROADBAND', 'RECHARGE', 'ACT FIBERNET', 'HATHWAY', 'MAHAVITARAN', 'DISCOM'
  ],
  'Subscriptions': [
    'NETFLIX', 'SPOTIFY', 'PRIME', 'YOUTUBE', 'APPLE', 'DISNEY', 'HOTSTAR', 'CHATGPT',
    'OPENAI', 'PLAYSTATION', 'XBOX', 'MEDIUM', 'ICLOUD', 'GOOGLE ONE'
  ],
  'Healthcare': [
    'PHARMEASY', 'APOLLO', '1MG', 'MEDPLUS', 'HOSPITAL', 'CLINIC', 'LAB', 'PHARMACY',
    'DOCTOR', 'DENTAL', 'MEDICINE', 'HEALTH'
  ],
  'Entertainment': [
    'BOOKMYSHOW', 'PVR', 'INOX', 'CINEMA', 'PLAYSTATION', 'STEAM', 'GAMING', 'THEATRE', 'SHOW'
  ],
};

/**
 * Extracts exact merchant/payee name, decodes UPI handles, and determines expense category.
 */
export function extractMerchantAndCategory(
  body: string,
  learnedCategories: LearnedCategoryMapping[] = []
): MerchantResult {
  if (!body) {
    return { merchant: 'Unknown Payee', originalMerchant: '', category: 'Other' };
  }

  let rawExtracted = '';

  // 1. Check for explicit name in parentheses after VPA/UPI (e.g. "to VPA swiggy@icici (Swiggy)")
  const parenMatch = /(?:vpa|to|upi)[\s:]+[\w.-]+@[\w.-]+\s*\(([^)]+)\)/i.exec(body);
  if (parenMatch && parenMatch[1] && parenMatch[1].trim().length > 1) {
    rawExtracted = parenMatch[1].trim();
  }

  // 2. High-precision transaction pattern matchers
  if (!rawExtracted) {
    const merchantPatterns = [
      // Explicit "To <Name/VPA>" e.g. "To Nandikeshwara condiments\nOn 23/09/26"
      /(?:^|\n|\s)(?:To\s+VPA|To)\s+([A-Za-z0-9._-]+@[a-zA-Z0-9]+|[A-Za-z0-9\s._&-]+?)(?=\s*(?:\n|\.|$|\s+(?:\b(?:on|ref|rrn|txn|val|bal|via|using|card|link|dated)\b|a\/c)))/i,
      // "trf to <Name>" or "transfer to <Name>"
      /(?:trf\s+to|transfer\s+to|transferred\s+to)\s+([A-Za-z0-9\s._&-]+?)(?=\s*(?:\n|\.|$|\s+(?:\b(?:on|ref|rrn|txn|val|bal|via|using|card|link|dated)\b|a\/c)))/i,
      // "paid to <Name>" or "spent at <Name>" or "purchase at <Name>"
      /(?:paid\s+to|spent\s+at|spent\s+on|purchase\s+at|sent\s+to|\bat)\s+([A-Za-z0-9._-]+@[a-zA-Z0-9]+|[A-Za-z0-9\s._&-]+?)(?=\s*(?:\n|\.|$|\s+(?:\b(?:on|ref|rrn|txn|val|bal|via|using|card|link|dated)\b|a\/c)))/i,
      // "towards <Purpose/Name>" or "in favour of <Name>"
      /(?:towards|in\s+favour\s+of|info:\s*|desc:\s*)\s+([A-Za-z0-9\s._&-]+?)(?=\s*(?:\n|\.|$|\s+(?:\b(?:on|ref|rrn|txn|val|bal|via|using|card|link|dated)\b|a\/c)))/i,
      // "refund from <Name>" or "received from <Name>" or "credited by <Name>"
      /(?:refund\s+from|received\s+from|credited\s+by|credited\s+from|cr\.\s+to|cr\s+to)\s+([A-Za-z0-9._-]+@[a-zA-Z0-9]+|[A-Za-z0-9\s._&-]+?)(?=\s*(?:\n|\.|$|\s+(?:\b(?:on|to|ref|rrn|txn|val|bal|via|using|card|link|dated)\b|a\/c)))/i,
      // Standalone VPA
      /vpa\s+([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)/i,
    ];

    for (const pattern of merchantPatterns) {
      const match = pattern.exec(body);
      if (match && match[1]) {
        const candidate = match[1].trim();
        const candidateLower = candidate.toLowerCase();
        // Filter out generic boilerplate words
        if (
          candidate.length > 1 &&
          !candidateLower.includes('bank a/c') &&
          !candidateLower.includes('your a/c') &&
          !candidateLower.includes('your account') &&
          !candidateLower.startsWith('a/c') &&
          candidateLower !== 'upi'
        ) {
          rawExtracted = candidate;
          break;
        }
      }
    }
  }

  // 3. Clean and normalize extracted merchant string
  let cleanMerchant = rawExtracted.trim();

  // Strip UPI domain suffix (e.g. "swiggy@icici" -> "swiggy", "paytm-1234@paytm" -> "paytm")
  if (cleanMerchant.includes('@')) {
    const handle = cleanMerchant.split('@')[0];
    cleanMerchant = handle.replace(/^[a-zA-Z0-9._-]+\./, ''); // remove sub-prefixes like "bharatpe.98124"
  }

  // Strip gateway routing prefixes (e.g. "BILLDESK*AIRTEL", "RAZORPAY*SWIGGY", "UPI-")
  cleanMerchant = cleanMerchant.replace(/^(?:INF|UPI|PAYTM|BILLDESK|RAZORPAY|CCAVENUE|PAYU|POS)[\*\/_-]/i, '');
  // Strip corporate suffixes for clean human readability
  cleanMerchant = cleanMerchant.replace(/\s+(?:PVT\s+LTD|PRIVATE\s+LIMITED|LTD|LIMITED|INC|LLP|INDIA)\b/gi, '');
  // Remove numeric transaction IDs/phone numbers attached to merchant name
  cleanMerchant = cleanMerchant.replace(/\b\d{6,}\b/g, '').trim();

  if (!cleanMerchant || cleanMerchant.length < 2) {
    return { merchant: '', originalMerchant: rawExtracted, category: 'Other' };
  }

  // 4. Format Title Case (e.g. "SWIGGY" -> "Swiggy", "RELIANCE RETAIL" -> "Reliance Retail")
  const formattedMerchant = cleanMerchant
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // 5. Match against User Learned Mappings
  const upperKey = cleanMerchant.toUpperCase();
  const learned = learnedCategories.find((lc) => {
    const mk = (lc.merchantKey || '').trim().toUpperCase();
    if (!mk) return false;
    if (upperKey === mk) return true;
    if (mk.length >= 3 && new RegExp(`\\b${mk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(upperKey)) {
      return true;
    }
    return false;
  });
  if (learned) {
    return {
      merchant: formattedMerchant,
      originalMerchant: rawExtracted,
      category: learned.categoryName,
    };
  }

  // 6. Match against Intelligent Default Categories
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
