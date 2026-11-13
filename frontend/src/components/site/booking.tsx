"use client";

import { CalendarCheck, ChevronLeft, ChevronRight, CircleCheck, Clock, LoaderCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Reveal } from "./reveal";

const SLOTS = ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_DAYS = 60;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Pick a day on the calendar, pick a time, add your details: the request lands in the admin inbox as a message. */
export function BookMeeting({ name, enabled }: { name: string; enabled: boolean }) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const last = useMemo(() => new Date(today.getTime() + MAX_DAYS * 86400000), [today]);
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [day, setDay] = useState<Date | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", note: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(first.getDay()).fill(null), ...Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))] as (Date | null)[];
  }, [month]);

  const canPrev = month > new Date(today.getFullYear(), today.getMonth(), 1);
  const canNext = new Date(month.getFullYear(), month.getMonth() + 1, 1) <= last;
  const pretty = day?.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!day || !slot) return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/v1/public/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          subject: `Meeting request: ${key(day)} ${slot}`,
          message: `Meeting request for ${pretty} at ${slot} (${tz || "visitor time zone"}).\n\n${form.note || "No additional notes."}`,
          elapsed_ms: Date.now() - startedAt.current,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.detail?.[0]?.msg || (typeof body?.detail === "string" ? body.detail : "") || "Could not send the request.");
      setState("sent");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Could not send the request.");
    }
  }

  if (!enabled) return null;
  return (
    <section id="book" aria-labelledby="book-title" className="container-x py-16 md:py-24">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-24">
            <h2 id="book-title" className="text-3xl md:text-4xl">Book a meeting</h2>
            <p className="mt-4 max-w-sm text-muted">
              Pick a day and a time that suits you. {name.split(" ")[0]} will confirm by email.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted">
              <li className="flex items-center gap-2"><Clock className="size-4 text-accent" aria-hidden /> 30-minute call</li>
              <li className="flex items-center gap-2"><CalendarCheck className="size-4 text-accent" aria-hidden /> Free to book, no account needed</li>
            </ul>
          </div>
        </div>

        <Reveal className="min-w-0 lg:col-span-8">
          {state === "sent" ? (
            <div role="status" className="rounded-2xl border border-line bg-surface p-8">
              <CircleCheck className="size-8 text-ok" aria-hidden />
              <h3 className="mt-4 text-2xl">Request sent</h3>
              <p className="mt-2 text-muted">{pretty} at {slot}. You will get a confirmation at {form.email}.</p>
              <button type="button" className="btn btn-ghost mt-6" onClick={() => { setState("idle"); setDay(null); setSlot(null); setForm({ name: "", email: "", note: "" }); startedAt.current = Date.now(); }}>
                Book another time
              </button>
            </div>
          ) : (
            <div className="grid gap-6 rounded-2xl border border-line bg-surface/70 p-5 backdrop-blur md:grid-cols-[1fr_15rem] md:p-7">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-sans text-base font-semibold tracking-normal">
                    {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                  </h3>
                  <div className="flex gap-1">
                    <button type="button" aria-label="Previous month" disabled={!canPrev} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="btn btn-ghost !p-2 disabled:opacity-30"><ChevronLeft className="size-4" /></button>
                    <button type="button" aria-label="Next month" disabled={!canNext} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="btn btn-ghost !p-2 disabled:opacity-30"><ChevronRight className="size-4" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs text-faint">
                  {DOW.map((w) => <div key={w} className="py-1">{w}</div>)}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1" role="grid" aria-label="Choose a date">
                  {cells.map((c, i) => {
                    if (!c) return <div key={`b${i}`} />;
                    const disabled = c < today || c > last;
                    const selected = day && key(day) === key(c);
                    return (
                      <button
                        key={key(c)}
                        type="button"
                        disabled={disabled}
                        aria-pressed={!!selected}
                        onClick={() => { setDay(c); setSlot(null); }}
                        className={`aspect-square rounded-lg text-sm transition-all ${
                          selected
                            ? "bg-accent text-accent-ink shadow-[0_8px_20px_-6px_var(--accent)] scale-105"
                            : disabled
                              ? "text-faint/40"
                              : key(c) === key(today)
                                ? "border border-accent text-text hover:bg-accent-soft"
                                : "text-text hover:bg-accent-soft"
                        }`}
                      >
                        {c.getDate()}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 text-xs text-faint">Times shown in your time zone{tz ? ` (${tz})` : ""}.</p>
              </div>

              <div>
                <h3 className="font-sans text-base font-semibold tracking-normal">{day ? day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "Select a date"}</h3>
                {day ? (
                  <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-1">
                    {SLOTS.map((s) => (
                      <button key={s} type="button" aria-pressed={slot === s} onClick={() => setSlot(s)}
                        className={`rounded-lg border px-3 py-2 text-sm transition-colors ${slot === s ? "border-accent bg-accent-soft text-text" : "border-line text-muted hover:border-line-strong hover:text-text"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted">Choose a day on the calendar to see available times.</p>
                )}
              </div>

              {day && slot && (
                <form onSubmit={submit} className="space-y-4 border-t border-line pt-6 md:col-span-2">
                  <p className="text-sm text-text">Meeting on <b>{pretty}</b> at <b>{slot}</b></p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block"><span className="label">Name</span>
                      <input required minLength={2} maxLength={120} className="field" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                    <label className="block"><span className="label">Email</span>
                      <input required type="email" className="field" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                    <label className="block sm:col-span-2"><span className="label">What would you like to discuss? (optional)</span>
                      <textarea rows={3} maxLength={2000} className="field resize-y" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
                  </div>
                  {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                  <button type="submit" className="btn btn-primary" disabled={state === "sending"}>
                    {state === "sending" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <CalendarCheck className="size-4" aria-hidden />}
                    {state === "sending" ? "Booking" : "Confirm booking"}
                  </button>
                </form>
              )}
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
