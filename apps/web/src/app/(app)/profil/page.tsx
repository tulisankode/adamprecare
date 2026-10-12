"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, TextInput } from "@/components/ui/fields";
import { ApiError, errorMessage, patchData, postData, setCurrentUser } from "@/lib/api";
import { ROLE_LABEL, useAuth } from "@/lib/auth-store";
import type { User } from "@/lib/types";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100, "Nama maksimal 100 karakter."),
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter.")
    .max(30, "Username maksimal 30 karakter.")
    .regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, garis bawah, atau strip."),
});
type ProfileValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Password saat ini wajib diisi."),
    new_password: z.string().min(8, "Password baru minimal 8 karakter."),
    confirm_password: z.string().min(1, "Ulangi password baru."),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    path: ["confirm_password"],
    message: "Konfirmasi password tidak sama.",
  })
  .refine((v) => v.new_password !== v.current_password, {
    path: ["new_password"],
    message: "Password baru harus berbeda dari password saat ini.",
  });
type PasswordValues = z.infer<typeof passwordSchema>;

function applyServerFieldErrors<T extends string>(err: unknown, setError: (field: T, e: { message: string }) => void, fields: T[]) {
  if (!(err instanceof ApiError)) return false;
  let applied = false;
  for (const d of err.details) {
    if ((fields as string[]).includes(d.field)) {
      setError(d.field as T, { message: d.message });
      applied = true;
    }
  }
  return applied;
}

function ViewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink underline underline-offset-2">{label}</dt>
      <dd className="mt-2 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function ProfileCard({ user }: { user: User }) {
  const [editing, setEditing] = useState(false);
  const defaults = { name: user.name ?? "", username: user.username ?? "" };
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), values: defaults });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const updated = await patchData<User>("/me", { name: values.name.trim(), username: values.username.trim() });
      setCurrentUser(updated);
      toast.success("Profil berhasil disimpan.");
      setEditing(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === "DUPLICATE") {
        setError("username", { message: err.message || "Username sudah dipakai." });
        return;
      }
      if (!applyServerFieldErrors<keyof ProfileValues>(err, setError, ["name", "username"])) {
        toast.error(errorMessage(err, "Gagal menyimpan profil."));
      }
    }
  });

  return (
    <section className="rounded-lg bg-primary-soft p-5" aria-labelledby="profil-card-title">
      <div className="flex items-center justify-between gap-3 border-b border-primary-ring pb-3">
        <h2 id="profil-card-title" className="text-base font-medium text-primary">
          Profil &amp; Nama Lengkap
        </h2>
        {editing ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              reset(defaults);
              setEditing(false);
            }}
          >
            Batal
          </Button>
        ) : (
          <Button size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      {!editing ? (
        <dl className="grid gap-5 pt-5 sm:grid-cols-3">
          <ViewField label="Nama Lengkap" value={user.name || "—"} />
          <ViewField label="Username" value={user.username || "—"} />
          <ViewField label="Role" value={ROLE_LABEL[user.role]} />
        </dl>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <div className="grid gap-5 pt-5 sm:grid-cols-3">
            <div>
              <label htmlFor="pf-name" className="mb-2 block text-xs font-semibold text-ink">
                Nama Lengkap
              </label>
              <TextInput id="pf-name" autoComplete="name" invalid={!!errors.name} {...register("name")} />
              <FieldError message={errors.name?.message} />
            </div>
            <div>
              <label htmlFor="pf-username" className="mb-2 block text-xs font-semibold text-ink">
                Username
              </label>
              <TextInput id="pf-username" autoComplete="username" invalid={!!errors.username} {...register("username")} />
              <FieldError message={errors.username?.message} />
            </div>
            <div>
              <p className="mb-2 text-xs text-ink underline underline-offset-2">Role</p>
              <p className="py-2 text-sm font-semibold text-ink">{ROLE_LABEL[user.role]}</p>
              <p className="text-[11px] text-muted-strong">Role tidak dapat diubah.</p>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-primary-ring pt-4">
            <Button variant="outline-muted" onClick={() => reset(defaults)} disabled={!isDirty || isSubmitting}>
              Reset
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              Simpan
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function PasswordCard() {
  const [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: "", new_password: "", confirm_password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await postData<{ success: boolean }>("/me/password", {
        current_password: values.current_password,
        new_password: values.new_password,
      });
      toast.success("Password berhasil diubah.");
      reset();
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_CREDENTIALS") {
        setError("current_password", { message: err.message || "Password saat ini salah." });
        return;
      }
      if (!applyServerFieldErrors<keyof PasswordValues>(err, setError, ["current_password", "new_password"])) {
        toast.error(errorMessage(err, "Gagal mengubah password."));
      }
    }
  });

  const type = show ? "text" : "password";
  const eye = (
    <button
      type="button"
      onClick={() => setShow((s) => !s)}
      aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
      aria-pressed={show}
      className="grid size-7 place-items-center rounded text-muted-strong hover:text-ink"
    >
      {show ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
    </button>
  );

  return (
    <section className="rounded-lg bg-primary-soft p-5" aria-labelledby="pw-card-title">
      <h2 id="pw-card-title" className="border-b border-primary-ring pb-3 text-base font-medium text-primary">
        Ubah Password
      </h2>
      <form onSubmit={onSubmit} noValidate>
        <div className="grid gap-5 pt-5 sm:grid-cols-3">
          <div>
            <label htmlFor="pw-current" className="mb-2 block text-xs font-semibold text-ink">
              Password Saat Ini
            </label>
            <TextInput id="pw-current" type={type} autoComplete="current-password" invalid={!!errors.current_password} rightSlot={eye} {...register("current_password")} />
            <FieldError message={errors.current_password?.message} />
          </div>
          <div>
            <label htmlFor="pw-new" className="mb-2 block text-xs font-semibold text-ink">
              Password Baru
            </label>
            <TextInput id="pw-new" type={type} autoComplete="new-password" invalid={!!errors.new_password} {...register("new_password")} />
            <FieldError message={errors.new_password?.message} />
          </div>
          <div>
            <label htmlFor="pw-confirm" className="mb-2 block text-xs font-semibold text-ink">
              Ulangi Password Baru
            </label>
            <TextInput id="pw-confirm" type={type} autoComplete="new-password" invalid={!!errors.confirm_password} {...register("confirm_password")} />
            <FieldError message={errors.confirm_password?.message} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-primary-ring pt-4">
          <Button variant="outline-muted" onClick={() => reset()} disabled={isSubmitting}>
            Reset
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Simpan Password
          </Button>
        </div>
      </form>
    </section>
  );
}

export default function ProfilPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="min-h-full rounded-lg bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider pb-4">
        <h1 className="text-xl font-medium text-primary">Profil saya</h1>
        <Link
          href="/dashboard"
          className="inline-flex h-9 items-center gap-2 rounded-md border-[1.5px] border-primary px-3 text-xs font-medium text-primary hover:bg-primary-soft"
        >
          <ChevronLeft className="size-4" aria-hidden /> Kembali ke Dashboard
        </Link>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        <ProfileCard user={user} />
        <PasswordCard />
      </div>
    </div>
  );
}
