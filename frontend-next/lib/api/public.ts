import type { LangCode } from "@/lib/i18n/translations";

export type DishCompareIngredient = {
  product_name: string;
  weight: number;
  unit: string;
  cost: number;
};

export type DishCompareDish = {
  id: string;
  name: string;
  portion_note: string;
  diy_cost: number;
  ingredients: DishCompareIngredient[];
  defaults?: {
    avg_restaurant_price?: number;
    price_note?: string;
  };
};

export type DishCompareResponse = {
  lang?: LangCode | string;
  currency?: string;
  dishes: DishCompareDish[];
  default_delivery_price?: number;
  meal_prep?: {
    avg_hourly_wage?: number;
  };
};

/** Unauthenticated public endpoint for login page marketing widget. */
export async function getDishCompare(
  lang: LangCode | string = "pl",
): Promise<DishCompareResponse> {
  const params = new URLSearchParams({ lang: String(lang) });
  const res = await fetch(`/api/public/dish-compare?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`dish-compare failed: ${res.status}`);
  }
  return res.json() as Promise<DishCompareResponse>;
}
