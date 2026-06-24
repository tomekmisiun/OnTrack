/** HttpOnly session cookie holding the FastAPI JWT when BFF mode is enabled. */
export const AUTH_COOKIE_NAME = "ontrack_session";

/** 30 days — align with typical JWT TTL; backend owns actual expiry. */
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type AuthCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

export function getAuthCookieOptions(): AuthCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE,
  };
}
