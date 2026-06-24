export function parseTimePart(str) {
  const m = str.trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;

  const hour = parseInt(m[1], 10);
  const minute = m[2] != null ? parseInt(m[2], 10) : 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return { hour, minute };
}

function toStartHour({ hour }) {
  return hour;
}

function toEndHour({ hour, minute }) {
  if (minute === 0) return hour;
  return hour + 1;
}

function matchTimeRange(text) {
  const patterns = [
    /^(\d{1,2}(?::\d{2})?)\s*(?:do|–|—|to|-)\s*(\d{1,2}(?::\d{2})?)\s*(.*)?$/iu,
    /^(\d{1,2}(?::\d{2})?)\s+(\d{1,2}(?::\d{2})?)\s*(.*)?$/iu,
  ];

  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) return m;
  }
  return null;
}

/** Parsuje np. „7:30 12:00 praca”, „8 do 16 praca”, „16:15 -17”. */
export function parseScheduleBlockText(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const m = matchTimeRange(trimmed);
  if (!m) return null;

  const startPart = parseTimePart(m[1]);
  const endPart = parseTimePart(m[2]);
  if (!startPart || !endPart) return null;

  const start_hour = toStartHour(startPart);
  const end_hour = toEndHour(endPart);
  const label = (m[3] || '').trim();

  if (start_hour < 0 || start_hour > 23) return null;
  if (end_hour < 1 || end_hour > 24 || end_hour <= start_hour) return null;

  return {
    start_hour,
    end_hour,
    start_minute: startPart.minute,
    end_part_hour: endPart.hour,
    end_part_minute: endPart.minute,
    label,
  };
}

export function hourToTimeInputValue(hour, minute = 0) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseTimeInputStart(value) {
  if (!value) return null;
  const part = parseTimePart(value);
  if (!part) return null;
  return toStartHour(part);
}

export function parseTimeInputEnd(value) {
  if (!value) return null;
  const part = parseTimePart(value);
  if (!part) return null;
  const end = toEndHour(part);
  if (end < 1 || end > 24) return null;
  return end;
}

export function parseTimeInputPart(value) {
  if (!value) return null;
  return parseTimePart(value);
}

export function normalizeTimeInput(value) {
  const part = parseTimePart(value);
  if (!part) return null;
  return hourToTimeInputValue(part.hour, part.minute);
}

export function endHourToTimeInputValue(endHour, endPartHour = endHour, endPartMinute = 0) {
  if (endHour === 24 && endPartMinute === 0) return '24:00';
  return hourToTimeInputValue(endPartHour, endPartMinute);
}
