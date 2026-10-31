import { AlertTriangle, CheckCircle2, ClipboardList, Clock } from "lucide-react";
import { Link } from "react-router-dom";

import { CategoryChart } from "../../components/charts/CategoryChart";
import { DepartmentChart } from "../../components/charts/DepartmentChart";
import { PriorityChart } from "../../components/charts/PriorityChart";
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
import { isCritical, isOpenStatus, useCampusStore } from "../../context/CampusStore";
import { useHealth } from "../../hooks/useHealth";

export function AdminDashboard() {
  const { complaints, departments, analytics, loading, error, isLiveBackend } = useCampusStore();
  const { data: healthData, error: healthError, loading: healthLoading } = useHealth();

  const totalCount = analytics?.totalComplaints ?? complaints.length;
  const pendingCount =
    analytics?.pendingComplaints ?? complaints.filter((c) => isOpenStatus(c.status)).length;
  const resolvedCount =
    analytics?.resolvedComplaints ??
    complaints.filter((c) => c.status === "resolved" || c.status === "closed").length;
  const criticalCount =
    analytics?.criticalComplaints ?? complaints.filter((c) => isCritical(c.priority)).length;

  const sourceHint = isLiveBackend ? "MongoDB Atlas" : "Demo Fallback";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Dashboard"
        description="Campus signal intelligence operations overview and real-time MongoDB triage metrics."
        actions={
          <Link to="/admin/complaints">
            <Button>Review queue</Button>
          </Link>
        }
      />
      <PreviewBanner />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        <CardBody className="py-3">
          {healthLoading ? <Spinner label="Checking API health…" /> : null}
          {healthError ? <p className="text-sm text-rose-600">Health API unavailable: {healthError}</p> : null}
          {healthData ? (
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-slate-600">
                Backend Status: <strong className="text-emerald-700">{healthData.status}</strong> · MongoDB:{" "}
                <strong className={healthData.mongodb.status === "connected" ? "text-emerald-700" : "text-amber-700"}>
                  {healthData.mongodb.status}
                </strong>
                {healthData.mongodb.database ? ` (${healthData.mongodb.database})` : ""}
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {sourceHint}
              </span>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner label="Loading live data from MongoDB Atlas…" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total complaints" value={totalCount} hint={sourceHint} icon={ClipboardList} />
            <StatCard label="Pending complaints" value={pendingCount} hint="Open tickets" icon={Clock} />
            <StatCard label="Resolved complaints" value={resolvedCount} hint="Resolved / closed" icon={CheckCircle2} />
            <StatCard label="Critical complaints" value={criticalCount} hint="Critical priority" icon={AlertTriangle} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Complaint category distribution" />
              <CardBody>
                {complaints.length === 0 ? (
                  <EmptyState title="No complaint data" description="Category chart will populate as tickets are filed." />
                ) : (
                  <CategoryChart complaints={complaints} />
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Daily complaint trends" />
              <CardBody>
                {complaints.length === 0 ? (
                  <EmptyState title="No trend data" description="Daily trends will appear as tickets are received." />
                ) : (
                  <TrendChart complaints={complaints} />
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Priority distribution" />
              <CardBody>
                {complaints.length === 0 ? (
                  <EmptyState title="No priority data" description="Priority distribution will appear as tickets are filed." />
                ) : (
                  <PriorityChart complaints={complaints} />
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Department-wise complaints" />
              <CardBody>
                {complaints.length === 0 ? (
                  <EmptyState title="No department data" description="Department assignments will appear here." />
                ) : (
                  <DepartmentChart complaints={complaints} departments={departments} />
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="Latest tickets" />
            <CardBody className="px-0">
              {complaints.length === 0 ? (
                <div className="p-6">
                  <EmptyState title="No tickets in queue" description="New student tickets will appear here automatically." />
                </div>
              ) : (
                <ComplaintTable
                  complaints={complaints.slice(0, 6)}
                  departments={departments}
                  detailBase="/admin/complaints"
                />
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
