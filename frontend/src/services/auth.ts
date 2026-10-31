import { api } from "./api";
import type { SessionUser, UserRole } from "../types/domain";

export type AuthResponse = {
  accessToken: string;
  tokenType: string;
  user: SessionUser;
};

export type SendOtpResponse = {
  message: string;
  email: string;
  cooldownSeconds: number;
  expiresInSeconds: number;
  delivery?: {
    delivered: boolean;
    method: string;
    message?: string;
  };
};

export type VerifyOtpResponse = {
  message: string;
  email: string;
  verified: boolean;
  verificationToken?: string;
};

export async function sendOtpApi(email: string): Promise<SendOtpResponse> {
  const response = await api.post<SendOtpResponse>(
    "/api/v1/auth/send-otp",
    {
      email: email.trim().toLowerCase(),
    },
    {
      timeout: 25000, // 25-second timeout specifically for OTP email dispatch over SMTP
    },
  );
  return response.data;
}

export async function verifyOtpApi(email: string, otp: string): Promise<VerifyOtpResponse> {
  const response = await api.post<VerifyOtpResponse>("/api/v1/auth/verify-otp", {
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
  const response = await api.post<AuthResponse>("/api/v1/auth/login", {
    email,
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
  const response = await api.post<AuthResponse>("/api/v1/auth/register", input);
  return response.data;
}

export async function getMeApi(): Promise<SessionUser> {
  const response = await api.get<SessionUser>("/api/v1/auth/me");
  return response.data;
}
