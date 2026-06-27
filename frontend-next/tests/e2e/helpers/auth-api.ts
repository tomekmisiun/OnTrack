import { expect, type APIRequestContext, type Page } from "@playwright/test";

const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:5001";

export function uniqueEmail(): string {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export async function registerUser(
  request: APIRequestContext,
  email: string,
  password: string,
  lang = "pl",
): Promise<void> {
  const res = await request.post(`${apiUrl}/api/auth/register`, {
    data: { email, password, lang },
  });
  if (!res.ok()) {
    throw new Error(`register failed: ${res.status()} ${await res.text()}`);
  }
}

export async function loginUser(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const res = await request.post(`${apiUrl}/api/auth/login`, {
    data: { email, password },
  });
  if (!res.ok()) {
    throw new Error(`login failed: ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error("login response missing token");
  return body.token;
}

export async function getPrimaryMemberId(
  request: APIRequestContext,
  token: string,
): Promise<number> {
  const res = await request.get(`${apiUrl}/api/members/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) {
    throw new Error(`members failed: ${res.status()} ${await res.text()}`);
  }
  const members = (await res.json()) as Array<{ id: number; is_primary?: boolean }>;
  const primary = members.find((m) => m.is_primary) ?? members[0];
  if (!primary) throw new Error("no household member after register");
  return primary.id;
}

export async function getFirstRecipeId(
  request: APIRequestContext,
  token: string,
): Promise<number> {
  const res = await request.get(`${apiUrl}/api/recipes/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) {
    throw new Error(`recipes failed: ${res.status()} ${await res.text()}`);
  }
  const recipes = (await res.json()) as Array<{ id: number }>;
  const first = recipes[0];
  if (!first) throw new Error("no recipes in catalog for e2e user");
  return first.id;
}

export async function addMealViaApi(
  request: APIRequestContext,
  token: string,
  body: {
    date: string;
    position: number;
    recipe_id: number;
    member_id: number;
  },
): Promise<void> {
  const res = await request.post(`${apiUrl}/api/meal-plan/`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
  if (!res.ok() && res.status() !== 200) {
    throw new Error(`add meal failed: ${res.status()} ${await res.text()}`);
  }
}

export async function seedTokenInBrowser(page: Page, token: string): Promise<void> {
  await page.goto("/login");
  await page.evaluate((t) => {
    localStorage.setItem("token", t);
    document.cookie = "ontrack_has_token=1; path=/; max-age=604800; SameSite=Lax";
  }, token);
}

/** Wait until auth bootstrap finishes and the welcome shell is interactive. */
export async function waitForWelcomePage(page: Page): Promise<void> {
  await expect(page.locator(".welcome-page")).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("button", { name: /log out|wyloguj/i }),
  ).toBeVisible({ timeout: 10_000 });
}

/** Navigate home and log out via the welcome footer (real API session). */
export async function logoutFromWelcome(page: Page): Promise<void> {
  await page.goto("/");
  await waitForWelcomePage(page);
  await page.getByRole("button", { name: /log out|wyloguj/i }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
}
