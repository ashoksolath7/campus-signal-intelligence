import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Field, TextInput } from "../../components/ui/Field";
import { useAuth } from "../../context/AuthContext";
import { sendOtpApi, verifyOtpApi } from "../../services/auth";
import { firstError, minLength, required, validEmail } from "../../utils/validation";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // OTP flow state
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cooldown countdown effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Handle email change - reset verification if email changes
  function handleEmailChange(newEmail: string) {
    setEmail(newEmail);
    if (isVerified && newEmail.trim().toLowerCase() !== verifiedEmail.toLowerCase()) {
      setIsVerified(false);
      setVerifiedEmail("");
      setVerificationToken(null);
      setOtpSent(false);
      setOtp("");
      setOtpSuccess(null);
      setOtpError(null);
    }
  }

  // Send OTP handler
  async function handleSendOtp() {
    const emailErr = firstError(required(email, "Email"), validEmail(email));
    if (emailErr) {
      setErrors((prev) => ({ ...prev, email: emailErr }));
      return;
    }

    setErrors((prev) => ({ ...prev, email: "" }));
    setIsSendingOtp(true);
    setOtpError(null);
    setOtpSuccess(null);

    try {
      const res = await sendOtpApi(email);
      setOtpSent(true);
      setCooldown(res.cooldownSeconds || 60);
      setOtpSuccess(
        `Verification code sent to ${res.email}. Check your email inbox (valid for 5 minutes).`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setOtpError(msg || "Failed to send verification code. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  }

  // Verify OTP handler
  async function handleVerifyOtp() {
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setOtpError("Please enter a valid 6-digit numeric verification code.");
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);
    setOtpSuccess(null);

    try {
      const res = await verifyOtpApi(email, cleanOtp);
      if (res.verified) {
        setIsVerified(true);
        setVerifiedEmail(res.email);
        setVerificationToken(res.verificationToken ?? null);
        setOtpSuccess("✓ Email verified successfully! You can now complete your registration.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setOtpError(msg || "Invalid verification code. Please check and try again.");
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  // Registration submission
  async function submit() {
    const nextErrors = {
      name: required(name, "Full name") ?? "",
      email: firstError(required(email, "Email"), validEmail(email)) ?? "",
      studentId: required(studentId, "Student ID") ?? "",
      password: firstError(required(password, "Password"), minLength(password, 6, "Password")) ?? "",
      confirm: password !== confirm ? "Passwords do not match" : "",
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    if (!isVerified) {
      setFormError("Please verify your email address using the 6-digit OTP code before creating your account.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const failure = await register({
        name,
        email: verifiedEmail || email,
        studentId,
        password,
        verificationToken: verificationToken ?? undefined,
        otp: otp.trim() || undefined,
      });
      if (failure) {
        setFormError(failure);
        return;
      }
      navigate("/student");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">Student registration</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create your student account to submit and track campus issues.
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
        <Field label="Full name" htmlFor="name" error={errors.name}>
          <TextInput
            id="name"
            placeholder="Jane Doe"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        {/* Email Address with helper text directly below label & Send OTP button beside input */}
        <Field
          label="Email address"
          htmlFor="email"
          hint="Enter your email address (Gmail, Yahoo, Outlook, college email, etc.) to receive a 6-digit verification code."
          error={errors.email}
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <TextInput
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              disabled={isVerified}
              onChange={(event) => handleEmailChange(event.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant={isVerified ? "outline" : "secondary"}
              disabled={isSendingOtp || cooldown > 0 || isVerified}
              onClick={handleSendOtp}
              className="whitespace-nowrap sm:min-w-[120px] w-full sm:w-auto shrink-0 h-11"
            >
              {isSendingOtp
                ? "Sending…"
                : cooldown > 0
                ? `Resend (${cooldown}s)`
                : otpSent
                ? "Resend OTP"
                : "Send OTP"}
            </Button>
          </div>
        </Field>

        {isVerified && (
          <div className="flex items-center justify-between text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Verified: {verifiedEmail}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsVerified(false);
                setVerifiedEmail("");
                setVerificationToken(null);
                setOtpSent(false);
                setOtp("");
                setOtpSuccess(null);
                setOtpError(null);
              }}
              className="text-slate-600 hover:text-slate-900 underline font-medium ml-2"
            >
              Change email
            </button>
          </div>
        )}

        {/* OTP Entry Section */}
        {otpSent && !isVerified && (
          <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="otp" className="block text-sm font-medium text-navy-900">
                Enter 6-digit verification code
              </label>
              <Badge className="bg-sky-100 text-sky-800">Expires in 5m</Badge>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-lg font-mono tracking-widest text-slate-900 shadow-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Button
                type="button"
                variant="primary"
                disabled={isVerifyingOtp || otp.trim().length !== 6}
                onClick={handleVerifyOtp}
                className="whitespace-nowrap sm:min-w-[120px] w-full sm:w-auto shrink-0 h-11"
              >
                {isVerifyingOtp ? "Verifying…" : "Verify code"}
              </Button>
            </div>

            <p className="text-xs text-slate-500">
              A 6-digit code was dispatched to your inbox. Max 5 verification attempts allowed.
            </p>
          </div>
        )}

        {/* Status Feedback Alerts */}
        {otpSuccess && <Alert tone="success">{otpSuccess}</Alert>}
        {otpError && <Alert tone="error">{otpError}</Alert>}

        <Field label="Student ID" htmlFor="studentId" error={errors.studentId}>
          <TextInput
            id="studentId"
            placeholder="STU-12345"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
          />
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password}>
          <TextInput
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm}>
          <TextInput
            id="confirm"
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </Field>

        <Button
          type="submit"
          className="w-full h-11"
          disabled={isSubmitting || !isVerified}
        >
          {isSubmitting
            ? "Creating account…"
            : !isVerified
            ? "Verify email with OTP to proceed"
            : "Create account"}
        </Button>
      </form>

      <p className="text-sm text-slate-500">
        Already have an account?{" "}
        <Link className="font-medium text-brand-600" to="/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}
