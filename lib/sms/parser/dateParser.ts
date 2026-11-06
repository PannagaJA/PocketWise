/**
 * Extracts and normalizes transaction dates and times from Indian bank SMS text.
 * Handles diverse date formats (DD-MM-YY, DD/MM/YYYY, DD-Mon-YY, YYYY-MM-DD)
 * and time formats (10:24 AM, 14:35:22, at 10:24, 09:15 hrs).
 * Preserves the exact message date and time, and cleanly falls back to SMS reception
 * arrival timestamp (not detection/opening time).
 */
const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

interface ParsedTime {
  hours: number;
  minutes: number;
  seconds: number;
}

function extractTime(body: string, fallbackHours?: number): ParsedTime | null {
  // Strip out full dates (e.g., 2026:11:02 or 2026-11-02) so "11:02" isn't mistaken for a time
  const cleanBody = body.replace(/20\d{2}[-/:](?:0[1-9]|1[0-2])[-/:](?:0[1-9]|[12]\d|3[01])/g, '');

  // Matches "10:24 AM", "10:24:15 PM", "14:35:22", "14:35", "at 10:24:15", "10:24 hrs", "10:24:15 IST", "02:30pm"
  const timeRegex = /(?:\b(?:at|time:?|on)\s+)?\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\s*(am|pm|hrs|hours|ist)?\b/i;
  const match = timeRegex.exec(cleanBody);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  const meridiem = match[4]?.toLowerCase();

  if (meridiem === 'pm' && hours < 12) {
    hours += 12;
  } else if (meridiem === 'am' && hours === 12) {
    hours = 0;
  } else if (!meridiem && fallbackHours !== undefined && fallbackHours >= 12 && hours < 12) {
    // Shorthand 12-hour bank time without AM/PM (e.g. Bank of Baroda "08:26:33" received at 8:27 PM)
    if (Math.abs(fallbackHours - (hours + 12)) <= 2) {
      hours += 12;
    }
  }

  return { hours, minutes, seconds };
}

interface ParsedDate {
  year: number;
  month: number; // 0-indexed
  day: number;
}

function extractDate(body: string, defaultYear: number): ParsedDate | null {
  // 1. Format: ISO YYYY-MM-DD or YYYY/MM/DD or YYYY:MM:DD (e.g., 2026-08-12, 2026:08:12)
  const isoMatch = /(?:\b(?:on|dated|dt:?|date:?)\s+)?\b(20\d{2})[-/:](0[1-9]|1[0-2])[-/:](0[1-9]|[12]\d|3[01])\b/i.exec(body);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10) - 1,
      day: parseInt(isoMatch[3], 10),
    };
  }

  // 2. Format: DD-Mon-YY or DD-Mon-YYYY or DD Mon YYYY or DD Mon (e.g. 23-Sep-26, 23 Sep 2026, 04-OCT-26, 4 Nov 2026, 04-Nov)
  const monNameMatch = /(?:\b(?:on|dated|dt:?|date:?)\s+)?\b(0?[1-9]|[12]\d|3[01])[-/\s]([A-Za-z]{3,9})[-/\s]?(20\d{2}|\d{2})?\b/i.exec(body);
  if (monNameMatch) {
    const day = parseInt(monNameMatch[1], 10);
    const monStr = monNameMatch[2].toLowerCase();
    let year = monNameMatch[3] ? parseInt(monNameMatch[3], 10) : defaultYear;
    if (year < 100) year += 2000;

    const prefix3 = monStr.substring(0, 3);
    if (prefix3 in MONTH_MAP) {
      return {
        year,
        month: MONTH_MAP[prefix3],
        day,
      };
    }
  }

  // 3. Format: Mon DD, YYYY or Mon DD (e.g. Nov 04, 2026, Nov 4)
  const monFirstMatch = /(?:\b(?:on|dated|dt:?|date:?)\s+)?\b([A-Za-z]{3,9})\s+(0?[1-9]|[12]\d|3[01])(?:,?\s*(20\d{2}|\d{2}))?\b/i.exec(body);
  if (monFirstMatch) {
    const monStr = monFirstMatch[1].toLowerCase();
    const day = parseInt(monFirstMatch[2], 10);
    let year = monFirstMatch[3] ? parseInt(monFirstMatch[3], 10) : defaultYear;
    if (year < 100) year += 2000;

    const prefix3 = monStr.substring(0, 3);
    if (prefix3 in MONTH_MAP) {
      return {
        year,
        month: MONTH_MAP[prefix3],
        day,
      };
    }
  }

  // 4. Format: DD/MM/YY or DD/MM/YYYY or DD-MM-YY or DD-MM-YYYY or DD.MM.YY or DD.MM.YYYY
  // (e.g. On 23/09/26, On 04/10/26, 04-11-26, 11-09-2026, 04.11.26)
  const ddmmyyMatch = /(?:\b(?:on|dated|date|dt:?)\s+)?\b(0?[1-9]|[12]\d|3[01])[/.-](0?[1-9]|1[0-2])[/.-](20\d{2}|\d{2})\b/i.exec(body);
  if (ddmmyyMatch) {
    const day = parseInt(ddmmyyMatch[1], 10);
    const month = parseInt(ddmmyyMatch[2], 10) - 1;
    let year = parseInt(ddmmyyMatch[3], 10);
    if (year < 100) year += 2000;

    return {
      year,
      month,
      day,
    };
  }

  return null;
}

export function extractTransactionDate(body: string, fallbackTimestamp?: number): string {
  const fallback = (fallbackTimestamp && fallbackTimestamp > 0 && !isNaN(fallbackTimestamp))
    ? new Date(fallbackTimestamp)
    : new Date();

  if (!body) {
    return fallback.toISOString();
  }

  const parsedTime = extractTime(body, fallback.getHours());
  const parsedDate = extractDate(body, fallback.getFullYear());

  const year = parsedDate ? parsedDate.year : fallback.getFullYear();
  const month = parsedDate ? parsedDate.month : fallback.getMonth();
  const day = parsedDate ? parsedDate.day : fallback.getDate();

  const hours = parsedTime ? parsedTime.hours : fallback.getHours();
  const minutes = parsedTime ? parsedTime.minutes : fallback.getMinutes();
  const seconds = parsedTime ? parsedTime.seconds : fallback.getSeconds();

  const d = new Date(year, month, day, hours, minutes, seconds);
  if (isNaN(d.getTime())) {
    return fallback.toISOString();
  }

  return d.toISOString();
}
