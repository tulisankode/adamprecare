"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogOut, UserRound, CircleUserRound } from "lucide-react";
import { ROLE_LABEL } from "@/lib/auth-store";
import { useSocketStatus } from "@/lib/socket";
import { cn } from "@/lib/cn";
import type { User } from "@/lib/types";

export function AvatarMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const socketStatus = useSocketStatus();
  const online = socketStatus === "connected";

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

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu akun ${user.name}. Realtime ${online ? "terhubung" : "terputus"}`}
        className="relative grid size-10 place-items-center rounded-full text-white hover:bg-white/15"
      >
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar_url} alt="" className="size-9 rounded-full border-2 border-white object-cover" />
        ) : (
          <CircleUserRound className="size-9" strokeWidth={1.6} aria-hidden />
        )}
        <span
          className={cn(
            "absolute top-0.5 right-0.5 size-3 rounded-full border-2 border-primary",
            online ? "bg-[#22C55E]" : "bg-icon-inactive",
          )}
          title={online ? "Realtime terhubung" : "Realtime terputus — memakai polling"}
          aria-hidden
        />
      </button>

      {open && (
        <div role="menu" className="absolute top-12 right-0 z-[1200] w-56 rounded-lg bg-white p-3 text-ink shadow-panel">
          <p className="truncate text-xs font-semibold uppercase">{user.name}</p>
          <span className="mt-2 flex h-6 items-center gap-1.5 rounded-md bg-primary-ring px-2 text-[11px] font-medium text-[#B83A37]">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            {ROLE_LABEL[user.role]}
          </span>
          <div className="my-3 border-t border-divider" />
          <Link
            role="menuitem"
            href="/profil"
            onClick={() => setOpen(false)}
            className="flex h-8 items-center gap-2 rounded-md px-2 text-xs text-muted-strong hover:bg-row-alt"
          >
            <UserRound className="size-4" aria-hidden /> Profil
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary text-xs font-medium text-white uppercase hover:bg-primary-pressed"
          >
            <LogOut className="size-4" aria-hidden /> Keluar
          </button>
        </div>
      )}
    </div>
  );
}
