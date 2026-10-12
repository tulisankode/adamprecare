import { toast } from "sonner";

/** One "Panggilan baru" toast per request, so it can be dismissed when the offer is no longer actionable. */
export const offerToastId = (requestId: string) => `offer-${requestId}`;

export function dismissOfferToast(requestId: string | null | undefined) {
  if (requestId) toast.dismiss(offerToastId(requestId));
}

/** Toast lifetime = remaining offer time (3 s – 60 s); 60 s when the expiry is unknown. */
export function offerToastDuration(expiresAt: string | null | undefined): number {
  const ms = expiresAt ? new Date(expiresAt).getTime() - Date.now() : NaN;
  if (!Number.isFinite(ms)) return 60_000;
  return Math.min(60_000, Math.max(3_000, ms));
}
