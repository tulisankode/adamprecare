"use client";

import { useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";
import { env } from "./env";
import { getAccessToken } from "./auth-store";
import { refreshSession } from "./api";

export type SocketStatus = "idle" | "connecting" | "connected" | "disconnected";

let socket: Socket | null = null;
let status: SocketStatus = "idle";
let authRetries = 0;
const listeners = new Set<() => void>();

function setStatus(next: SocketStatus) {
  if (status === next) return;
  status = next;
  listeners.forEach((l) => l());
}

function looksLikeAuthError(message: string) {
  return /unauth|jwt|token|forbidden|401/i.test(message);
}

/** Returns the singleton socket, creating and connecting it on first use. */
export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(env.socketUrl, {
    path: env.socketPath,
    transports: ["websocket", "polling"],
    // Evaluated on every (re)connection attempt, so a refreshed access token is picked up automatically.
    auth: (cb) => cb({ token: getAccessToken() ?? "" }),
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    autoConnect: false,
  });

  socket.on("connect", () => {
    authRetries = 0;
    setStatus("connected");
  });
  socket.on("disconnect", () => setStatus("disconnected"));
  socket.io.on("reconnect_attempt", () => setStatus("connecting"));
  socket.on("connect_error", (err) => {
    setStatus("disconnected");
    const s = socket;
    if (!s) return;
    // A rejection by the server middleware stops auto-reconnect (socket.active === false).
    if (!s.active || looksLikeAuthError(err.message)) {
      if (authRetries >= 3) return;
      authRetries += 1;
      refreshSession()
        .then(() => {
          if (socket && !socket.connected) socket.connect();
        })
        .catch(() => undefined);
    }
  });

  setStatus("connecting");
  socket.connect();
  return socket;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.io.removeAllListeners();
  socket.disconnect();
  socket = null;
  authRetries = 0;
  setStatus("idle");
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSocketStatus(): SocketStatus {
  return useSyncExternalStore(
    subscribe,
    () => status,
    () => "idle" as SocketStatus,
  );
}

/** Polling interval to use for live lists when the realtime connection is down (§6). */
export function useFallbackPolling(ms = 10_000): number | false {
  const s = useSocketStatus();
  return s === "connected" ? false : ms;
}
