"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, MapPin, Phone, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GenderPill, StatusBadge } from "@/components/ui/badges";
import { SidePanel } from "@/components/ui/overlays";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { FieldError, TextInput } from "@/components/ui/fields";
import { IncidentMap } from "@/components/maps";
import { errorMessage } from "@/lib/api";
import { formatDateTime, formatEta } from "@/lib/format";
import { SIMRS_HINT, timelineArrowColor } from "@/lib/status";
import { useRequestDetail, useSyncMedicalRecord, useUpdateMedicalRecord } from "@/lib/queries";
import type { OperatorRequest, OperatorRequestDetail } from "@/lib/types";
import { OfferCountdown } from "./countdown";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-divider py-4 first:pt-0 last:border-b-0">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-strong uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 py-1 text-xs">
      <dt className="text-muted-strong">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

function MedicalRecordEditor({ item }: { item: OperatorRequestDetail }) {
  const update = useUpdateMedicalRecord();
  const sync = useSyncMedicalRecord();
  const [value, setValue] = useState(item.medical_record_no ?? "");
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    setValue(item.medical_record_no ?? "");
    setError(undefined);
  }, [item.id, item.medical_record_no]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return setError("No. RM wajib diisi.");
    if (v.length > 30) return setError("No. RM maksimal 30 karakter.");
    setError(undefined);
    try {
      await update.mutateAsync({ id: item.id, medical_record_no: v });
      toast.success("No. RM disimpan.");
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan No. RM."));
    }
  };

  const resync = async () => {
    try {
      const res = await sync.mutateAsync({ id: item.id });
      const hint = res.simrs_status ? SIMRS_HINT[res.simrs_status] : null;
      toast.success(hint ? `Sinkron SIMRS: ${hint.label}` : "Sinkron SIMRS selesai.");
    } catch (err) {
      toast.error(errorMessage(err, "Gagal sinkron ke SIMRS."));
    }
  };

  const hint = item.simrs_status ? SIMRS_HINT[item.simrs_status] : null;

  return (
    <div>
      <form onSubmit={save} className="flex gap-2" noValidate>
        <div className="flex-1">
          <label htmlFor="mr-no" className="sr-only">
            No. RM
          </label>
          <TextInput
            id="mr-no"
            value={value}
            placeholder="No. RM, mis. 00-01-23"
            onChange={(e) => setValue(e.target.value)}
            invalid={!!error}
            aria-describedby={error ? "mr-err" : undefined}
          />
        </div>
        <Button type="submit" loading={update.isPending} disabled={value.trim() === (item.medical_record_no ?? "")}>
          Simpan
        </Button>
      </form>
      <div id="mr-err">
        <FieldError message={error} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-strong">
          Sumber: {item.medical_record_source ?? "—"}
          {hint && (
            <span className="ml-2 font-medium" style={{ color: hint.color }}>
              · {hint.label}
            </span>
          )}
        </span>
        {item.medical_record_source === "SIMRS" && (
          <Button size="sm" variant="outline" onClick={resync} loading={sync.isPending} icon={<RefreshCw className="size-3.5" aria-hidden />}>
            Sinkron ulang SIMRS
          </Button>
        )}
      </div>
    </div>
  );
}

