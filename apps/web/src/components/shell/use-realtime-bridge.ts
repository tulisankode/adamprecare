"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { disconnectSocket, getSocket } from "@/lib/socket";
import { playAlarm, primeAlarm } from "@/lib/alarm";
import { qk } from "@/lib/queries";
import { dismissOfferToast, offerToastDuration, offerToastId } from "@/lib/toasts";
import type { AppNotification, OfferWithdrawnEvent, OperatorRequest } from "@/lib/types";

/**
 * Connects the singleton socket for the authenticated shell and maps server events (§6)
 * onto React Query invalidations, toasts and the alarm sound.
 */
export function useRealtimeBridge() {
  const qc = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    const socket = getSocket();

    const invalidateCases = (requestId?: string) => {
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["trips"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (requestId) {
        qc.invalidateQueries({ queryKey: qk.request(requestId) });
        qc.invalidateQueries({ queryKey: qk.trip(requestId) });
      }
    };

    const onOfferCreated = (item: OperatorRequest) => {
      invalidateCases(item?.id);
      playAlarm();
      const patient = item?.patient?.name || "Pasien tanpa nama";
      const kasus = item?.case_type_other || item?.case_type?.name || "Kasus darurat";
      toast.warning(`Panggilan baru: ${kasus}`, {
        id: item?.id ? offerToastId(item.id) : undefined,
        description: `${patient}${item?.address ? ` — ${item.address}` : ""}`,
        duration: offerToastDuration(item?.offer?.expires_at),
        action: item?.id ? { label: "Lihat", onClick: () => router.push(`/kasus?id=${encodeURIComponent(item.id)}`) } : undefined,
      });
    };

    const onRequestUpdated = (item: { id?: string; status?: string }) => {
      invalidateCases(item?.id);
      // The offer is no longer actionable once the case left MENUNGGU (accepted elsewhere, cancelled, …).
      if (item?.status && item.status !== "MENUNGGU") dismissOfferToast(item.id);
    };

    const onOfferWithdrawn = (ev: OfferWithdrawnEvent) => {
      invalidateCases(ev?.request_id);
      dismissOfferToast(ev?.request_id);
      toast.info("Penawaran kasus ditarik", { description: ev?.reason || undefined });
    };

    const onNotification = (n: AppNotification) => {
      qc.invalidateQueries({ queryKey: qk.notifications });
      // New-offer notifications are already announced by `offer.created`.
      if (n && !/offer/i.test(n.type ?? "")) toast(n.title, { description: n.body });
    };

    // After reconnecting, refresh everything that might have changed while offline.
    const onConnect = () => {
      invalidateCases();
      qc.invalidateQueries({ queryKey: qk.notifications });
    };

    socket.on("offer.created", onOfferCreated);
    socket.on("request.updated", onRequestUpdated);
    socket.on("offer.withdrawn", onOfferWithdrawn);
    socket.on("notification.created", onNotification);
    socket.on("connect", onConnect);

    // Browsers block audio until a user gesture; unlock it on the first interaction.
    const unlock = () => primeAlarm();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      socket.off("offer.created", onOfferCreated);
      socket.off("request.updated", onRequestUpdated);
      socket.off("offer.withdrawn", onOfferWithdrawn);
      socket.off("notification.created", onNotification);
      socket.off("connect", onConnect);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      disconnectSocket();
    };
  }, [qc, router]);
}
