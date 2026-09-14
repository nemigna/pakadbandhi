export const SESSION_IDS = [
  "morning",
  "afternoon",
  "evening",
  "night",
] as const;
export const dayNumber = (date: string) =>
  Date.parse(`${date}T00:00:00Z`) / 86400000;
export const isLocalDate = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  Number.isFinite(dayNumber(date)) &&
  new Date(dayNumber(date) * 86400000).toISOString().slice(0, 10) === date;
export const addDays = (date: string, count: number) =>
  new Date((dayNumber(date) + count) * 86400000).toISOString().slice(0, 10);
export function datesBetween(start: string, end: string) {
  if (
    !isLocalDate(start) ||
    !isLocalDate(end) ||
    end < start ||
    dayNumber(end) - dayNumber(start) > 89
  )
    return [];
  return Array.from({ length: dayNumber(end) - dayNumber(start) + 1 }, (_, i) =>
    addDays(start, i),
  );
}
export const dateLabel = (
  date: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
) =>
  new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
export const timeLabel = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
export const parseTime = (time: string) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(time) || time === "24:00"
    ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
    : NaN;
