import { createAuthedApiClient } from "@/lib/api/auth";
import { ApiError, errorMessageFromBody } from "@/lib/api/errors";
import { getStoredToken } from "@/lib/auth/storage";
import { getApiBaseUrl } from "@/lib/config/env";

async function postFormData<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);

  const headers = new Headers();
  const token = getStoredToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  const text = await response.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      errorMessageFromBody(parsed, response.statusText || "Request failed"),
      response.status,
      parsed,
    );
  }

  return parsed as T;
}

export type ImportParseResponse = {
  items: unknown[];
  remaining_today?: number;
};

export async function parseImportAI(file: File): Promise<ImportParseResponse> {
  return postFormData<ImportParseResponse>("/api/import/parse", file);
}

export async function parseImportFree(file: File): Promise<ImportParseResponse> {
  return postFormData<ImportParseResponse>("/api/import/parse-free", file);
}

export type ImportPriceUpdate = {
  product_id: number;
  price: number;
};

export async function applyImportPrices(
  updates: ImportPriceUpdate[],
): Promise<{ message: string }> {
  return createAuthedApiClient().post<{ message: string }>(
    "/api/import/apply",
    { updates },
  );
}
