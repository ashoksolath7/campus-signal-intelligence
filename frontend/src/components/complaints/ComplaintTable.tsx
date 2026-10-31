import { Link } from "react-router-dom";

import type { Complaint, Department } from "../../types/domain";
import { categoryLabel, formatDate } from "../../utils/format";
import { EmptyState } from "../ui/EmptyState";
import { PriorityBadge, StatusBadge } from "../ui/Badge";

export function ComplaintTable({
  complaints,
  departments,
  detailBase,
}: {
  complaints: Complaint[];
  departments: Department[];
  detailBase: string;
}) {
  if (complaints.length === 0) {
    return (
      <EmptyState
        title="No complaints match these filters"
        description="Adjust search or status filters to see records from the queue."
      />
    );
  }

  return (
    <div>
      {/* Mobile Card View (shown below md breakpoint: 320px, 375px, 390px, 430px) */}
      <div className="divide-y divide-slate-100 md:hidden">
        {complaints.map((complaint) => {
          const department = departments.find((item) => item.id === complaint.departmentId);
          return (
            <Link
              key={complaint.id}
              to={`${detailBase}/${complaint.id}`}
              className="block p-4 transition hover:bg-slate-50 active:bg-slate-100"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-mono text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                  {complaint.ticket}
                </span>
                <div className="flex items-center gap-1.5">
                  <PriorityBadge priority={complaint.priority} />
                  <StatusBadge status={complaint.status} />
                </div>
              </div>
              <h3 className="text-sm font-semibold text-navy-900 line-clamp-2 mb-1.5">
                {complaint.title}
              </h3>
              <div className="flex flex-wrap items-center justify-between gap-y-1 text-xs text-slate-500 pt-0.5">
                <span>
                  <strong className="text-slate-600">{categoryLabel[complaint.category]}</strong>
                  {" · "}
                  {department?.name ?? "Unassigned"}
                </span>
                <span>{formatDate(complaint.updatedAt)}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Desktop & Tablet Table View (shown from md breakpoint upwards: 768px+) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Ticket</th>
              <th className="px-3 py-3">Title</th>
              <th className="px-3 py-3">Category</th>
              <th className="px-3 py-3">Department</th>
              <th className="px-3 py-3">Priority</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {complaints.map((complaint) => {
              const department = departments.find((item) => item.id === complaint.departmentId);
              return (
                <tr key={complaint.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="px-3 py-3 font-medium text-brand-600">
                    <Link to={`${detailBase}/${complaint.id}`} className="hover:underline">
                      {complaint.ticket}
                    </Link>
                  </td>
                  <td className="px-3 py-3 font-medium text-navy-900">{complaint.title}</td>
                  <td className="px-3 py-3">{categoryLabel[complaint.category]}</td>
                  <td className="px-3 py-3">{department?.name ?? "Unassigned"}</td>
                  <td className="px-3 py-3">
                    <PriorityBadge priority={complaint.priority} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={complaint.status} />
                  </td>
                  <td className="px-3 py-3 text-slate-500">{formatDate(complaint.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
