export const MONTH_NAMES_PL = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
] as const;

/** Date → 'YYYY-MM-DD' */
export function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 'YYYY-MM-DD' → 'DD.MM.YYYY' */
export function toEU(s: string): string {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

/** 'YYYY-MM-DD' + n → 'YYYY-MM-DD' */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return dateToStr(d);
}

/** Monday and Sunday of the current week */
export function getCurrentWeek(): { start: string; end: string } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dow = (now.getDay() + 6) % 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - dow);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: dateToStr(mon), end: dateToStr(sun) };
}

/** First and last day of the current month */
export function getCurrentMonth(): { start: string; end: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: dateToStr(first), end: dateToStr(last) };
}

/**
 * Calendar grid: Date[] from Monday before the first day
 * through Sunday after the last day of the month.
 */
export function getCalGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const start = new Date(firstDay);
  start.setDate(start.getDate() - ((firstDay.getDay() + 6) % 7));
  const end = new Date(lastDay);
  const endDow = (lastDay.getDay() + 6) % 7;
  if (endDow < 6) end.setDate(end.getDate() + (6 - endDow));
  const days: Date[] = [];
  const c = new Date(start);
  while (c <= end) {
    days.push(new Date(c));
    c.setDate(c.getDate() + 1);
  }
  return days;
}

/** Next N Mondays (from current/previous week start) */
export function getUpcomingMondays(count = 16): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    return dateToStr(d);
  });
}
