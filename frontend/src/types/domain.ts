export type UserRole = "student" | "faculty" | "staff" | "admin";

export type ComplaintStatus =
  | "submitted"
  | "in_review"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed";

export type Priority = "low" | "medium" | "high" | "critical";

export type Category =
  | "facilities"
  | "academics"
  | "hostel"
  | "it"
  | "safety"
  | "transport"
  | "other";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  studentId?: string;
  facultyId?: string;
  staffId?: string;
  departmentId?: string;
  phone?: string;
  emailVerified?: boolean;
  verificationStatus?: string;
};

export type CampusUser = SessionUser & {
  password?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type Department = {
  id: string;
  name: string;
  code: string;
  head: string;
  email: string;
  active: boolean;
};

export type ComplaintUpdate = {
  at: string;
  status: ComplaintStatus;
  note: string;
  actor: string;
};

export type Complaint = {
  id: string;
  ticket: string;
  title: string;
  description: string;
  category: Category;
  departmentId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: ComplaintStatus;
  priority: Priority;
  location: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  duplicateGroupId?: string;
  updates: ComplaintUpdate[];
};

export type AuditLog = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
};

export type CampusStoreState = {
  users: CampusUser[];
  departments: Department[];
  complaints: Complaint[];
  auditLogs: AuditLog[];
  loading?: boolean;
  error?: string | null;
  isLiveBackend?: boolean;
};

export type ComplaintDraft = {
  title: string;
  description: string;
  category: Category;
  departmentId: string;
  location: string;
  imageUrl?: string;
};
