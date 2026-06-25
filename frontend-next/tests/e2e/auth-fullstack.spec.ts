import { expect, test } from "@playwright/test";

function uniqueUsername(): string {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

test.describe("auth full-stack (real API)", () => {
  test("register, login session, protected route, refresh, logout", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const username = uniqueUsername();
    const password = "TestPass123!";

    await page.goto("/login");
    await page.getByRole("button", { name: /sign up|rejestracja/i }).click();
    await page.locator("#login-username").fill(username);
    await page.locator("#login-password").fill(password);
    await page
      .locator("form")
      .getByRole("button", { name: /sign up|rejestracja|create account|utwórz/i })
      .click();

    await expect(page).toHaveURL(/\/($|\?)/, { timeout: 15_000 });
    await expect(page.locator(".welcome-page")).toBeVisible();

    await page.goto("/calendar");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("#recipe-carousel")).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto("/");
    await page.locator(".welcome-footer-btn--logout").click();

    await page.goto("/calendar");
    await expect(page).toHaveURL(/\/login/);
    expect(new URL(page.url()).searchParams.get("next")).toBe("/calendar");
  });
});
