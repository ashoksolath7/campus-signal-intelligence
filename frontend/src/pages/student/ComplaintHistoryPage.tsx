import { useState } from "react";
import { Link } from "react-router-dom";

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
import { useAuth } from "../../context/AuthContext";
import { useCampusStore } from "../../context/CampusStore";

export function ComplaintHistoryPage() {
  const { user } = useAuth();
  const { complaints, departments, loading, error } = useCampusStore();
  const [filters, setFilters] = useState<FilterState>({
    query: "",
    status: "all",
    priority: "all",
  });
  const mine = complaints
    .filter((complaint) => complaint.studentId === user?.id)
    .filter((complaint) => matchesFilters(filters.query, filters.status, filters.priority, complaint));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Complaint history"
        description="Every ticket you submitted, tracked in real-time."
        actions={
          <Link to="/student/complaints/new">
            <Button>New complaint</Button>
          </Link>
        }
      />
      <PreviewBanner />
      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner label="Loading complaint history from MongoDB…" />
        </div>
      ) : (
        <Card>
          <CardBody className="space-y-4">
            <ComplaintFilters value={filters} onChange={setFilters} />
            {mine.length === 0 ? (
              <EmptyState
                title="No complaints match your filters"
                description="Try clearing your search query or status filter to see more tickets."
              />
            ) : (
              <ComplaintTable complaints={mine} departments={departments} detailBase="/student/complaints" />
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
