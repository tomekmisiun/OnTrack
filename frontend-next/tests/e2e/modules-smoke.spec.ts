import { expect, test } from "@playwright/test";
import { setupAuthenticatedMocks } from "./helpers/mock-api";

const MODULES = [
  {
    path: "/",
    tab: null as string | null,
    marker: ".welcome-page",
    home: true,
  },
  {
    path: "/macro",
    tab: "macro",
    marker: ".card .card-section-title",
    home: false,
  },
  {
    path: "/calendar",
    tab: "calendar",
    marker: "#recipe-carousel",
    home: false,
  },
  {
    path: "/schedule",
    tab: "schedule",
    marker: ".schedule-page",
    home: false,
  },
  {
    path: "/recipes",
    tab: "recipes",
    marker: ".recipes-page",
    home: false,
  },
  {
    path: "/products",
    tab: "products",
    marker: ".products-page",
    home: false,
  },
  {
    path: "/summary",
    tab: "summary",
    marker: ".card",
    home: false,
  },
  {
    path: "/export",
    tab: "export",
    marker: ".export-section-head",
    home: false,
  },
] as const;

test.describe("logged-in module smoke", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);
  });

  for (const mod of MODULES) {
    test(`${mod.path} loads for authenticated user`, async ({ page }) => {
      await page.goto(mod.path);

      await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
      await expect(page.locator(mod.marker).first()).toBeVisible({
        timeout: 15_000,
      });

      if (mod.home) {
        await expect(page.locator(".app--home")).toBeVisible();
        return;
      }

      await expect(page.locator("aside.app-sidebar")).toBeVisible();
      await expect(page.locator(`[data-tour="tab-${mod.tab}"]`)).toHaveClass(
        /active/,
      );
    });
  }
});
