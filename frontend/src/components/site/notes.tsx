"use client";

import { ArrowUpRight, Clock } from "lucide-react";
import Link from "next/link";
import { useLang, useT } from "@/components/i18n-provider";
import type { NoteCard as NoteCardT } from "@/lib/types";
import { Section } from "./section";
import { Tilt } from "./tilt";

export function NoteDate({ iso }: { iso: string }) {
  const lang = useLang();
  return <time dateTime={iso}>{new Date(iso).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}</time>;
}

export function NoteCard({ note }: { note: NoteCardT }) {
  const t = useT();
  return (
    <Tilt className="rounded-2xl">
      <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface">
        {note.cover_url && <img src={note.cover_url} alt="" loading="lazy" className="aspect-[16/8] w-full border-b border-line object-cover" />}
        <div className="flex flex-1 flex-col p-6">
          <p className="flex items-center gap-3 text-xs text-faint">
            <NoteDate iso={note.published_at} />
            <span className="inline-flex items-center gap-1"><Clock className="size-3" aria-hidden /> {t("notes.min", { n: note.reading_minutes })}</span>
          </p>
          <h3 className="mt-3 text-xl leading-snug">
            <Link href={`/notes/${note.slug}`} className="after:absolute after:inset-0 hover:text-accent">{note.title}</Link>
          </h3>
          {note.summary && <p className="mt-3 flex-1 text-muted">{note.summary}</p>}
          <div className="mt-5 flex items-center justify-between gap-3">
            <ul className="flex flex-wrap gap-1.5">
              {note.tags.slice(0, 3).map((x) => <li key={x} className="chip">{x}</li>)}
            </ul>
            <ArrowUpRight className="size-4 shrink-0 text-faint transition-colors group-hover:text-accent" aria-hidden />
          </div>
        </div>
      </article>
    </Tilt>
  );
}

export function NotesPreview({ notes }: { notes: NoteCardT[] }) {
  const t = useT();
  if (!notes.length) return null;
  return (
    <Section
      id="notes"
      title={t("sec.notes")}
      lede={t("sec.notes.lede")}
      aside={<Link href="/notes" className="btn btn-ghost mt-6">{t("sec.notes.all")}</Link>}
    >
      <div className="grid gap-5 md:grid-cols-2">
        {notes.map((n) => <NoteCard key={n.id} note={n} />)}
      </div>
    </Section>
  );
}
