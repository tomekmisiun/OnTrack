import { getApiBaseUrl } from "@/lib/config/env";

const FORWARD_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "if-none-match",
  "if-modified-since",
] as const;

/**
 * Reject path traversal and build upstream FastAPI URL.
 * Proxy only — no domain logic.
 */
export function buildUpstreamApiUrl(pathSegments: string[]): string {
  if (pathSegments.length === 0) {
    throw new ProxyError("Missing API path", 400);
  }
  for (const segment of pathSegments) {
    if (!segment || segment === "." || segment === "..") {
      throw new ProxyError("Invalid API path", 400);
    }
  }

  const base = getApiBaseUrl();
  const path = `/api/${pathSegments.join("/")}`;
  return `${base}${path}`;
}

export class ProxyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProxyError";
  }
}

export function pickForwardRequestHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

export async function proxyToUpstream(
  request: Request,
  upstreamUrl: string,
  token: string | undefined,
): Promise<Response> {
  const headers = pickForwardRequestHeaders(request);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body,
    redirect: "manual",
  });

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
