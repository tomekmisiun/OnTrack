import type { ScheduleBlock } from "@/types/daySchedule";

export function hasBlockOverlap(
  blocks: ScheduleBlock[],
  day: number,
  startHour: number,
  endHour: number,
  excludeId: number | null = null,
): boolean {
  return blocks.some(
    (b) =>
      b.id !== excludeId &&
      b.day === day &&
      startHour < b.end_hour &&
      endHour > b.start_hour,
  );
}
