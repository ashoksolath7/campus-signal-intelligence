import { api } from "./api";
import type { CampusUser } from "../types/domain";

export async function getUsersApi(): Promise<CampusUser[]> {
  const response = await api.get<CampusUser[]>("/api/v1/users");
  return response.data;
}

export async function createUserApi(
  input: Omit<CampusUser, "id" | "createdAt">,
): Promise<CampusUser> {
  const response = await api.post<CampusUser>("/api/v1/users", input);
  return response.data;
}

export async function updateUserApi(
  id: string,
  patch: Partial<CampusUser>,
): Promise<CampusUser> {
  const response = await api.patch<CampusUser>(`/api/v1/users/${id}`, patch);
  return response.data;
}
