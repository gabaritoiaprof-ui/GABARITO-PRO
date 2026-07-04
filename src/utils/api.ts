export function apiFetch(uri: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  const userStr = localStorage.getItem("gabarito_user");
  const headers = new Headers(options?.headers);
  if (userStr) {
    try {
      const userObj = JSON.parse(userStr);
      headers.set("x-user-id", userObj.id);
    } catch (e) {
      console.error("Error parsing user from localStorage", e);
    }
  }

  let targetUrl = typeof uri === "string" ? uri : uri.toString();
  // Support VITE_API_URL configuration for separated frontend hosting (like Vercel)
  let apiUrl = import.meta.env.VITE_API_URL || "";

  // If running in AI Studio preview or localhost, force relative paths to use the container's own Express backend
  const isAiStudio = typeof window !== "undefined" && (
    window.location.hostname.includes("ais-dev-") ||
    window.location.hostname.includes("ais-pre-") ||
    window.location.hostname.includes("localhost") ||
    window.location.hostname.includes("127.0.0.1")
  );

  if (isAiStudio) {
    apiUrl = "";
  }

  if (apiUrl && targetUrl.startsWith("/")) {
    targetUrl = `${apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl}${targetUrl}`;
  }

  return window.fetch(targetUrl, {
    ...options,
    headers
  });
}
