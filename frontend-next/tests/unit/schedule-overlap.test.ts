import { describe, expect, it } from "vitest";
import { hasBlockOverlap } from "@/lib/schedule/overlap";
import type { ScheduleBlock } from "@/types/daySchedule";

const blocks: ScheduleBlock[] = [
  {
    id: 1,
    day: 1,
    start_hour: 9,
    end_hour: 12,
    label: "Praca",
    week_start: "2026-05-18",
    member_id: 1,
  },
];

describe("hasBlockOverlap", () => {
  it("detects overlapping intervals on same day", () => {
    expect(hasBlockOverlap(blocks, 1, 10, 13)).toBe(true);
    expect(hasBlockOverlap(blocks, 1, 12, 14)).toBe(false);
    expect(hasBlockOverlap(blocks, 2, 9, 12)).toBe(false);
  });

  it("excludes block by id when editing", () => {
    expect(hasBlockOverlap(blocks, 1, 9, 12, 1)).toBe(false);
  });
});
