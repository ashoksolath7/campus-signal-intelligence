import { api } from "./api";
import type { Department } from "../types/domain";

export async function getDepartmentsApi(activeOnly = false): Promise<Department[]> {
  const response = await api.get<Department[]>("/api/v1/departments", {
    params: { active_only: activeOnly },
  });
  return response.data;
}

export async function createDepartmentApi(
  input: Omit<Department, "id">,
): Promise<Department> {
  const response = await api.post<Department>("/api/v1/departments", input);
  return response.data;
}

export async function updateDepartmentApi(
  id: string,
  patch: Partial<Department>,
): Promise<Department> {
  const response = await api.patch<Department>(`/api/v1/departments/${id}`, patch);
  return response.data;
}
