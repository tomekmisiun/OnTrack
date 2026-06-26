import type { Page, Route } from "@playwright/test";

const API_ORIGIN = "http://localhost:5001";

const MOCK_USER = {
  id: 1,
  username: "e2e",
  lang: "pl",
  ui_locale: "pl",
  market_code: "PL",
};

const MOCK_MEMBERS = [
  {
    id: 1,
    name: "Primary",
    is_primary: true,
    gender: null,
    age: null,
    weight: null,
    height: null,
    activity: null,
    goal: null,
    macro_goals: null,
  },
];

type MockProduct = {
  id: number;
  name: string;
  package_weight: number;
  price: number;
  unit: string;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  sold_by_weight: boolean;
  lang: string;
  source: string;
  is_system: boolean;
  is_editable: boolean;
  base_product_id: number | null;
};

type MockRecipeSummary = {
  id: number;
  name: string;
  notes: string | null;
  is_favorite: boolean;
  total_cost: number;
  total_kcal: number;
  total_protein: number;
  total_fat: number;
  total_carbs: number;
  kcal_100g: number | null;
  protein_100g: number | null;
  fat_100g: number | null;
  carbs_100g: number | null;
  image_url: string | null;
  source_url: string | null;
  category: string | null;
  servings: number;
  lang: string;
};

