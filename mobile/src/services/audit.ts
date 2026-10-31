import { api } from "./api";
import type { AuditLog } from "../types/domain";

export async function getAuditLogsApi(): Promise<AuditLog[]> {
  const response = await api.get<AuditLog[]>("/audit-logs");
  return response.data;
}

