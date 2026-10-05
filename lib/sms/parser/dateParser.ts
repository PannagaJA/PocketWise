/**
 * Extracts and normalizes transaction dates from Indian bank SMS text.
 * Examples:
 * "On 23/09/26" -> ISO string for 2026-09-23
 * "On 04/10/26" -> ISO string for 2026-10-04
 * "on 11-09-2026" -> ISO string for 2026-09-11
 * "on 23-Sep-2026" -> ISO string for 2026-09-23
 * "2026-08-12 03:45:22" -> ISO string
 */
const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function extractTransactionDate(body: string, fallbackTimestamp?: number): string {
  if (!body) {
    return fallbackTimestamp ? new Date(fallbackTimestamp).toISOString() : new Date().toISOString();
  }

  // 1. Format: ISO-like YYYY-MM-DD or YYYY:MM:DD (e.g., 2026-08-12 03:45:22 or 2026:08:12 01:15:36)
  const isoMatch = /(?:on\s+)?(\d{4})[-/:](0[1-9]|1[0-2])[-/:](0[1-9]|[12]\d|3[01])(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/i.exec(body);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const hours = isoMatch[4] ? parseInt(isoMatch[4], 10) : 12;
    const mins = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
    const d = new Date(Date.UTC(year, month, day, hours, mins));
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }

  // 2. Format: DD-Mon-YY or DD-Mon-YYYY (e.g., 23-Sep-26, 23 Sep 2026, 04-OCT-26)
  const monNameMatch = /(?:on|dated|dt:?)\s*(0?[1-9]|[12]\d|3[01])[-/\s]([A-Za-z]{3})[-/\s](\d{2,4})/i.exec(body);
  if (monNameMatch) {
    const day = parseInt(monNameMatch[1], 10);
    const monStr = monNameMatch[2].toLowerCase();
    let year = parseInt(monNameMatch[3], 10);
    if (year < 100) year += 2000;

    if (monStr in MONTH_MAP) {
      const month = MONTH_MAP[monStr];
      const d = new Date(Date.UTC(year, month, day, 12, 0));
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
    }
  }

  // 3. Format: DD/MM/YY or DD/MM/YYYY or DD-MM-YY or DD-MM-YYYY (e.g. On 23/09/26, On 04/10/26, 11-09-2026)
  const ddmmyyMatch = /(?:on|dated|date|dt:?)\s*(0?[1-9]|[12]\d|3[01])[/.-](0?[1-9]|1[0-2])[/.-](\d{2,4})/i.exec(body);
  if (ddmmyyMatch) {
    const day = parseInt(ddmmyyMatch[1], 10);
    const month = parseInt(ddmmyyMatch[2], 10) - 1;
    let year = parseInt(ddmmyyMatch[3], 10);
    if (year < 100) year += 2000;

    const d = new Date(Date.UTC(year, month, day, 12, 0));
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }

  // Fallback to provided timestamp or current date
  if (fallbackTimestamp) {
    const d = new Date(fallbackTimestamp);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }

  return new Date().toISOString();
}