function Photos({ photos, onExpired }: { photos: OperatorRequestDetail["photos"]; onExpired: () => void }) {
  const reported = useRef(false);
  if (!photos.length) return <p className="text-xs text-muted-strong">Tidak ada foto.</p>;
  return (
    <ul className="grid grid-cols-3 gap-2">
      {photos.map((p, i) => (
        <li key={p.id}>
          <a href={p.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md bg-row-alt" aria-label={`Buka foto ${i + 1}`}>
            {/* Signed URL valid 5 minutes (§7) — fetch a fresh detail when it fails. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={`Foto kejadian ${i + 1}`}
              className="aspect-square w-full object-cover"
              onError={() => {
                if (reported.current) return;
                reported.current = true;
                onExpired();
              }}
            />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function RequestDetailPanel({
  requestId,
  onClose,
  onProcess,
}: {
  requestId: string | null;
  onClose: () => void;
  onProcess: (item: OperatorRequest) => void;
}) {
  const { data, isLoading, isError, error, refetch } = useRequestDetail(requestId);
  const item = data && data.id === requestId ? data : undefined;

  return (
    <SidePanel
      open={!!requestId}
      onClose={onClose}
      title="Detail Kasus"
      footer={
        item?.actions.can_accept ? (
          <div className="flex justify-end">
            <Button onClick={() => onProcess(item)}>Proses Ambulans</Button>
          </div>
        ) : undefined
      }
    >
      {isLoading || (!item && !isError) ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : isError || !item ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-base font-semibold text-ink">{item.code}</p>
              <p className="text-xs text-muted-strong">Dipanggil {formatDateTime(item.requested_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              {item.offer?.expires_at && <OfferCountdown expiresAt={item.offer.expires_at} onExpire={() => refetch()} />}
              <StatusBadge status={item.status} text={item.status_badge} />
            </div>
          </div>

          <Section title="Pasien">
            <p className="text-sm font-semibold text-ink">
              {item.patient.name || "Tanpa nama"}{" "}
              {item.patient.age_text && <span className="font-normal text-muted">({item.patient.age_text})</span>}
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-strong">
              <span>NIK. {item.patient.identity_number || "—"}</span>
              <GenderPill gender={item.patient.gender} />
            </div>
          </Section>

          <Section title="No. Rekam Medis">
            <MedicalRecordEditor item={item} />
          </Section>

          <Section title="Kasus">
            <p className="text-sm font-medium text-ink">{item.case_type_other || item.case_type?.name}</p>
            <p className="mt-1 text-xs whitespace-pre-line text-body">{item.description || "Tidak ada deskripsi."}</p>
          </Section>

          <Section title="Foto">
            <Photos
              key={(item.photos ?? []).map((p) => p.url).join("|")}
              photos={item.photos ?? []}
              onExpired={() => refetch()}
            />
          </Section>

          <Section title="Lokasi">
            {item.location ? (
              <>
                <div className="h-48 overflow-hidden rounded-md border border-divider">
                  <IncidentMap location={item.location} label={item.location.address ?? item.address} />
                </div>
                <p className="mt-2 flex gap-1.5 text-xs text-body">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  {item.location.address || item.address || "—"}
                </p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${item.location.lat},${item.location.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Buka di Google Maps <ExternalLink className="size-3" aria-hidden />
                </a>
              </>
            ) : (
              <p className="text-xs text-muted-strong">{item.address || "Lokasi tidak tersedia."}</p>
            )}
          </Section>

          <Section title="Pelapor & Layanan">
            <dl>
              <Row label="Nama pelapor">{item.reporter?.name || "—"}</Row>
              <Row label="No. HP pelapor">
                {item.reporter?.phone ? (
                  <a href={`tel:${item.reporter.phone}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    <Phone className="size-3" aria-hidden /> {item.reporter.phone}
                  </a>
                ) : (
                  "—"
                )}
              </Row>
              <Row label="Penyedia">{item.provider?.name || "—"}</Row>
              <Row label="Ambulans">{item.ambulance ? `${item.ambulance.name} – ${item.ambulance.plate_number}` : "—"}</Row>
              <Row label="Estimasi tiba">{formatEta(item.eta_seconds)}</Row>
            </dl>
          </Section>

          <Section title="Data Kunjungan">
            <ol className="space-y-1">
              {item.timeline.map((t, i) => (
                <li key={`${t.status}-${i}`} className="flex items-center gap-2 text-xs text-ink">
                  <span className="min-w-20">{t.label}</span>
                  <span aria-hidden style={{ color: timelineArrowColor(t.status) }}>
                    →
                  </span>
                  <span>{formatDateTime(t.at)}</span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      )}
    </SidePanel>
  );
}
