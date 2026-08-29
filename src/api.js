export const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "" : "http://localhost:8080");

export class ApiError extends Error {
  constructor(message, status, retryAfter = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function cookie(name) {
  const prefix = `${name}=`;
  const value = document.cookie
    .split("; ")
    .find((item) => item.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : null;
}

async function csrfToken() {
  await fetch(`${API_URL}/api/auth/csrf`, { credentials: "include" });
  return cookie("ECOMMERCE-XSRF-TOKEN");
}

async function readResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;
  return { response, data };
}

function apiError(response, data) {
  const fieldMessage = data?.fieldErrors && Object.values(data.fieldErrors)[0];
  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfter = retryAfterHeader
    ? Number.parseInt(retryAfterHeader, 10)
    : null;
  return new ApiError(
    fieldMessage || data?.message || `İşlem başarısız (${response.status})`,
    response.status,
    Number.isNaN(retryAfter) ? null : retryAfter,
  );
}

async function request(path, options = {}) {
  const method = options.method || "GET";
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = await csrfToken();
    if (token) headers["X-XSRF-TOKEN"] = token;
  }

  return readResponse(
    await fetch(`${API_URL}${path}`, {
      ...options,
      method,
      headers,
      credentials: "include",
    }),
  );
}

let refreshPromise = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = request("/api/auth/refresh", { method: "POST" })
      .then(({ response, data }) => {
        if (!response.ok) throw apiError(response, data);
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function api(path, options = {}) {
  let result = await request(path, options);
  const canRefresh =
    result.response.status === 401 && !path.startsWith("/api/auth/");

  if (canRefresh) {
    await refreshAccessToken();
    result = await request(path, options);
  }

  if (!result.response.ok) {
    throw apiError(result.response, result.data);
  }
  return result.data;
}
