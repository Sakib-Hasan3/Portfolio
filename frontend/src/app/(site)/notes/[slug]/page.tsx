import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { Markdown } from "@/components/site/markdown";
import { NoteCard, NoteDate } from "@/components/site/notes";
import { getNote, getNotes, getPortfolioSafe, NotFoundError, siteUrl } from "@/lib/api/server";
import { getT } from "@/lib/i18n-server";
import { baseMetadata, jsonLdString } from "@/lib/seo";
import type { Note } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string): Promise<Note | null> {
  try {
    return await getNote(slug);
  } catch (e) {
    if (e instanceof NotFoundError) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [note, data] = await Promise.all([load(slug), getPortfolioSafe()]);
  if (!note) return { title: "Note not found" };
  const md = baseMetadata(data, { title: `${note.title} — ${data?.profile?.full_name ?? "Notes"}`, description: note.summary, path: `/notes/${note.slug}`, image: note.cover_url });
  return { ...md, openGraph: { ...md.openGraph, type: "article", publishedTime: note.published_at, modifiedTime: note.updated_at, tags: note.tags } };
}

export default async function NotePage({ params }: Props) {
  const { slug } = await params;
  const note = await load(slug);
  if (!note) notFound();
  const [data, { t }, all] = await Promise.all([getPortfolioSafe(), getT(), getNotes().catch(() => [])]);
  const base = siteUrl(data?.settings?.site_url);
  const more = all.filter((n) => n.id !== note.id).slice(0, 2);
  const ld = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: note.title,
    description: note.summary,
    datePublished: note.published_at,
    dateModified: note.updated_at,
    keywords: note.tags.join(", ") || undefined,
    author: { "@type": "Person", name: data?.profile?.full_name, url: base },
    mainEntityOfPage: `${base}/notes/${note.slug}`,
  };
  return (
    <article className="container-x py-12 md:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(ld) }} />
      <Link href="/notes" className="inline-flex items-center gap-2 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> {t("notes.back")}
      </Link>
      <header className="mt-8 max-w-[46rem]">
        <p className="flex items-center gap-3 text-sm text-faint">
          <NoteDate iso={note.published_at} />
          <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden /> {t("notes.min", { n: note.reading_minutes })}</span>
        </p>
        <h1 className="mt-4 text-4xl leading-[1.08] md:text-5xl">{note.title}</h1>
        {note.summary && <p className="mt-5 text-lg text-muted">{note.summary}</p>}
        {note.tags.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {note.tags.map((x) => <li key={x}><Link href={`/notes?tag=${encodeURIComponent(x)}`} className="chip hover:border-line-strong">{x}</Link></li>)}
          </ul>
        )}
      </header>
      {note.cover_url && <img src={note.cover_url} alt="" className="mt-10 max-h-[30rem] w-full max-w-[60rem] rounded-2xl border border-line object-cover" />}
      <Markdown text={note.content} className="mt-10 max-w-[46rem] text-[1.0625rem] leading-[1.75] text-muted" />
      {more.length > 0 && (
        <section className="mt-20 border-t border-line pt-12" aria-label="More notes">
          <h2 className="text-2xl">{t("sec.notes")}</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">{more.map((n) => <NoteCard key={n.id} note={n} />)}</div>
        </section>
      )}
    </article>
  );
}
