export const SESSION_COOKIE_NAME = "ontrack_has_token";

export function setSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE_NAME}=1; path=/; SameSite=Lax`;
}

export function clearSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

export function syncSessionCookieFromStorage(): void {
  if (typeof window === "undefined") return;
  const hasToken = Boolean(localStorage.getItem("token"));
  if (hasToken) setSessionCookie();
  else clearSessionCookie();
}
