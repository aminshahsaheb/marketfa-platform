export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly correlationId: string;
}
export interface HealthResponse {
  readonly status: "ok" | "ready";
}
