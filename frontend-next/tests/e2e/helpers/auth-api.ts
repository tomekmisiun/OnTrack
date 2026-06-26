import type { APIRequestContext, Page } from "@playwright/test";

const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:5001";

export function uniqueUsername(): string {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function registerUser(
  request: APIRequestContext,
  username: string,
  password: string,
  lang = "pl",
): Promise<void> {
  const res = await request.post(`${apiUrl}/api/auth/register`, {
    data: { username, password, lang },
  });
  if (!res.ok()) {
    throw new Error(`register failed: ${res.status()} ${await res.text()}`);
  }
}

export async function loginUser(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<string> {
  const res = await request.post(`${apiUrl}/api/auth/login`, {
    data: { username, password },
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
