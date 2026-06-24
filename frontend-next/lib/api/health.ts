import { apiClient } from "@/lib/api/client";

export type HealthResponse = {
  status: string;
};

export function fetchHealth(): Promise<HealthResponse> {
  return apiClient.get<HealthResponse>("/health");
}
