import { api } from "./api";
import type { Complaint, ComplaintStatus, Priority } from "../types/domain";

export type ComplaintFilter = {
  status?: string;
  category?: string;
  priority?: string;
  studentId?: string;
  search?: string;
};

export async function getComplaintsApi(filters?: ComplaintFilter): Promise<Complaint[]> {
  const params: Record<string, string> = {};
  if (filters?.status) params.status = filters.status;
  if (filters?.category) params.category = filters.category;
  if (filters?.priority) params.priority = filters.priority;
  if (filters?.studentId) params.student_id = filters.studentId;
  if (filters?.search) params.query = filters.search;

  const response = await api.get<Complaint[]>("/complaints", { params });
  return response.data;
}

export async function getComplaintByIdApi(id: string): Promise<Complaint> {
  const response = await api.get<Complaint>(`/complaints/${id}`);
  return response.data;
}

export async function createComplaintApi(input: {
  title: string;
  description: string;
  category: string;
  departmentId: string;
  location: string;
  imageUrl?: string | null;
}): Promise<Complaint> {
  const response = await api.post<Complaint>("/complaints", input);
  return response.data;
}

export async function patchComplaintApi(
  id: string,
  patch: {
    status?: ComplaintStatus;
    priority?: Priority;
    departmentId?: string;
    duplicateGroupId?: string | null;
    note?: string;
  },
): Promise<Complaint> {
  const response = await api.patch<Complaint>(`/complaints/${id}`, patch);
  return response.data;
}

export async function groupComplaintsApi(
  primaryId: string,
  secondaryId: string,
): Promise<Complaint[]> {
  const response = await api.post<Complaint[]>("/complaints/group", {
    primaryId,
    secondaryId,
  });
  return response.data;
}

