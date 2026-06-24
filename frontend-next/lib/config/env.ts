/**
 * Single source for FastAPI base URL. Components must not hardcode API hosts.
 * Set NEXT_PUBLIC_API_URL in .env.local (see .env.example).
 */
export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (url) {
    return url.replace(/\/$/, "");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_API_URL is required for production builds of frontend-next",
    );
  }
  return "http://localhost:5001";
}
