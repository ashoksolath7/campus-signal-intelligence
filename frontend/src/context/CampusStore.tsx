import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { previewStore } from "../data/preview";
import { getAnalyticsApi, type AnalyticsSummary } from "../services/analytics";
import { getAuditLogsApi } from "../services/audit";
import {
  createComplaintApi,
  getComplaintsApi,
  groupComplaintsApi,
  updateComplaintApi,
} from "../services/complaints";
import {
  createDepartmentApi,
  getDepartmentsApi,
  updateDepartmentApi,
} from "../services/departments";
import { createUserApi, getUsersApi, updateUserApi } from "../services/users";
import type {
  AuditLog,
  CampusStoreState,
  CampusUser,
  Complaint,
  ComplaintDraft,
  ComplaintStatus,
  Department,
  Priority,
  SessionUser,
} from "../types/domain";
import { readJson, writeJson } from "../utils/storage";

type CampusStoreValue = CampusStoreState & {
  analytics: AnalyticsSummary | null;
  loading: boolean;
  error: string | null;
  isLiveBackend: boolean;
  addComplaint: (draft: ComplaintDraft, student: SessionUser) => Promise<Complaint>;
  updateComplaint: (
    id: string,
    patch: Partial<Pick<Complaint, "status" | "priority" | "departmentId" | "duplicateGroupId">>,
    actor: string,
    note?: string,
  ) => Promise<Complaint>;
  addUser: (
    input: Omit<CampusUser, "id" | "createdAt">,
  ) => Promise<CampusUser>;
  updateUser: (id: string, patch: Partial<CampusUser>, actor: string) => Promise<CampusUser>;
  addDepartment: (input: Omit<Department, "id">) => Promise<Department>;
  updateDepartment: (id: string, patch: Partial<Department>, actor: string) => Promise<Department>;
  groupComplaints: (primaryId: string, secondaryId: string) => Promise<Complaint[]>;
  enablePreviewFallback: () => void;
  exitPreviewFallback: () => Promise<void>;
  resetPreview: () => void;
  refreshFromApi: () => Promise<void>;
};

const CampusStoreContext = createContext<CampusStoreValue | undefined>(undefined);

