/**
 * Resolves the API base URL.
 * Prefers IPv4 127.0.0.1 on localhost to avoid macOS IPv6 (::1) connection refusal delays in Safari.
 * Aligns with the current hostname when accessed over LAN (e.g. physical phone or tablet).
 */
function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;

  if (typeof window !== "undefined" && window.location) {
    const currentHostname = window.location.hostname;
    const protocol = window.location.protocol;

    // IPv4 address check (e.g. 10.x.x.x, 192.168.x.x, 127.0.0.1)
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(currentHostname)) {
      return `${protocol}//${currentHostname}:8000`;
    }

    // On localhost, always prefer 127.0.0.1 to avoid macOS IPv6 (::1) socket refusal delays
    if (currentHostname === "localhost") {
      return `${protocol}//127.0.0.1:8000`;
    }

    if (configured) {
      return configured;
    }

    return `${protocol}//${currentHostname}:8000`;
  }

  return configured || "http://127.0.0.1:8000";
}

export const apiBaseUrl = resolveApiBaseUrl();
