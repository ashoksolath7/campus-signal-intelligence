import axios from "axios";

import type { ApiErrorResponse } from "../types/api";
import { apiBaseUrl } from "../utils/env";
import { readJson, removeItem } from "../utils/storage";

export const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 8000,
});


api.interceptors.request.use((config) => {
  try {
    const token = readJson<string>("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Demo mode is allowed only during local development.
    if (import.meta.env.DEV) {
      const demoMode =
        localStorage.getItem("demo_mode") ||
        localStorage.getItem("use_preview_fallback");

      if (demoMode === "true") {
        config.headers["X-Demo-Mode"] = "true";
      }
    }
  } catch {
    // Ignore storage issues in SSR / testing environments
  }

  return config;
});


api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError<ApiErrorResponse>(error)) {
      const status = error.response?.status;
      const url = error.config?.url ?? "";
      if (status === 401 && !url.includes("/auth/login") && !url.includes("/auth/register")) {
        removeItem("token");
        removeItem("session");
      }
      let message = error.response?.data?.error?.message;
      if (!message) {
        if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
          message = "Request timed out while waiting for server response. Please verify your connection or mail server configuration and try again.";
        } else {
          message = error.message || "Network request failed. Please try again.";
        }
      }
      return Promise.reject(new Error(message));
    }
    return Promise.reject(error);
  },
);
