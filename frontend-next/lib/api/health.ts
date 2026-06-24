import { apiClient } from "@/lib/api/client";
import type { HealthResponse } from "@/lib/api/openapi-helpers";

export function fetchHealth(): Promise<HealthResponse> {
  return apiClient.get<HealthResponse>("/health");
}
