export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiErrorResponse = {
  error: ApiErrorPayload;
  requestId?: string;
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

export type AuthResponse = {
  accessToken: string;
  tokenType: string;
  user: import("./domain").SessionUser;
};

