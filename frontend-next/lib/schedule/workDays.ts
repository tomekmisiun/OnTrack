export const SCHEDULE_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export const SCHEDULE_WEEKDAYS = [0, 1, 2, 3, 4] as const;

export function sameDaySet(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

export function toggleScheduleDay(days: number[], day: number): number[] {
  const set = new Set(days);
  if (set.has(day)) {
    if (set.size <= 1) return days;
    set.delete(day);
  } else {
    set.add(day);
  }
  return [...set].sort((a, b) => a - b);
}

/** Toggle preset: if all preset days are selected, deselect them; otherwise add them. */
export function togglePresetDays(
  current: number[],
  preset: readonly number[],
): number[] {
  const allOn = preset.every((d) => current.includes(d));
  if (allOn) {
    return current.filter((d) => !preset.includes(d));
  }
  return [...new Set([...current, ...preset])].sort((a, b) => a - b);
}

export function isPresetActive(
  current: number[],
  preset: readonly number[],
): boolean {
  return preset.every((d) => current.includes(d));
}
