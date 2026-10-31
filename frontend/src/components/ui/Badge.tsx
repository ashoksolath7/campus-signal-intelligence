import type { ComplaintStatus, Priority } from "../../types/domain";
import { priorityLabel, statusLabel } from "../../utils/format";

const statusClass: Record<ComplaintStatus, string> = {
  submitted: "bg-slate-100 text-slate-700",
  in_review: "bg-sky-50 text-sky-700",
  assigned: "bg-indigo-50 text-indigo-700",
  in_progress: "bg-amber-50 text-amber-800",
  resolved: "bg-emerald-50 text-emerald-700",
  closed: "bg-slate-200 text-slate-600",
};

const priorityClass: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-50 text-blue-700",
  high: "bg-orange-50 text-orange-700",
  critical: "bg-rose-50 text-rose-700",
};

export function Badge({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  return <Badge className={statusClass[status]}>{statusLabel[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge className={priorityClass[priority]}>{priorityLabel[priority]}</Badge>;
}
