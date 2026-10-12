import { AlertTriangle, Inbox, RotateCw } from "lucide-react";
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-divider", className)} />;
}

export function TableSkeleton({ rows = 5, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className={r % 2 === 1 ? "bg-row-alt" : "bg-white"}>
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="px-3 py-4">
              <Skeleton className="h-4 w-full max-w-40" />
              {c < 2 && <Skeleton className="mt-2 h-3 w-2/3 max-w-28" />}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function EmptyState({ title = "Belum ada data", description, className }: { title?: string; description?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-10 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
        <Inbox className="size-6" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-strong">{description}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center gap-2 py-10 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-ink">Gagal memuat data</p>
      <p className="max-w-sm text-xs text-muted-strong">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded-md border-[1.5px] border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-soft"
        >
          <RotateCw className="size-3.5" aria-hidden /> Coba lagi
        </button>
      )}
    </div>
  );
}

/** Full-width table row wrapper for empty / error states. */
export function TableMessageRow({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={cols}>{children}</td>
    </tr>
  );
}
