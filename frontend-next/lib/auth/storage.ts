import {
  clearSessionCookie,
  setSessionCookie,
} from "@/lib/auth/session-cookie";
import { isBffEnabled } from "@/lib/bff/config";

export const TOKEN_STORAGE_KEY = "token";
export const PENDING_LANG_STORAGE_KEY = "pending_lang";

export function getStoredToken(): string | null {
  if (isBffEnabled()) return null;
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  if (isBffEnabled()) return;
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  setSessionCookie();
}

export function clearStoredToken(): void {
  if (isBffEnabled()) return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  clearSessionCookie();
}

export function getPendingLang(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PENDING_LANG_STORAGE_KEY);
}

export function setPendingLang(lang: string): void {
  localStorage.setItem(PENDING_LANG_STORAGE_KEY, lang);
}

export function clearPendingLang(): void {
  localStorage.removeItem(PENDING_LANG_STORAGE_KEY);
}

export function clearAuthQueryParams(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("auth_error");
  const qs = url.searchParams.toString();
  window.history.replaceState(
    {},
    "",
    qs ? `${url.pathname}?${qs}` : url.pathname,
  );
}
