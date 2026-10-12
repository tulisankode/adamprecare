"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/states";

// Leaflet touches `window` on import, so maps are client-only.
export const IncidentMap = dynamic(() => import("./leaflet-maps").then((m) => m.IncidentMap), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

export const TrackingMap = dynamic(() => import("./leaflet-maps").then((m) => m.TrackingMap), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});
