import { describe, expect, it } from "vitest";
import {
  buildUpstreamApiUrl,
  ProxyError,
  pickForwardRequestHeaders,
} from "@/lib/bff/proxy";

function buildImportUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const apiPath = normalized.startsWith("/api/")
    ? normalized.slice("/api/".length)
    : normalized.slice(1);
  return `/api/bff/${apiPath}`;
}

describe("bff proxy", () => {
  it("builds upstream URL from path segments", () => {
    expect(buildUpstreamApiUrl(["members"])).toBe(
      "http://localhost:5001/api/members",
    );
    expect(buildUpstreamApiUrl(["auth", "me"])).toBe(
      "http://localhost:5001/api/auth/me",
    );
  });

  it("rejects empty and traversal segments", () => {
    expect(() => buildUpstreamApiUrl([])).toThrow(ProxyError);
    expect(() => buildUpstreamApiUrl([".."])).toThrow(ProxyError);
    expect(() => buildUpstreamApiUrl(["members", ".."])).toThrow(ProxyError);
  });

  it("forwards only allowlisted request headers", () => {
    const request = new Request("http://localhost/api/bff/members", {
      headers: {
        accept: "application/json",
        authorization: "Bearer secret",
        "content-type": "application/json",
        cookie: "ontrack_session=abc",
        host: "localhost",
      },
    });

    const headers = pickForwardRequestHeaders(request);
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("cookie")).toBeNull();
  });
});

describe("bff import URLs", () => {
  it("routes import uploads through the BFF proxy path", () => {
    expect(buildImportUrl("/api/import/parse")).toBe("/api/bff/import/parse");
    expect(buildImportUrl("/api/import/parse-free")).toBe("/api/bff/import/parse-free");
  });
});

describe("bff config", () => {
  it("is disabled unless explicitly enabled", async () => {
    const previous = process.env.NEXT_PUBLIC_BFF_ENABLED;
    delete process.env.NEXT_PUBLIC_BFF_ENABLED;
    const { isBffEnabled } = await import("@/lib/bff/config");
    expect(isBffEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_BFF_ENABLED = previous;
  });
});
