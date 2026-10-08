/**
 * Ritual API boundary.
 *
 * Core Ritual does not need this module to function. When a private backend is
 * introduced, keep provider credentials server-side and point this client at
 * that backend through VITE-style/build-time configuration or an injected
 * public base URL. Never put a private provider key in this file or the APK.
 */

export function getApiConfig() {
  const baseUrl = (globalThis.RITUAL_API_BASE_URL || "").trim();
  return {
    enabled: Boolean(baseUrl),
    baseUrl: baseUrl.replace(/\/+$/, ""),
    publicApiKey: (globalThis.RITUAL_PUBLIC_API_KEY || "").trim()
  };
}

export async function ritualApi(path, options = {}) {
  const config = getApiConfig();
  if (!config.enabled) {
    throw new Error("Ritual API is not configured.");
  }

  const response = await fetch(config.baseUrl + "/" + String(path).replace(/^\/+/, ""), {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error("Ritual API request failed: " + response.status);
  }

  return response.json();
}
