import { describe, expect, it } from "vitest";
import {
  normalizeTimeInput,
  parseScheduleBlockText,
} from "@/lib/schedule/parseScheduleBlockText";

describe("parseScheduleBlockText", () => {
  it("parses Polish time ranges", () => {
    expect(parseScheduleBlockText("8 do 16 praca")).toEqual({
      start_hour: 8,
      end_hour: 16,
      start_minute: 0,
      end_part_hour: 16,
      end_part_minute: 0,
      label: "praca",
    });

    expect(parseScheduleBlockText("7:30 12:00 praca")).toEqual({
      start_hour: 7,
      end_hour: 12,
      start_minute: 30,
      end_part_hour: 12,
      end_part_minute: 0,
      label: "praca",
    });

    expect(parseScheduleBlockText("9:00 17:30 spotkanie")).toEqual({
      start_hour: 9,
      end_hour: 18,
      start_minute: 0,
      end_part_hour: 17,
      end_part_minute: 30,
      label: "spotkanie",
    });
  });

  it("rejects invalid input", () => {
    expect(parseScheduleBlockText("")).toBeNull();
    expect(parseScheduleBlockText("invalid")).toBeNull();
    expect(parseScheduleBlockText("25 do 30")).toBeNull();
  });

  it("normalizes time input", () => {
    expect(normalizeTimeInput("9")).toBe("09:00");
    expect(normalizeTimeInput("7:30")).toBe("07:30");
    expect(normalizeTimeInput("bad")).toBeNull();
  });
});
