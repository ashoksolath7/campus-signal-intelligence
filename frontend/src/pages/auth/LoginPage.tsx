import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Field, Select, TextInput } from "../../components/ui/Field";
import { useAuth } from "../../context/AuthContext";
import {
  PREVIEW_ADMIN_EMAIL,
  PREVIEW_PASSWORD,
  PREVIEW_STUDENT_EMAIL,
} from "../../data/preview";
import type { UserRole } from "../../types/domain";
import { firstError, required, validEmail } from "../../utils/validation";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialPortal = params.get("portal") === "admin" ? "admin" : "student";
  const [role, setRole] = useState<UserRole>(initialPortal as UserRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    const nextErrors = {
      email: firstError(required(email, "Email"), validEmail(email)) ?? "",
      password: required(password, "Password") ?? "",
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const failure = await login(email, password, role);
      if (failure) {
        setFormError(failure);
        return;
      }
      navigate(role === "admin" || role === "staff" ? "/admin" : "/student");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose a portal and authenticate with your verified campus credentials.
        </p>
      </div>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field label="Portal" htmlFor="role">
          <Select
            id="role"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
          >
            <option value="student">Student Portal</option>
            <option value="faculty">Faculty Portal</option>
            <option value="admin">Admin Operations Portal</option>
            <option value="staff">Staff Operations Portal</option>
          </Select>
        </Field>
        <Field label="Email Address" htmlFor="email" error={errors.email}>
          <TextInput
            id="email"
            type="email"
            placeholder="you@example.com (Gmail, Outlook, College, etc.)"
            value={email}
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <TextInput
            id="password"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full min-h-[44px]" disabled={isSubmitting}>
          {isSubmitting ? "Authenticating…" : "Sign in"}
        </Button>
      </form>
      {import.meta.env.DEV && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-medium text-navy-900">Demo Accounts (Seeded in Atlas)</p>
          <p className="text-xs text-slate-500">
            Pre-seeded test credentials with PBKDF2 hashed passwords.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="text-xs min-h-[44px] justify-center"
              onClick={() => {
                setRole("student");
                setEmail(PREVIEW_STUDENT_EMAIL);
                setPassword(PREVIEW_PASSWORD);
                setFormError(null);
              }}
            >
              Student (Aisha)
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-xs min-h-[44px] justify-center"
              onClick={() => {
                setRole("admin");
                setEmail(PREVIEW_ADMIN_EMAIL);
                setPassword(PREVIEW_PASSWORD);
                setFormError(null);
              }}
            >
              Admin (Campus Admin)
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-xs min-h-[44px] justify-center"
              onClick={() => {
                setRole("faculty");
                setEmail("faculty@campus.edu");
                setPassword(PREVIEW_PASSWORD);
                setFormError(null);
              }}
            >
              Faculty (Dr. Rao)
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-xs min-h-[44px] justify-center"
              onClick={() => {
                setRole("staff");
                setEmail("staff@campus.edu");
                setPassword(PREVIEW_PASSWORD);
                setFormError(null);
              }}
            >
              Staff (Facilities)
            </Button>
          </div>
        </div>
      )}

      <p className="text-sm text-slate-500">
        New student or faculty?{" "}
        <Link className="font-medium text-brand-600" to="/register">
          Create an account
        </Link>
      </p>
    </div>
  );
}
