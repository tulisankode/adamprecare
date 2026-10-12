"use client";

import { useSyncExternalStore } from "react";
import type { Role, StaffRole, User } from "./types";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  /** Access token lives only in memory. */
  accessToken: string | null;
}

const REFRESH_KEY = "apc.refresh";
const SERVER_SNAPSHOT: AuthState = { status: "loading", user: null, accessToken: null };

let state: AuthState = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

export const authStore = {
  get: (): AuthState => state,
  set(patch: Partial<AuthState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useAuth(): AuthState {
  return useSyncExternalStore(authStore.subscribe, authStore.get, () => SERVER_SNAPSHOT);
}

export function getAccessToken(): string | null {
  return state.accessToken;
}

export function getRefreshToken(): string | null {
  try {
    return window.localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setRefreshToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(REFRESH_KEY, token);
    else window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* storage unavailable: session lasts until reload */
  }
}

export const STAFF_ROLES: StaffRole[] = ["FACILITY_OPERATOR", "FACILITY_ADMIN", "SUPER_ADMIN"];

export function isStaffRole(role: Role | undefined | null): role is StaffRole {
  return !!role && (STAFF_ROLES as Role[]).includes(role);
}

export const ROLE_LABEL: Record<Role, string> = {
  USER: "Pengguna",
  CREW: "Petugas",
  FACILITY_OPERATOR: "Operator",
  FACILITY_ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};