export function CampusStoreProvider({ children }: { children: ReactNode }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [users, setUsers] = useState<CampusUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiveBackend, setIsLiveBackend] = useState<boolean>(() => {
    // Check if user previously explicitly opted into offline demo mode
    return readJson<boolean>("use_preview_fallback") !== true;
  });

  const refreshFromApi = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = readJson<{ role?: string; id?: string }>("session");
      const isAdminOrStaff = session?.role === "admin" || session?.role === "staff";

      const promises: [
        Promise<Department[]>,
        Promise<Complaint[]>,
        Promise<CampusUser[]>,
        Promise<AuditLog[]>,
        Promise<AnalyticsSummary | null>,
      ] = [
        getDepartmentsApi(),
        getComplaintsApi(),
        isAdminOrStaff ? getUsersApi() : Promise.resolve([]),
        isAdminOrStaff ? getAuditLogsApi() : Promise.resolve([]),
        session ? getAnalyticsApi(session.role === "student" ? session.id : undefined) : Promise.resolve(null),
      ];

      const [deptRes, compRes, userRes, auditRes, analyticsRes] = await Promise.allSettled(promises);

      let anySuccess = false;

      if (deptRes.status === "fulfilled") {
        setDepartments(deptRes.value);
        anySuccess = true;
      }
      if (compRes.status === "fulfilled") {
        setComplaints(compRes.value);
        anySuccess = true;
      }
      if (userRes.status === "fulfilled") {
        setUsers(userRes.value);
        anySuccess = true;
      }
      if (auditRes.status === "fulfilled") {
        setAuditLogs(auditRes.value);
        anySuccess = true;
      }
      if (analyticsRes.status === "fulfilled" && analyticsRes.value) {
        setAnalytics(analyticsRes.value);
        anySuccess = true;
      }

      if (anySuccess) {
        setIsLiveBackend(true);
        writeJson("use_preview_fallback", false);
      } else {
        // If essential endpoints failed, record connection error
        const firstErr = [deptRes, compRes].find(
          (r) => r.status === "rejected",
        );
        const reason =
          firstErr && "reason" in firstErr
            ? (firstErr.reason instanceof Error ? firstErr.reason.message : String(firstErr.reason))
            : "Backend API unreachable";
        setError(`Unable to connect to live backend API (${reason}). You may use Demo Fallback Mode.`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Backend error: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLiveBackend) {
      refreshFromApi();
    } else {
      // In explicit demo fallback mode, load preview dataset
      setDepartments(structuredClone(previewStore.departments));
      setComplaints(structuredClone(previewStore.complaints));
      setUsers(structuredClone(previewStore.users));
      setAuditLogs(structuredClone(previewStore.auditLogs));
      setLoading(false);
    }
  }, [isLiveBackend, refreshFromApi]);

  const addComplaint = useCallback(
    async (draft: ComplaintDraft, _student: SessionUser): Promise<Complaint> => {
      if (isLiveBackend) {
        const saved = await createComplaintApi(draft);
        setComplaints((prev) => [saved, ...prev.filter((c) => c.id !== saved.id)]);
        // Refresh analytics & audit in background
        getAnalyticsApi().then(setAnalytics).catch(() => {});
        getAuditLogsApi().then(setAuditLogs).catch(() => {});
        return saved;
      } else {
        // Explicit preview fallback mode
        const now = new Date().toISOString();
        const fallbackComplaint: Complaint = {
          id: `cmp-demo-${Date.now()}`,
          ticket: `CSI-DEMO-${Math.floor(1000 + Math.random() * 9000)}`,
          title: draft.title.trim(),
          description: draft.description.trim(),
          category: draft.category,
          departmentId: draft.departmentId,
          studentId: _student.id,
          studentName: _student.name,
          studentEmail: _student.email,
          status: "submitted",
          priority: "medium",
          location: draft.location.trim(),
          imageUrl: draft.imageUrl,
          createdAt: now,
          updatedAt: now,
          updates: [
            {
              at: now,
              status: "submitted",
              note: "Complaint submitted in demo mode.",
              actor: _student.name,
            },
          ],
        };
        setComplaints((prev) => [fallbackComplaint, ...prev]);
        return fallbackComplaint;
      }
    },
    [isLiveBackend],
  );

  const updateComplaint = useCallback(
    async (
      id: string,
      patch: Partial<Pick<Complaint, "status" | "priority" | "departmentId" | "duplicateGroupId">>,
      actor: string,
      note?: string,
    ): Promise<Complaint> => {
      if (isLiveBackend) {
        const updated = await updateComplaintApi(id, { ...patch, note });
        setComplaints((prev) => prev.map((c) => (c.id === id ? updated : c)));
        getAnalyticsApi().then(setAnalytics).catch(() => {});
        getAuditLogsApi().then(setAuditLogs).catch(() => {});
        return updated;
      } else {
        const now = new Date().toISOString();
        let target: Complaint | undefined;
        setComplaints((prev) =>
          prev.map((c) => {
            if (c.id !== id) return c;
            const nextStatus = patch.status ?? c.status;
            const updates =
              patch.status && patch.status !== c.status
                ? [
                    ...c.updates,
                    {
                      at: now,
                      status: nextStatus,
                      note: note ?? `Status changed to ${nextStatus.replaceAll("_", " ")}.`,
                      actor,
                    },
                  ]
                : c.updates;
            target = { ...c, ...patch, updatedAt: now, updates };
            return target;
          }),
        );
        return target ?? ({ id, ...patch } as Complaint);
      }
    },
    [isLiveBackend],
  );

  const addDepartment = useCallback(
    async (input: Omit<Department, "id">): Promise<Department> => {
      if (isLiveBackend) {
        const created = await createDepartmentApi(input);
        setDepartments((prev) => [...prev, created]);
        getAuditLogsApi().then(setAuditLogs).catch(() => {});
        return created;
      } else {
        const created: Department = { ...input, id: `dept-demo-${Date.now()}` };
        setDepartments((prev) => [...prev, created]);
        return created;
      }
    },
    [isLiveBackend],
  );

  const updateDepartment = useCallback(
    async (id: string, patch: Partial<Department>, _actor: string): Promise<Department> => {
      if (isLiveBackend) {
        const updated = await updateDepartmentApi(id, patch);
        setDepartments((prev) => prev.map((d) => (d.id === id ? updated : d)));
        getAuditLogsApi().then(setAuditLogs).catch(() => {});
        return updated;
      } else {
        let target: Department | undefined;
        setDepartments((prev) =>
          prev.map((d) => {
            if (d.id !== id) return d;
            target = { ...d, ...patch };
            return target;
          }),
        );
        return target ?? ({ id, ...patch } as Department);
      }
    },
    [isLiveBackend],
  );

  const addUser = useCallback(
    async (input: Omit<CampusUser, "id" | "createdAt">): Promise<CampusUser> => {
      if (isLiveBackend) {
        const created = await createUserApi(input);
        setUsers((prev) => [created, ...prev]);
        getAuditLogsApi().then(setAuditLogs).catch(() => {});
        return created;
      } else {
        const created: CampusUser = {
          ...input,
          id: `user-demo-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        setUsers((prev) => [created, ...prev]);
        return created;
      }
    },
    [isLiveBackend],
  );

  const updateUser = useCallback(
    async (id: string, patch: Partial<CampusUser>, _actor: string): Promise<CampusUser> => {
      if (isLiveBackend) {
        const updated = await updateUserApi(id, patch);
        setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
        getAuditLogsApi().then(setAuditLogs).catch(() => {});
        return updated;
      } else {
        let target: CampusUser | undefined;
        setUsers((prev) =>
          prev.map((u) => {
            if (u.id !== id) return u;
            target = { ...u, ...patch };
            return target;
          }),
        );
        return target ?? ({ id, ...patch } as CampusUser);
      }
    },
    [isLiveBackend],
  );

  const groupComplaints = useCallback(
    async (primaryId: string, secondaryId: string): Promise<Complaint[]> => {
      if (isLiveBackend) {
        const updatedList = await groupComplaintsApi(primaryId, secondaryId);
        setComplaints((prev) =>
          prev.map((c) => {
            const found = updatedList.find((u) => u.id === c.id);
            return found ?? c;
          }),
        );
        getAuditLogsApi().then(setAuditLogs).catch(() => {});
        return updatedList;
      } else {
        const groupId = `dup-demo-${Date.now()}`;
        setComplaints((prev) =>
          prev.map((c) => (c.id === primaryId || c.id === secondaryId ? { ...c, duplicateGroupId: groupId } : c)),
        );
        return [];
      }
    },
    [isLiveBackend],
  );

  const enablePreviewFallback = useCallback(() => {
    setIsLiveBackend(false);
    writeJson("use_preview_fallback", true);
    setDepartments(structuredClone(previewStore.departments));
    setComplaints(structuredClone(previewStore.complaints));
    setUsers(structuredClone(previewStore.users));
    setAuditLogs(structuredClone(previewStore.auditLogs));
    setError(null);
  }, []);

  const exitPreviewFallback = useCallback(async () => {
    setIsLiveBackend(true);
    writeJson("use_preview_fallback", false);
    await refreshFromApi();
  }, [refreshFromApi]);

  const resetPreview = useCallback(() => {
    setDepartments(structuredClone(previewStore.departments));
    setComplaints(structuredClone(previewStore.complaints));
    setUsers(structuredClone(previewStore.users));
    setAuditLogs(structuredClone(previewStore.auditLogs));
  }, []);

  const value = useMemo(
    () => ({
      departments,
      complaints,
      users,
      auditLogs,
      analytics,
      loading,
      error,
      isLiveBackend,
      addComplaint,
      updateComplaint,
      addUser,
      updateUser,
      addDepartment,
      updateDepartment,
      groupComplaints,
      enablePreviewFallback,
      exitPreviewFallback,
      resetPreview,
      refreshFromApi,
    }),
    [
      departments,
      complaints,
      users,
      auditLogs,
      analytics,
      loading,
      error,
      isLiveBackend,
      addComplaint,
      updateComplaint,
      addUser,
      updateUser,
      addDepartment,
      updateDepartment,
      groupComplaints,
      enablePreviewFallback,
      exitPreviewFallback,
      resetPreview,
      refreshFromApi,
    ],
  );

  return <CampusStoreContext.Provider value={value}>{children}</CampusStoreContext.Provider>;
}

export function useCampusStore(): CampusStoreValue {
  const value = useContext(CampusStoreContext);
  if (!value) {
    throw new Error("useCampusStore must be used within CampusStoreProvider");
  }
  return value;
}

export function isOpenStatus(status: ComplaintStatus): boolean {
  return status !== "resolved" && status !== "closed";
}

export function isCritical(priority: Priority): boolean {
  return priority === "critical";
}
