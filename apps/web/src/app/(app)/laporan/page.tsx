"use client";

import { Fragment, useState } from "react";
import { ChevronDown, FileSpreadsheet, Search } from "lucide-react";
import { toast } from "sonner";
import { PageCard } from "@/components/ui/page-card";
import { Button } from "@/components/ui/button";
import { DateRangeInputs, FieldLabel, SearchInput, SelectInput } from "@/components/ui/fields";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, TableMessageRow, TableSkeleton } from "@/components/ui/states";
import { useCaseTypes, useReports, type ReportFilters } from "@/lib/queries";
import { downloadFile, errorMessage } from "@/lib/api";
import { currentMonthRange, formatDateTime, genderLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ReportItem } from "@/lib/types";

const COLS = 6;

function initialFilters(): ReportFilters {
  const { from, to } = currentMonthRange();
  return { patient_name: "", case_type: "", from, to, page: 1, per_page: 10 };
}

function PatientTable({ item }: { item: ReportItem }) {
  return (
    <div className="overflow-hidden rounded-md bg-white shadow-card">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead>
          <tr className="bg-primary text-white">
            <th scope="col" className="px-3 py-2.5 font-medium">No. Identitas</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Nama Pasien</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Jenis Kelamin</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Umur</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Jenis Kasus</th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-ink">
            <td className="px-3 py-3">{item.patient.identity_number || "—"}</td>
            <td className="px-3 py-3">{item.patient.name || "Tanpa nama"}</td>
            <td className="px-3 py-3">{genderLabel(item.patient.gender)}</td>
            <td className="px-3 py-3">{item.patient.age_text || "—"}</td>
            <td className="px-3 py-3">{item.case_type?.name || "—"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function LaporanPage() {
  const [draft, setDraft] = useState<ReportFilters>(initialFilters);
  const [filters, setFilters] = useState<ReportFilters>(initialFilters);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [exporting, setExporting] = useState(false);

  const caseTypes = useCaseTypes();
  const { data, isLoading, isError, error, refetch, isFetching } = useReports(filters);
  const rows = data?.data ?? [];
  const meta = data?.meta;

  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    setFilters({ ...draft, page: 1 });
  };
  const reset = () => {
    const f = initialFilters();
    setDraft(f);
    setFilters(f);
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const { patient_name, case_type, from, to } = filters;
      await downloadFile(
        "/operator/reports/export",
        { format: "xlsx", patient_name, case_type, from, to },
        `laporan-adam-precare-${from || "awal"}_${to || "akhir"}.xlsx`,
      );
      toast.success("Laporan berhasil diekspor.");
    } catch (err) {
      toast.error(errorMessage(err, "Gagal mengekspor laporan."));
    } finally {
      setExporting(false);
    }
  };

  const filtersUi = (
    <form onSubmit={apply} role="search" aria-label="Filter laporan" className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto]">
      <div>
        <FieldLabel htmlFor="lap-name">Nama Pasien</FieldLabel>
        <SearchInput
          id="lap-name"
          placeholder="Cari Nama Pasien"
          value={draft.patient_name}
          onChange={(e) => setDraft((d) => ({ ...d, patient_name: e.target.value }))}
        />
      </div>
      <div>
        <FieldLabel htmlFor="lap-type">Kasus</FieldLabel>
        <SelectInput id="lap-type" value={draft.case_type} onChange={(e) => setDraft((d) => ({ ...d, case_type: e.target.value }))}>
          <option value="">Semua</option>
          {(caseTypes.data ?? []).map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </SelectInput>
      </div>
      <div>
        <FieldLabel htmlFor="lap-date-from">Tanggal</FieldLabel>
        <DateRangeInputs idPrefix="lap-date" from={draft.from} to={draft.to} onChange={(r) => setDraft((d) => ({ ...d, ...r }))} />
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
    <PageCard title="Laporan" onRefresh={() => refetch()} refreshing={isFetching} filters={filtersUi}>
      <div className="mb-3 flex justify-end">
        <Button
          variant="outline"
          onClick={exportExcel}
          loading={exporting}
          disabled={rows.length === 0}
          icon={<FileSpreadsheet className="size-4" aria-hidden />}
        >
          Ekspor Excel
        </Button>
      </div>
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <caption className="sr-only">Laporan panggilan. Buka baris untuk melihat data pasien.</caption>
          <thead>
            <tr className="bg-table-header text-xs text-ink">
              <th scope="col" className="w-12 px-3 py-3">
                <span className="sr-only">Buka detail</span>
              </th>
              <th scope="col" className="w-12 px-3 py-3 font-medium">No.</th>
              <th scope="col" className="px-3 py-3 font-medium">Waktu Panggil</th>
              <th scope="col" className="px-3 py-3 font-medium">Ambulans</th>
              <th scope="col" className="px-3 py-3 font-medium">No. Plat</th>
              <th scope="col" className="px-3 py-3 font-medium">Tujuan</th>
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
                <EmptyState title="Belum ada laporan" description="Tidak ada data laporan pada filter ini." />
              </TableMessageRow>
            ) : (
              rows.map((item, i) => {
                const open = expanded.has(item.request_id);
                const detailId = `lap-detail-${item.request_id}`;
                return (
                  <Fragment key={item.request_id}>
                    <tr className={cn("align-middle text-xs text-ink", open ? "bg-white" : i % 2 === 1 ? "bg-row-alt" : "bg-white")}>
                      <td className="px-3 py-4">
                        <button
                          type="button"
                          onClick={() => toggle(item.request_id)}
                          aria-expanded={open}
                          aria-controls={detailId}
                          aria-label={open ? `Tutup data pasien baris ${item.no}` : `Buka data pasien baris ${item.no}`}
                          className="grid size-7 place-items-center rounded-md text-primary hover:bg-primary-soft"
                        >
                          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
                        </button>
                      </td>
                      <td className="px-3 py-4">{item.no}</td>
                      <td className="px-3 py-4 whitespace-nowrap">{formatDateTime(item.called_at, " | ")}</td>
                      <td className="px-3 py-4">{item.ambulance?.name || "—"}</td>
                      <td className="px-3 py-4 whitespace-nowrap">{item.ambulance?.plate_number || "—"}</td>
                      <td className="max-w-[420px] px-3 py-4">{item.destination_address || "—"}</td>
                    </tr>
                    {open && (
                      <tr id={detailId} className="bg-table-header">
                        <td colSpan={COLS} className="px-2.5 py-2.5">
                          <PatientTable item={item} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
  );
}
