import { createApiClient } from "@/lib/api/client";
import { getApiBaseUrl } from "@/lib/config/env";
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
type MarketRequest = { market_code: string };
type PasswordChangeRequest = ApiSchema<"PasswordChangeRequest">;

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

export function login(email: string, password: string): Promise<TokenResponse> {
  if (isBffEnabled()) {
    return sessionRequest<TokenResponse>("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", email, password }),
    }).then(() => ({ token: "" }));
  }

  const body: LoginRequest = { email, password };
  return publicClient.post<TokenResponse>("/api/auth/login", body);
}

export function register(data: {
  email: string;
  password: string;
  lang: string;
}): Promise<TokenResponse> {
  if (isBffEnabled()) {
    return sessionRequest<TokenResponse>("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "register", ...data }),
    }).then(() => ({ token: "" }));
  }

  const body: RegisterRequest = data;
  return publicClient.post<TokenResponse>("/api/auth/register", body);
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

export function refreshAccessToken(): Promise<TokenResponse> {
  if (isBffEnabled()) {
    return sessionRequest<TokenResponse>("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refresh" }),
    }).then(() => ({ token: "" }));
  }
  return createAuthedApiClient().post<TokenResponse>("/api/auth/refresh");
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

export function changeMarket(marketCode: string): Promise<unknown> {
  const body: MarketRequest = { market_code: marketCode };
  if (isBffEnabled()) {
    return sessionRequest<unknown>("/api/auth/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, target: "market" }),
    });
  }
  return createAuthedApiClient().patch<unknown>("/api/auth/market", body);
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  const body: PasswordChangeRequest = {
    current_password: currentPassword,
    new_password: newPassword,
  };
  if (isBffEnabled()) {
    return sessionRequest<{ message: string }>("/api/auth/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, target: "password" }),
    });
  }
  return createAuthedApiClient().patch<{ message: string }>(
    "/api/auth/password",
    body,
  );
}

export function deleteAccountApi() {
  return createAuthedApiClient().delete<{ message: string }>("/api/auth/me");
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return publicClient.post<{ message: string }>("/api/auth/forgot-password", {
    email,
  });
}

export function resetPassword(
  token: string,
  newPassword: string,
): Promise<TokenResponse> {
  return publicClient.post<TokenResponse>("/api/auth/reset-password", {
    token,
    new_password: newPassword,
  });
}

export function logoutSession(): Promise<void> {
  if (!isBffEnabled()) return Promise.resolve();
  return sessionRequest<{ ok: true }>("/api/auth/session", {
    method: "DELETE",
  }).then(() => undefined);
}

export function googleAuthUrl(lang: string): string {
  const base = getApiBaseUrl();
  return `${base}/api/auth/google?lang=${encodeURIComponent(lang)}`;
}

export async function fetchGoogleOAuthEnabled(): Promise<boolean> {
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/health`);
    if (!res.ok) return false;
    const data = (await res.json()) as {
      status?: string;
      google_oauth?: boolean;
    };
    return data.google_oauth === true;
  } catch {
    return false;
  }
}
