import { describe, expect, it } from "vitest";
import {
  addDays,
  dateToStr,
  getCalGrid,
  getCurrentMonth,
  getCurrentWeek,
  getUpcomingMondays,
  toEU,
} from "@/lib/dates";

describe("dates", () => {
  it("formats and shifts dates", () => {
    expect(dateToStr(new Date(2026, 4, 23))).toBe("2026-05-23");
    expect(toEU("2026-05-23")).toBe("23.05.2026");
    expect(addDays("2026-05-23", 7)).toBe("2026-05-30");
  });

  it("returns current week boundaries", () => {
    const week = getCurrentWeek();
    expect(week.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(week.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(addDays(week.start, 6)).toBe(week.end);
  });

  it("returns current month boundaries", () => {
    const month = getCurrentMonth();
    expect(month.start <= month.end).toBe(true);
  });

  it("builds calendar grid for May 2026", () => {
    const grid = getCalGrid(2026, 4);
    expect(grid.length % 7).toBe(0);
    expect(dateToStr(grid[0]!)).toBe("2026-04-27");
    expect(dateToStr(grid[grid.length - 1]!)).toBe("2026-05-31");
  });

  it("lists upcoming Mondays", () => {
    const mondays = getUpcomingMondays(4);
    expect(mondays).toHaveLength(4);
    for (const m of mondays) {
      const d = new Date(m);
      expect((d.getDay() + 6) % 7).toBe(0);
    }
  });
});
