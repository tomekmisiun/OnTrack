import { createAuthedApiClient } from "@/lib/api/auth";
import type { ApiSchema } from "@/lib/api/openapi-helpers";
import {
  parseMeal,
  parseMealList,
  parseMealsByDate,
  type Meal,
  type MealsByDate,
} from "@/types/mealPlan";

type AddMealRequest = ApiSchema<"AddMealRequest">;
type CopyRangeRequest = ApiSchema<"CopyRangeRequest">;

function parseMealResponse(data: unknown): Meal {
  const meal = parseMeal(data);
  if (!meal) {
    throw new Error("Invalid meal response");
  }
  return meal;
}

function buildMemberParams(memberIds?: number[]): string {
  if (!memberIds?.length) return "";
  const search = new URLSearchParams();
  search.set("member_ids", memberIds.join(","));
  return `?${search.toString()}`;
}

function buildMemberIdParam(memberId?: number): string {
  if (memberId == null) return "";
  const search = new URLSearchParams();
  search.set("member_id", String(memberId));
  return `?${search.toString()}`;
}

export async function getDay(date: string, memberId?: number): Promise<Meal[]> {
  const data = await createAuthedApiClient().get<unknown>(
    `/api/meal-plan/${date}${buildMemberIdParam(memberId)}`,
  );
  return parseMealList(data);
}

export async function getRange(
  start: string,
  end: string,
  memberIds?: number[],
): Promise<MealsByDate> {
  const data = await createAuthedApiClient().get<unknown>(
    `/api/meal-plan/range/${start}/${end}${buildMemberParams(memberIds)}`,
  );
  return parseMealsByDate(data);
}

export async function addMeal(body: AddMealRequest): Promise<Meal> {
  const data = await createAuthedApiClient().post<unknown>(
    "/api/meal-plan/",
    body,
  );
  return parseMealResponse(data);
}

export async function deleteMeal(id: number): Promise<void> {
  await createAuthedApiClient().delete(`/api/meal-plan/${id}`);
}

export async function copyRange(
  body: CopyRangeRequest,
): Promise<{ message: string }> {
  return createAuthedApiClient().post<{ message: string }>(
    "/api/meal-plan/copy",
    body,
  );
}

export type MealPlanSummary = {
  items: Array<{
    product_name: string;
    total_weight: number;
    total_cost?: number;
  }>;
  total_cost: number;
};

export async function getSummary(
  start: string,
  end: string,
  memberIds?: number[],
): Promise<MealPlanSummary> {
  return createAuthedApiClient().get<MealPlanSummary>(
    `/api/meal-plan/summary/${start}/${end}${buildMemberParams(memberIds)}`,
  );
}
