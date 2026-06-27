import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/bff/cookies";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";
import { isPublicPath, LOGIN_PATH } from "@/lib/config/routes";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const hasSession =
    request.cookies.get(SESSION_COOKIE_NAME)?.value === "1" ||
    Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  const isLogin = isPublicPath(pathname);

  if (searchParams.has("code") || searchParams.has("auth_error")) {
    return NextResponse.next();
  }

  if (isLogin) {
    if (hasSession) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg|icon.svg).*)"],
};
