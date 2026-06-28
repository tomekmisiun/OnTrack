import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/public/dish-compare/route";

describe("GET /api/public/dish-compare", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns upstream JSON when FastAPI responds OK", async () => {
    const upstream = {
      dishes: [{ id: "upstream_dish", defaults: { price: 10 } }],
    };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(upstream),
    } as Response);

    const request = new NextRequest(
      "http://localhost:3000/api/public/dish-compare?lang=pl",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(upstream);
  });

  it("returns bundled fallback when upstream is unreachable", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

    const request = new NextRequest(
      "http://localhost:3000/api/public/dish-compare?lang=pl",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.dishes.length).toBeGreaterThan(0);
    expect(data.dishes[0]?.id).toBe("pizza_margherita");
  });

  it("returns bundled fallback when upstream responds with error status", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);

    const request = new NextRequest(
      "http://localhost:3000/api/public/dish-compare?lang=en",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.dishes[0]?.portion_note).toMatch(/demo/i);
  });
});
