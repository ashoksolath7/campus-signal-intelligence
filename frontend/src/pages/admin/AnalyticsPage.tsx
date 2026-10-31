import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock } from "lucide-react";

import { CategoryChart } from "../../components/charts/CategoryChart";
import { DepartmentChart } from "../../components/charts/DepartmentChart";
import { PriorityChart } from "../../components/charts/PriorityChart";
import { TrendChart } from "../../components/charts/TrendChart";
import { PageHeader } from "../../components/layout/PageHeader";
import { StatCard } from "../../components/layout/StatCard";
import { Alert } from "../../components/ui/Alert";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PreviewBanner } from "../../components/ui/PreviewBanner";
import { Spinner } from "../../components/ui/Spinner";
import { useCampusStore } from "../../context/CampusStore";
import { getAnalyticsApi, type AnalyticsSummary } from "../../services/analytics";

export function AnalyticsPage() {
  const { complaints, departments, isLiveBackend } = useCampusStore();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);

    getAnalyticsApi()
      .then((data) => {
        if (!isCancelled) {
          setAnalyticsData(data);
        }
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg || "Failed to load live analytics.");
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const total = analyticsData?.totalComplaints ?? complaints.length;
  const pending = analyticsData?.pendingComplaints ?? complaints.filter((c) => c.status !== "resolved" && c.status !== "closed").length;
  const resolved = analyticsData?.resolvedComplaints ?? complaints.filter((c) => c.status === "resolved" || c.status === "closed").length;
  const critical = analyticsData?.criticalComplaints ?? complaints.filter((c) => c.priority === "critical").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Operations Analytics"
        description="Comprehensive real-time complaint telemetry, status trends, and category distribution from MongoDB Atlas."
      />
      <PreviewBanner />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner label="Computing real-time analytics from database…" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Tickets" value={total} hint={isLiveBackend ? "MongoDB Atlas" : "Demo"} icon={ClipboardList} />
            <StatCard label="Pending Triage" value={pending} hint="In-flight" icon={Clock} />
            <StatCard label="Resolved Tickets" value={resolved} hint="Completed" icon={CheckCircle2} />
            <StatCard label="Critical Escalations" value={critical} hint="Highest priority" icon={AlertTriangle} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Complaint category distribution" />
              <CardBody>
                {complaints.length === 0 ? (
                  <EmptyState title="No category data" description="Category breakdown will render as tickets are filed." />
                ) : (
                  <CategoryChart complaints={complaints} />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Daily complaint trends" />
              <CardBody>
                {complaints.length === 0 ? (
                  <EmptyState title="No trend data" description="Trends will populate as tickets are received over time." />
                ) : (
                  <TrendChart complaints={complaints} />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Priority distribution" />
              <CardBody>
                {complaints.length === 0 ? (
                  <EmptyState title="No priority data" description="Priority breakdown will render here." />
                ) : (
                  <PriorityChart complaints={complaints} />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Department-wise complaints" />
              <CardBody>
                {complaints.length === 0 ? (
                  <EmptyState title="No department data" description="Department routing volume will appear here." />
                ) : (
                  <DepartmentChart complaints={complaints} departments={departments} />
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
