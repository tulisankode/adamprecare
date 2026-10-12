"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { errorMessage, staffLogin } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { primeAlarm } from "@/lib/alarm";

const schema = z.object({
  username: z.string().trim().min(1, "Username wajib diisi."),
  password: z.string().min(1, "Password wajib diisi."),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { status } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { username: "", password: "" } });

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    primeAlarm();
    try {
      await staffLogin(values.username.trim(), values.password);
      router.replace("/dashboard");
    } catch (err) {
      setServerError(errorMessage(err, "Login gagal. Periksa username dan password."));
    }
  });

  return (
    <main className="grid min-h-dvh bg-white lg:grid-cols-2">
      <section className="flex flex-col items-center justify-center gap-8 px-6 py-10 lg:gap-14">
        <Image
          src="/login-illustration.png"
          alt="Ilustrasi petugas mendorong pasien kursi roda di depan ambulans"
          width={486}
          height={300}
          priority
          className="h-auto w-full max-w-[486px]"
        />
        <Image src="/logo.png" alt="Adam PreCare — Pre-Hospital & Incident Emergency System" width={386} height={60} priority className="h-auto w-full max-w-[386px]" />
      </section>

      <section className="flex items-center justify-center bg-primary px-4 py-12 sm:px-10 lg:my-20 lg:mr-20">
        <div className="w-full max-w-[500px] rounded-[20px] bg-white px-6 py-14 shadow-card sm:px-12">
          <h1 className="text-center text-4xl font-semibold text-primary">Login</h1>
          <p className="mt-2 text-center text-sm text-muted">Silahkan login terlebih dahulu</p>

          <form onSubmit={onSubmit} noValidate className="mt-10 space-y-5">
            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-medium text-ink">
                Username
              </label>
              <input
                id="username"
                autoComplete="username"
                placeholder="Username"
                aria-invalid={!!errors.username || undefined}
                aria-describedby={errors.username ? "username-error" : undefined}
                {...register("username")}
                className="h-10 w-full rounded-md border border-line px-3 text-sm outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary-ring/60"
              />
              {errors.username && (
                <p id="username-error" className="mt-1 text-xs text-danger">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-ink">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={!!errors.password || undefined}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  {...register("password")}
                  className="h-10 w-full rounded-md border border-line pr-11 pl-3 text-sm outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary-ring/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  aria-pressed={showPassword}
                  className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded text-muted-strong hover:text-ink"
                >
                  {showPassword ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1 text-xs text-danger">
                  {errors.password.message}
                </p>
              )}
            </div>

            {serverError && (
              <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {serverError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-white uppercase hover:bg-primary-pressed disabled:opacity-70"
            >
              {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Login
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
