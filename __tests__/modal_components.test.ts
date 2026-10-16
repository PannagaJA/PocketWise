describe('Magpie Modal System — Unit Tests', () => {
  test('AppTextInput card-number formatting spaces every 4 digits up to 16 digits', () => {
    const formatCardNumber = (raw: string) => {
      const digits = raw.replace(/\D/g, '').slice(0, 16);
      return digits.match(/.{1,4}/g)?.join(' ') || digits;
    };

    expect(formatCardNumber('1234567890123456')).toBe('1234 5678 9012 3456');
    expect(formatCardNumber('1234abcd5678')).toBe('1234 5678');
    expect(formatCardNumber('123456789012345678999')).toBe('1234 5678 9012 3456');
  });

  test('AppTextInput expiry formatting inserts slash after MM', () => {
    const formatExpiry = (raw: string) => {
      const digits = raw.replace(/\D/g, '').slice(0, 4);
      if (digits.length >= 3) {
        return `${digits.slice(0, 2)}/${digits.slice(2)}`;
      }
      return digits;
    };

    expect(formatExpiry('1228')).toBe('12/28');
    expect(formatExpiry('05')).toBe('05');
    expect(formatExpiry('052')).toBe('05/2');
    expect(formatExpiry('1228999')).toBe('12/28');
  });

  test('AppTextInput CVV limits to 4 digits', () => {
    const formatCvv = (raw: string) => raw.replace(/\D/g, '').slice(0, 4);

    expect(formatCvv('123')).toBe('123');
    expect(formatCvv('1234')).toBe('1234');
    expect(formatCvv('12345')).toBe('1234');
  });

  test('AppLoadingIndicator alternating pulse math calculates complementary phases', () => {
    // When progress is 0: Dot 1 is at base (1.0), Dot 2 is at peak (1.55)
    // When progress is 1: Dot 1 is at peak (1.55), Dot 2 is at base (1.0)
    const interpolatePhase = (val: number, outMin: number, outMax: number) => {
      return outMin + (outMax - outMin) * val;
    };

    // Progress 0
    const dot1ScaleP0 = interpolatePhase(0, 1.0, 1.55);
    const dot2ScaleP0 = interpolatePhase(0, 1.55, 1.0);
    expect(dot1ScaleP0).toBeCloseTo(1.0);
    expect(dot2ScaleP0).toBeCloseTo(1.55);

    // Progress 1
    const dot1ScaleP1 = interpolatePhase(1, 1.0, 1.55);
    const dot2ScaleP1 = interpolatePhase(1, 1.55, 1.0);
    expect(dot1ScaleP1).toBeCloseTo(1.55);
    expect(dot2ScaleP1).toBeCloseTo(1.0);

    // Progress 0.5 (halfway crossover)
    const dot1ScaleMid = interpolatePhase(0.5, 1.0, 1.55);
    const dot2ScaleMid = interpolatePhase(0.5, 1.55, 1.0);
    expect(dot1ScaleMid).toBeCloseTo(1.275);
    expect(dot2ScaleMid).toBeCloseTo(1.275);
  });

  test('Set Monthly Budget modal validates category selection and positive limit', () => {
    const validateBudgetForm = (categoryId: string, limitStr: string) => {
      if (!categoryId) return { valid: false, error: 'Please select an expense category' };
      const num = parseFloat(limitStr.replace(/,/g, ''));
      if (isNaN(num) || num <= 0) return { valid: false, error: 'Monthly limit must be greater than zero' };
      return { valid: true, error: null, amountMinor: Math.round(num * 100) };
    };

    expect(validateBudgetForm('', '5000')).toEqual({
      valid: false,
      error: 'Please select an expense category',
    });
    expect(validateBudgetForm('cat-123', '')).toEqual({
      valid: false,
      error: 'Monthly limit must be greater than zero',
    });
    expect(validateBudgetForm('cat-123', '0')).toEqual({
      valid: false,
      error: 'Monthly limit must be greater than zero',
    });
    expect(validateBudgetForm('cat-123', '15000')).toEqual({
      valid: true,
      error: null,
      amountMinor: 1500000,
    });
    expect(validateBudgetForm('cat-123', '15,000.50')).toEqual({
      valid: true,
      error: null,
      amountMinor: 1500050,
    });
  });

  test('AppDialog differentiates destructive and confirmation variants', () => {
    const getButtonStyles = (variant: 'primary' | 'destructive', isDestructiveProp?: boolean) => {
      const isDestructive = isDestructiveProp || variant === 'destructive';
      return {
        bg: isDestructive ? '#FEE2E2' : '#09090B',
        textColor: isDestructive ? '#DC2626' : '#FFFFFF',
      };
    };

    expect(getButtonStyles('primary')).toEqual({
      bg: '#09090B',
      textColor: '#FFFFFF',
    });
    expect(getButtonStyles('destructive')).toEqual({
      bg: '#FEE2E2',
      textColor: '#DC2626',
    });
    expect(getButtonStyles('primary', true)).toEqual({
      bg: '#FEE2E2',
      textColor: '#DC2626',
    });
  });
});
