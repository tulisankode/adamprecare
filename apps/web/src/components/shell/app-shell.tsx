"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { logout } from "@/lib/api";
import { APP_VERSION } from "@/lib/env";
import type { User } from "@/lib/types";
import { AvatarMenu } from "./avatar-menu";
import { NotificationBell } from "./notification-bell";
import { MAIN_NAV, PROFILE_NAV } from "./nav";
import { Sidebar } from "./sidebar";
import { useRealtimeBridge } from "./use-realtime-bridge";

const COLLAPSE_KEY = "apc.sidebar.collapsed";

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useRealtimeBridge();

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const handleLogout = useCallback(async () => {
    await logout();
    qc.clear();
    router.replace("/login");
  }, [qc, router]);

  const isProfile = pathname.startsWith("/profil");
  const sidebarTitle = isProfile ? "Profile" : "Menu";
  const items = isProfile ? PROFILE_NAV : MAIN_NAV;
  const facilityName = user.facility?.name ?? (user.role === "SUPER_ADMIN" ? "Semua Penyedia" : "—");

  return (
    <div className="flex min-h-dvh flex-col gap-2.5 bg-web-bg p-2.5">
      <a
        href="#main"
        className="sr-only z-[2000] rounded-md bg-white px-3 py-2 text-sm text-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Lewati ke konten
      </a>

      <header className="flex h-[60px] shrink-0 items-center gap-2 rounded-lg bg-primary pr-3 sm:pr-5">
        <Link
          href="/dashboard"
          aria-label="Adam PreCare — ke Dashboard"
          className="flex h-full items-center rounded-lg bg-white px-4 sm:w-[360px] sm:px-5"
        >
          <Image src="/logo.png" alt="Adam PreCare" width={386} height={60} priority className="h-8 w-auto sm:h-10" />
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Buka menu"
          aria-expanded={drawerOpen}
          className="ml-1 grid size-10 place-items-center rounded-md text-white hover:bg-white/15 lg:hidden"
        >
          <Menu className="size-6" aria-hidden />
        </button>
        <div className="flex-1" />
        <NotificationBell />
        <AvatarMenu user={user} onLogout={handleLogout} />
      </header>

      <div className="flex min-h-0 flex-1 gap-2.5">
        <aside className="hidden shrink-0 lg:block">
          <Sidebar title={sidebarTitle} items={items} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} showGridIcon={!isProfile} />
        </aside>

        {drawerOpen && (
          <div className="fixed inset-0 z-[1500] lg:hidden">
            <div className="absolute inset-0 bg-black/40" aria-hidden onClick={() => setDrawerOpen(false)} />
            <div className="absolute inset-y-0 left-0 p-2.5">
              <Sidebar
                title={sidebarTitle}
                items={items}
                collapsed={false}
                drawer
                onToggleCollapsed={() => setDrawerOpen(false)}
                onNavigate={() => setDrawerOpen(false)}
                showGridIcon={!isProfile}
              />
            </div>
          </div>
        )}

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      <footer className="flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg bg-primary px-5 py-2 text-xs text-white">
        <p>
          <span className="font-semibold">©ADAM PRECARE</span>
          <span className="ml-3">{APP_VERSION}</span>
        </p>
        <span className="rounded-full bg-white px-4 py-0.5 text-xs font-semibold text-[#C43F3C] uppercase">{facilityName}</span>
      </footer>
    </div>
  );
}
