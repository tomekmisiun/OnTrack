import type { Page, Route } from "@playwright/test";

const API_ORIGIN = "http://localhost:5001";

const MOCK_USER = {
  id: 1,
  username: "e2e",
  lang: "pl",
  ui_locale: "pl",
  market_code: "PL",
};

const MOCK_MEMBERS = [
  {
    id: 1,
    name: "Primary",
    is_primary: true,
    gender: null,
    age: null,
    weight: null,
    height: null,
    activity: null,
    goal: null,
    macro_goals: null,
  },
];

const EMPTY_PRODUCT_PAGE = {
  items: [] as unknown[],
  total: 0,
  limit: 50,
  offset: 0,
};

const EMPTY_SUMMARY = {
  items: [] as unknown[],
  total_cost: 0,
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function handleApiRoute(route: Route) {
  const request = route.request();
  if (!request.url().startsWith(`${API_ORIGIN}/api/`)) {
    await route.continue();
    return;
  }

  const url = new URL(request.url());
  const { pathname } = url;
  const method = request.method();

  if (method === "GET" && pathname === "/api/auth/me") {
    await json(route, MOCK_USER);
    return;
  }

  if (method === "GET" && pathname === "/api/members/") {
    await json(route, MOCK_MEMBERS);
    return;
  }

  if (method === "GET" && pathname.startsWith("/api/products")) {
    await json(route, EMPTY_PRODUCT_PAGE);
    return;
  }

  if (method === "GET" && pathname === "/api/recipes/") {
    await json(route, []);
    return;
  }

  if (method === "GET" && pathname.includes("/api/meal-plan/range/")) {
    await json(route, {});
    return;
  }

  if (method === "GET" && pathname.includes("/api/meal-plan/summary/")) {
    await json(route, EMPTY_SUMMARY);
    return;
  }

  if (method === "GET" && pathname.startsWith("/api/meal-plan/")) {
    await json(route, []);
    return;
  }

  if (method === "GET" && pathname.startsWith("/api/day-schedule")) {
    await json(route, []);
    return;
  }

  if (method === "GET" && pathname.startsWith("/api/fuel/prices")) {
    await json(route, {});
    return;
  }

  await json(route, {});
}

/** Mock FastAPI responses and seed a client-side session (no backend required). */
export async function setupAuthenticatedMocks(page: Page) {
  await page.route(`${API_ORIGIN}/api/**`, handleApiRoute);

  await page.addInitScript(() => {
    localStorage.setItem("token", "e2e-test-token");
  });

  await page.context().addCookies([
    {
      name: "ontrack_has_token",
      value: "1",
      url: "http://127.0.0.1:3002",
    },
  ]);
}
