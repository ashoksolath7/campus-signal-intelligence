import { PageHeader } from "../../components/layout/PageHeader";
import { Alert } from "../../components/ui/Alert";
import { Card, CardBody } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PreviewBanner } from "../../components/ui/PreviewBanner";
import { Spinner } from "../../components/ui/Spinner";
import { useCampusStore } from "../../context/CampusStore";
import { formatDate } from "../../utils/format";

export function AuditLogsPage() {
  const { auditLogs, loading, error } = useCampusStore();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit logs"
        description="Chronological security and operations event trail recorded in MongoDB Atlas."
      />
      <PreviewBanner />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner label="Loading audit trail from MongoDB…" />
        </div>
      ) : (
        <Card>
          <CardBody>
            {auditLogs.length === 0 ? (
              <EmptyState
                title="No audit events recorded yet"
                description="Status changes, department assignments, and user operations will appear here."
              />
            ) : (
              <ol className="space-y-3">
                {auditLogs.map((log) => (
                  <li key={log.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-medium text-navy-900">
                      {log.action.replaceAll("_", " ")} · {log.target}
                    </p>
                    <p className="text-sm text-slate-600">{log.detail}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {log.actor} · {formatDate(log.at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
