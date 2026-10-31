import { useState } from "react";

import { PageHeader } from "../../components/layout/PageHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Field, TextInput } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { PreviewBanner } from "../../components/ui/PreviewBanner";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { useCampusStore } from "../../context/CampusStore";
import { firstError, required, validEmail } from "../../utils/validation";

export function DepartmentManagementPage() {
  const { user } = useAuth();
  const { departments, addDepartment, updateDepartment, loading, error } = useCampusStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [head, setHead] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = user?.role === "admin";

  async function submit() {
    const nextErrors = {
      name: required(name, "Name") ?? "",
      code: required(code, "Code") ?? "",
      head: required(head, "Head") ?? "",
      email: firstError(required(email, "Email"), validEmail(email)) ?? "",
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setSaved(false);

    try {
      await addDepartment({ name, code: code.toUpperCase(), head, email, active: true });
      setOpen(false);
      setName("");
      setCode("");
      setHead("");
      setEmail("");
      setSaved(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg || "Failed to add department to database.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleStatus(deptId: string, currentActive: boolean) {
    if (!isAdmin) return;
    setActionError(null);
    try {
      await updateDepartment(deptId, { active: !currentActive }, user?.name ?? "Admin");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg || "Failed to update department status.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Department management"
        description="Configure campus routing departments and ticket dispatch targets stored in MongoDB Atlas."
        actions={isAdmin ? <Button onClick={() => setOpen(true)}>Add department</Button> : null}
      />
      <PreviewBanner />

      {!isAdmin ? (
        <Alert tone="info">
          Staff View: Department configuration changes require Administrator privileges.
        </Alert>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}
      {actionError ? <Alert tone="error">{actionError}</Alert> : null}
      {saved ? <Alert tone="success">Department created and persisted to MongoDB Atlas.</Alert> : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner label="Loading departments from MongoDB…" />
        </div>
      ) : (
        <Card>
          <CardBody className="px-0">
            {departments.length === 0 ? (
              <div className="p-6">
                <EmptyState title="No departments found" description="No campus routing departments configured yet." />
              </div>
            ) : (
              <>
                {/* Mobile Card View (shown below md breakpoint: 320px, 375px, 390px, 430px) */}
                <div className="divide-y divide-slate-100 md:hidden">
                  {departments.map((department) => (
                    <div key={department.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold bg-navy-900 text-white px-2 py-0.5 rounded">
                            {department.code}
                          </span>
                          <span className="font-semibold text-sm text-navy-900">{department.name}</span>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            department.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {department.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-0.5">
                        <p><strong className="text-slate-700">Head:</strong> {department.head}</p>
                        <p><strong className="text-slate-700">Email:</strong> {department.email}</p>
                      </div>
                      {isAdmin ? (
                        <div className="pt-1">
                          <Button
                            variant="outline"
                            className="w-full text-xs py-1.5 min-h-[38px]"
                            onClick={() => handleToggleStatus(department.id, department.active)}
                          >
                            {department.active ? "Deactivate department" : "Activate department"}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                {/* Desktop & Tablet Table View (shown from md breakpoint upwards: 768px+) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Name</th>
                        <th className="px-5 py-3">Code</th>
                        <th className="px-5 py-3">Head</th>
                        <th className="px-5 py-3">Email</th>
                        <th className="px-5 py-3">Status</th>
                        {isAdmin ? <th className="px-5 py-3">Action</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {departments.map((department) => (
                        <tr key={department.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                          <td className="px-5 py-3 font-medium text-navy-900">{department.name}</td>
                          <td className="px-5 py-3 font-mono text-xs">{department.code}</td>
                          <td className="px-5 py-3">{department.head}</td>
                          <td className="px-5 py-3 text-slate-600">{department.email}</td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                department.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {department.active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          {isAdmin ? (
                            <td className="px-5 py-3">
                              <Button
                                variant="outline"
                                onClick={() => handleToggleStatus(department.id, department.active)}
                              >
                                {department.active ? "Deactivate" : "Activate"}
                              </Button>
                            </td>
                          ) : null}
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

      {open ? (
        <Modal
          title="Add department"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={isSubmitting}>
                {isSubmitting ? "Saving to database…" : "Save department"}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Department name" htmlFor="name" error={errors.name}>
              <TextInput id="name" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Code (e.g. IT, FAC)" htmlFor="code" error={errors.code}>
              <TextInput id="code" value={code} onChange={(event) => setCode(event.target.value)} />
            </Field>
            <Field label="Department head" htmlFor="head" error={errors.head}>
              <TextInput id="head" value={head} onChange={(event) => setHead(event.target.value)} />
            </Field>
            <Field label="Dispatch email" htmlFor="email" error={errors.email}>
              <TextInput
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
