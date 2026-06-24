import { createAuthedApiClient } from "@/lib/api/auth";
import type { ApiSchema } from "@/lib/api/openapi-helpers";
import { normalizeProductPage } from "@/lib/products/productPage";
import {
  parseProduct,
  parseProductList,
  type Product,
} from "@/types/product";

type ProductCreateRequest = ApiSchema<"ProductCreateRequest">;
type ProductUpdateRequest = ApiSchema<"ProductUpdateRequest">;

export type ProductListParams = {
  q?: string;
  limit?: number;
  offset?: number;
};

export type ProductPage = {
  items: Product[];
  total: number;
  limit: number;
  offset: number;
};

function buildProductsPath(params?: ProductListParams): string {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return `/api/products/${qs ? `?${qs}` : ""}`;
}

function parseProductResponse(data: unknown): Product {
  const product = parseProduct(data);
  if (!product) {
    throw new Error("Invalid product response");
  }
  return product;
}

export async function listProducts(
  params?: ProductListParams,
): Promise<ProductPage> {
  const data = await createAuthedApiClient().get<unknown>(
    buildProductsPath(params),
  );
  const page = normalizeProductPage(data);
  return {
    items: parseProductList(page.items),
    total: page.total,
    limit: page.limit,
    offset: page.offset,
  };
}

export async function createProduct(
  body: ProductCreateRequest,
): Promise<Product> {
  const data = await createAuthedApiClient().post<unknown>(
    "/api/products/",
    body,
  );
  return parseProductResponse(data);
}

export async function updateProduct(
  id: number,
  body: ProductUpdateRequest,
): Promise<Product> {
  const data = await createAuthedApiClient().put<unknown>(
    `/api/products/${id}`,
    body,
  );
  return parseProductResponse(data);
}

export async function customizeProduct(
  id: number,
  body: ProductUpdateRequest,
): Promise<Product> {
  const data = await createAuthedApiClient().post<unknown>(
    `/api/products/${id}/customize`,
    body,
  );
  return parseProductResponse(data);
}

export async function deleteProduct(id: number): Promise<void> {
  await createAuthedApiClient().delete(`/api/products/${id}`);
}

export async function deleteAllProducts(): Promise<{ message: string }> {
  return createAuthedApiClient().delete<{ message: string }>(
    "/api/products/all",
  );
}
