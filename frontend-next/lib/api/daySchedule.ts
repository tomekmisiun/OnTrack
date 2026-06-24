import { createAuthedApiClient } from "@/lib/api/auth";
import type { ApiSchema } from "@/lib/api/openapi-helpers";
import {
  parseBulkCreateResult,
  parseScheduleBlock,
  parseScheduleBlockList,
  type BulkCreateResult,
  type ScheduleBlock,
} from "@/types/daySchedule";

type CreateBlockRequest = ApiSchema<"CreateBlockRequest">;
type CreateBulkRequest = ApiSchema<"CreateBulkRequest">;
type UpdateBlockRequest = ApiSchema<"UpdateBlockRequest">;

function parseBlockResponse(data: unknown): ScheduleBlock {
  const block = parseScheduleBlock(data);
  if (!block) {
    throw new Error("Invalid schedule block response");
  }
  return block;
}

function buildScheduleQuery(memberId: number, weekStart: string): string {
  const search = new URLSearchParams();
  search.set("member_id", String(memberId));
  search.set("week_start", weekStart);
  return `?${search.toString()}`;
}

export async function getAll(
  memberId: number,
  weekStart: string,
): Promise<ScheduleBlock[]> {
  const data = await createAuthedApiClient().get<unknown>(
    `/api/day-schedule/${buildScheduleQuery(memberId, weekStart)}`,
  );
  return parseScheduleBlockList(data);
}

export async function create(body: CreateBlockRequest): Promise<ScheduleBlock> {
  const data = await createAuthedApiClient().post<unknown>(
    "/api/day-schedule/",
    body,
  );
  return parseBlockResponse(data);
}

export async function createBulk(
  body: CreateBulkRequest,
): Promise<BulkCreateResult> {
  const data = await createAuthedApiClient().post<unknown>(
    "/api/day-schedule/bulk",
    body,
  );
  return parseBulkCreateResult(data);
}

export async function update(
  id: number,
  body: UpdateBlockRequest,
): Promise<ScheduleBlock> {
  const data = await createAuthedApiClient().patch<unknown>(
    `/api/day-schedule/${id}`,
    body,
  );
  return parseBlockResponse(data);
}

export async function deleteBlock(id: number): Promise<void> {
  await createAuthedApiClient().delete(`/api/day-schedule/${id}`);
}

export async function clearWeek(
  memberId: number,
  weekStart: string,
): Promise<{ deleted: number }> {
  return createAuthedApiClient().delete<{ deleted: number }>(
    `/api/day-schedule/week${buildScheduleQuery(memberId, weekStart)}`,
  );
}
