export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/v1",
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000",
  socketPath: process.env.NEXT_PUBLIC_SOCKET_PATH ?? "/realtime",
};

export const APP_VERSION = "V1.0.0";
