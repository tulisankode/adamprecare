"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { TrackingMap } from "@/components/maps";
import { StatusBadge } from "@/components/ui/badges";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { formatDateTime, formatEta } from "@/lib/format";
import { useTripDetail } from "@/lib/queries";
import { getSocket, useSocketStatus } from "@/lib/socket";
import type { AmbulanceLocationEvent, LatLng } from "@/lib/types";

/** Live Tracking card. Mount with `key={requestId}` so live state resets per trip. */
export function LiveTrackingCard({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const { data, isLoading, isError, error, refetch } = useTripDetail(requestId);
  const socketStatus = useSocketStatus();
  const [livePoints, setLivePoints] = useState<(LatLng & { at: string })[]>([]);
  const [last, setLast] = useState<AmbulanceLocationEvent | null>(null);

  // Join room `request:{id}` and stream `ambulance.location` (§6).
  useEffect(() => {
    const socket = getSocket();
    const subscribe = () => socket.emit("subscribe", { request_id: requestId });
    const onLocation = (ev: AmbulanceLocationEvent) => {
      if (!ev || ev.request_id !== requestId) return;
      setLast(ev);
      setLivePoints((pts) => [...pts, { lat: ev.lat, lng: ev.lng, at: ev.updated_at }].slice(-2000));
    };
    if (socket.connected) subscribe();
    socket.on("connect", subscribe);
    socket.on("ambulance.location", onLocation);
    return () => {
      socket.off("connect", subscribe);
      socket.off("ambulance.location", onLocation);
      if (socket.connected) socket.emit("unsubscribe", { request_id: requestId });
    };
  }, [requestId]);

  const route = useMemo(() => {
    const base = data?.route ?? [];
    const lastAt = base.length ? new Date(base[base.length - 1].at).getTime() : 0;
    return [...base, ...livePoints.filter((p) => new Date(p.at).getTime() > lastAt)];
  }, [data?.route, livePoints]);

  const lastIsNewer =
    last && (!data?.ambulance_location || new Date(last.updated_at).getTime() >= new Date(data.ambulance_location.updated_at).getTime());
  const ambulancePos = lastIsNewer
    ? { lat: last.lat, lng: last.lng, heading: last.heading }
    : data?.ambulance_location
      ? { lat: data.ambulance_location.lat, lng: data.ambulance_location.lng, heading: data.ambulance_location.heading }
      : null;
  const updatedAt = lastIsNewer ? last.updated_at : data?.ambulance_location?.updated_at;

  return (
    <section aria-label="Live Tracking" className="flex h-full flex-col overflow-hidden rounded-lg bg-white shadow-card ring-1 ring-divider">
      <header className="flex h-[60px] shrink-0 items-center justify-between bg-primary px-5">
        <h2 className="text-base font-medium text-white">Live Tracking</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup live tracking"
          className="grid size-8 place-items-center rounded-full bg-white text-ink hover:bg-primary-soft"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div className="p-2.5">
        <div className="h-[380px] overflow-hidden rounded-md border border-divider bg-row-alt">
          {isLoading ? (
            <Skeleton className="h-full w-full rounded-none" />
          ) : isError ? (
            <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
          ) : (
            <TrackingMap
              incident={data?.incident_location ?? null}
              ambulance={ambulancePos}
              route={route}
              ambulanceLabel={data?.ambulance ? `${data.ambulance.name} – ${data.ambulance.plate_number}` : undefined}
            />
          )}
        </div>
      </div>

      {data && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-5 pb-4 text-xs">
          <div>
            <dt className="text-muted-strong">Kode</dt>
            <dd className="font-medium text-ink">{data.code}</dd>
          </div>
          <div>
            <dt className="text-muted-strong">Status</dt>
            <dd>
              <StatusBadge status={data.status} text={data.status_badge} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-strong">Pasien</dt>
            <dd className="text-ink">{data.patient_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-strong">Ambulans</dt>
            <dd className="text-ink">{data.ambulance ? `${data.ambulance.name} – ${data.ambulance.plate_number}` : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-strong">Estimasi tiba</dt>
            <dd className="text-ink">{formatEta(last?.eta_seconds)}</dd>
          </div>
          <div>
            <dt className="text-muted-strong">Posisi terakhir</dt>
            <dd className="text-ink">{updatedAt ? formatDateTime(updatedAt) : "Belum ada data"}</dd>
          </div>
          {socketStatus !== "connected" && (
            <div role="status" className="col-span-2 rounded-md bg-warning-subtle px-3 py-1.5 text-[11px] text-[#8A5A12]">
              Koneksi realtime terputus — posisi diperbarui tiap 10 detik.
            </div>
          )}
        </dl>
      )}
    </section>
  );
}
