const DEFAULT_API_URL = "http://localhost:4000";

function normalizeApiUrl(value: string | undefined): string {
  return (value?.trim() || DEFAULT_API_URL).replace(/\/+$/, "");
}

const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
const ACCESS_TOKEN_KEY = "parkflow:access-token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(apiUrl("/api/auth/refresh"), {
      method: "POST",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          setAccessToken(null);
          return false;
        }
        const data = (await res.json()) as { accessToken?: string };
        if (data.accessToken) setAccessToken(data.accessToken);
        return true;
      })
      .catch(() => {
        setAccessToken(null);
        return false;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export interface ApiFetchOptions extends RequestInit {
  skipRefreshRetry?: boolean;
}

export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipRefreshRetry, ...init } = options;
  const isFormData = init.body instanceof FormData;
  const accessToken = getAccessToken();

  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && !skipRefreshRetry && !path.startsWith("/api/auth/refresh") && path !== "/api/auth/login") {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return apiFetch<T>(path, { ...options, skipRefreshRetry: true });
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    if (res.status === 401) setAccessToken(null);
    const message =
      typeof body === "object" && body && "error" in body
        ? (body as { error: { message: string; code: string } }).error.message
        : "Something went wrong. Please try again.";
    const code =
      typeof body === "object" && body && "error" in body
        ? (body as { error: { message: string; code: string } }).error.code
        : "UNKNOWN";
    throw new ApiError(message, code, res.status);
  }

  return body as T;
}

export function apiUrl(path: string): string {
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export { API_URL };
