"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldLabel, SelectInput } from "@/components/ui/fields";
import { SidePanel } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/badges";
import { ApiError, errorMessage } from "@/lib/api";
import { AMBULANCE_TYPE_OPTIONS } from "@/lib/status";
import { useAcceptRequest, useAvailableAmbulances } from "@/lib/queries";
import type { AmbulanceType, OperatorRequest } from "@/lib/types";
import { OfferCountdown } from "./countdown";
import { RejectDialog } from "./reject-dialog";

const DEFAULT_TYPE: AmbulanceType = "PASIEN";

export function ProsesAmbulansPanel({ request, onClose }: { request: OperatorRequest | null; onClose: () => void }) {
  const open = !!request;
  const [type, setType] = useState<AmbulanceType>(DEFAULT_TYPE);
  const [ambulanceId, setAmbulanceId] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const ambulances = useAvailableAmbulances(type, open);
  const accept = useAcceptRequest();

  useEffect(() => {
    if (open) {
      setType(DEFAULT_TYPE);
      setAmbulanceId("");
    }
  }, [open, request?.id]);

  useEffect(() => setImgFailed(false), [ambulanceId]);

  const list = ambulances.data ?? [];
  const selected = list.find((a) => a.id === ambulanceId) ?? null;
  const canAccept = !!request?.actions.can_accept;
  const canReject = !!request?.actions.can_reject;

  const reset = () => {
    setType(DEFAULT_TYPE);
    setAmbulanceId("");
  };

  const submit = async () => {
    if (!request || !selected) return;
    try {
      await accept.mutateAsync({ id: request.id, ambulance_id: selected.id });
      toast.success(`${selected.name} (${selected.plate_number}) diproses ke lokasi.`);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === "ALREADY_TAKEN") {
        toast.error("Kasus sudah diterima penyedia lain.", { description: err.message });
        onClose();
        return;
      }
      if (err instanceof ApiError && err.code === "INVALID_STATUS_TRANSITION") {
        toast.error(err.message || "Status kasus sudah berubah.");
        onClose();
        return;
      }
      toast.error(errorMessage(err, "Gagal memproses ambulans."));
    }
  };

  const photo = selected?.photo_url && !imgFailed ? selected.photo_url : "/ambulance-placeholder.jpg";

  return (
    <>
      <SidePanel
        open={open}
        onClose={onClose}
        title="Proses Ambulans"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline-muted" onClick={reset} disabled={accept.isPending}>
              Reset
            </Button>
            {canReject && (
              <Button variant="outline" onClick={() => setRejectOpen(true)} disabled={accept.isPending}>
                Tolak
              </Button>
            )}
            <Button onClick={submit} loading={accept.isPending} disabled={!canAccept || !selected}>
              Proses Ke Lokasi
            </Button>
          </div>
        }
      >
        {request && (
          <div className="mb-5 rounded-md bg-primary-soft px-4 py-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-ink">{request.code}</span>
              <span className="flex items-center gap-2">
                {request.offer?.expires_at && <OfferCountdown expiresAt={request.offer.expires_at} />}
                <StatusBadge status={request.status} text={request.status_badge} />
              </span>
            </div>
            <p className="mt-1 text-body">
              {request.patient.name || "Tanpa nama"} · {request.case_type_other || request.case_type?.name}
            </p>
            {request.address && <p className="mt-0.5 text-muted-strong">{request.address}</p>}
          </div>
        )}

        {!canAccept && (
          <p role="status" className="mb-4 rounded-md bg-warning-subtle px-3 py-2 text-xs text-[#8A5A12]">
            Kasus ini tidak dapat diproses lagi (sudah diterima atau penawaran berakhir).
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="amb-type">Tipe</FieldLabel>
            <SelectInput
              id="amb-type"
              value={type}
              onChange={(e) => {
                setType(e.target.value as AmbulanceType);
                setAmbulanceId("");
              }}
            >
              {AMBULANCE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="amb-unit">Ambulans</FieldLabel>
            <SelectInput
              id="amb-unit"
              value={ambulanceId}
              onChange={(e) => setAmbulanceId(e.target.value)}
              disabled={ambulances.isLoading || ambulances.isError || list.length === 0}
            >
              <option value="">
                {ambulances.isLoading
                  ? "Memuat ambulans…"
                  : ambulances.isError
                    ? "Gagal memuat ambulans"
                    : list.length === 0
                      ? "Tidak ada ambulans tersedia"
                      : "Pilih ambulans"}
              </option>
              {list.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} – {a.plate_number}
                </option>
              ))}
            </SelectInput>
            {ambulances.isError && (
              <p className="mt-1 text-xs text-danger">
                {errorMessage(ambulances.error)}{" "}
                <button type="button" className="font-medium underline" onClick={() => ambulances.refetch()}>
                  Coba lagi
                </button>
              </p>
            )}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-ink">Preview</p>
          <div className="overflow-hidden rounded-lg bg-row-alt">
            {/* Signed/remote photo URL from the API — plain <img> on purpose. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={selected ? `Foto ${selected.name}` : "Ilustrasi ambulans"}
              onError={() => setImgFailed(true)}
              className="aspect-[2/1] w-full object-cover"
            />
          </div>
          {selected && (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-muted-strong">No. Plat</dt>
                <dd className="font-medium text-ink">{selected.plate_number}</dd>
              </div>
              <div>
                <dt className="text-muted-strong">Petugas</dt>
                <dd className="font-medium text-ink">
                  {selected.crew.length
                    ? selected.crew.map((c) => `${c.name}${c.on_duty ? "" : " (off)"}`).join(", ")
                    : "—"}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </SidePanel>

      {request && (
        <RejectDialog requestId={request.id} open={rejectOpen} onClose={() => setRejectOpen(false)} onRejected={onClose} />
      )}
    </>
  );
}
