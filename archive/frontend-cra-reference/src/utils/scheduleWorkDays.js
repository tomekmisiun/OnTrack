export const SCHEDULE_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const SCHEDULE_WEEKDAYS = [0, 1, 2, 3, 4];

export function sameDaySet(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

export function toggleScheduleDay(days, day) {
  const set = new Set(days);
  if (set.has(day)) {
    if (set.size <= 1) return days;
    set.delete(day);
  } else {
    set.add(day);
  }
  return [...set].sort((a, b) => a - b);
}

/** Klik preset gdy wszystkie jego dni są zaznaczone → odznacza je; inaczej dodaje. */
export function togglePresetDays(current, preset) {
  const allOn = preset.every(d => current.includes(d));
  if (allOn) {
    return current.filter(d => !preset.includes(d));
  }
  return [...new Set([...current, ...preset])].sort((a, b) => a - b);
}

export function isPresetActive(current, preset) {
  return preset.every(d => current.includes(d));
}
