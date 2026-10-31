import { useState } from "react";

import { PageHeader } from "../../components/layout/PageHeader";
import { Alert } from "../../components/ui/Alert";
import { PriorityBadge, StatusBadge } from "../../components/ui/Badge";
import { Card, CardBody } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Select } from "../../components/ui/Field";
import { PreviewBanner } from "../../components/ui/PreviewBanner";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { useCampusStore } from "../../context/CampusStore";
import type { Priority } from "../../types/domain";

const levels: Priority[] = ["low", "medium", "high", "critical"];

export function PriorityManagementPage() {
  const { user } = useAuth();
  const { complaints, updateComplaint, loading, error } = useCampusStore();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handlePriorityChange(complaintId: string, ticket: string, newPriority: Priority) {
    setUpdatingId(complaintId);
    setActionError(null);
    setSuccessMsg(null);
    try {
      await updateComplaint(
        complaintId,
        { priority: newPriority },
        user?.name ?? "Admin",
        `Priority set to ${newPriority} via triage management.`,
      );
      setSuccessMsg(`Ticket ${ticket} priority updated to ${newPriority}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg || `Failed to update priority for ${ticket}.`);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Priority management"
        description="Escalate or adjust priority on active campus tickets. Every change is tracked in MongoDB audit logs."
      />
      <PreviewBanner />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {actionError ? <Alert tone="error">{actionError}</Alert> : null}
      {successMsg ? <Alert tone="success">{successMsg}</Alert> : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner label="Loading tickets from MongoDB…" />
        </div>
      ) : (
        <Card>
          <CardBody className="px-0">
            {complaints.length === 0 ? (
              <div className="p-6">
                <EmptyState title="No tickets available" description="No tickets to manage priority for yet." />
              </div>
            ) : (
              <>
                {/* Mobile Card View (320px - 767px) */}
                <div className="divide-y divide-slate-100 block md:hidden">
                  {complaints.map((complaint) => (
                    <div key={complaint.id} className="p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-navy-900 text-sm">{complaint.ticket}</span>
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={complaint.status} />
                          <PriorityBadge priority={complaint.priority} />
                        </div>
                      </div>

                      <p className="text-sm text-slate-700 font-medium">{complaint.title}</p>

                      <div className="pt-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                          Update Priority:
                        </label>
                        <Select
                          aria-label={`Priority for ${complaint.ticket}`}
                          value={complaint.priority}
                          disabled={updatingId === complaint.id}
                          className="w-full min-h-[44px]"
                          onChange={(event) =>
                            handlePriorityChange(
                              complaint.id,
                              complaint.ticket,
                              event.target.value as Priority,
                            )
                          }
                        >
                          {levels.map((level) => (
                            <option key={level} value={level}>
                              {level.charAt(0).toUpperCase() + level.slice(1)}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View (>= 768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Ticket</th>
                        <th className="px-5 py-3">Title</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Current</th>
                        <th className="px-5 py-3">Update priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {complaints.map((complaint) => (
                        <tr key={complaint.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-5 py-3 font-medium text-navy-900">{complaint.ticket}</td>
                          <td className="px-5 py-3 max-w-xs truncate">{complaint.title}</td>
                          <td className="px-5 py-3">
                            <StatusBadge status={complaint.status} />
                          </td>
                          <td className="px-5 py-3">
                            <PriorityBadge priority={complaint.priority} />
                          </td>
                          <td className="px-5 py-3">
                            <Select
                              aria-label={`Priority for ${complaint.ticket}`}
                              value={complaint.priority}
                              disabled={updatingId === complaint.id}
                              onChange={(event) =>
                                handlePriorityChange(
                                  complaint.id,
                                  complaint.ticket,
                                  event.target.value as Priority,
                                )
                              }
                            >
                              {levels.map((level) => (
                                <option key={level} value={level}>
                                  {level.charAt(0).toUpperCase() + level.slice(1)}
                                </option>
                              ))}
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
