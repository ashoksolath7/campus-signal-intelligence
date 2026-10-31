import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, AlertTriangle, Image as ImageIcon, X } from "lucide-react";

import { PageHeader } from "../../components/layout/PageHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Field, Select, TextArea, TextInput } from "../../components/ui/Field";
import { useAuth } from "../../context/AuthContext";
import { useCampusStore } from "../../context/CampusStore";
import type { Category } from "../../types/domain";
import { required } from "../../utils/validation";
import {
  classifyComplaintApi,
  detectDuplicatesApi,
  type DuplicateMatch,
  type AIClassifyResult,
} from "../../services/ai";

const categories: Category[] = [
  "facilities",
  "academics",
  "hostel",
  "it",
  "safety",
  "transport",
  "other",
];

export function SubmitComplaintPage() {
  const { user } = useAuth();
  const { departments, addComplaint } = useCampusStore();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("facilities");
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [location, setLocation] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Sync initial department if loaded asynchronously
  if (!departmentId && departments.length > 0) {
    setDepartmentId(departments[0].id);
  }

  // AI Assist State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AIClassifyResult | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);

  if (!user) {
    return null;
  }

  async function handleAIAssist() {
    if (!title.trim() && !description.trim()) {
      setErrors((prev) => ({
        ...prev,
        title: "Enter a title or description first for AI assist.",
      }));
      return;
    }

    setIsAnalyzing(true);
    try {
      const [classification, dupCheck] = await Promise.all([
        classifyComplaintApi({
          title: title.trim(),
          description: description.trim(),
          location: location.trim() || undefined,
        }),
        detectDuplicatesApi({
          title: title.trim(),
          description: description.trim(),
          category,
          location: location.trim() || undefined,
          threshold: 0.45,
        }),
      ]);

      setAiResult(classification);
      setCategory(classification.category);

      // Auto-match department if hint matches
      if (classification.departmentHint) {
        const matchedDept = departments.find(
          (d) =>
            d.name.toLowerCase().includes(classification.departmentHint!.toLowerCase()) ||
            classification.departmentHint!.toLowerCase().includes(d.name.toLowerCase()),
        );
        if (matchedDept) {
          setDepartmentId(matchedDept.id);
        }
      }

      setDuplicateMatches(dupCheck.matches);
    } catch (err) {
      console.warn("AI Assist encountered an issue:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function submit() {
    if (!user) {
      return;
    }
    const nextErrors = {
      title: required(title, "Title") ?? "",
      description: required(description, "Description") ?? "",
      location: required(location, "Location") ?? "",
      departmentId: required(departmentId, "Department") ?? "",
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const created = await addComplaint(
        { title, description, category, departmentId, location, imageUrl: imageUrl || undefined },
        user,
      );
      navigate(`/student/complaints/${created.id}`, { state: { created: true } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(msg || "Failed to submit complaint to database.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submit a complaint"
        description="Submit your issue for automatic AI prioritization and department dispatch."
      />

      {submitError ? <Alert tone="error">{submitError}</Alert> : null}

      {duplicateMatches.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-1.5 flex-1">
              <p className="font-semibold">
                Possible duplicate tickets detected on campus:
              </p>
              <ul className="space-y-2 text-sm">
                {duplicateMatches.map((m) => (
                  <li key={m.complaintId} className="rounded bg-white/70 p-2 border border-amber-200">
                    <div className="flex items-center justify-between">
                      <span>
                        <Link
                          to={`/student/complaints/${m.complaintId}`}
                          className="font-medium underline hover:text-amber-800"
                        >
                          {m.ticket}
                        </Link>{" "}
                        — {m.title}
                      </span>
                      <span className="font-bold text-amber-800 text-xs">
                        {Math.round(m.similarityScore * 100)}% match
                      </span>
                    </div>
                    {m.evidence && (
                      <p className="text-xs text-amber-700 mt-1">
                        <strong>Evidence:</strong> {m.evidence}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-amber-700 pt-1">
                You can still proceed with submission if your issue is distinct.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {aiResult ? (
        <Alert tone="info">
          <div className="space-y-1 text-sm">
            <div className="font-semibold flex items-center justify-between">
              <span>✨ AI Recommendation: {aiResult.category.toUpperCase()} ({aiResult.priority.toUpperCase()} priority)</span>
              <span className="text-[11px] font-mono font-normal opacity-80">{aiResult.modelUsed}</span>
            </div>
            <p>{aiResult.reasoning}</p>
            {aiResult.departmentHint && (
              <p className="text-xs text-brand-800">
                <strong>Suggested Department:</strong> {aiResult.departmentHint} {aiResult.departmentCode ? `(${aiResult.departmentCode})` : ""}
              </p>
            )}
            {aiResult.priorityReasons && aiResult.priorityReasons.length > 0 && (
              <p className="text-xs text-brand-800">
                <strong>Priority Rationale:</strong> {aiResult.priorityReasons.join("; ")}
              </p>
            )}
          </div>
        </Alert>
      ) : null}

      <Card>
        <CardBody>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Field label="Title" htmlFor="title" error={errors.title}>
              <TextInput
                id="title"
                placeholder="e.g. Wi-Fi dropping on 2nd floor library"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>

            <Field label="Description" htmlFor="description" error={errors.description}>
              <TextArea
                id="description"
                placeholder="Describe the issue, when it started, and specific room details..."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-md bg-slate-50 p-3 border border-slate-200">
              <div className="text-xs text-slate-600">
                Let AI automatically triage your issue, predict priority, and verify if it's already reported.
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleAIAssist}
                disabled={isAnalyzing}
                className="w-full sm:w-auto shrink-0 min-h-[44px] sm:min-h-0 gap-2 justify-center"
              >
                <Sparkles className="h-4 w-4 text-brand-600" />
                {isAnalyzing ? "Analyzing..." : "AI Auto-Triage"}
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Category" htmlFor="category">
                <Select
                  id="category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as Category)}
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Department" htmlFor="department" error={errors.departmentId}>
                <Select
                  id="department"
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                >
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Location" htmlFor="location" error={errors.location}>
              <TextInput
                id="location"
                placeholder="e.g. Central Library, Reading Room 2"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </Field>

            <Field label="Photo / Evidence Attachment (Optional)" htmlFor="image-upload">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50">
                    <ImageIcon className="h-4 w-4 text-slate-500" />
                    <span>Upload Image</span>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === "string") {
                            setImageUrl(reader.result);
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800"
                    >
                      <X className="h-3.5 w-3.5" />
                      Remove photo
                    </button>
                  )}
                </div>
                {imageUrl && (
                  <div className="relative inline-block overflow-hidden rounded-md border border-slate-200">
                    <img src={imageUrl} alt="Complaint preview" className="h-28 w-auto object-cover" />
                  </div>
                )}
              </div>
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto min-h-[44px] justify-center">
                {isSubmitting ? "Submitting to database…" : "Submit ticket"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
