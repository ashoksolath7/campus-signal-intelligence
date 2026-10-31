import { useState, useEffect } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Sparkles } from "lucide-react";

import { StatusTimeline } from "../../components/complaints/StatusTimeline";
import { PageHeader } from "../../components/layout/PageHeader";
import { Alert } from "../../components/ui/Alert";
import { PriorityBadge, StatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Field, Select, TextArea } from "../../components/ui/Field";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { useCampusStore } from "../../context/CampusStore";
import { getComplaintByIdApi } from "../../services/complaints";
import type { Complaint, ComplaintStatus, Priority } from "../../types/domain";
import { categoryLabel, formatDate } from "../../utils/format";
import {
  classifyComplaintApi,
  detectDuplicatesApi,
  type AIClassifyResult,
  type DuplicateMatch,
} from "../../services/ai";

export function ComplaintDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const { complaints, departments, updateComplaint } = useCampusStore();

  const storeComplaint = complaints.find((item) => item.id === id || item.ticket === id);
  const [remoteComplaint, setRemoteComplaint] = useState<Complaint | null>(null);
  const [isLoadingTicket, setIsLoadingTicket] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  const complaint = storeComplaint ?? remoteComplaint;

  const [status, setStatus] = useState<ComplaintStatus>("submitted");
  const [priority, setPriority] = useState<Priority>("medium");
  const [departmentId, setDepartmentId] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // AI state
  const [aiTriage, setAiTriage] = useState<AIClassifyResult | null>(null);
  const [similarTickets, setSimilarTickets] = useState<DuplicateMatch[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const created = Boolean((location.state as { created?: boolean } | null)?.created);
  const canManage = user?.role === "admin" || user?.role === "staff";

  // Fetch from MongoDB API if not found in local store (e.g. on direct page reload)
  useEffect(() => {
    if (storeComplaint) {
      return;
    }
    if (!id) return;

    setIsLoadingTicket(true);
    setTicketError(null);
    getComplaintByIdApi(id)
      .then((data) => {
        setRemoteComplaint(data);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setTicketError(msg || "Could not locate ticket in database.");
      })
      .finally(() => {
        setIsLoadingTicket(false);
      });
  }, [id, storeComplaint]);

  useEffect(() => {
    if (!complaint) return;
    setStatus(complaint.status);
    setPriority(complaint.priority);
    setDepartmentId(complaint.departmentId);

    // Run background AI analysis for triage insights & duplicate check
    let isCancelled = false;
    setIsLoadingAi(true);

    Promise.all([
      classifyComplaintApi({
        title: complaint.title,
        description: complaint.description,
        location: complaint.location,
      }),
      detectDuplicatesApi({
        title: complaint.title,
        description: complaint.description,
        category: complaint.category,
        location: complaint.location,
        threshold: 0.45,
      }),
    ])
      .then(([triage, dups]) => {
        if (!isCancelled) {
          setAiTriage(triage);
          setSimilarTickets(dups.matches.filter((m) => m.complaintId !== complaint.id));
        }
      })
      .catch((err) => {
        console.warn("AI Triage lookup error:", err);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingAi(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [complaint?.id]);

  if (isLoadingTicket) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner label="Loading ticket from MongoDB…" />
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="space-y-4">
        <PageHeader title="Complaint not found" />
        <Alert tone="error">{ticketError ?? "That ticket is not in the system."}</Alert>
        <Link to={canManage ? "/admin/complaints" : "/student/complaints"}>
          <Button variant="outline">Back to list</Button>
        </Link>
      </div>
    );
  }

  const department = departments.find((item) => item.id === complaint.departmentId);

  function applyAiSuggestion() {
    if (!aiTriage) return;
    setPriority(aiTriage.priority);
    if (aiTriage.departmentHint) {
      const match = departments.find(
        (d) =>
          d.name.toLowerCase().includes(aiTriage.departmentHint!.toLowerCase()) ||
          aiTriage.departmentHint!.toLowerCase().includes(d.name.toLowerCase()),
      );
      if (match) {
        setDepartmentId(match.id);
      }
    }
  }

  async function handleSaveUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!complaint || !user) return;

    setIsSaving(true);
    setSaveError(null);
    setSaved(false);

    try {
      await updateComplaint(
        complaint.id,
        { status, priority, departmentId },
        user.name,
        note.trim() || undefined,
      );
      setSaved(true);
      setNote("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg || "Failed to update complaint in database.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={complaint.ticket}
        description={complaint.title}
        actions={
          <Link to={canManage ? "/admin/complaints" : "/student/tracking"}>
            <Button variant="outline">{canManage ? "All complaints" : "Track status"}</Button>
          </Link>
        }
      />
      {created ? (
        <Alert tone="success">Complaint submitted and stored in MongoDB. Tracking is active immediately.</Alert>
      ) : null}
      {saved ? (
        <Alert tone="success">Complaint workflow updated and recorded to the audit log.</Alert>
      ) : null}
      {saveError ? <Alert tone="error">{saveError}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Details" />
          <CardBody className="space-y-4 text-sm">
            <p className="leading-6 text-slate-600">{complaint.description}</p>
            {complaint.imageUrl && (
              <div className="rounded-lg border border-slate-200 p-2 bg-slate-50">
                <span className="block text-xs font-semibold text-slate-500 mb-1.5">Attached Evidence Photo:</span>
                <img
                  src={complaint.imageUrl}
                  alt={`Attachment for ${complaint.ticket}`}
                  className="max-h-64 max-w-full rounded object-contain border border-slate-200 bg-white"
                />
              </div>
            )}
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Category</dt>
                <dd className="font-medium">{categoryLabel[complaint.category]}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Department</dt>
                <dd className="font-medium">{department?.name ?? "Unassigned"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Location</dt>
                <dd className="font-medium">{complaint.location}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Submitted</dt>
                <dd className="font-medium">{formatDate(complaint.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Student</dt>
                <dd className="font-medium">{complaint.studentName} ({complaint.studentEmail})</dd>
              </div>
              <div className="flex gap-2">
                <StatusBadge status={complaint.status} />
                <PriorityBadge priority={complaint.priority} />
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Status tracking" />
          <CardBody>
            <StatusTimeline complaint={complaint} />
          </CardBody>
        </Card>
      </div>

      {/* AI Triage & Semantic Intelligence Insights Card */}
      <Card className="border-brand-200 bg-slate-50/60">
        <CardHeader
          title="AI Signal & Triage Intelligence"
          description="Explainable urgency scoring, domain categorization, and semantic duplicate detection."
        />
        <CardBody className="space-y-4">
          {isLoadingAi ? (
            <div className="py-4">
              <Spinner label="Running AI signal triage & dense semantic duplicate analysis…" />
            </div>
          ) : aiTriage ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1 border-b border-slate-200">
                <span>Model: <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-800 font-mono text-[11px]">{aiTriage.modelUsed}</code></span>
                {aiTriage.categoryConfidence ? (
                  <span className="font-semibold text-brand-700">
                    Category Confidence: {Math.round(aiTriage.categoryConfidence * 100)}%
                  </span>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
                  <span className="text-xs font-medium text-slate-500">AI Priority & Urgency</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-navy-900">{Math.round(aiTriage.urgencyScore * 100)}</span>
                    <span className="text-xs text-slate-400">/ 100</span>
                  </div>
                  <span className="mt-1 inline-block text-xs font-semibold uppercase text-brand-600">
                    Suggested: {aiTriage.priority}
                  </span>
                  {aiTriage.priorityReasons && aiTriage.priorityReasons.length > 0 && (
                    <ul className="mt-2 list-disc list-inside text-[11px] text-slate-600 space-y-0.5">
                      {aiTriage.priorityReasons.map((r, i) => (
                        <li key={i} className="line-clamp-2">{r}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
                  <span className="text-xs font-medium text-slate-500">Predicted Category</span>
                  <div className="mt-1 text-base font-bold text-navy-900">
                    {categoryLabel[aiTriage.category]}
                  </div>
                  <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                    {aiTriage.reasoning}
                  </p>
                  {aiTriage.categoryReasons && aiTriage.categoryReasons.length > 0 && (
                    <ul className="mt-2 list-disc list-inside text-[11px] text-slate-500 space-y-0.5">
                      {aiTriage.categoryReasons.map((r, i) => (
                        <li key={i} className="line-clamp-2">{r}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
                  <span className="text-xs font-medium text-slate-500">Department Routing</span>
                  <div className="mt-1 text-sm font-semibold text-navy-900">
                    {aiTriage.departmentHint || "Facilities"}
                    {aiTriage.departmentCode ? ` (${aiTriage.departmentCode})` : ""}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {aiTriage.departmentReasoning || "Suggested operational campus department assignment."}
                  </p>
                </div>
              </div>

              {canManage && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 shrink-0 text-brand-600" />
                    <span>Apply AI-suggested priority ({aiTriage.priority.toUpperCase()}) and routing ({aiTriage.departmentHint})?</span>
                  </div>
                  <Button variant="outline" className="w-full sm:w-auto shrink-0 min-h-[44px] sm:min-h-0 text-xs py-1.5" onClick={applyAiSuggestion}>
                    Apply AI Suggestions
                  </Button>
                </div>
              )}

              {similarTickets.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-900">
                      Related / Semantically Similar Campus Tickets ({similarTickets.length})
                    </h4>
                    <span className="text-[11px] text-amber-700 italic">Admin approval required to merge</span>
                  </div>
                  <ul className="mt-2 space-y-2.5 text-sm text-amber-900">
                    {similarTickets.map((dup) => (
                      <li key={dup.complaintId} className="rounded bg-white/80 p-2.5 border border-amber-200">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                          <span>
                            <Link
                              to={`/admin/complaints/${dup.complaintId}`}
                              className="font-medium underline hover:text-amber-950"
                            >
                              {dup.ticket}
                            </Link>{" "}
                            — {dup.title}
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            {dup.denseSimilarity ? (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                                {Math.round(dup.denseSimilarity * 100)}% dense semantic
                              </span>
                            ) : null}
                            <span className="text-xs font-bold text-amber-800">
                              {Math.round(dup.similarityScore * 100)}% match
                            </span>
                          </div>
                        </div>
                        {dup.evidence && (
                          <p className="mt-1 text-xs text-amber-700">
                            <strong>Evidence:</strong> {dup.evidence}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">AI triage data unavailable.</p>
          )}
        </CardBody>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader title="Manage workflow" description="Update status, priority, or routing department." />
          <CardBody>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSaveUpdate}>
              <Field label="Status" htmlFor="status">
                <Select
                  id="status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as ComplaintStatus)}
                >
                  <option value="submitted">Submitted</option>
                  <option value="in_review">In review</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </Select>
              </Field>
              <Field label="Priority" htmlFor="priority">
                <Select
                  id="priority"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as Priority)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </Select>
              </Field>
              <Field label="Department" htmlFor="department">
                <Select
                  id="department"
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                >
                  {departments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Internal note / update" htmlFor="note">
                <TextArea
                  id="note"
                  placeholder="Note recorded into ticket history and audit log"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>
              <div className="md:col-span-2">
                <Button type="submit" disabled={isSaving} className="w-full sm:w-auto min-h-[44px]">
                  {isSaving ? "Saving to database…" : "Save update"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
