import { describe, expect, it } from "vitest";
import { normalizeProductPage } from "@/lib/products/productPage";

const PRODUCT_PAGE_SIZE = 50;

describe("normalizeProductPage", () => {
  it("parses paginated response", () => {
    expect(
      normalizeProductPage({
        items: [{ id: 1 }],
        total: 10,
        limit: 20,
        offset: 0,
      }),
    ).toEqual({
      items: [{ id: 1 }],
      total: 10,
      limit: 20,
      offset: 0,
    });
  });

  it("wraps legacy array response", () => {
    const legacy = normalizeProductPage([{ id: 1 }, { id: 2 }]);
    expect(legacy.items).toHaveLength(2);
    expect(legacy.total).toBe(2);
  });

  it("returns empty page for invalid payload", () => {
    const empty = normalizeProductPage({});
    expect(empty.items).toEqual([]);
    expect(empty.limit).toBe(PRODUCT_PAGE_SIZE);
  });
});
