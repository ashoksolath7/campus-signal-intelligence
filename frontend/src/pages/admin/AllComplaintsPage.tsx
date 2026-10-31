import { useMemo, useState } from "react";

import {
  ComplaintFilters,
  matchesFilters,
  type FilterState,
} from "../../components/complaints/ComplaintFilters";
import { ComplaintTable } from "../../components/complaints/ComplaintTable";
import { PageHeader } from "../../components/layout/PageHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PreviewBanner } from "../../components/ui/PreviewBanner";
import { Spinner } from "../../components/ui/Spinner";
import { useCampusStore } from "../../context/CampusStore";

export function AllComplaintsPage() {
  const { complaints, departments, loading, error } = useCampusStore();
  const [filters, setFilters] = useState<FilterState>({
    query: "",
    status: "all",
    priority: "all",
  });

  const rows = useMemo(
    () =>
      complaints.filter((complaint) =>
        matchesFilters(filters.query, filters.status, filters.priority, complaint),
      ),
    [complaints, filters],
  );

  function exportCsv() {
    const header = "ticket,title,status,priority,student,studentEmail,category,location,createdAt";
    const body = rows
      .map((complaint) =>
        [
          complaint.ticket,
          `"${complaint.title.replaceAll('"', '""')}"`,
          complaint.status,
          complaint.priority,
          `"${complaint.studentName}"`,
          complaint.studentEmail,
          complaint.category,
          `"${complaint.location.replaceAll('"', '""')}"`,
          complaint.createdAt,
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `campus-complaints-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="All complaints"
        description="Filter, review, and triage tickets from the MongoDB operational queue."
        actions={
          rows.length > 0 ? (
            <Button variant="outline" onClick={exportCsv}>
              Export CSV ({rows.length})
            </Button>
          ) : null
        }
      />
      <PreviewBanner />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner label="Loading complaints queue from MongoDB…" />
        </div>
      ) : (
        <Card>
          <CardBody className="space-y-4">
            <ComplaintFilters value={filters} onChange={setFilters} />
            {rows.length === 0 ? (
              <EmptyState
                title="No complaints match current filters"
                description="Try clearing search filters or check back when new tickets arrive."
              />
            ) : (
              <ComplaintTable complaints={rows} departments={departments} detailBase="/admin/complaints" />
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
