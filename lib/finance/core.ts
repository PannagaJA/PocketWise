export function formatMoney(amountInMinor: number, currency: string = 'INR'): string {
  const amount = amountInMinor / 100;
  if (currency === 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseMoneyToMinor(amountString: string): number {
  const cleanString = amountString.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleanString);
  if (isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

export function addMoney(a: number, b: number): number {
  return a + b;
}

export function subtractMoney(a: number, b: number): number {
  return a - b;
}

export function formatDate(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
