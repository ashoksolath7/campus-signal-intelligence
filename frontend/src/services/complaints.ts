import { api } from "./api";
import type { Complaint, ComplaintDraft } from "../types/domain";

export async function getComplaintsApi(params?: {
  studentId?: string;
  status?: string;
  priority?: string;
  category?: string;
  departmentId?: string;
  query?: string;
}): Promise<Complaint[]> {
  const response = await api.get<Complaint[]>("/api/v1/complaints", { params });
  return response.data;
}

export async function getComplaintByIdApi(id: string): Promise<Complaint> {
  const response = await api.get<Complaint>(`/api/v1/complaints/${id}`);
  return response.data;
}

export async function createComplaintApi(draft: ComplaintDraft): Promise<Complaint> {
  const response = await api.post<Complaint>("/api/v1/complaints", draft);
  return response.data;
}

export async function updateComplaintApi(
  id: string,
  patch: Partial<Pick<Complaint, "status" | "priority" | "departmentId" | "duplicateGroupId">> & {
    note?: string;
  },
): Promise<Complaint> {
  const response = await api.patch<Complaint>(`/api/v1/complaints/${id}`, patch);
  return response.data;
}

export async function groupComplaintsApi(
  primaryId: string,
  secondaryId: string,
): Promise<Complaint[]> {
  const response = await api.post<Complaint[]>("/api/v1/complaints/group", {
    primaryId,
    secondaryId,
  });
  return response.data;
}
