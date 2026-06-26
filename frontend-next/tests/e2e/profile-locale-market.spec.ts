import { expect, test, type Page, type Route } from "@playwright/test";
import { setupAuthenticatedMocks } from "./helpers/mock-api";

const API_ORIGIN = "http://localhost:5001";

type MockUser = {
  id: number;
  username: string;
  lang: string;
  ui_locale: string;
  market_code: string;
};

async function setupProfileLocaleMocks(page: Page) {
  const user: MockUser = {
    id: 1,
    username: "e2e",
    lang: "pl",
    ui_locale: "pl",
    market_code: "PL",
  };

  await setupAuthenticatedMocks(page);

  await page.route(`${API_ORIGIN}/api/auth/**`, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    const method = request.method();

    if (method === "GET" && pathname === "/api/auth/me") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(user),
      });
      return;
    }

    if (method === "PATCH" && pathname === "/api/auth/language") {
      const body = request.postDataJSON() as { lang: string };
      user.lang = body.lang;
      user.ui_locale = body.lang;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(user),
      });
      return;
    }

    if (method === "PATCH" && pathname === "/api/auth/market") {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unexpected market change in locale test" }),
      });
      return;
    }

    await route.continue();
  });
}

test.describe("profile ui locale vs market", () => {
  test("changing UI language does not change product market", async ({ page }) => {
    await setupProfileLocaleMocks(page);
    await page.goto("/products");

    await page.getByRole("button", { name: /account|konto/i }).click();
    await expect(page.locator(".profile-modal")).toBeVisible();

    const marketPl = page.locator(".profile-lang-btn", { hasText: /Polska|Poland/i });
    await expect(marketPl).toHaveClass(/profile-lang-btn--active/);

    await page.locator(".profile-lang-btn", { hasText: /English|Angielski/i }).click();

    await expect(page.locator(".profile-lang-btn", { hasText: /English|Angielski/i })).toHaveClass(
      /profile-lang-btn--active/,
    );
    await expect(marketPl).toHaveClass(/profile-lang-btn--active/);
  });
});
