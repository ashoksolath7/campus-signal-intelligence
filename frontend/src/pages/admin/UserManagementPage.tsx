import { useState } from "react";

import { PageHeader } from "../../components/layout/PageHeader";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Field, Select, TextInput } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { PreviewBanner } from "../../components/ui/PreviewBanner";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { useCampusStore } from "../../context/CampusStore";
import type { UserRole } from "../../types/domain";
import { firstError, minLength, required, validEmail } from "../../utils/validation";

export function UserManagementPage() {
  const { user } = useAuth();
  const { users, addUser, updateUser, loading, error } = useCampusStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [studentId, setStudentId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = user?.role === "admin";

  async function submit() {
    const nextErrors = {
      name: required(name, "Name") ?? "",
      email: firstError(required(email, "Email"), validEmail(email)) ?? "",
      password: firstError(required(password, "Password"), minLength(password, 6, "Password")) ?? "",
      studentId: role === "student" ? (required(studentId, "Student ID") ?? "") : "",
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setSaved(false);

    try {
      await addUser({
        name,
        email: email.trim().toLowerCase(),
        password,
        role,
        studentId: studentId.trim() || undefined,
        active: true,
      });
      setOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setStudentId("");
      setSaved(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg || "Failed to add user to database.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleUser(targetId: string, currentActive: boolean) {
    if (!isAdmin) return;
    setActionError(null);
    try {
      await updateUser(targetId, { active: !currentActive }, user?.name ?? "Admin");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg || "Failed to update user status.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User management"
        description="Directory of registered students, faculty, staff, and administrators in MongoDB Atlas."
        actions={isAdmin ? <Button onClick={() => setOpen(true)}>Add user</Button> : null}
      />
      <PreviewBanner />

      {!isAdmin ? (
        <Alert tone="info">
          Staff View: Managing and provisioning user accounts requires Administrator privileges.
        </Alert>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}
      {actionError ? <Alert tone="error">{actionError}</Alert> : null}
      {saved ? <Alert tone="success">User created and persisted in MongoDB Atlas.</Alert> : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner label="Loading users from MongoDB…" />
        </div>
      ) : (
        <Card>
          <CardBody className="px-0">
            {users.length === 0 ? (
              <div className="p-6">
                <EmptyState title="No users found" description="The user directory is currently empty." />
              </div>
            ) : (
              <>
                {/* Mobile Card View (320px - 767px) */}
                <div className="divide-y divide-slate-100 block md:hidden">
                  {users.map((item) => (
                    <div key={item.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-navy-900 text-sm">{item.name}</p>
                          <p className="text-xs text-slate-500 break-all">{item.email}</p>
                        </div>
                        <Badge
                          className={
                            item.role === "admin"
                              ? "bg-navy-900 text-white shrink-0"
                              : item.role === "faculty"
                              ? "bg-purple-800 text-white shrink-0"
                              : item.role === "staff"
                              ? "bg-amber-700 text-white shrink-0"
                              : "bg-blue-700 text-white shrink-0"
                          }
                        >
                          {item.role}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                        <span>
                          ID: <strong className="text-slate-700">{item.studentId || item.facultyId || item.staffId || "—"}</strong>
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            item.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      {isAdmin ? (
                        <div className="pt-1">
                          <Button
                            variant="outline"
                            className="w-full min-h-[44px] text-xs justify-center"
                            disabled={item.id === user?.id}
                            onClick={() => handleToggleUser(item.id, item.active)}
                          >
                            {item.active ? "Deactivate User" : "Activate User"}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                {/* Desktop Table View (>= 768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Name</th>
                        <th className="px-5 py-3">Email</th>
                        <th className="px-5 py-3">Role</th>
                        <th className="px-5 py-3">Identifier</th>
                        <th className="px-5 py-3">Status</th>
                        {isAdmin ? <th className="px-5 py-3">Action</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-5 py-3 font-medium">{item.name}</td>
                          <td className="px-5 py-3">{item.email}</td>
                          <td className="px-5 py-3">
                            <Badge
                              className={
                                item.role === "admin"
                                  ? "bg-navy-900 text-white"
                                  : item.role === "faculty"
                                  ? "bg-purple-800 text-white"
                                  : item.role === "staff"
                                  ? "bg-amber-700 text-white"
                                  : "bg-blue-700 text-white"
                              }
                            >
                              {item.role}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-500">
                            {item.studentId || item.facultyId || item.staffId || "—"}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                item.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {item.active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          {isAdmin ? (
                            <td className="px-5 py-3">
                              <Button
                                variant="outline"
                                disabled={item.id === user?.id}
                                onClick={() => handleToggleUser(item.id, item.active)}
                              >
                                {item.active ? "Deactivate" : "Activate"}
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
          title="Add user"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={isSubmitting}>
                {isSubmitting ? "Saving to database…" : "Save user"}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Full name" htmlFor="name" error={errors.name}>
              <TextInput id="name" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Email address" htmlFor="email" error={errors.email}>
              <TextInput
                id="email"
                type="email"
                placeholder="you@example.com (Gmail, Outlook, College, etc.)"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field label="Initial password" htmlFor="password" error={errors.password}>
              <TextInput
                id="password"
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Field label="Role" htmlFor="role">
              <Select id="role" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
                <option value="staff">Staff</option>
                <option value="admin">Administrator</option>
              </Select>
            </Field>
            {role === "student" ? (
              <Field label="Student ID" htmlFor="studentId" error={errors.studentId}>
                <TextInput
                  id="studentId"
                  placeholder="e.g. STU-20418"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                />
              </Field>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