type MockMeal = {
  id: number;
  date: string;
  position: number;
  recipe_id: number;
  member_id: number;
  recipe: {
    id: number;
    name: string;
    total_kcal: number;
    total_protein: number;
    total_fat: number;
    total_carbs: number;
    total_cost: number;
    image_url: string | null;
    source_url: string | null;
  };
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function recipeSummary(id: number, name: string): MockRecipeSummary {
  return {
    id,
    name,
    notes: null,
    is_favorite: false,
    total_cost: 4.5,
    total_kcal: 420,
    total_protein: 18,
    total_fat: 12,
    total_carbs: 55,
    kcal_100g: null,
    protein_100g: null,
    fat_100g: null,
    carbs_100g: null,
    image_url: null,
    source_url: null,
    category: null,
    servings: 1,
    lang: "pl",
  };
}

function mealFromRecipe(
  id: number,
  date: string,
  position: number,
  recipe: MockRecipeSummary,
  memberId = 1,
): MockMeal {
  return {
    id,
    date,
    position,
    recipe_id: recipe.id,
    member_id: memberId,
    recipe: {
      id: recipe.id,
      name: recipe.name,
      total_kcal: recipe.total_kcal,
      total_protein: recipe.total_protein,
      total_fat: recipe.total_fat,
      total_carbs: recipe.total_carbs,
      total_cost: recipe.total_cost,
      image_url: recipe.image_url,
      source_url: recipe.source_url,
    },
  };
}

export type StatefulMock = {
  products: MockProduct[];
  recipes: MockRecipeSummary[];
  mealsByDate: Record<string, MockMeal[]>;
};

export async function setupStatefulAuthenticatedMocks(page: Page): Promise<StatefulMock> {
  const state: StatefulMock = {
    products: [],
    recipes: [recipeSummary(1, "Kanapka testowa")],
    mealsByDate: {},
  };

  let nextProductId = 100;
  let nextRecipeId = 200;
  let nextMealId = 300;

  await page.route(`${API_ORIGIN}/api/**`, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    const method = request.method();

    if (method === "GET" && pathname === "/api/auth/me") {
      await json(route, MOCK_USER);
      return;
    }

    if (method === "GET" && pathname === "/api/members/") {
      await json(route, MOCK_MEMBERS);
      return;
    }

    if (method === "GET" && pathname.startsWith("/api/products")) {
      await json(route, {
        items: state.products,
        total: state.products.length,
        limit: 50,
        offset: 0,
      });
      return;
    }

    if (method === "POST" && pathname === "/api/products/") {
      const body = request.postDataJSON() as {
        name: string;
        package_weight: number;
        price: number;
        unit: string;
        sold_by_weight: boolean;
      };
      const product: MockProduct = {
        id: nextProductId++,
        name: body.name,
        package_weight: body.package_weight,
        price: body.price,
        unit: body.unit,
        kcal: null,
        protein: null,
        fat: null,
        carbs: null,
        sold_by_weight: body.sold_by_weight,
        lang: "pl",
        source: "user",
        is_system: false,
        is_editable: true,
        base_product_id: null,
      };
      state.products.push(product);
      await json(route, product, 201);
      return;
    }

    if (method === "PUT" && pathname.match(/^\/api\/products\/\d+$/)) {
      const id = Number(pathname.split("/").pop());
      const body = request.postDataJSON() as Partial<MockProduct>;
      const product = state.products.find((p) => p.id === id);
      if (!product) {
        await json(route, { error: "Not found" }, 404);
        return;
      }
      Object.assign(product, body);
      await json(route, product);
      return;
    }

    if (method === "DELETE" && pathname.match(/^\/api\/products\/\d+$/)) {
      const id = Number(pathname.split("/").pop());
      state.products = state.products.filter((p) => p.id !== id);
      await json(route, { ok: true });
      return;
    }

    if (method === "GET" && pathname === "/api/nutrition/lookup") {
      await json(route, { found: false, error: "not_found" });
      return;
    }

    if (method === "GET" && pathname === "/api/recipes/") {
      await json(route, state.recipes);
      return;
    }

    if (method === "POST" && pathname === "/api/recipes/") {
      const body = request.postDataJSON() as { name: string; servings: number };
      const recipe = recipeSummary(nextRecipeId++, body.name);
      recipe.servings = body.servings;
      state.recipes.push(recipe);
      await json(route, recipe, 201);
      return;
    }

    if (method === "GET" && pathname.match(/^\/api\/recipes\/\d+$/)) {
      const id = Number(pathname.split("/").pop());
      const summary = state.recipes.find((r) => r.id === id);
      if (!summary) {
        await json(route, { error: "Not found" }, 404);
        return;
      }
      await json(route, { ...summary, ingredients: [] });
      return;
    }

    if (method === "GET" && pathname.includes("/api/meal-plan/range/")) {
      await json(route, state.mealsByDate);
      return;
    }

    if (method === "GET" && pathname.match(/^\/api\/meal-plan\/\d{4}-\d{2}-\d{2}$/)) {
      const date = pathname.split("/").pop() ?? "";
      await json(route, state.mealsByDate[date] ?? []);
      return;
    }

    if (method === "POST" && pathname === "/api/meal-plan/") {
      const body = request.postDataJSON() as {
        date: string;
        position: number;
        recipe_id: number;
        member_id: number;
      };
      const recipe = state.recipes.find((r) => r.id === body.recipe_id);
      if (!recipe) {
        await json(route, { error: "Recipe not found" }, 404);
        return;
      }
      const meal = mealFromRecipe(
        nextMealId++,
        body.date,
        body.position,
        recipe,
        body.member_id,
      );
      const day = state.mealsByDate[body.date] ?? [];
      day.push(meal);
      state.mealsByDate[body.date] = day;
      await json(route, meal, 201);
      return;
    }

    if (method === "DELETE" && pathname.match(/^\/api\/meal-plan\/\d+$/)) {
      const id = Number(pathname.split("/").pop());
      for (const [date, meals] of Object.entries(state.mealsByDate)) {
        state.mealsByDate[date] = meals.filter((m) => m.id !== id);
      }
      await json(route, { ok: true });
      return;
    }

    if (method === "GET" && pathname.includes("/api/meal-plan/summary/")) {
      await json(route, { items: [], total_cost: 0 });
      return;
    }

    if (method === "GET" && pathname.startsWith("/api/day-schedule")) {
      await json(route, []);
      return;
    }

    if (method === "GET" && pathname.startsWith("/api/fuel/prices")) {
      await json(route, {});
      return;
    }

    await json(route, {});
  });

  await page.addInitScript(() => {
    localStorage.setItem("token", "e2e-test-token");
  });

  await page.context().addCookies([
    {
      name: "ontrack_has_token",
      value: "1",
      url: "http://127.0.0.1:3002",
    },
  ]);

  return state;
}
