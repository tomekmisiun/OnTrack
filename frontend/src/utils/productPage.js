export const PRODUCT_PAGE_SIZE = 50;

/** Normalize list API response (paginated envelope or legacy array). */
export function normalizeProductPage(data) {
  if (Array.isArray(data)) {
    return { items: data, total: data.length, limit: data.length, offset: 0 };
  }
  return {
    items: data?.items || [],
    total: data?.total ?? 0,
    limit: data?.limit ?? PRODUCT_PAGE_SIZE,
    offset: data?.offset ?? 0,
  };
}

export function apiErrorMessage(err, fallback = '') {
  return err?.response?.data?.error || fallback;
}
