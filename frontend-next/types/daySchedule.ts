export type ScheduleBlock = {
  id: number;
  member_id: number;
  week_start: string;
  day: number;
  start_hour: number;
  end_hour: number;
  label: string;
};

export type ParsedScheduleBlock = {
  start_hour: number;
  end_hour: number;
  start_minute: number;
  end_part_hour: number;
  end_part_minute: number;
  label: string;
};

export type BulkCreateResult = {
  created: ScheduleBlock[];
  skipped: number[];
};

function num(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export function parseScheduleBlock(data: unknown): ScheduleBlock | null {
  if (typeof data !== "object" || data === null) return null;
  const o = data as Record<string, unknown>;
  const id = num(o.id);
  const member_id = num(o.member_id);
  const week_start = str(o.week_start);
  const day = num(o.day);
  const start_hour = num(o.start_hour);
  const end_hour = num(o.end_hour);
  const label = str(o.label);
  if (
    id == null ||
    member_id == null ||
    !week_start ||
    day == null ||
    start_hour == null ||
    end_hour == null ||
    label == null
  ) {
    return null;
  }
  return { id, member_id, week_start, day, start_hour, end_hour, label };
}

export function parseScheduleBlockList(data: unknown): ScheduleBlock[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => parseScheduleBlock(item))
    .filter((item): item is ScheduleBlock => item !== null);
}

export function parseBulkCreateResult(data: unknown): BulkCreateResult {
  if (typeof data !== "object" || data === null) {
    return { created: [], skipped: [] };
  }
  const o = data as Record<string, unknown>;
  const created = parseScheduleBlockList(o.created);
  const skipped = Array.isArray(o.skipped)
    ? o.skipped.filter((d): d is number => typeof d === "number")
    : [];
  return { created, skipped };
}

export function sortScheduleBlocks(blocks: ScheduleBlock[]): ScheduleBlock[] {
  return [...blocks].sort(
    (a, b) => a.day - b.day || a.start_hour - b.start_hour,
  );
}
