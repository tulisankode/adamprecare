import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/cn";

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

function pageWindow(page: number, totalPages: number): number[] {
  const span = 2;
  const start = Math.max(1, Math.min(page - span, totalPages - span * 2));
  const end = Math.min(totalPages, start + span * 2);
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

export function Pagination({ page, totalPages, total, perPage, onPageChange, onPerPageChange }: PaginationProps) {
  const last = Math.max(1, totalPages);
  const navBtn =
    "grid size-6 place-items-center border-r border-divider text-ink last:border-r-0 hover:bg-primary-soft disabled:text-icon-inactive disabled:hover:bg-transparent";
  return (
    <nav aria-label="Navigasi halaman" className="flex flex-wrap items-center justify-end gap-x-8 gap-y-3 pt-4 text-xs text-ink">
      <span>Total Data: {total}</span>
      <div className="flex overflow-hidden rounded border border-divider">
        <button type="button" className={navBtn} aria-label="Halaman pertama" disabled={page <= 1} onClick={() => onPageChange(1)}>
          <ChevronsLeft className="size-3.5" aria-hidden />
        </button>
        <button type="button" className={navBtn} aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="size-3.5" aria-hidden />
        </button>
        {pageWindow(page, last).map((p) => (
          <button
            key={p}
            type="button"
            aria-label={`Halaman ${p}`}
            aria-current={p === page ? "page" : undefined}
            onClick={() => onPageChange(p)}
            className={cn(
              "grid h-6 min-w-6 place-items-center border-r border-divider px-1.5",
              p === page ? "bg-primary text-white" : "hover:bg-primary-soft",
            )}
          >
            {p}
          </button>
        ))}
        <button type="button" className={navBtn} aria-label="Halaman berikutnya" disabled={page >= last} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="size-3.5" aria-hidden />
        </button>
        <button type="button" className={navBtn} aria-label="Halaman terakhir" disabled={page >= last} onClick={() => onPageChange(last)}>
          <ChevronsRight className="size-3.5" aria-hidden />
        </button>
      </div>
      <div className="relative">
        <select
          aria-label="Jumlah data per halaman"
          value={perPage}
          onChange={(e) => onPerPageChange(Number(e.target.value))}
          className="h-7 appearance-none border-0 border-b border-divider bg-transparent pr-6 pl-1 text-xs"
        >
          {[10, 25, 50].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-1 size-3.5 -translate-y-1/2 text-icon-inactive" aria-hidden />
      </div>
    </nav>
  );
}
