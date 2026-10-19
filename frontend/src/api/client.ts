const API_BASE = "http://localhost:8000/api/v1";

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("sentinel_token");

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // If unauthorized, clear token if expired
    if (!endpoint.includes("/auth/login") && !endpoint.includes("/auth/demo-login")) {
      localStorage.removeItem("sentinel_token");
      localStorage.removeItem("sentinel_user");
    }
  }

  if (!response.ok) {
    let errorDetail = "An unexpected error occurred";
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(typeof errorDetail === "string" ? errorDetail : JSON.stringify(errorDetail));
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}
