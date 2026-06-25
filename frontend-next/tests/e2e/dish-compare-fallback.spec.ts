import { expect, test } from "@playwright/test";

/**
 * Login DishCompare must render without a reachable FastAPI instance.
 * The Next.js route handler falls back to bundled JSON when upstream fails.
 * Do not mock /api/public/dish-compare — this verifies the real route + fallback.
 */
test.describe("dish compare fallback", () => {
  test("login page shows compare widget when backend is unavailable", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.locator(".dish-compare-widget")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator(".dish-compare-tab").first()).toBeVisible();
    await expect(page.locator(".dish-compare-panel--diy")).toBeVisible();
  });
});
