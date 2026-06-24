import { createApiClient } from "@/lib/api/client";
import { ApiError, errorMessageFromBody } from "@/lib/api/errors";
import type {
  ApiSchema,
  TokenResponse,
} from "@/lib/api/openapi-helpers";
import { isBffEnabled } from "@/lib/bff/config";
import { getStoredToken } from "@/lib/auth/storage";

type LoginRequest = ApiSchema<"LoginRequest">;
type RegisterRequest = ApiSchema<"RegisterRequest">;
type ExchangeRequest = ApiSchema<"ExchangeRequest">;
type LanguageRequest = ApiSchema<"LanguageRequest">;

let unauthorizedHandler: (() => void) | undefined;

export function setUnauthorizedHandler(handler: (() => void) | undefined): void {
  unauthorizedHandler = handler;
}

export function createAuthedApiClient() {
  return createApiClient({
    getToken: getStoredToken,
    onUnauthorized: () => unauthorizedHandler?.(),
  });
}

const publicClient = createApiClient();

async function sessionRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
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

  if (response.status === 401 && unauthorizedHandler) {
    unauthorizedHandler();
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

export function login(username: string, password: string): Promise<TokenResponse> {
  if (isBffEnabled()) {
    return sessionRequest<TokenResponse>("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", username, password }),
    }).then(() => ({ token: "" }));
  }

  const body: LoginRequest = { username, password };
  return publicClient.post<TokenResponse>("/api/auth/login", body);
}

export function register(data: RegisterRequest): Promise<TokenResponse> {
  if (isBffEnabled()) {
    return sessionRequest<TokenResponse>("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "register", ...data }),
    }).then(() => ({ token: "" }));
  }

  return publicClient.post<TokenResponse>("/api/auth/register", data);
}

export function exchangeCode(code: string): Promise<TokenResponse> {
  if (isBffEnabled()) {
    return sessionRequest<TokenResponse>("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "exchange", code }),
    }).then(() => ({ token: "" }));
  }

  const body: ExchangeRequest = { code };
  return publicClient.post<TokenResponse>("/api/auth/exchange", body);
}

export function fetchMeRaw(): Promise<unknown> {
  if (isBffEnabled()) {
    return sessionRequest<unknown>("/api/auth/session", { method: "GET" });
  }
  return createAuthedApiClient().get<unknown>("/api/auth/me");
}

export function changeLanguage(lang: string): Promise<unknown> {
  const body: LanguageRequest = { lang };
  if (isBffEnabled()) {
    return sessionRequest<unknown>("/api/auth/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  return createAuthedApiClient().patch<unknown>("/api/auth/language", body);
}

export function deleteAccountApi() {
  return createAuthedApiClient().delete<{ message: string }>("/api/auth/me");
}

export function logoutSession(): Promise<void> {
  if (!isBffEnabled()) return Promise.resolve();
  return sessionRequest<{ ok: true }>("/api/auth/session", {
    method: "DELETE",
  }).then(() => undefined);
}

export function googleAuthUrl(lang: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:5001";
  return `${base}/api/auth/google?lang=${encodeURIComponent(lang)}`;
}
