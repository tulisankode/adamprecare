"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Ambulance, Search } from "lucide-react";
import { PageCard } from "@/components/ui/page-card";
import { Button } from "@/components/ui/button";
import { DateRangeInputs, FieldLabel, SearchInput, SelectInput } from "@/components/ui/fields";
import { GenderPill, StatusBadge } from "@/components/ui/badges";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, TableMessageRow, TableSkeleton } from "@/components/ui/states";
import { OfferCountdown } from "@/components/kasus/countdown";
import { ProsesAmbulansPanel } from "@/components/kasus/proses-ambulans-panel";
import { RequestDetailPanel } from "@/components/kasus/request-detail-panel";
import { useCaseTypes, useRequests, type RequestFilters } from "@/lib/queries";
import { errorMessage } from "@/lib/api";
import { currentMonthRange, formatDateTime } from "@/lib/format";
import { REQUEST_STATUS_OPTIONS, SIMRS_HINT, timelineArrowColor } from "@/lib/status";
import { cn } from "@/lib/cn";
import type { OperatorRequest } from "@/lib/types";

const COLS = 6;

function initialFilters(): RequestFilters {
  const { from, to } = currentMonthRange();
  return { q: "", case_type: "", status: "", from, to, page: 1, per_page: 10 };
}

function NomorCell({ item }: { item: OperatorRequest }) {
  const hint = item.simrs_status ? SIMRS_HINT[item.simrs_status] : null;
  return (
    <div className="text-center text-xs text-ink">
      <p>{item.medical_record_no || "—"}</p>
      {hint && (
        <p className="mt-0.5 text-[10px] leading-3" style={{ color: hint.color }}>
          {hint.label}
        </p>
      )}
      <p className="mt-1.5">NIK.{item.patient.identity_number || "—"}</p>
    </div>
  );
}

