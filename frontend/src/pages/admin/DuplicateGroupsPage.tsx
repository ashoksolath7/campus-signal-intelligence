import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Sparkles, CheckCircle2 } from "lucide-react";

import { PageHeader } from "../../components/layout/PageHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Field, Select } from "../../components/ui/Field";
import { PreviewBanner } from "../../components/ui/PreviewBanner";
import { useAuth } from "../../context/AuthContext";
import { useCampusStore } from "../../context/CampusStore";
import { createId } from "../../utils/format";
import {
  getSuggestedDuplicatesApi,
  type SuggestedDuplicateGroup,
} from "../../services/ai";

export function DuplicateGroupsPage() {
  const { user } = useAuth();
  const { complaints, updateComplaint, groupComplaints } = useCampusStore();
  const [primary, setPrimary] = useState(complaints[0]?.id ?? "");
  const [secondary, setSecondary] = useState(complaints[1]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isGrouping, setIsGrouping] = useState(false);

  // Sync initial primary & secondary once complaints load
  useEffect(() => {
    if (complaints.length >= 2) {
      if (!primary) setPrimary(complaints[0].id);
      if (!secondary) setSecondary(complaints[1].id);
    }
  }, [complaints, primary, secondary]);

  // AI Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const [suggestedClusters, setSuggestedClusters] = useState<SuggestedDuplicateGroup[]>([]);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const grouped = complaints.filter((complaint) => complaint.duplicateGroupId);
  const groups = [...new Set(grouped.map((complaint) => complaint.duplicateGroupId))] as string[];

  useEffect(() => {
    // Perform initial AI duplicate scan
    runAiScan();
  }, [complaints.length]);

  async function runAiScan() {
    setIsScanning(true);
    setScanMessage(null);
    try {
      const res = await getSuggestedDuplicatesApi(0.50);
      setSuggestedClusters(res.suggestedGroups);
      if (res.suggestedGroups.length > 0) {
        setScanMessage(`AI identified ${res.suggestedGroups.length} candidate duplicate cluster(s) across campus.`);
      } else {
        setScanMessage("No new duplicate clusters detected with current threshold.");
      }
    } catch (err) {
      console.warn("AI Duplicate scan failed:", err);
    } finally {
      setIsScanning(false);
    }
  }

  function handleGroupCluster(cluster: SuggestedDuplicateGroup) {
    const groupId = cluster.groupId || createId("dup");
    // Update primary
    updateComplaint(
      cluster.primaryId,
      { duplicateGroupId: groupId },
      user?.name ?? "Admin",
      `Grouped into AI duplicate cluster: ${cluster.commonTheme}`,
    );
    // Update all members
    for (const memId of cluster.memberIds) {
      updateComplaint(
        memId,
        { duplicateGroupId: groupId },
        user?.name ?? "Admin",
        `Grouped into AI duplicate cluster: ${cluster.commonTheme}`,
      );
    }
    // Remove cluster from suggested
    setSuggestedClusters((prev) => prev.filter((c) => c.groupId !== cluster.groupId));
    setMessage(`Tickets for "${cluster.commonTheme}" grouped successfully.`);
  }

  async function groupSelected() {
    if (!primary || !secondary || primary === secondary) {
      setMessage("Choose two different tickets.");
      return;
    }
    setIsGrouping(true);
    try {
      await groupComplaints(primary, secondary);
      setMessage("Tickets grouped successfully in MongoDB.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage(msg || "Failed to group tickets.");
    } finally {
      setIsGrouping(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Duplicate complaint groups"
        description="Review suspected duplicates, run AI duplicate clustering, and group tickets."
        actions={
          <Button
            variant="outline"
            onClick={runAiScan}
            disabled={isScanning}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4 text-brand-600" />
            {isScanning ? "Scanning..." : "Rescan with AI"}
          </Button>
        }
      />
      <PreviewBanner />

      {message ? <Alert tone="success">{message}</Alert> : null}
      {scanMessage ? <Alert tone="info">{scanMessage}</Alert> : null}

      {/* AI Suggested Clusters Card */}
      {suggestedClusters.length > 0 ? (
        <Card className="border-brand-200 bg-brand-50/40">
          <CardHeader
            title="AI Recommended Duplicate Clusters"
            description="Dense sentence embedding clusters for administrative review. Complaints are never merged automatically."
          />
          <CardBody className="space-y-4">
            <div className="rounded border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              <strong>Admin Supervision Notice:</strong> The clusters below were identified using semantic sentence embeddings. No complaints are grouped until an administrator clicks <strong>Group Cluster</strong>.
            </div>

            {suggestedClusters.map((cluster) => (
              <div
                key={cluster.groupId}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-lg border border-brand-200 bg-white p-4 shadow-sm"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      Primary: {cluster.primaryTicket}
                    </span>
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                      {Math.round(cluster.averageSimilarity * 100)}% match
                    </span>
                    {cluster.engine && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono text-slate-600">
                        {cluster.engine}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-700">{cluster.commonTheme}</p>
                  <p className="text-xs text-slate-500">
                    Candidate duplicates ({cluster.memberTickets.length}): {cluster.memberTickets.join(", ")}
                  </p>
                  {cluster.evidence && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100">
                      <span className="font-semibold text-slate-700">Semantic Evidence:</span> {cluster.evidence}
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => handleGroupCluster(cluster)}
                  className="w-full sm:w-auto min-h-[44px] sm:min-h-0 gap-1.5 shrink-0 justify-center"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve & Group Cluster
                </Button>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Manual grouping" description="Group any two individual tickets together." />
        <CardBody className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Field label="Primary ticket" htmlFor="primary">
            <Select id="primary" value={primary} onChange={(event) => setPrimary(event.target.value)}>
              {complaints.map((complaint) => (
                <option key={complaint.id} value={complaint.id}>
                  {complaint.ticket} — {complaint.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Possible duplicate" htmlFor="secondary">
            <Select
              id="secondary"
              value={secondary}
              onChange={(event) => setSecondary(event.target.value)}
            >
              {complaints.map((complaint) => (
                <option key={complaint.id} value={complaint.id}>
                  {complaint.ticket} — {complaint.title}
                </option>
              ))}
            </Select>
          </Field>
          <Button onClick={groupSelected} disabled={isGrouping} className="w-full md:w-auto min-h-[44px] justify-center">
            {isGrouping ? "Grouping in database…" : "Group tickets"}
          </Button>
        </CardBody>
      </Card>

      {groups.map((groupId) => {
        const members = complaints.filter((complaint) => complaint.duplicateGroupId === groupId);
        return (
          <Card key={groupId}>
            <CardHeader title={`Group ${groupId}`} description={`${members.length} related tickets`} />
            <CardBody className="space-y-3">
              {members.map((complaint) => (
                <div key={complaint.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div>
                    <Link className="font-medium text-brand-600" to={`/admin/complaints/${complaint.id}`}>
                      {complaint.ticket}
                    </Link>
                    <p className="text-slate-500">{complaint.title}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      updateComplaint(
                        complaint.id,
                        { duplicateGroupId: undefined },
                        user?.name ?? "Admin",
                        "Removed from duplicate group.",
                      )
                    }
                  >
                    Ungroup
                  </Button>
                </div>
              ))}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
