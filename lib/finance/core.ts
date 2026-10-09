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
  if (!amountString || amountString.trim().startsWith('-')) return 0;
  const cleanString = amountString.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleanString);
  if (isNaN(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100);
}

export function parseSignedMoneyToMinor(amountString: string): number {
  if (!amountString) return 0;
  const isNegative = amountString.trim().startsWith('-');
  const cleanString = amountString.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleanString);
  if (isNaN(parsed)) return 0;
  const minor = Math.round(parsed * 100);
  return isNegative ? -minor : minor;
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

export function formatDateTime(dateString: string): string {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = (Math.random() * 256) | 0;
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // RFC4122 version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC4122 variant 10xx

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
