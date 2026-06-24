import { expect, test } from "@playwright/test";
import { setupAuthenticatedMocks } from "./helpers/mock-api";
import { prepareVisualPage, stabilizeLoginMedia, waitForScreenReady } from "./helpers/visual";

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "375x812", width: 375, height: 812 },
] as const;

const AUTH_SCREENS = [
  { path: "/", marker: ".welcome-page", name: "home" },
  { path: "/macro", marker: ".card", name: "macro" },
  { path: "/calendar", marker: "#recipe-carousel", name: "calendar" },
  { path: "/schedule", marker: ".schedule-page", name: "schedule" },
  { path: "/recipes", marker: ".recipes-page", name: "recipes" },
  { path: "/products", marker: ".products-page", name: "products" },
  { path: "/summary", marker: ".card", name: "summary" },
  { path: "/export", marker: ".export-section-head", name: "export" },
] as const;

test.describe.configure({ mode: "serial" });

for (const viewport of VIEWPORTS) {
  test.describe(`viewport ${viewport.name}`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
    });

    test("login", async ({ page }) => {
      await prepareVisualPage(page);
      await page.goto("/login");
      await expect(page.locator("#login-username")).toBeVisible();
      await stabilizeLoginMedia(page);
      await expect(page).toHaveScreenshot(`login-${viewport.name}.png`, {
        fullPage: true,
      });
    });

    test.describe("authenticated", () => {
      test.beforeEach(async ({ page }) => {
        await setupAuthenticatedMocks(page);
        await prepareVisualPage(page, { authenticated: true });
      });

      for (const screen of AUTH_SCREENS) {
        test(screen.name, async ({ page }) => {
          await page.goto(screen.path);
          await expect(page).not.toHaveURL(/\/login/);
          await expect(page.locator(screen.marker).first()).toBeVisible({
            timeout: 15_000,
          });
          await waitForScreenReady(page, screen.name);
          await expect(page).toHaveScreenshot(
            `${screen.name}-${viewport.name}.png`,
            { fullPage: true },
          );
        });
      }
    });
  });
}
