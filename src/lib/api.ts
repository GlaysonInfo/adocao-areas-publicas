// src/lib/api.ts
export type ApiErrorPayload = {
  message?: string;
  error?: string;
  statusCode?: number;
};

export class ApiHttpError extends Error {
  status: number;
  payload?: ApiErrorPayload;

  constructor(status: number, message: string, payload?: ApiErrorPayload) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.payload = payload;
  }
}

function trimSlash(s: string) {
  return s.replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  const envBase = (import.meta as any)?.env?.VITE_API_BASE_URL;
  return trimSlash(String(envBase || "http://localhost:3333"));
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(url, {
    ...init,
    headers,
  });

  const text = await response.text();
  let payload: any = undefined;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      (typeof payload === "object" && payload?.message) ||
      (typeof payload === "object" && payload?.error) ||
      `HTTP ${response.status}`;

    throw new ApiHttpError(response.status, message, typeof payload === "object" ? payload : undefined);
  }

  return payload as T;
}
