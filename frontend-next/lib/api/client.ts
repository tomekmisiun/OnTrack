import { getApiBaseUrl } from "@/lib/config/env";
import { isBffEnabled } from "@/lib/bff/config";
import { ApiError, errorMessageFromBody } from "@/lib/api/errors";

export type ApiClientOptions = {
  /** Optional Bearer token provider (e.g. localStorage in a later auth task). */
  getToken?: () => string | null;
  /** Called on HTTP 401 before the error is thrown. */
  onUnauthorized?: () => void;
};

export type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

function buildUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;

  if (isBffEnabled()) {
    const apiPath = normalized.startsWith("/api/")
      ? normalized.slice("/api/".length)
      : normalized.slice(1);
    return `/api/bff/${apiPath}`;
  }

  const base = getApiBaseUrl();
  return `${base}${normalized}`;
}

export function createApiClient(options: ApiClientOptions = {}) {
  async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    const { body, headers: initHeaders, ...rest } = init;
    const headers = new Headers(initHeaders);

    if (body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const token = isBffEnabled() ? null : options.getToken?.();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(buildUrl(path), {
      ...rest,
      headers,
      credentials: isBffEnabled() ? "include" : rest.credentials,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401 && options.onUnauthorized) {
      options.onUnauthorized();
    }

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

  return {
    request,
    get: <T>(path: string, init?: RequestOptions) =>
      request<T>(path, { ...init, method: "GET" }),
    post: <T>(path: string, body?: unknown, init?: RequestOptions) =>
      request<T>(path, { ...init, method: "POST", body }),
    put: <T>(path: string, body?: unknown, init?: RequestOptions) =>
      request<T>(path, { ...init, method: "PUT", body }),
    patch: <T>(path: string, body?: unknown, init?: RequestOptions) =>
      request<T>(path, { ...init, method: "PATCH", body }),
    delete: <T>(path: string, init?: RequestOptions) =>
      request<T>(path, { ...init, method: "DELETE" }),
  };
}

/** Default client without auth hooks — extended in a later auth migration task. */
export const apiClient = createApiClient();
