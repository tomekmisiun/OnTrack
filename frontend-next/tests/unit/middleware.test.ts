import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { middleware } from "@/middleware";
import { AUTH_COOKIE_NAME } from "@/lib/bff/cookies";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";

describe("middleware", () => {
  it("redirects unauthenticated users from protected paths with next param", () => {
    const request = new NextRequest("http://localhost:3000/calendar");
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Fcalendar",
    );
  });

  it("allows public login path without session", () => {
    const request = new NextRequest("http://localhost:3000/login");
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it("redirects authenticated users away from login", () => {
    const request = new NextRequest("http://localhost:3000/login", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=1` },
    });
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("allows protected paths when BFF session cookie is present", () => {
    const request = new NextRequest("http://localhost:3000/calendar", {
      headers: { cookie: `${AUTH_COOKIE_NAME}=session-token` },
    });
    const response = middleware(request);

    expect(response.status).toBe(200);
  });
});
