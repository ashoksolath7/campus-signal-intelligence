import { api } from "./api";
import type { Department } from "../types/domain";

export async function getDepartmentsApi(): Promise<Department[]> {
  const response = await api.get<Department[]>("/departments");
  return response.data;
}

export async function getDepartmentByIdApi(id: string): Promise<Department> {
  const response = await api.get<Department>(`/departments/${id}`);
  return response.data;
}

export async function createDepartmentApi(input: {
  name: string;
  code: string;
  head: string;
  email: string;
  active?: boolean;
}): Promise<Department> {
  const response = await api.post<Department>("/departments", input);
  return response.data;
}

export async function updateDepartmentApi(
  id: string,
  patch: {
    name?: string;
    code?: string;
    head?: string;
    email?: string;
    active?: boolean;
  },
): Promise<Department> {
  const response = await api.patch<Department>(`/departments/${id}`, patch);
  return response.data;
}

