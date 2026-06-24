import type { components, operations } from "@/lib/api/generated/schema";

/** Re-export generated schema building blocks. */
export type { components, operations, paths } from "@/lib/api/generated/schema";

/** Named Pydantic schema from OpenAPI components. */
export type ApiSchema<Name extends keyof components["schemas"]> =
  components["schemas"][Name];

/** JSON response body for a generated operation (HTTP 200). */
export type OperationResponse<Op extends keyof operations> =
  operations[Op] extends {
    responses: { 200: infer Response };
  }
    ? Response extends { content: { "application/json": infer Body } }
      ? Body
      : never
    : never;

export type HealthResponse = OperationResponse<"health_health_get">;
export type MessageResponse = ApiSchema<"MessageResponse">;
export type TokenResponse = ApiSchema<"TokenResponse">;

/** GET /api/auth/me — OpenAPI body is `unknown` until FastAPI adds response_model. */
export type MeResponse = OperationResponse<"me_api_auth_me_get">;
