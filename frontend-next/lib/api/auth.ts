import { createApiClient } from "@/lib/api/client";
import type {
  ApiSchema,
  TokenResponse,
} from "@/lib/api/openapi-helpers";
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

export function login(username: string, password: string): Promise<TokenResponse> {
  const body: LoginRequest = { username, password };
  return publicClient.post<TokenResponse>("/api/auth/login", body);
}

export function register(data: RegisterRequest): Promise<TokenResponse> {
  return publicClient.post<TokenResponse>("/api/auth/register", data);
}

export function exchangeCode(code: string): Promise<TokenResponse> {
  const body: ExchangeRequest = { code };
  return publicClient.post<TokenResponse>("/api/auth/exchange", body);
}

export function fetchMeRaw(): Promise<unknown> {
  return createAuthedApiClient().get<unknown>("/api/auth/me");
}

export function changeLanguage(lang: string): Promise<unknown> {
  const body: LanguageRequest = { lang };
  return createAuthedApiClient().patch<unknown>("/api/auth/language", body);
}

export function deleteAccountApi() {
  return createAuthedApiClient().delete<{ message: string }>("/api/auth/me");
}

export function googleAuthUrl(lang: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:5001";
  return `${base}/api/auth/google?lang=${encodeURIComponent(lang)}`;
}
