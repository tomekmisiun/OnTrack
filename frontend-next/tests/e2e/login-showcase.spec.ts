import { expect, test } from "@playwright/test";

const SHOWCASE_IDS = [
  "macro",
  "calendar",
  "schedule",
  "recipes",
  "products",
  "summary",
  "export",
] as const;

test.describe("login showcase parity", () => {
  test("renders feature sections and demo media", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator(".login-page")).toBeVisible();
    await expect(page.locator(".features-list")).toBeVisible();

    for (const id of SHOWCASE_IDS) {
      await expect(page.locator(`#feature-${id}`)).toBeVisible();
      await expect(
        page.locator(`#feature-${id} .feature-demo source`),
      ).toHaveAttribute("src", new RegExp(`/demos/${id}\\.(pl|en)\\.webm`));
    }

    await expect(page.locator(".dish-compare-cta")).toBeVisible();
    await expect(page.locator(".login-panel-inner")).toBeVisible();
  });
});
