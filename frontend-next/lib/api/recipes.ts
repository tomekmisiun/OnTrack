import { createAuthedApiClient } from "@/lib/api/auth";
import type { ApiSchema } from "@/lib/api/openapi-helpers";
import {
  parseRecipe,
  parseRecipeSummary,
  parseRecipeSummaryList,
  type Recipe,
  type RecipeSummary,
} from "@/types/recipe";

type RecipeCreateRequest = ApiSchema<"RecipeCreateRequest">;
type RecipeUpdateRequest = ApiSchema<"RecipeUpdateRequest">;
type RecipeCategoryRequest = ApiSchema<"RecipeCategoryRequest">;

function parseRecipeResponse(data: unknown): Recipe {
  const recipe = parseRecipe(data);
  if (!recipe) {
    throw new Error("Invalid recipe response");
  }
  return recipe;
}

function parseRecipeSummaryResponse(data: unknown): RecipeSummary {
  const summary = parseRecipeSummary(data);
  if (!summary) {
    throw new Error("Invalid recipe summary response");
  }
  return summary;
}

export type RecipeListParams = {
  ownOnly?: boolean;
};

function buildRecipesPath(params?: RecipeListParams): string {
  if (!params?.ownOnly) return "/api/recipes/";
  return "/api/recipes/?own_only=true";
}

export async function listRecipes(params?: RecipeListParams): Promise<RecipeSummary[]> {
  const data = await createAuthedApiClient().get<unknown>(buildRecipesPath(params));
  return parseRecipeSummaryList(data);
}

export async function countOwnRecipes(): Promise<number> {
  const items = await listRecipes({ ownOnly: true });
  return items.length;
}

export async function getRecipe(id: number): Promise<Recipe> {
  const data = await createAuthedApiClient().get<unknown>(`/api/recipes/${id}`);
  return parseRecipeResponse(data);
}

export async function createRecipe(
  body: RecipeCreateRequest,
): Promise<RecipeSummary> {
  const data = await createAuthedApiClient().post<unknown>(
    "/api/recipes/",
    body,
  );
  return parseRecipeSummaryResponse(data);
}

export async function updateRecipe(
  id: number,
  body: RecipeUpdateRequest,
): Promise<Recipe> {
  const data = await createAuthedApiClient().put<unknown>(
    `/api/recipes/${id}`,
    body,
  );
  return parseRecipeResponse(data);
}

export async function deleteRecipe(id: number): Promise<void> {
  await createAuthedApiClient().delete(`/api/recipes/${id}`);
}

export async function deleteAllRecipes(): Promise<{ message: string }> {
  return createAuthedApiClient().delete<{ message: string }>(
    "/api/recipes/all",
  );
}

export async function toggleFavorite(id: number): Promise<void> {
  await createAuthedApiClient().patch<unknown>(`/api/recipes/${id}/favorite`);
}

export async function updateCategory(
  id: number,
  category: string | null,
): Promise<void> {
  const body: RecipeCategoryRequest = { category };
  await createAuthedApiClient().patch<unknown>(
    `/api/recipes/${id}/category`,
    body,
  );
}

export async function fetchRecipeImage(
  id: number,
): Promise<{ image_url: string | null }> {
  return createAuthedApiClient().post<{ image_url: string | null }>(
    `/api/recipes/${id}/fetch-image`,
  );
}
