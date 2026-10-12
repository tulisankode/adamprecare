"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { PageCard } from "@/components/ui/page-card";
import { Button } from "@/components/ui/button";
import { DateRangeInputs, FieldLabel, SearchInput, SelectInput } from "@/components/ui/fields";
import { PlatePill, StatusBadge } from "@/components/ui/badges";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, TableMessageRow, TableSkeleton } from "@/components/ui/states";
import { LiveTrackingCard } from "@/components/tracking/live-tracking-card";
import { useTrips, type TripFilters } from "@/lib/queries";
import { errorMessage } from "@/lib/api";
import { currentMonthRange, formatDateTime } from "@/lib/format";
import { TRIP_STATUS_OPTIONS } from "@/lib/status";
import { cn } from "@/lib/cn";

const COLS = 3;

function initialFilters(): TripFilters {
  const { from, to } = currentMonthRange();
  return { q: "", status: "", from, to, page: 1, per_page: 10 };
}

export default function TrackingPage() {
  const [draft, setDraft] = useState<TripFilters>(initialFilters);
  const [filters, setFilters] = useState<TripFilters>(initialFilters);
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useTrips(filters);
  const rows = data?.data ?? [];
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
    <form onSubmit={apply} role="search" aria-label="Filter tracking ambulans" className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto]">
      <div>
        <FieldLabel htmlFor="trip-q">Cari Ambulans</FieldLabel>
        <SearchInput
          id="trip-q"
          placeholder="Cari Nama Ambulans / No. Plat"
          value={draft.q}
          onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
        />
      </div>
      <div>
        <FieldLabel htmlFor="trip-status">Status</FieldLabel>
        <SelectInput id="trip-status" value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
          <option value="">Semua</option>
          {TRIP_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectInput>
      </div>
      <div>
        <FieldLabel htmlFor="trip-date-from">Tanggal</FieldLabel>
        <DateRangeInputs idPrefix="trip-date" from={draft.from} to={draft.to} onChange={(r) => setDraft((d) => ({ ...d, ...r }))} />
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" icon={<Search className="size-4" aria-hidden />} className="px-5">
          Cari
        </Button>
        <Button variant="outline" onClick={reset}>
          Reset
        </Button>
      </div>
    </form>
  );

  return (
    <PageCard title="Tracking Ambulans" onRefresh={() => refetch()} refreshing={isFetching} filters={filtersUi}>
      <div className={cn("grid gap-5", selected && "2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(380px,1fr)]")}>
        <div className="min-w-0">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <caption className="sr-only">Daftar perjalanan ambulans. Pilih baris untuk live tracking.</caption>
              <thead>
                <tr className="bg-table-header text-xs text-ink">
                  <th scope="col" className="px-3 py-3 font-medium">Panggilan</th>
                  <th scope="col" className="px-3 py-3 font-medium">Ambulans</th>
                  <th scope="col" className="px-3 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <TableSkeleton cols={COLS} rows={4} />
                ) : isError ? (
                  <TableMessageRow cols={COLS}>
                    <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
                  </TableMessageRow>
                ) : rows.length === 0 ? (
                  <TableMessageRow cols={COLS}>
                    <EmptyState title="Belum ada perjalanan" description="Tidak ada perjalanan ambulans yang cocok dengan filter." />
                  </TableMessageRow>
                ) : (
                  rows.map((t, i) => {
                    const active = selected === t.request_id;
                    return (
                      <tr
                        key={t.request_id}
                        tabIndex={0}
                        aria-selected={active}
                        aria-label={`Perjalanan ${t.code}. Tekan Enter untuk live tracking.`}
                        onClick={() => setSelected(t.request_id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.target === e.currentTarget) setSelected(t.request_id);
                        }}
                        className={cn(
                          "cursor-pointer align-middle transition-colors hover:bg-primary-soft/60",
                          active ? "bg-primary-soft" : i % 2 === 1 ? "bg-row-alt" : "bg-white",
                        )}
                      >
                        <td className="px-3 py-4 text-xs text-ink">
                          <p className="font-semibold">{t.code}</p>
                          <p className="mt-0.5">{t.patient_name || "Tanpa nama"}</p>
                          <p className="mt-0.5 text-muted-strong">{formatDateTime(t.called_at, " | ")}</p>
                        </td>
                        <td className="px-3 py-4 text-xs text-ink">
                          {t.ambulance ? (
                            <>
                              <p>{t.ambulance.name}</p>
                              <div className="mt-1">
                                <PlatePill plate={t.ambulance.plate_number} />
                              </div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-4">
                          <StatusBadge status={t.status} text={t.status_badge} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={meta?.page ?? filters.page}
            totalPages={meta?.total_pages ?? 1}
            total={meta?.total ?? 0}
            perPage={filters.per_page}
            onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            onPerPageChange={(per_page) => setFilters((f) => ({ ...f, per_page, page: 1 }))}
          />
        </div>

        {selected && (
          <div className="min-w-0">
            <LiveTrackingCard key={selected} requestId={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </PageCard>
  );
}
