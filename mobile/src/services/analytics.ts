import { api } from "./api";
import type { AnalyticsSummary } from "../types/domain";

export async function getAnalyticsApi(studentId?: string): Promise<AnalyticsSummary> {
  const params: Record<string, string> = {};
  if (studentId) params.studentId = studentId;
  const response = await api.get<AnalyticsSummary>("/analytics", { params });
  return response.data;
}

