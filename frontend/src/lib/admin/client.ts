"use client";

export class ApiError extends Error {
  status: number;
  errors: { field: string; message: string }[];
  constructor(message: string, status: number, errors: { field: string; message: string }[] = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch("/api/v1/auth/refresh", { method: "POST", credentials: "same-origin" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => (refreshing = null), 0);
      });
  }
  return refreshing;
}

function toLogin() {
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/admin/login")) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/admin/login?next=${next}`;
  }
}

type Options = { method?: string; body?: unknown; form?: FormData; query?: Record<string, string | number | boolean | null | undefined> };

/**
 * Admin API client. Sends the HTTP-only session cookie automatically, adds the
 * double-submit CSRF header, and transparently rotates the session once on 401.
 */
export async function api<T = unknown>(path: string, opts: Options = {}, retry = true): Promise<T> {
  const method = (opts.method || (opts.body || opts.form ? "POST" : "GET")).toUpperCase();
  const qs = opts.query
    ? "?" +
      Object.entries(opts.query)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const headers: Record<string, string> = { accept: "application/json" };
  if (method !== "GET") headers["x-csrf-token"] = readCookie("csrf_token");
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(`/api/v1${path}${qs === "?" ? "" : qs}`, { method, headers, body, credentials: "same-origin" });

  if (res.status === 401 && retry && !path.startsWith("/auth/login")) {
    if (await refreshSession()) return api<T>(path, opts, false);
    toLogin();
    throw new ApiError("Your session has ended. Sign in again.", 401);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(typeof data?.detail === "string" ? data.detail : `Request failed (${res.status})`, res.status, data?.errors ?? []);
  }
  return data as T;
}

export async function upload(file: File, purpose: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("purpose", purpose);
  return api<{ id: number; url: string; kind: string; original_filename: string | null; size_bytes: number }>("/admin/media/upload", { form });
}
