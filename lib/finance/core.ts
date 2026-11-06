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

export function toLocalDateString(dateInput?: string | Date | number): string {
  if (!dateInput) return '';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }
  const d = typeof dateInput === 'object' ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatRelativeDateTime(dateStr?: string, timestampStr?: string): string {
  if (!dateStr && !timestampStr) return '';

  const now = new Date();
  const nowYear = now.getFullYear();
  const todayStr = `${nowYear}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  const cleanDate = (dateStr || '').substring(0, 10);

  let timeStr = '';
  if (timestampStr) {
    try {
      const d = new Date(timestampStr);
      if (!isNaN(d.getTime())) {
        timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      }
    } catch {}
  }

  let dayLabel = '';
  if (cleanDate === todayStr) {
    dayLabel = 'Today';
  } else if (cleanDate === yesterdayStr) {
    dayLabel = 'Yesterday';
  } else if (cleanDate) {
    const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(cleanDate);
    if (ymdMatch) {
      const y = parseInt(ymdMatch[1], 10);
      const m = parseInt(ymdMatch[2], 10) - 1;
      const d = parseInt(ymdMatch[3], 10);
      const targetDate = new Date(y, m, d);
      const diffMs = now.getTime() - targetDate.getTime();
      const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

      if (diffDays >= 2 && diffDays <= 6) {
        dayLabel = targetDate.toLocaleDateString('en-US', { weekday: 'long' });
      } else if (y === nowYear) {
        dayLabel = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        dayLabel = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }
  }

  if (dayLabel && timeStr) {
    return `${dayLabel} • ${timeStr}`;
  }
  return dayLabel || timeStr || cleanDate;
}

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString.trim());
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
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
