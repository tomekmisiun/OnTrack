import { strict as assert } from "node:assert";

function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toEU(s) {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return dateToStr(d);
}

function getCurrentWeek() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dow = (now.getDay() + 6) % 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - dow);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: dateToStr(mon), end: dateToStr(sun) };
}

function getCurrentMonth() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: dateToStr(first), end: dateToStr(last) };
}

function getCalGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const start = new Date(firstDay);
  start.setDate(start.getDate() - ((firstDay.getDay() + 6) % 7));
  const end = new Date(lastDay);
  const endDow = (lastDay.getDay() + 6) % 7;
  if (endDow < 6) end.setDate(end.getDate() + (6 - endDow));
  const days = [];
  const c = new Date(start);
  while (c <= end) {
    days.push(new Date(c));
    c.setDate(c.getDate() + 1);
  }
  return days;
}

function getUpcomingMondays(count = 16) {
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

assert.equal(dateToStr(new Date(2026, 4, 23)), "2026-05-23");
assert.equal(toEU("2026-05-23"), "23.05.2026");
assert.equal(addDays("2026-05-23", 7), "2026-05-30");

const week = getCurrentWeek();
assert.match(week.start, /^\d{4}-\d{2}-\d{2}$/);
assert.match(week.end, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(addDays(week.start, 6), week.end);

const month = getCurrentMonth();
assert.ok(month.start <= month.end);

const grid = getCalGrid(2026, 4);
assert.ok(grid.length % 7 === 0);
assert.equal(dateToStr(grid[0]), "2026-04-27");
assert.equal(dateToStr(grid[grid.length - 1]), "2026-05-31");

const mondays = getUpcomingMondays(4);
assert.equal(mondays.length, 4);
for (const m of mondays) {
  const d = new Date(m);
  assert.equal((d.getDay() + 6) % 7, 0);
}

console.log("meal plan date helpers: ok");
