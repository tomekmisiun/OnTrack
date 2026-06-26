import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isBffEnabled } from "@/lib/bff/config";
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
} from "@/lib/bff/cookies";
import { getApiBaseUrl } from "@/lib/config/env";

type SessionAction =
  | { action: "login"; username: string; password: string }
  | { action: "register"; username: string; password: string; lang: string }
  | { action: "exchange"; code: string }
  | { action: "refresh" };

type TokenPayload = { token?: string };

function bffDisabled() {
  return NextResponse.json({ error: "BFF mode is disabled" }, { status: 404 });
}

type AuthTokenResult =
  | { ok: true; token: string }
  | { ok: false; response: NextResponse };

async function readTokenFromUpstream(
  path: string,
  init: RequestInit,
): Promise<AuthTokenResult> {
  const base = getApiBaseUrl();
  const response = await fetch(`${base}${path}`, init);
  const text = await response.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      response: NextResponse.json(body ?? { error: "Auth failed" }, {
        status: response.status,
      }),
    };
  }

  const token = (body as TokenPayload)?.token;
  if (!token || typeof token !== "string") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Missing token in auth response" }, {
        status: 502,
      }),
    };
  }
  return { ok: true, token };
}

export async function GET() {
  if (!isBffEnabled()) return bffDisabled();

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base = getApiBaseUrl();
  const response = await fetch(`${base}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }

  if (response.status === 401) {
    cookieStore.set(AUTH_COOKIE_NAME, "", { ...getAuthCookieOptions(), maxAge: 0 });
  }

  return NextResponse.json(body, { status: response.status });
}

export async function POST(request: NextRequest) {
  if (!isBffEnabled()) return bffDisabled();

  let payload: SessionAction;
  try {
    payload = (await request.json()) as SessionAction;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let upstreamPath: string;
  let upstreamInit: RequestInit;

  switch (payload.action) {
    case "login":
      upstreamPath = "/api/auth/login";
      upstreamInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: payload.username,
          password: payload.password,
        }),
      };
      break;
    case "register":
      upstreamPath = "/api/auth/register";
      upstreamInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: payload.username,
          password: payload.password,
          lang: payload.lang,
        }),
      };
      break;
    case "exchange":
      upstreamPath = "/api/auth/exchange";
      upstreamInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: payload.code }),
      };
      break;
    case "refresh": {
      const cookieStore = await cookies();
      const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      upstreamPath = "/api/auth/refresh";
      upstreamInit = {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      };
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const authResult = await readTokenFromUpstream(upstreamPath, upstreamInit);
  if (!authResult.ok) return authResult.response;

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, authResult.token, getAuthCookieOptions());
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  if (!isBffEnabled()) return bffDisabled();

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, "", { ...getAuthCookieOptions(), maxAge: 0 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  if (!isBffEnabled()) return bffDisabled();

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const base = getApiBaseUrl();
  const target =
    typeof body === "object" &&
    body !== null &&
    "target" in body &&
    (body as { target?: string }).target === "market"
      ? "/api/auth/market"
      : "/api/auth/language";
  const upstreamBody =
    typeof body === "object" && body !== null && "target" in body
      ? (() => {
          const { target: _target, ...rest } = body as Record<string, unknown>;
          return rest;
        })()
      : body;

  const response = await fetch(`${base}${target}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(upstreamBody),
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

  return NextResponse.json(parsed, { status: response.status });
}
