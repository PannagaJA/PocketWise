export type CardNetwork = 'visa' | 'mastercard' | 'rupay' | 'pocketwise';

export interface AtmCardTheme {
  bankId: string;
  bankName: string;
  shortName: string;
  cardTier: string;
  cardNetwork: CardNetwork;
  gradientColors: [string, string, string];
  accentColor: string;
  textColor: string;
  chipColor: string;
  patternType: 'mesh' | 'waves' | 'geometric' | 'minimal' | 'stripes';
}

/**
 * Deterministically derives a 4-digit card suffix from an account id or string.
 */
export function getDeterministicCardLast4(seed: string): string {
  // Check if string already contains 4 digits (e.g. "HDFC 4921")
  const match = seed.match(/\b\d{4}\b/);
  if (match) return match[0];

  // Otherwise hash the seed to generate 4 deterministic digits
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const abs = Math.abs(hash);
  const num = (abs % 9000) + 1000;
  return num.toString();
}

/**
 * Resolves full premium ATM card theme based on bank/account name.
 */
export function getAtmCardTheme(accountName: string, accountType?: string, customColor?: string): AtmCardTheme {
  const name = (accountName || '').toLowerCase().trim();

  // 1. HDFC Bank
  if (name.includes('hdfc')) {
    return {
      bankId: 'hdfc',
      bankName: 'HDFC BANK',
      shortName: 'HDFC',
      cardTier: 'MILLENNIA PLATINUM DEBIT',
      cardNetwork: 'visa',
      gradientColors: ['#00204E', '#004B8D', '#0284C7'],
      accentColor: '#38BDF8',
      textColor: '#FFFFFF',
      chipColor: '#FDE047',
      patternType: 'mesh',
    };
  }

  // 2. State Bank of India (SBI)
  if (name.includes('sbi') || name.includes('state bank')) {
    return {
      bankId: 'sbi',
      bankName: 'STATE BANK OF INDIA',
      shortName: 'SBI',
      cardTier: 'GLOBAL INTERNATIONAL DEBIT',
      cardNetwork: 'rupay',
      gradientColors: ['#130138', '#280071', '#0369A1'],
      accentColor: '#60A5FA',
      textColor: '#FFFFFF',
      chipColor: '#FDE047',
      patternType: 'waves',
    };
  }

  // 3. ICICI Bank
  if (name.includes('icici')) {
    return {
      bankId: 'icici',
      bankName: 'ICICI Bank',
      shortName: 'ICICI',
      cardTier: 'SAPPHIRO PREFERRED DEBIT',
      cardNetwork: 'visa',
      gradientColors: ['#58080C', '#991B1B', '#EA580C'],
      accentColor: '#FDBA74',
      textColor: '#FFFFFF',
      chipColor: '#FDE047',
      patternType: 'geometric',
    };
  }

  // 4. Axis Bank
  if (name.includes('axis')) {
    return {
      bankId: 'axis',
      bankName: 'AXIS BANK',
      shortName: 'AXIS',
      cardTier: 'PRIORITY PLATINUM DEBIT',
      cardNetwork: 'mastercard',
      gradientColors: ['#4A0417', '#881337', '#BE123C'],
      accentColor: '#FDA4AF',
      textColor: '#FFFFFF',
      chipColor: '#FDE047',
      patternType: 'geometric',
    };
  }

  // 5. Kotak Mahindra Bank
  if (name.includes('kotak')) {
    return {
      bankId: 'kotak',
      bankName: 'KOTAK MAHINDRA BANK',
      shortName: 'KOTAK',
      cardTier: 'PRIVY LEAGUE SIGNATURE',
      cardNetwork: 'visa',
      gradientColors: ['#18181B', '#7F1D1D', '#DC2626'],
      accentColor: '#FCA5A5',
      textColor: '#FFFFFF',
      chipColor: '#FDE047',
      patternType: 'mesh',
    };
  }

  // 6. Canara Bank
  if (name.includes('canara')) {
    return {
      bankId: 'canara',
      bankName: 'CANARA BANK',
      shortName: 'CANARA',
      cardTier: 'PLATINUM EMV DEBIT',
      cardNetwork: 'rupay',
      gradientColors: ['#00264D', '#0059B2', '#D97706'],
      accentColor: '#FDE047',
      textColor: '#FFFFFF',
      chipColor: '#FDE047',
      patternType: 'waves',
    };
  }

  // 7. Bank of Baroda (BOB)
  if (name.includes('baroda') || name.includes('bob')) {
    return {
      bankId: 'bob',
      bankName: 'BANK OF BARODA',
      shortName: 'BOB',
      cardTier: 'BOB WORLD EMV DEBIT',
      cardNetwork: 'mastercard',
      gradientColors: ['#1F1D2B', '#C2410C', '#EA580C'],
      accentColor: '#FED7AA',
      textColor: '#FFFFFF',
      chipColor: '#FDE047',
      patternType: 'geometric',
    };
  }

  // 8. IDFC FIRST Bank
  if (name.includes('idfc')) {
    return {
      bankId: 'idfc',
      bankName: 'IDFC FIRST Bank',
      shortName: 'IDFC FIRST',
      cardTier: 'FIRST WEALTH SIGNATURE',
      cardNetwork: 'visa',
      gradientColors: ['#3B0717', '#7F1D1D', '#991B1E'],
      accentColor: '#FCA5A5',
      textColor: '#FFFFFF',
      chipColor: '#FDE047',
      patternType: 'mesh',
    };
  }

  // 9. Punjab National Bank (PNB)
  if (name.includes('pnb') || name.includes('punjab')) {
    return {
      bankId: 'pnb',
      bankName: 'PUNJAB NATIONAL BANK',
      shortName: 'PNB',
      cardTier: 'PLATINUM CONTACTLESS',
      cardNetwork: 'rupay',
      gradientColors: ['#3F0013', '#831843', '#9D174D'],
      accentColor: '#FBCFE8',
      textColor: '#FFFFFF',
      chipColor: '#FDE047',
      patternType: 'waves',
    };
  }

  // 10. Union Bank of India
  if (name.includes('union')) {
    return {
      bankId: 'union',
      bankName: 'UNION BANK OF INDIA',
      shortName: 'UNION',
      cardTier: 'VYOM SIGNATURE DEBIT',
      cardNetwork: 'rupay',
      gradientColors: ['#001E3D', '#0054A6', '#0284C7'],
      accentColor: '#7DD3FC',
      textColor: '#FFFFFF',
      chipColor: '#FDE047',
      patternType: 'waves',
    };
  }

  // 11. IndusInd Bank
  if (name.includes('indusind')) {
    return {
      bankId: 'indusind',
      bankName: 'INDUSIND BANK',
      shortName: 'INDUSIND',
      cardTier: 'EXCLUSIVE WORLD DEBIT',
      cardNetwork: 'mastercard',
      gradientColors: ['#3B050B', '#65000B', '#831843'],
      accentColor: '#F472B6',
      textColor: '#FFFFFF',
      chipColor: '#FDE047',
      patternType: 'geometric',
    };
  }

  // 12. Federal Bank
  if (name.includes('federal')) {
    return {
      bankId: 'federal',
      bankName: 'FEDERAL BANK',
      shortName: 'FEDERAL',
      cardTier: 'CELSIO PLATINUM DEBIT',
      cardNetwork: 'visa',
      gradientColors: ['#002244', '#00427A', '#0284C7'],
      accentColor: '#93C5FD',
      textColor: '#FFFFFF',
      chipColor: '#FDE047',
      patternType: 'mesh',
    };
  }

  // 13. Cash / Wallet
  if (accountType === 'cash' || name.includes('cash') || name.includes('wallet')) {
    return {
      bankId: 'cash',
      bankName: 'CASH RESERVE',
      shortName: 'CASH',
      cardTier: 'LIQUID PHYSICAL ASSET',
      cardNetwork: 'pocketwise',
      gradientColors: ['#0F172A', '#1E293B', '#334155'],
      accentColor: '#94A3B8',
      textColor: '#FFFFFF',
      chipColor: '#E2E8F0',
      patternType: 'minimal',
    };
  }

  // 14. All Accounts Combined (Global Master Card)
  if (name === 'all accounts combined' || name === 'all accounts' || name === 'all') {
    return {
      bankId: 'all',
      bankName: 'POCKETWISE',
      shortName: 'COMBINED',
      cardTier: 'WORLD ELITE PORTFOLIO',
      cardNetwork: 'mastercard',
      gradientColors: ['#2E1065', '#581C87', '#7C3AED'],
      accentColor: '#DDD6FE',
      textColor: '#FFFFFF',
      chipColor: '#FDE047',
      patternType: 'mesh',
    };
  }

  // 15. Default / Custom User Added Bank (with user custom color if provided)
  const defaultGradient: [string, string, string] = customColor
    ? [customColor, customColor, '#0F172A']
    : ['#18181B', '#27272A', '#3F3F46'];

  return {
    bankId: 'custom',
    bankName: accountName ? accountName.toUpperCase() : 'DEBIT CARD',
    shortName: accountName ? accountName.slice(0, 10).toUpperCase() : 'BANK',
    cardTier: 'PLATINUM GLOBAL DEBIT',
    cardNetwork: 'visa',
    gradientColors: defaultGradient,
    accentColor: '#A1A1AA',
    textColor: '#FFFFFF',
    chipColor: '#FDE047',
    patternType: 'mesh',
  };
}
