"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Spinner } from "@/components/admin/ui";
import { ThemeToggle } from "@/components/theme-provider";

const schema = z.object({
  email: z.email("Enter the admin email address"),
  password: z.string().min(1, "Enter your password"),
});

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setError(null);
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
      credentials: "same-origin",
    });
    if (res.ok) {
      const next = params.get("next");
      router.replace(next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
      router.refresh();
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(res.status === 429 ? "Too many attempts. Wait a minute and try again." : body?.detail || "Sign-in failed.");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <label className="block">
        <span className="label">Email</span>
        <input {...register("email")} type="email" autoComplete="username" className="field" aria-invalid={!!errors.email} autoFocus />
        {errors.email && <span className="mt-1.5 block text-sm text-danger">{errors.email.message}</span>}
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input {...register("password")} type="password" autoComplete="current-password" className="field" aria-invalid={!!errors.password} />
        {errors.password && <span className="mt-1.5 block text-sm text-danger">{errors.password.message}</span>}
      </label>
      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary w-full justify-center" disabled={isSubmitting}>
        {isSubmitting && <Spinner />} Sign in
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <span className="grid size-10 place-items-center rounded-xl bg-text text-bg"><KeyRound className="size-5" /></span>
          <h1 className="mt-6 text-3xl">Sign in to the dashboard</h1>
          <p className="mt-2 text-sm text-muted">Manage everything on your portfolio from one place.</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
