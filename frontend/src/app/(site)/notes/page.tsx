import type { Metadata } from "next";
import Link from "next/link";
import { NoteCard } from "@/components/site/notes";
import { ContentUnavailable } from "@/components/site/states";
import { getNotes, getPortfolioSafe } from "@/lib/api/server";
import { getT } from "@/lib/i18n-server";
import { baseMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPortfolioSafe();
  const name = data?.profile?.full_name ?? "Portfolio";
  return baseMetadata(data, { title: `Notes — ${name}`, description: `Technical write-ups by ${name}: machine learning, LLM systems and full-stack engineering.`, path: "/notes" });
}

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const [{ tag }, { t }, data, all] = await Promise.all([searchParams, getT(), getPortfolioSafe(), getNotes().catch(() => null)]);
  if (!data || !all) return <ContentUnavailable />;
  const tags = [...new Set(all.flatMap((n) => n.tags))].sort((a, b) => a.localeCompare(b));
  const notes = tag ? all.filter((n) => n.tags.some((x) => x.toLowerCase() === tag.toLowerCase())) : all;
  return (
    <div className="container-x py-14 md:py-20">
      <h1 className="text-4xl md:text-5xl">{t("notes.title")}</h1>
      <p className="mt-4 max-w-xl text-muted">{t("notes.lede")}</p>
      {tags.length > 0 && (
        <nav aria-label="Filter by tag" className="mt-8 flex flex-wrap gap-2">
          {[{ label: t("notes.all.tags"), href: "/notes", on: !tag }, ...tags.map((x) => ({ label: x, href: `/notes?tag=${encodeURIComponent(x)}`, on: tag?.toLowerCase() === x.toLowerCase() }))].map((c) => (
            <Link key={c.href} href={c.href} aria-current={c.on ? "page" : undefined} className={cn("rounded-full border px-3.5 py-1.5 text-sm transition-colors", c.on ? "border-text bg-text text-bg" : "border-line text-muted hover:border-line-strong hover:text-text")}>
              {c.label}
            </Link>
          ))}
        </nav>
      )}
      {notes.length === 0 ? (
        <p className="mt-16 text-muted">{t("notes.empty")}</p>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2">{notes.map((n) => <NoteCard key={n.id} note={n} />)}</div>
      )}
    </div>
  );
}
