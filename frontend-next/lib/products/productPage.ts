import { ApiError, errorMessageFromBody } from "@/lib/api/errors";

export const PRODUCT_PAGE_SIZE = 50;

export type NormalizedProductPage = {
  items: unknown[];
  total: number;
  limit: number;
  offset: number;
};

/** Normalize list API response (paginated envelope or legacy array). */
export function normalizeProductPage(data: unknown): NormalizedProductPage {
  if (Array.isArray(data)) {
    return { items: data, total: data.length, limit: data.length, offset: 0 };
  }
  if (typeof data === "object" && data !== null) {
    const row = data as Record<string, unknown>;
    return {
      items: Array.isArray(row.items) ? row.items : [],
      total: typeof row.total === "number" ? row.total : 0,
      limit:
        typeof row.limit === "number" ? row.limit : PRODUCT_PAGE_SIZE,
      offset: typeof row.offset === "number" ? row.offset : 0,
    };
  }
  return { items: [], total: 0, limit: PRODUCT_PAGE_SIZE, offset: 0 };
}

export function apiErrorMessage(err: unknown, fallback = ""): string {
  if (err instanceof ApiError) {
    return errorMessageFromBody(err.body, fallback);
  }
  return fallback;
}
