import { expect, test } from "@playwright/test";
import { uniqueEmail } from "./helpers/auth-api";

const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:5001";

test.describe("auth negative full-stack (real API)", () => {
  test("login shows error for wrong password", async ({ page, request }) => {
    const email = uniqueEmail();
    const password = "TestPass123!";

    const register = await request.post(`${apiUrl}/api/auth/register`, {
      data: { email, password, lang: "pl" },
    });
    expect(register.status()).toBe(201);

    await page.goto("/login");
    await page.locator("#login-email").fill(email);
    await page.locator("#login-password").fill("WrongPass123!");
    await page
      .locator("form")
      .getByRole("button", { name: /sign in|zaloguj/i })
      .click();

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await expect(page.locator(".login-error")).toBeVisible();
    await expect(page.locator(".login-error")).toContainText(
      /invalid email|nieprawidłowy adres e-mail/i,
    );
  });

  test("register shows error for duplicate email", async ({ page, request }) => {
    const email = uniqueEmail();
    const password = "TestPass123!";

    const first = await request.post(`${apiUrl}/api/auth/register`, {
      data: { email, password, lang: "pl" },
    });
    expect(first.status()).toBe(201);

    await page.goto("/login");
    await page.getByRole("button", { name: /sign up|rejestracja/i }).click();
    await page.locator("#login-email").fill(email);
    await page.locator("#login-password").fill(password);
    await page
      .locator("form")
      .getByRole("button", { name: /sign up|rejestracja|create account|utwórz/i })
      .click();

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await expect(page.locator(".login-error")).toBeVisible();
    await expect(page.locator(".login-error")).toContainText(
      /already registered|rejestracja nie powiodła/i,
    );
  });
});
