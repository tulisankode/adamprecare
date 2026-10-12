"use client";

import { useId, useState } from "react";
import { ChevronUp, RotateCw } from "lucide-react";
import { cn } from "@/lib/cn";

export interface PageCardProps {
  title: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Collapsible filter area under the title row. */
  filters?: React.ReactNode;
  /** Replaces the collapse chevron on the right (e.g. date range on the dashboard). */
  headerRight?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/** Content header card: red refresh button + red title + collapse-filter chevron (§12.3 "Header konten"). */
export function PageCard({ title, onRefresh, refreshing, filters, headerRight, children, className }: PageCardProps) {
  const [open, setOpen] = useState(true);
  const filterId = useId();
  return (
    <section className={cn("rounded-lg bg-white p-4 shadow-card sm:p-5", className)}>
      <div className="flex flex-wrap items-center gap-3 sm:gap-5">
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Muat ulang data"
          title="Muat ulang data"
          className="grid size-11 shrink-0 place-items-center rounded-md bg-primary text-white hover:bg-primary-pressed"
        >
          <RotateCw className={cn("size-5", refreshing && "animate-spin")} aria-hidden />
        </button>
        <h1 className="min-w-0 flex-1 text-xl font-medium text-primary">{title}</h1>
        {headerRight}
        {!headerRight && filters && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={filterId}
            aria-label={open ? "Sembunyikan filter" : "Tampilkan filter"}
            className="grid size-11 shrink-0 place-items-center rounded-md bg-primary-ring/80 text-primary hover:bg-primary-ring"
          >
            <ChevronUp className={cn("size-5 transition-transform", !open && "rotate-180")} aria-hidden />
          </button>
        )}
      </div>
      {filters && (
        <div id={filterId} hidden={!open} className="mt-4 border-t border-divider pt-4">
          {filters}
        </div>
      )}
      {children && <div className={cn(filters ? "mt-4 border-t border-divider pt-4" : "mt-4")}>{children}</div>}
    </section>
  );
}
