import { createApiClient } from "@/lib/api/client";
import type { MeResponse, MessageResponse } from "@/lib/api/openapi-helpers";

function authedClient(getToken: () => string | null) {
  return createApiClient({ getToken });
}

/**
 * GET /api/auth/me — requires Bearer JWT.
 * Response typing is `unknown` in OpenAPI today (no response_model on route).
 */
export function fetchMe(getToken: () => string | null): Promise<MeResponse> {
  return authedClient(getToken).get<MeResponse>("/api/auth/me");
}

/**
 * DELETE /api/auth/me — requires Bearer JWT.
 * Typed from OpenAPI `MessageResponse`.
 */
export function deleteAccount(
  getToken: () => string | null,
): Promise<MessageResponse> {
  return authedClient(getToken).delete<MessageResponse>("/api/auth/me");
}
