"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAdmin } from "@/components/admin/shell";
import { Card, PageHeader, Spinner, useToast } from "@/components/admin/ui";
import { api, ApiError } from "@/lib/admin/client";

const schema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    new_password: z
      .string()
      .min(12, "Use at least 12 characters")
      .refine((v) => [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(v)).length >= 3, "Use at least three of: lowercase, uppercase, digits, symbols"),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export default function AccountPage() {
  const { user } = useAdmin();
  const toast = useToast();
  const router = useRouter();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = async (v: z.infer<typeof schema>) => {
    try {
      await api("/auth/change-password", { body: { current_password: v.current_password, new_password: v.new_password } });
      toast("success", "Password changed. Sign in with the new password.");
      router.replace("/admin/login");
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) setError("current_password", { message: e.message });
      else toast("error", e instanceof ApiError ? e.message : "Could not change the password");
    }
  };

  return (
    <div>
      <PageHeader title="Account & security" description="Your administrator account. Sessions use short-lived tokens in HTTP-only cookies and rotate automatically." />
      <Card className="mb-6 p-6">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div><dt className="text-xs text-faint">Name</dt><dd className="mt-0.5 font-medium">{user?.full_name}</dd></div>
          <div><dt className="text-xs text-faint">Email</dt><dd className="mt-0.5 font-medium">{user?.email}</dd></div>
          <div><dt className="text-xs text-faint">Role</dt><dd className="mt-0.5 font-medium capitalize">{user?.role}</dd></div>
        </dl>
      </Card>
      <Card className="max-w-xl p-6">
        <h2 className="font-sans text-base font-semibold tracking-normal">Change password</h2>
        <p className="mt-1 text-sm text-muted">Changing it signs out every other session.</p>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
          {([
            ["current_password", "Current password", "current-password"],
            ["new_password", "New password", "new-password"],
            ["confirm", "Confirm new password", "new-password"],
          ] as const).map(([name, label, ac]) => (
            <label key={name} className="block">
              <span className="label">{label}</span>
              <input type="password" autoComplete={ac} className="field" aria-invalid={!!errors[name]} {...register(name)} />
              {errors[name] && <span className="mt-1.5 block text-sm text-danger">{errors[name]?.message}</span>}
            </label>
          ))}
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting && <Spinner />} Change password</button>
        </form>
      </Card>
    </div>
  );
}
