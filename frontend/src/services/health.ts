import type { HealthResponse } from "../types/health";
import { api } from "./api";

export async function getHealth(): Promise<HealthResponse> {
  const response = await api.get<HealthResponse>("/api/v1/health");
  return response.data;
}
