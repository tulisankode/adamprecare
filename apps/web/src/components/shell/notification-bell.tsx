"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useMarkNotificationsRead, useNotifications } from "@/lib/queries";
import { errorMessage } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AppNotification } from "@/lib/types";

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, refetch } = useNotifications();
  const markRead = useMarkNotificationsRead();

  const items = data?.data ?? [];
  const unread = data?.meta?.unread_count ?? items.filter((n) => !n.read_at).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openItem = (n: AppNotification) => {
    if (!n.read_at) markRead.mutate([n.id]);
    setOpen(false);
    if (n.request_id) router.push(`/kasus?id=${encodeURIComponent(n.request_id)}`);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
        className="relative grid size-10 place-items-center rounded-full text-white hover:bg-white/15"
      >
        <Bell className="size-7 fill-white" aria-hidden />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-primary bg-white px-1 text-[10px] leading-none font-semibold text-primary">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-12 right-0 z-[1200] w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-lg bg-white text-ink shadow-panel">
          <div className="flex items-center justify-between border-b border-divider px-4 py-3">
            <p className="text-sm font-semibold">Notifikasi</p>
            <button
              type="button"
              disabled={unread === 0 || markRead.isPending}
              onClick={() => markRead.mutate(undefined)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:text-muted disabled:no-underline"
            >
              <CheckCheck className="size-3.5" aria-hidden /> Tandai semua dibaca
            </button>
          </div>
          <div className="scroll-thin max-h-[380px] overflow-y-auto">
            {isLoading ? (
              <div className="grid place-items-center py-8 text-muted">
                <Loader2 className="size-5 animate-spin" aria-label="Memuat" />
              </div>
            ) : isError ? (
              <div className="px-4 py-6 text-center text-xs text-muted-strong">
                {errorMessage(error)}{" "}
                <button type="button" className="font-medium text-primary hover:underline" onClick={() => refetch()}>
                  Coba lagi
                </button>
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-strong">Belum ada notifikasi.</p>
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={cn(
                        "flex w-full gap-3 border-b border-divider px-4 py-3 text-left last:border-b-0 hover:bg-row-alt",
                        !n.read_at && "bg-primary-soft/60",
                      )}
                    >
                      <span
                        className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold">{n.title}</span>
                        <span className="mt-0.5 block text-xs text-body">{n.body}</span>
                        <span className="mt-1 block text-[11px] text-muted-strong">{relativeTime(n.created_at)}</span>
                      </span>
                      {!n.read_at && <span className="sr-only">(belum dibaca)</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
