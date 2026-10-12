"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlays";
import { FieldError, FieldLabel, TextArea } from "@/components/ui/fields";
import { useRejectRequest } from "@/lib/queries";
import { errorMessage } from "@/lib/api";

const REASONS = ["Tidak ada ambulans tersedia", "Lokasi di luar jangkauan layanan", "Ambulans sedang bertugas semua"];

const schema = z.object({
  reason: z.string().trim().min(5, "Alasan minimal 5 karakter.").max(255, "Alasan maksimal 255 karakter."),
});
type Values = z.infer<typeof schema>;

export function RejectDialog({
  requestId,
  open,
  onClose,
  onRejected,
}: {
  requestId: string;
  open: boolean;
  onClose: () => void;
  onRejected?: () => void;
}) {
  const reject = useRejectRequest();
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { reason: "" } });

  useEffect(() => {
    if (open) reset({ reason: "" });
  }, [open, reset]);

  const submit = handleSubmit(async ({ reason }) => {
    try {
      await reject.mutateAsync({ id: requestId, reason: reason.trim() });
      toast.success("Kasus ditolak. Penawaran diteruskan ke penyedia lain.");
      onRejected?.();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Gagal menolak kasus."));
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Tolak Kasus"
      footer={
        <>
          <Button variant="outline-muted" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit} loading={reject.isPending}>
            Tolak Kasus
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <p className="mb-4 text-xs text-muted-strong">
          Kasus akan ditawarkan ke penyedia berikutnya. Tuliskan alasan penolakan.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setValue("reason", r, { shouldValidate: true })}
              className="rounded-sm bg-primary-soft px-2.5 py-1 text-[11px] text-[#B83A37] hover:bg-primary-ring"
            >
              {r}
            </button>
          ))}
        </div>
        <FieldLabel htmlFor="reject-reason">Alasan *</FieldLabel>
        <TextArea id="reject-reason" rows={3} invalid={!!errors.reason} {...register("reason")} />
        <FieldError message={errors.reason?.message} />
      </form>
    </Dialog>
  );
}
