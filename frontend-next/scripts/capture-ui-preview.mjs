import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../../assets/ui-preview");
const baseURL = process.env.PREVIEW_BASE_URL ?? "http://127.0.0.1:3000";
const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001";

const MOCK_USER = {
  id: 1,
  username: "preview",
  lang: "pl",
  ui_locale: "pl",
  market_code: "PL",
};

const MOCK_PRODUCTS = {
  items: [
    {
      id: 1,
      name: "banan 7zł",
      package_weight: 1000,
      price: 7,
      unit: "g",
      kcal: 89,
      protein: 1.1,
      fat: 0.3,
      carbs: 22.8,
      sold_by_weight: false,
      lang: "pl",
      source: "catalog",
      is_system: true,
      is_editable: false,
      base_product_id: null,
    },
    {
      id: 2,
      name: "banan",
      package_weight: 100,
      price: 0,
      unit: "g",
      kcal: 89,
      protein: 1.1,
      fat: 0.3,
      carbs: 22.8,
      sold_by_weight: false,
      lang: "pl",
      source: "catalog",
      is_system: true,
      is_editable: false,
      base_product_id: null,
    },
    {
      id: 3,
      name: "ananas",
      package_weight: 1000,
      price: 12.5,
      unit: "g",
      kcal: 50,
      protein: 0.5,
      fat: 0.1,
      carbs: 13.1,
      sold_by_weight: false,
      lang: "pl",
      source: "catalog",
      is_system: true,
      is_editable: false,
      base_product_id: null,
    },
  ],
  total: 3,
  limit: 50,
  offset: 0,
};

const MOCK_RECIPES = [
  {
    id: 1,
    name: "Chipsy Jabłkowe z Frytkownicy Powietrznej",
    notes: null,
    is_favorite: false,
    total_cost: 1.54,
    total_kcal: 139,
    total_protein: 6.2,
    total_fat: 3.2,
    total_carbs: 23.6,
    kcal_100g: null,
    protein_100g: null,
    fat_100g: null,
    carbs_100g: null,
    image_url: null,
    source_url: "https://example.com/recipe",
    category: "deser",
    servings: 1,
    lang: "pl",
  },
  {
    id: 2,
    name: "Falafel na zapas",
    notes: null,
    is_favorite: true,
    total_cost: 8.2,
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
    category: "obiad",
    servings: 4,
    lang: "pl",
  },
  {
    id: 3,
    name: "Gulasz z kurczakiem w stylu pot pie",
    notes: null,
    is_favorite: false,
    total_cost: 14.9,
    total_kcal: 512,
    total_protein: 42,
    total_fat: 18,
    total_carbs: 38,
    kcal_100g: null,
    protein_100g: null,
    fat_100g: null,
    carbs_100g: null,
    image_url: null,
    source_url: null,
    category: "obiad",
    servings: 2,
    lang: "pl",
  },
];

async function handleApiRoute(route) {
  const request = route.request();
  if (!request.url().startsWith(`${apiOrigin}/api/`)) {
    await route.continue();
    return;
  }

  const url = new URL(request.url());
  const { pathname } = url;
  const method = request.method();
  const json = (body, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  if (method === "GET" && pathname === "/api/auth/me") return json(MOCK_USER);
  if (method === "GET" && pathname === "/api/members/") return json([{ id: 1, name: "Primary", is_primary: true }]);
  if (method === "GET" && pathname.startsWith("/api/products")) return json(MOCK_PRODUCTS);
  if (method === "GET" && pathname === "/api/recipes/") return json(MOCK_RECIPES);
  if (method === "GET" && pathname.includes("/api/meal-plan/range/")) return json({});
  if (method === "GET" && pathname.includes("/api/meal-plan/summary/")) return json({ items: [], total_cost: 0 });
  if (method === "GET" && pathname.startsWith("/api/meal-plan/")) return json([]);
  if (method === "GET" && pathname.startsWith("/api/day-schedule")) return json([]);
  if (method === "GET" && pathname.startsWith("/api/fuel/prices")) return json({});
  return json({});
}

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: "pl-PL",
});
const page = await context.newPage();

await page.route(`${apiOrigin}/api/**`, handleApiRoute);
await page.addInitScript(() => {
  localStorage.setItem("token", "preview-token");
});
await context.addCookies([
  { name: "ontrack_has_token", value: "1", url: baseURL },
]);

for (const [path, name, selector] of [
  ["/schedule", "schedule-form", ".schedule-work-card"],
  ["/products", "products-form", ".products-form-panel"],
]) {
  await page.goto(`${baseURL}${path}`);
  await page.waitForSelector(selector, { timeout: 60_000 });
  await page.waitForTimeout(800);
  const file = join(outDir, `${name}-1440x900.png`);
  await page.locator(selector).screenshot({ path: file });
  console.log(`saved ${file}`);
}

await browser.close();
