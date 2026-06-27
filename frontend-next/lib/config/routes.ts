import type { TranslationKey } from "@/lib/i18n/translations";

/** App routes — IDs match CRA tab navigation in `frontend/src/App.js`. */
export const APP_NAV_ITEMS = [
  { id: "macro", path: "/macro", labelKey: "tab_macro" },
  { id: "calendar", path: "/calendar", labelKey: "tab_calendar" },
  { id: "schedule", path: "/schedule", labelKey: "tab_schedule" },
  { id: "recipes", path: "/recipes", labelKey: "tab_recipes" },
  { id: "products", path: "/products", labelKey: "tab_products" },
  { id: "summary", path: "/summary", labelKey: "tab_summary" },
  { id: "export", path: "/export", labelKey: "tab_export" },
] as const satisfies ReadonlyArray<{
  id: string;
  path: string;
  labelKey: TranslationKey;
}>;

export type AppNavId = (typeof APP_NAV_ITEMS)[number]["id"];

export const HOME_PATH = "/";

export const LOGIN_PATH = "/login";

export const PROTECTED_PATHS = [
  HOME_PATH,
  ...APP_NAV_ITEMS.map((item) => item.path),
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function isPublicPath(pathname: string): boolean {
  return (
    pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`)
  );
}

export function navItemByPath(pathname: string) {
  return APP_NAV_ITEMS.find((item) => item.path === pathname);
}
