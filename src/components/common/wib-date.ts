/**
 * Shared WIB (Asia/Jakarta) date formatting and day-boundary helpers
 * for Server Components so UTC/server-local timezones never shift dates.
 */

export const WIB_TIME_ZONE = "Asia/Jakarta";

export interface WibDateParts {
  year: number;
  month: number;
  day: number;
  key: string;
}

/** Extract `YYYY`, `MM`, `DD`, and `YYYY-MM-DD` key in Asia/Jakarta time. */
export function getWibDateParts(date: Date): WibDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: WIB_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const yearStr = parts.find((p) => p.type === "year")?.value ?? "1970";
  const monthStr = parts.find((p) => p.type === "month")?.value ?? "01";
  const dayStr = parts.find((p) => p.type === "day")?.value ?? "01";

  return {
    year: Number.parseInt(yearStr, 10),
    month: Number.parseInt(monthStr, 10),
    day: Number.parseInt(dayStr, 10),
    key: `${yearStr}-${monthStr}-${dayStr}`,
  };
}

/** Start of calendar day (00:00:00.000+07:00) for a given `YYYY-MM-DD` WIB key. */
export function wibStartOfDayFromKey(key: string): Date {
  return new Date(`${key}T00:00:00+07:00`);
}

/** End of calendar day (23:59:59.999+07:00) for a given `YYYY-MM-DD` WIB key. */
export function wibEndOfDayFromKey(key: string): Date {
  return new Date(`${key}T23:59:59.999+07:00`);
}

/** Monday 00:00:00+07:00 of the current WIB week. */
export function wibStartOfWeek(date: Date): Date {
  const { key } = getWibDateParts(date);
  const weekdayShort = new Intl.DateTimeFormat("en-US", {
    timeZone: WIB_TIME_ZONE,
    weekday: "short",
  }).format(date);
  const offsetMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const daysSinceMonday = offsetMap[weekdayShort] ?? 0;
  const startToday = wibStartOfDayFromKey(key);
  return new Date(startToday.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
}

/** First day of the current WIB month (00:00:00+07:00). */
export function wibStartOfMonth(date: Date): Date {
  const { year, month } = getWibDateParts(date);
  const mm = String(month).padStart(2, "0");
  return new Date(`${year}-${mm}-01T00:00:00+07:00`);
}

/** Format a date in Indonesian locale locked to Asia/Jakarta timezone. */
export function formatWibDate(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  },
): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    ...options,
    timeZone: WIB_TIME_ZONE,
  }).format(d);
}
