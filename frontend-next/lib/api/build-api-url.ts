import { isBffEnabled } from "@/lib/bff/config";
import { getApiBaseUrl } from "@/lib/config/env";

/** Resolve a FastAPI path for browser fetch (direct API or BFF proxy). */
export function buildClientApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;

  if (isBffEnabled()) {
    const apiPath = normalized.startsWith("/api/")
      ? normalized.slice("/api/".length)
      : normalized.slice(1);
    return `/api/bff/${apiPath}`;
  }

  return `${getApiBaseUrl()}${normalized}`;
}
