import { api } from "./api";

export type CategoryStat = {
  name: string;
  category: string;
  value: number;
};

export type PriorityStat = {
  name: string;
  priority: string;
  count: number;
};

export type DepartmentStat = {
  name: string;
  code: string;
  departmentId: string;
  count: number;
};

export type TrendStat = {
  day: string;
  date: string;
  complaints: number;
};

export type AnalyticsSummary = {
  totalComplaints: number;
  pendingComplaints: number;
  resolvedComplaints: number;
  criticalComplaints: number;
  categoryDistribution: CategoryStat[];
  priorityDistribution: PriorityStat[];
  departmentDistribution: DepartmentStat[];
  dailyTrends: TrendStat[];
};

export async function getAnalyticsApi(studentId?: string): Promise<AnalyticsSummary> {
  const response = await api.get<AnalyticsSummary>("/api/v1/analytics", {
    params: { studentId },
  });
  return response.data;
}
