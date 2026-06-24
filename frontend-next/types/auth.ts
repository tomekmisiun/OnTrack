import type { LangCode } from "@/lib/i18n/translations";

/** User payload from GET /api/auth/me (until OpenAPI adds UserResponse). */
export type AuthUser = {
  id: number;
  lang: LangCode;
  username?: string;
  email?: string;
};

export function parseAuthUser(data: unknown): AuthUser | null {
  if (typeof data !== "object" || data === null) return null;
  const row = data as Record<string, unknown>;
  if (typeof row.id !== "number" || typeof row.lang !== "string") return null;
  const lang: LangCode = row.lang === "pl" || row.lang === "en" ? row.lang : "en";
  const user: AuthUser = { id: row.id, lang };
  if (typeof row.username === "string") user.username = row.username;
  if (typeof row.email === "string") user.email = row.email;
  return user;
}
