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
  location: string;
  imageUrl?: string | null;
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: ComplaintStatus;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
  duplicateGroupId?: string | null;
  updates: ComplaintUpdate[];
};

export type AIClassifyResult = {
  category: Category;
  categoryConfidence: number;
  categoryReasons: string[];
  priority: Priority;
  priorityReasons: string[];
  urgencyScore: number;
  summary: string;
  reasoning: string;
  departmentHint?: string | null;
  departmentCode?: string | null;
  departmentReasoning?: string | null;
  modelUsed: string;
};

export type DuplicateMatch = {
  complaintId: string;
  ticket: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  similarityScore: number;
  denseSimilarity?: number;
  duplicateGroupId?: string | null;
  matchingKeywords: string[];
  summary: string;
  evidence?: string;
  engine?: string;
};

export type AIDuplicateDetectResult = {
  matches: DuplicateMatch[];
  hasDuplicates: boolean;
  topSimilarity: number;
  engine: string;
};

export type SuggestedDuplicateGroup = {
  groupId: string;
  primaryTicket: string;
  primaryId: string;
  memberTickets: string[];
  memberIds: string[];
  commonTheme: string;
  averageSimilarity: number;
  evidence: string;
  engine: string;
};

export type AnalyticsSummary = {
  totalComplaints: number;
  pendingComplaints: number;
  resolvedComplaints: number;
  criticalComplaints: number;
  categoryDistribution: Array<{ name: string; category: string; value: number }>;
  priorityDistribution: Array<{ name: string; priority: string; count: number }>;
  departmentDistribution: Array<{ name: string; code: string; departmentId: string; count: number }>;
  dailyTrends: Array<{ day: string; date: string; complaints: number }>;
};

export type AuditLog = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
};

