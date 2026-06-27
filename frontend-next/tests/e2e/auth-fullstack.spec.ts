import { expect, test } from "@playwright/test";
import { logoutFromWelcome, uniqueEmail, waitForWelcomePage } from "./helpers/auth-api";

test.describe("auth full-stack (real API)", () => {
  test("register, login session, protected route, refresh, logout", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const email = uniqueEmail();
    const password = "TestPass123!";

    await page.goto("/login");
    await page.getByRole("button", { name: /sign up|rejestracja/i }).click();
    await page.locator("#login-email").fill(email);
    await page.locator("#login-password").fill(password);
    await page
      .locator("form")
      .getByRole("button", { name: /sign up|rejestracja|create account|utwórz/i })
      .click();

    await expect(page).toHaveURL(/\/($|\?)/, { timeout: 15_000 });
    await waitForWelcomePage(page);

    await page.goto("/calendar");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("#recipe-carousel")).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("#recipe-carousel")).toBeVisible({
      timeout: 15_000,
    });

    await logoutFromWelcome(page);

    await page.goto("/calendar");
    await expect(page).toHaveURL(/\/login/);
    expect(new URL(page.url()).searchParams.get("next")).toBe("/calendar");
  });
});
