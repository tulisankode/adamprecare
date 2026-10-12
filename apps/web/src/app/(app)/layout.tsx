"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { AppShell } from "@/components/shell/app-shell";

/** Client-side route guard for every authenticated page. */
export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status, user } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated" || !user) {
    return (
      <div className="grid min-h-dvh place-items-center bg-web-bg" aria-busy="true">
        <div className="flex flex-col items-center gap-4">
          <Image src="/logo.png" alt="Adam PreCare" width={386} height={60} priority className="h-auto w-64" />
          <Loader2 className="size-6 animate-spin text-primary" aria-label="Memuat sesi" />
        </div>
      </div>
    );
  }

  return <AppShell user={user}>{children}</AppShell>;
}
