// Timestamps are stored as ISO-8601 UTC strings. The diary groups them by
// calendar day in this time zone, never UTC: dinner after 21:00 in Argentina
// is already the next day in UTC.
export const APP_TIME_ZONE = "America/Argentina/Buenos_Aires";
const LOCALE = "es-AR";

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar day in the app time zone, as "YYYY-MM-DD". */
export function dayKey(date: Date | string): string {
  return dayKeyFormat.format(new Date(date));
}

/** The value if it's a real "YYYY-MM-DD" day, otherwise null. */
export function parseDayKey(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : null;
}

/** Shifts a "YYYY-MM-DD" key by whole days. Pure calendar math, no time zone involved. */
export function addDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Hoy", "Ayer", "Mañana", or a short date like "vie 2 oct". */
export function formatDayLabel(key: string, today: string): string {
  if (key === today) return "Hoy";
  if (key === addDays(today, -1)) return "Ayer";
  if (key === addDays(today, 1)) return "Mañana";
  return new Date(`${key}T12:00:00Z`).toLocaleDateString(LOCALE, {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: key.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
  });
}

/** Time of day in the app time zone, e.g. "13:45". */
export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString(LOCALE, {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

/** Formats a date as a `datetime-local` value in the device's time zone. */
export function toLocalInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
