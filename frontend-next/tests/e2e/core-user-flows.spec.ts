import { expect, test } from "@playwright/test";
import { setupStatefulAuthenticatedMocks } from "./helpers/stateful-mock-api";

test.describe("core user flows (mocked API)", () => {
  test("products: create and delete", async ({ page }) => {
    await setupStatefulAuthenticatedMocks(page);
    await page.goto("/products");

    await page.locator(".products-form-panel input").first().fill("Mleko E2E");
    await page.locator(".products-price-row input").fill("4.99");
    await page.locator(".products-unit-row input").fill("1000");
    await page.locator(".products-form-actions .btn-primary").click();

    await expect(page.locator(".product-row", { hasText: "Mleko E2E" })).toBeVisible({
      timeout: 15_000,
    });

    const row = page.locator(".product-row", { hasText: "Mleko E2E" });
    await row.getByRole("button", { name: /usuń|delete/i }).click();
    await page.getByRole("dialog").getByRole("button", { name: /usuń|delete/i }).click();

    await expect(page.locator(".product-row", { hasText: "Mleko E2E" })).toHaveCount(0);
  });

  test("recipes: lists seeded recipe", async ({ page }) => {
    await setupStatefulAuthenticatedMocks(page);
    await page.goto("/recipes");

    await expect(page.locator(".recipes-page")).toBeVisible();
    await expect(page.getByText("Kanapka testowa")).toBeVisible({ timeout: 15_000 });
  });

  test("calendar: drag recipe onto day slot", async ({ page }) => {
    await setupStatefulAuthenticatedMocks(page);
    await page.goto("/calendar");

    await expect(page.locator("#recipe-carousel")).toBeVisible({ timeout: 15_000 });
    const recipeCard = page.locator(".recipe-carousel > div").filter({
      hasText: "Kanapka testowa",
    });
    await expect(recipeCard).toBeVisible();

    const todayColumn = page.locator("#calendar-today");
    await expect(todayColumn).toBeVisible();
    await recipeCard.dragTo(todayColumn);

    await expect(todayColumn.getByText("Kanapka testowa")).toBeVisible({
      timeout: 15_000,
    });
  });
});
