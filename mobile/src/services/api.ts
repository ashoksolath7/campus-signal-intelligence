import axios from "axios";
import { API_BASE_URL } from "../utils/env";
import { deleteSecureItem, getSecureItem } from "./storage";
import type { ApiErrorResponse } from "../types/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  try {
    const token = await getSecureItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const demoMode = await getSecureItem("use_demo_mode");
    if (demoMode === "true") {
      config.headers["X-Demo-Mode"] = "true";
    }
  } catch {
    // Non-fatal
  }

  // Diagnostic logging: Outgoing API Request
  const fullUrl = `${config.baseURL || ""}${config.url || ""}`;
  console.log(`[API Diagnostic -> Request] ${config.method?.toUpperCase()} ${fullUrl}`);

  return config;
});

api.interceptors.response.use(
  (response) => {
    // Diagnostic logging: Successful API Response
    const fullUrl = `${response.config.baseURL || ""}${response.config.url || ""}`;
    console.log(
      `[API Diagnostic <- Response] ${response.status} ${response.config.method?.toUpperCase()} ${fullUrl}`,
    );
    return response;
  },
  async (error: unknown) => {
    if (axios.isAxiosError<ApiErrorResponse>(error)) {
      const status = error.response?.status;
      const url = error.config?.url ?? "";
      const fullUrl = `${error.config?.baseURL || ""}${url}`;
      const method = error.config?.method?.toUpperCase() || "UNKNOWN";

      // Diagnostic logging: Failed API Request
      console.error(`[API Diagnostic <! Error] ${method} ${fullUrl}`, {
        status: status ?? "NO_RESPONSE",
        code: error.code,
        message: error.message,
        responseData: error.response?.data,
      });

      // Clear expired credentials on 401 (excluding login / register)
      if (status === 401 && !url.includes("/auth/login") && !url.includes("/auth/register")) {
        await deleteSecureItem("token");
        await deleteSecureItem("session");
      }

      let message = error.response?.data?.error?.message;
      if (!message) {
        if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
          message = `Request timed out connecting to ${fullUrl}. Please verify your connection.`;
        } else if (error.message === "Network Error" || error.code === "ERR_NETWORK") {
          message = `Network Error connecting to ${fullUrl}. Check server accessibility and cleartext traffic policy.`;
        } else {
          message = error.message || "Network request failed. Please try again.";
        }
      }
      return Promise.reject(new Error(message));
    }
    console.error("[API Diagnostic <! Non-Axios Error]", error);
    return Promise.reject(error);
  },
);

