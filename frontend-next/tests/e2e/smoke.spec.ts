import { expect, test } from "@playwright/test";

test.describe("auth smoke", () => {
  test("login page renders credential form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#login-username")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();
    await expect(
      page.locator("form").getByRole("button", { name: /sign in|zaloguj/i }),
    ).toBeVisible();
  });

  test("protected route redirects to login", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page).toHaveURL(/\/login/);
    expect(new URL(page.url()).searchParams.get("next")).toBe("/calendar");
  });

  test("login page is reachable without session cookie", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.ok()).toBe(true);
  });
});
