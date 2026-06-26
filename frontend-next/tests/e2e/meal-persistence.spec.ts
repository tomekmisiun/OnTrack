import { expect, test } from "@playwright/test";
import {
  addMealViaApi,
  getFirstRecipeId,
  getPrimaryMemberId,
  loginUser,
  registerUser,
  seedTokenInBrowser,
  uniqueUsername,
} from "./helpers/auth-api";

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

test.describe("meal calendar persistence (real API)", () => {
  test("saved meal survives reload and re-login", async ({ page, request }) => {
    test.setTimeout(90_000);
    const username = uniqueUsername();
    const password = "TestPass123!";
    const mealDate = todayIso();

    await registerUser(request, username, password);
    const token = await loginUser(request, username, password);
    const memberId = await getPrimaryMemberId(request, token);
    const recipeId = await getFirstRecipeId(request, token);

    await addMealViaApi(request, token, {
      date: mealDate,
      position: 1,
      recipe_id: recipeId,
      member_id: memberId,
    });

    const recipesRes = await request.get(
      `${process.env.E2E_API_URL ?? "http://127.0.0.1:5001"}/api/recipes/${recipeId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(recipesRes.ok()).toBeTruthy();
    const recipe = (await recipesRes.json()) as { name: string };
    const recipeName = recipe.name;
    expect(recipeName.length).toBeGreaterThan(0);

    await seedTokenInBrowser(page, token);
    await page.goto("/calendar");
    await expect(page.locator("#recipe-carousel")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(recipeName, { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(recipeName, { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/");
    await page.locator(".welcome-footer-btn--logout").click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    await page.getByRole("button", { name: /log in|zaloguj/i }).click();
    await page.locator("#login-username").fill(username);
    await page.locator("#login-password").fill(password);
    await page
      .locator("form")
      .getByRole("button", { name: /log in|zaloguj/i })
      .click();

    await expect(page).toHaveURL(/\/($|\?)/, { timeout: 15_000 });
    await page.goto("/calendar");
    await expect(page.getByText(recipeName, { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
