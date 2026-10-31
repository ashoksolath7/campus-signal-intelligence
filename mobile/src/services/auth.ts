import { api } from "./api";
import type { SessionUser, UserRole } from "../types/domain";
import type { AuthResponse, SendOtpResponse, VerifyOtpResponse } from "../types/api";

export async function sendOtpApi(email: string): Promise<SendOtpResponse> {
  const response = await api.post<SendOtpResponse>(
    "/auth/send-otp",
    { email: email.trim().toLowerCase() },
    { timeout: 25000 }, // Generous timeout for real SMTP delivery
  );
  return response.data;
}

export async function verifyOtpApi(email: string, otp: string): Promise<VerifyOtpResponse> {
  const response = await api.post<VerifyOtpResponse>("/auth/verify-otp", {
    email: email.trim().toLowerCase(),
    otp: otp.trim(),
  });
  return response.data;
}

export async function loginApi(
  email: string,
  password: string,
  role: UserRole,
): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/auth/login", {
    email: email.trim().toLowerCase(),
    password,
    role,
  });
  return response.data;
}

export async function registerApi(input: {
  name: string;
  email: string;
  studentId: string;
  password: string;
  otp?: string;
  verificationToken?: string;
  role?: UserRole;
}): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/auth/register", input);
  return response.data;
}

export async function getMeApi(): Promise<SessionUser> {
  const response = await api.get<SessionUser>("/auth/me");
  return response.data;
}

