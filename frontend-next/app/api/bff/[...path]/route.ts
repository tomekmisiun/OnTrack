import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isBffEnabled } from "@/lib/bff/config";
import { AUTH_COOKIE_NAME } from "@/lib/bff/cookies";
import {
  buildUpstreamApiUrl,
  ProxyError,
  proxyToUpstream,
} from "@/lib/bff/proxy";

type RouteContext = { params: Promise<{ path: string[] }> };

async function handleProxy(request: NextRequest, context: RouteContext) {
  if (!isBffEnabled()) {
    return NextResponse.json({ error: "BFF mode is disabled" }, { status: 404 });
  }

  const { path } = await context.params;
  let upstreamUrl: string;
  try {
    upstreamUrl = buildUpstreamApiUrl(path);
  } catch (err) {
    if (err instanceof ProxyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  return proxyToUpstream(request, upstreamUrl, token);
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}
