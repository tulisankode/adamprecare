"use client";

import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import { env } from "./env";
import {
  authStore,
  getAccessToken,
  getRefreshToken,
  isStaffRole,
  setRefreshToken,
} from "./auth-store";
import type { ApiErrorBody, ApiErrorDetail, AuthTokens, DataEnvelope, PageEnvelope, PageMeta } from "./types";

/** Typed error built from `{ error: { code, message, details } }` (§1.1). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorMessage(err: unknown, fallback = "Terjadi kesalahan. Coba lagi."): string {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function isErrorBody(v: unknown): v is ApiErrorBody {
  return (
    typeof v === "object" &&
    v !== null &&
    "error" in v &&
    typeof (v as ApiErrorBody).error === "object" &&
    (v as ApiErrorBody).error !== null
  );
}

async function toApiError(err: unknown): Promise<ApiError> {
  if (err instanceof ApiError) return err;
  if (axios.isAxiosError(err)) {
    const res = err.response;
    if (!res) return new ApiError(0, "NETWORK_ERROR", "Tidak dapat terhubung ke server. Periksa koneksi Anda.");
    let body: unknown = res.data;
    // Blob responses (file export) carry the JSON error as a blob.
    if (typeof Blob !== "undefined" && body instanceof Blob) {
      try {
        body = JSON.parse(await body.text());
      } catch {
        body = null;
      }
    }
    if (isErrorBody(body)) {
      return new ApiError(res.status, body.error.code, body.error.message, body.error.details ?? []);
    }
    return new ApiError(res.status, res.status >= 500 ? "INTERNAL_ERROR" : "UNKNOWN", `Permintaan gagal (HTTP ${res.status}).`);
  }
  return new ApiError(0, "UNKNOWN", err instanceof Error ? err.message : "Terjadi kesalahan.");
}

/* ----------------------------------------------------------------------------
 * Session management
 * ------------------------------------------------------------------------- */

const bare = axios.create({ baseURL: env.apiBaseUrl, timeout: 20_000 });

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshPromise: Promise<string> | null = null;
let bootstrapPromise: Promise<void> | null = null;

export class NotStaffError extends ApiError {
  constructor() {
    super(403, "FORBIDDEN", "Akun ini tidak memiliki akses ke dashboard web. Gunakan akun Operator atau Admin.");
  }
}

function scheduleProactiveRefresh(expiresIn: number) {
  if (refreshTimer) clearTimeout(refreshTimer);
  // Refresh one minute before expiry so the socket handshake always has a fresh token.
  const ms = Math.max(30, expiresIn - 60) * 1000;
  refreshTimer = setTimeout(() => {
    refreshSession().catch(() => undefined);
  }, ms);
}

function applyTokens(tokens: AuthTokens) {
  if (!isStaffRole(tokens.user?.role)) {
    throw new NotStaffError();
  }
  setRefreshToken(tokens.refresh_token);
  authStore.set({ status: "authenticated", user: tokens.user, accessToken: tokens.access_token });
  scheduleProactiveRefresh(tokens.expires_in || 900);
}

export function clearSession() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  setRefreshToken(null);
  authStore.set({ status: "unauthenticated", user: null, accessToken: null });
}

/** Single-flight refresh: concurrent callers share one `/auth/refresh` call (the refresh token rotates). */
export function refreshSession(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearSession();
    return Promise.reject(new ApiError(401, "UNAUTHENTICATED", "Sesi berakhir. Silakan login kembali."));
  }
  refreshPromise = bare
    .post<DataEnvelope<AuthTokens>>("/auth/refresh", { refresh_token: refreshToken })
    .then((res) => {
      applyTokens(res.data.data);
      return res.data.data.access_token;
    })
    .catch(async (err) => {
      const apiErr = await toApiError(err);
      if (apiErr.status === 0) {
        // Server unreachable: keep the refresh token so a later reload can restore the session.
        if (refreshTimer) clearTimeout(refreshTimer);
        authStore.set({ status: "unauthenticated", user: null, accessToken: null });
      } else {
        clearSession();
      }
      throw apiErr;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

/** Restores the session from the stored refresh token once per page load. */
export function bootstrapSession(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    if (authStore.get().status === "authenticated") return;
    if (!getRefreshToken()) {
      authStore.set({ status: "unauthenticated", user: null, accessToken: null });
      return;
    }
    try {
      await refreshSession();
    } catch {
      /* clearSession already ran */
    }
  })();
  return bootstrapPromise;
}

export async function staffLogin(username: string, password: string) {
  try {
    const res = await bare.post<DataEnvelope<AuthTokens>>("/auth/staff/login", { username, password });
    applyTokens(res.data.data);
    return res.data.data.user;
  } catch (err) {
    if (err instanceof NotStaffError) {
      clearSession();
      throw err;
    }
    throw await toApiError(err);
  }
}

export async function logout() {
  const refreshToken = getRefreshToken();
  const accessToken = getAccessToken();
  clearSession();
  bootstrapPromise = null;
  if (refreshToken) {
    try {
      await bare.post(
        "/auth/logout",
        { refresh_token: refreshToken },
        { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined },
      );
    } catch {
      /* best effort */
    }
  }
}

/* ----------------------------------------------------------------------------
 * Authenticated axios instance
 * ------------------------------------------------------------------------- */

export const api = axios.create({ baseURL: env.apiBaseUrl, timeout: 30_000 });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const apiErr = await toApiError(error);
    const config = error.config as RetriableConfig | undefined;
    if (apiErr.status === 401 && apiErr.code === "UNAUTHENTICATED" && config && !config._retried) {
      config._retried = true;
      try {
        const token = await refreshSession();
        config.headers.set("Authorization", `Bearer ${token}`);
        return api.request(config);
      } catch {
        // refreshSession cleared the session; the route guard redirects to /login.
        throw apiErr;
      }
    }
    throw apiErr;
  },
);

/* ----------------------------------------------------------------------------
 * Unwrapping helpers
 * ------------------------------------------------------------------------- */

type Params = Record<string, string | number | boolean | null | undefined>;

/** Drops empty filter values so they are not sent as `?q=`. */
export function cleanParams(params?: Params): Params | undefined {
  if (!params) return undefined;
  const out: Params = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out;
}

export async function getData<T>(url: string, params?: Params, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.get<DataEnvelope<T>>(url, { ...config, params: cleanParams(params) });
  return res.data.data;
}

export async function getPage<T, M extends PageMeta = PageMeta>(
  url: string,
  params?: Params,
): Promise<PageEnvelope<T, M>> {
  const res = await api.get<PageEnvelope<T, M>>(url, { params: cleanParams(params) });
  return { data: res.data.data ?? [], meta: res.data.meta };
}

export async function postData<T>(url: string, body?: unknown): Promise<T> {
  const res = await api.post<DataEnvelope<T>>(url, body ?? {});
  return res.data.data;
}

export async function putData<T>(url: string, body?: unknown): Promise<T> {
  const res = await api.put<DataEnvelope<T>>(url, body ?? {});
  return res.data.data;
}

export async function patchData<T>(url: string, body?: unknown): Promise<T> {
  const res = await api.patch<DataEnvelope<T>>(url, body ?? {});
  return res.data.data;
}

/** Downloads a binary response with the auth header and triggers a browser save. */
export async function downloadFile(url: string, params: Params, fallbackName: string) {
  const res = await api.get<Blob>(url, { params: cleanParams(params), responseType: "blob" });
  const disposition = String(res.headers["content-disposition"] ?? "");
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Updates the cached user after PATCH /me. */
export function setCurrentUser(user: AuthTokens["user"]) {
  authStore.set({ user });
}
