"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, LoaderCircle, Mail, MapPin, Phone, Send } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Profile, SocialLink } from "@/lib/types";
import { SocialIcon } from "./icons";
import { useT } from "@/components/i18n-provider";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.email("Enter a valid email address"),
  subject: z.string().trim().min(2, "Add a short subject").max(200),
  message: z.string().trim().min(10, "Write at least a sentence (10+ characters)").max(5000),
  website: z.string().max(200).optional(), // honeypot
});
type Values = z.infer<typeof schema>;

export function ContactSection({ profile, links, enabled }: { profile: Profile; links: SocialLink[]; enabled: boolean }) {
  const t = useT();
  const startedAt = useRef<number>(Date.now());
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Values) => {
    setServerError(null);
    try {
      const res = await fetch("/api/v1/public/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, elapsed_ms: Date.now() - startedAt.current }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.detail || "The message could not be sent.");
      setState("sent");
      reset();
    } catch (e) {
      setState("error");
      setServerError(e instanceof Error ? e.message : "The message could not be sent.");
    }
  };

  const channels = links.filter((l) => !l.url.startsWith("mailto:"));

  return (
    <section id="contact" aria-labelledby="contact-title" className="container-x border-t border-line py-16 md:py-24">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <h2 id="contact-title" className="text-3xl md:text-4xl">{t("contact.title")}</h2>
          <p className="mt-4 max-w-md text-muted">
            {profile.availability_note || t("contact.default")}
          </p>
          <ul className="mt-8 space-y-4">
            {profile.email && (
              <li>
                <a href={`mailto:${profile.email}`} className="group flex items-center gap-3">
                  <Mail className="size-5 text-accent" aria-hidden />
                  <span className="border-b border-transparent group-hover:border-current">{profile.email}</span>
                </a>
              </li>
            )}
            {channels.map((l) => (
              <li key={l.id}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3">
                  <SocialIcon platform={l.platform} className="size-5 text-accent" />
                  <span className="border-b border-transparent group-hover:border-current">{l.label}</span>
                </a>
              </li>
            ))}
            {profile.phone && (
              <li className="flex items-center gap-3 text-muted"><Phone className="size-5 text-accent" aria-hidden /> {profile.phone}</li>
            )}
            {profile.location && (
              <li className="flex items-center gap-3 text-muted">
                <MapPin className="size-5 text-accent" aria-hidden /> {profile.location}
              </li>
            )}
          </ul>
        </div>

        <div className="lg:col-span-7">
          {!enabled ? (
            <p className="rounded-xl border border-line bg-surface p-8 text-muted">
              The contact form is turned off right now. Email works just as well.
            </p>
          ) : state === "sent" ? (
            <div className="rounded-xl border border-line bg-surface p-8" role="status">
              <CircleCheck className="size-7 text-ok" aria-hidden />
              <h3 className="mt-4 text-2xl">{t("contact.sent")}</h3>
              <p className="mt-2 text-muted">{t("contact.sent.body")}</p>
              <button type="button" className="btn btn-ghost mt-6" onClick={() => { setState("idle"); startedAt.current = Date.now(); }}>
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="rounded-xl border border-line bg-surface p-6 md:p-8">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t("contact.name")} error={errors.name?.message}>
                  <input {...register("name")} autoComplete="name" className="field" aria-invalid={!!errors.name} />
                </Field>
                <Field label={t("contact.email")} error={errors.email?.message}>
                  <input {...register("email")} type="email" autoComplete="email" className="field" aria-invalid={!!errors.email} />
                </Field>
                <Field label={t("contact.subject")} error={errors.subject?.message} className="sm:col-span-2">
                  <input {...register("subject")} className="field" aria-invalid={!!errors.subject} />
                </Field>
                <Field label={t("contact.message")} error={errors.message?.message} className="sm:col-span-2">
                  <textarea {...register("message")} rows={6} className="field resize-y" aria-invalid={!!errors.message} />
                </Field>
                {/* Honeypot: hidden from people, irresistible to bots */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label>
                    Website
                    <input {...register("website")} tabIndex={-1} autoComplete="off" />
                  </label>
                </div>
              </div>
              {serverError && <p className="mt-4 text-sm text-danger" role="alert">{serverError}</p>}
              <div className="mt-6 flex items-center justify-between gap-4">
                <p className="text-xs text-faint">{t("contact.privacy")}</p>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                  {isSubmitting ? t("contact.sending") : t("contact.send")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({ label, error, children, className = "" }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {error && <span className="mt-1.5 block text-sm text-danger">{error}</span>}
    </label>
  );
}
