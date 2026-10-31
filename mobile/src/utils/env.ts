import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Resolves the reachability address for the FastAPI backend across:
 * 1. Physical Android/iOS devices on the local Wi-Fi network
 * 2. Android Studio emulator (via 10.0.2.2)
 * 3. iOS Simulator & Web (via localhost / debugger host)
 * 4. Production deployment via explicit environment configuration
 */
export function resolveApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  // Derive host dynamically from Expo Metro server if available
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

  if (hostUri) {
    const ip = hostUri.split(":")[0];
    if (ip && ip !== "localhost" && ip !== "127.0.0.1") {
      return `http://${ip}:8000/api/v1`;
    }
  }

  // Primary LAN IP fallback for physical devices on Wi-Fi
  return "http://10.107.161.8:8000/api/v1";
}

export const API_BASE_URL = resolveApiBaseUrl();

if (__DEV__) {
  console.log(`[CSI Mobile] Configured API Base URL: ${API_BASE_URL}`);
}
