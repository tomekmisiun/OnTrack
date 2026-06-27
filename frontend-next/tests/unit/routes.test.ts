import { describe, expect, it } from "vitest";
import {
  APP_NAV_ITEMS,
  HOME_PATH,
  isProtectedPath,
  isPublicPath,
  LOGIN_PATH,
  navItemByPath,
} from "@/lib/config/routes";

describe("routes", () => {
  it("marks app paths as protected", () => {
    expect(isProtectedPath(HOME_PATH)).toBe(true);
    expect(isProtectedPath("/calendar")).toBe(true);
    expect(isProtectedPath(LOGIN_PATH)).toBe(false);
  });

  it("marks login paths as public", () => {
    expect(isPublicPath(LOGIN_PATH)).toBe(true);
    expect(isPublicPath("/login/callback")).toBe(true);
    expect(isPublicPath("/calendar")).toBe(false);
  });

  it("resolves nav item by path", () => {
    expect(navItemByPath("/recipes")?.id).toBe("recipes");
    expect(navItemByPath("/unknown")).toBeUndefined();
  });

  it("lists all CRA tab routes", () => {
    expect(APP_NAV_ITEMS.map((item) => item.path)).toEqual([
      "/macro",
      "/calendar",
      "/schedule",
      "/recipes",
      "/products",
      "/summary",
      "/export",
    ]);
  });
});