function PasienCell({ item }: { item: OperatorRequest }) {
  return (
    <div className="max-w-[260px] min-w-[220px]">
      <p className="text-xs font-semibold text-ink">
        {item.patient.name || "Tanpa nama"}{" "}
        {item.patient.age_text && item.patient.age_text !== "-" && (
          <span className="font-normal text-muted">({item.patient.age_text})</span>
        )}
      </p>
      {item.address && <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-body">{item.address}</p>}
      <div className="mt-1">
        <GenderPill gender={item.patient.gender} />
      </div>
    </div>
  );
}

function TimelineCell({ item }: { item: OperatorRequest }) {
  return (
    <ol className="space-y-1.5">
      {item.timeline.map((t, i) => (
        <li key={`${t.status}-${i}`} className="flex items-center gap-2 text-xs whitespace-nowrap text-ink">
          <span>{t.label}</span>
          <span aria-hidden className="text-sm leading-none" style={{ color: timelineArrowColor(t.status) }}>
            →
          </span>
          <span>{formatDateTime(t.at)}</span>
        </li>
      ))}
    </ol>
  );
}

function KasusContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const [draft, setDraft] = useState<RequestFilters>(initialFilters);
  const [filters, setFilters] = useState<RequestFilters>(initialFilters);
  const [processItem, setProcessItem] = useState<OperatorRequest | null>(null);

  const detailId = searchParams.get("id");
  const setDetailId = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("id", id);
      else params.delete("id");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const caseTypes = useCaseTypes();
  const { data, isLoading, isError, error, refetch, isFetching } = useRequests(filters);

  // W5: incoming calls ("Panggilan") first, keeping server order otherwise.
  const rows = useMemo(() => {
    const list = data?.data ?? [];
    return [...list].sort((a, b) => Number(b.status === "MENUNGGU") - Number(a.status === "MENUNGGU"));
  }, [data]);

  const meta = data?.meta;

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    setFilters({ ...draft, page: 1 });
  };
  const reset = () => {
    const f = initialFilters();
    setDraft(f);
    setFilters(f);
  };

  const filtersUi = (
    <form onSubmit={apply} className="space-y-4" role="search" aria-label="Filter data kasus">
      <div>
        <FieldLabel htmlFor="kasus-q">Cari Pasien</FieldLabel>
        <SearchInput
          id="kasus-q"
          placeholder="Cari Nama / Alamat / No. RM"
          value={draft.q}
          onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_minmax(0,1.1fr)_auto]">
        <div>
          <FieldLabel htmlFor="kasus-type">Kasus</FieldLabel>
          <SelectInput id="kasus-type" value={draft.case_type} onChange={(e) => setDraft((d) => ({ ...d, case_type: e.target.value }))}>
            <option value="">Semua</option>
            {(caseTypes.data ?? []).map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </SelectInput>
        </div>
        <div>
          <FieldLabel htmlFor="kasus-status">Status</FieldLabel>
          <SelectInput id="kasus-status" value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
            <option value="">Semua</option>
            {REQUEST_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectInput>
        </div>
        <div>
          <FieldLabel htmlFor="kasus-date-from">Tanggal</FieldLabel>
          <DateRangeInputs idPrefix="kasus-date" from={draft.from} to={draft.to} onChange={(r) => setDraft((d) => ({ ...d, ...r }))} />
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" icon={<Search className="size-4" aria-hidden />} className="px-5">
            Cari
          </Button>
          <Button variant="outline" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>
    </form>
  );

  return (
    <>
      <PageCard title="Data Kasus Masuk" onRefresh={() => refetch()} refreshing={isFetching} filters={filtersUi}>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left">
            <caption className="sr-only">Daftar kasus masuk. Klik baris untuk melihat detail.</caption>
            <thead>
              <tr className="bg-table-header text-xs font-medium text-ink">
                <th scope="col" className="px-3 py-3 text-center font-medium">Nomor</th>
                <th scope="col" className="px-3 py-3 font-medium">Pasien</th>
                <th scope="col" className="px-3 py-3 font-medium">Kasus</th>
                <th scope="col" className="px-3 py-3 font-medium">Data Kunjungan</th>
                <th scope="col" className="px-3 py-3 font-medium">Status</th>
                <th scope="col" className="px-3 py-3 text-center font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={COLS} rows={5} />
              ) : isError ? (
                <TableMessageRow cols={COLS}>
                  <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
                </TableMessageRow>
              ) : rows.length === 0 ? (
                <TableMessageRow cols={COLS}>
                  <EmptyState title="Belum ada kasus" description="Tidak ada kasus yang cocok dengan filter. Kasus baru akan muncul otomatis." />
                </TableMessageRow>
              ) : (
                rows.map((item, i) => {
                  const canAccept = item.actions?.can_accept;
                  return (
                    <tr
                      key={item.id}
                      tabIndex={0}
                      aria-label={`Kasus ${item.code}, ${item.patient.name || "tanpa nama"}. Tekan Enter untuk detail.`}
                      onClick={() => setDetailId(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.target === e.currentTarget) setDetailId(item.id);
                      }}
                      className={cn(
                        "cursor-pointer align-middle transition-colors hover:bg-primary-soft/60",
                        i % 2 === 1 ? "bg-row-alt" : "bg-white",
                        item.status === "MENUNGGU" && "shadow-[inset_3px_0_0_var(--color-warning)]",
                      )}
                    >
                      <td className="px-3 py-3">
                        <NomorCell item={item} />
                      </td>
                      <td className="px-3 py-3">
                        <PasienCell item={item} />
                      </td>
                      <td className="px-3 py-3 text-xs text-ink">{item.case_type_other || item.case_type?.name}</td>
                      <td className="px-3 py-3">
                        <TimelineCell item={item} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-start gap-1.5">
                          <StatusBadge status={item.status} text={item.status_badge} />
                          {item.offer?.expires_at && (
                            <OfferCountdown
                              expiresAt={item.offer.expires_at}
                              onExpire={() => qc.invalidateQueries({ queryKey: ["requests"] })}
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          disabled={!canAccept}
                          onClick={(e) => {
                            e.stopPropagation();
                            setProcessItem(item);
                          }}
                          aria-label={canAccept ? `Proses ambulans untuk ${item.code}` : `Kasus ${item.code} tidak dapat diproses`}
                          title={canAccept ? "Proses Ambulans" : "Tidak dapat diproses"}
                          className={cn(
                            "inline-grid size-7 place-items-center rounded-md transition-colors",
                            canAccept ? "bg-primary text-white hover:bg-primary-pressed" : "bg-divider text-muted-strong",
                          )}
                        >
                          <Ambulance className="size-4" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-divider">
          <Pagination
            page={meta?.page ?? filters.page}
            totalPages={meta?.total_pages ?? 1}
            total={meta?.total ?? 0}
            perPage={filters.per_page}
            onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            onPerPageChange={(per_page) => setFilters((f) => ({ ...f, per_page, page: 1 }))}
          />
        </div>
      </PageCard>

      <RequestDetailPanel
        requestId={processItem ? null : detailId}
        onClose={() => setDetailId(null)}
        onProcess={(item) => setProcessItem(item)}
      />
      <ProsesAmbulansPanel request={processItem} onClose={() => setProcessItem(null)} />
    </>
  );
}

export default function KasusPage() {
  return (
    <Suspense fallback={null}>
      <KasusContent />
    </Suspense>
  );
}
