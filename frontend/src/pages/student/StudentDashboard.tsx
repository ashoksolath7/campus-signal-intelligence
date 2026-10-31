import { AlertTriangle, CheckCircle2, ClipboardList, Clock } from "lucide-react";
import { Link } from "react-router-dom";

import { CategoryChart } from "../../components/charts/CategoryChart";
import { TrendChart } from "../../components/charts/TrendChart";
import { ComplaintTable } from "../../components/complaints/ComplaintTable";
import { PageHeader } from "../../components/layout/PageHeader";
import { StatCard } from "../../components/layout/StatCard";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PreviewBanner } from "../../components/ui/PreviewBanner";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { isCritical, isOpenStatus, useCampusStore } from "../../context/CampusStore";

export function StudentDashboard() {
  const { user } = useAuth();
  const { complaints, departments, loading, error } = useCampusStore();
  const mine = complaints.filter((complaint) => complaint.studentId === user?.id);
  const pending = mine.filter((complaint) => isOpenStatus(complaint.status));
  const resolved = mine.filter(
    (complaint) => complaint.status === "resolved" || complaint.status === "closed",
  );
  const critical = mine.filter((complaint) => isCritical(complaint.priority));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user?.name ?? "student"}`}
        description="Your active complaints, progress timeline, and recent campus signal submissions."
        actions={
          <Link to="/student/complaints/new">
            <Button>Submit complaint</Button>
          </Link>
        }
      />
      <PreviewBanner />
      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner label="Loading your complaints from MongoDB…" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total complaints" value={mine.length} hint="Your records" icon={ClipboardList} />
            <StatCard label="Pending complaints" value={pending.length} hint="Open statuses" icon={Clock} />
            <StatCard label="Resolved complaints" value={resolved.length} hint="Resolved or closed" icon={CheckCircle2} />
            <StatCard label="Critical complaints" value={critical.length} hint="Critical priority" icon={AlertTriangle} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Category distribution" description="Your complaints by category" />
              <CardBody>
                {mine.length === 0 ? (
                  <EmptyState title="No data yet" description="Category breakdown will appear after tickets are filed." />
                ) : (
                  <CategoryChart complaints={mine} />
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Daily complaint trends" description="Last 7 days" />
              <CardBody>
                {mine.length === 0 ? (
                  <EmptyState title="No trend data" description="Trends will appear as your issues are tracked." />
                ) : (
                  <TrendChart complaints={mine} />
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Recent complaints"
              action={
                mine.length > 0 ? (
                  <Link to="/student/complaints" className="text-sm font-medium text-brand-600">
                    View all ({mine.length})
                  </Link>
                ) : null
              }
            />
            <CardBody className="px-0">
              {mine.length === 0 ? (
                <div className="py-6 px-4">
                  <EmptyState
                    title="No complaints filed yet"
                    description="You have not submitted any complaints yet. Report an issue to get started."
                  />
                </div>
              ) : (
                <ComplaintTable
                  complaints={mine.slice(0, 5)}
                  departments={departments}
                  detailBase="/student/complaints"
                />
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
