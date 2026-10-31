import type { Category, ComplaintStatus, Priority } from "../types/domain";

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDay(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric" }).format(
    new Date(value),
  );
}

export const statusLabel: Record<ComplaintStatus, string> = {
  submitted: "Submitted",
  in_review: "In review",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const priorityLabel: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const categoryLabel: Record<Category, string> = {
  facilities: "Facilities",
  academics: "Academics",
  hostel: "Hostel",
  it: "IT",
  safety: "Safety",
  transport: "Transport",
  other: "Other",
};

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function createTicket(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `CSI-${n}`;
}
