"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/cn";

/** Seconds remaining until `expiresAt`, ticking every second. */
export function useSecondsLeft(expiresAt: string | null | undefined): number | null {
  const target = expiresAt ? new Date(expiresAt).getTime() : NaN;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!Number.isFinite(target)) return null;
  return Math.max(0, Math.ceil((target - now) / 1000));
}

/** 60-second offer countdown (W3). Calls `onExpire` once when it reaches zero. */
export function OfferCountdown({ expiresAt, onExpire, className }: { expiresAt: string; onExpire?: () => void; className?: string }) {
  const left = useSecondsLeft(expiresAt);

  useEffect(() => {
    if (left === 0) onExpire?.();
    // fire once when hitting zero
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left === 0]);

  if (left === null) return null;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  const urgent = left <= 15;
  return (
    <span
      role="timer"
      aria-label={left > 0 ? `Sisa waktu penawaran ${left} detik` : "Waktu penawaran habis"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] leading-4 font-semibold tabular-nums",
        left === 0 ? "bg-divider text-muted-strong" : urgent ? "bg-danger-soft text-danger" : "bg-warning-subtle text-[#8A5A12]",
        className,
      )}
    >
      <Timer className="size-3" aria-hidden />
      {left > 0 ? `${mm}:${ss}` : "Habis"}
    </span>
  );
}
