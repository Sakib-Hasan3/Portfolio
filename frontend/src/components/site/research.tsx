"use client";

import { ArrowUpRight, FileText, Quote } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ieeeCitation, venueYear } from "@/lib/citation";
import type { Publication } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Tilt } from "./tilt";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function PublicationList({
  items,
  author,
  onSelect,
}: {
  items: Publication[];
  author?: string;
  onSelect?: (p: Publication) => void;
}) {
  const years = useMemo(() => [...new Set(items.map((p) => p.year))].sort((a, b) => b - a), [items]);
  const types = useMemo(() => [...new Set(items.map((p) => p.publication_type))], [items]);
  const [year, setYear] = useState<number | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const shown = items.filter((p) => (year ? p.year === year : true) && (type ? p.publication_type === type : true));
  const showFilters = years.length > 1 || types.length > 1;

  return (
    <div>
      {showFilters && (
        <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter publications">
          <FilterChip active={!year && !type} onClick={() => { setYear(null); setType(null); }}>All</FilterChip>
          {years.length > 1 && years.map((y) => (
            <FilterChip key={y} active={year === y} onClick={() => setYear(year === y ? null : y)}>{y}</FilterChip>
          ))}
          {types.length > 1 && types.map((t) => (
            <FilterChip key={t} active={type === t} onClick={() => setType(type === t ? null : t)}>
              <span className="capitalize">{t}</span>
            </FilterChip>
          ))}
        </div>
      )}

      <ol className="space-y-5">
        {shown.map((p, idx) => {
          const n = items.indexOf(p) + 1;
          return (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, x: -32 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.55, ease: EASE, delay: idx * 0.07 }}
            >
              <Tilt className="rounded-xl" max={4}>
                <article
                  className={cn(
                    "group relative grid gap-x-5 rounded-xl border border-line bg-surface p-6 transition-colors hover:border-line-strong sm:grid-cols-[2.5rem_1fr]",
                    onSelect ? "cursor-pointer" : "",
                  )}
                  onClick={onSelect ? () => onSelect(p) : undefined}
                >
                  <span className="font-display text-lg text-faint" aria-hidden>[{n}]</span>
                  <div className="min-w-0">
                    <h3 className="text-xl leading-snug md:text-[1.375rem]">
                      <Link
                        href={`/research/${p.slug}`}
                        className={cn(!onSelect && "after:absolute after:inset-0 after:rounded-xl after:content-['']")}
                        onClick={onSelect ? (e) => { e.preventDefault(); e.stopPropagation(); onSelect(p); } : undefined}
                      >
                        {p.title}
                      </Link>
                    </h3>
                    <p className="mt-2 text-sm text-muted">
                      <span className="text-text">{venueYear(p.venue, p.year)}</span>
                      {p.author_position ? <> — {p.author_position}</> : null}
                    </p>
                    {p.doi_url ? (
                      <p className="relative z-10 mt-1 w-fit text-sm">
                        <a href={p.doi_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="break-all text-accent hover:underline">
                          doi:{p.doi}
                        </a>
                      </p>
                    ) : null}
                    {p.abstract ? <p className="mt-4 line-clamp-3 max-w-[68ch] text-muted">{p.abstract}</p> : null}
                    {p.tags.length > 0 && (
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {p.tags.map((t) => <li key={t} className="chip !text-xs">{t}</li>)}
                      </ul>
                    )}
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-sm text-text">
                        {onSelect ? "View details" : "Read the paper details"}
                        <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                      </span>
                      <span className="flex-1" />
                      {p.pdf_url ? (
                        <a href={p.pdf_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="btn btn-ghost relative z-10 !py-1.5 text-sm">
                          <FileText className="size-4" aria-hidden /> PDF
                        </a>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-ghost relative z-10 !py-1.5 text-sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await navigator.clipboard.writeText(ieeeCitation(p, author));
                            setCopied(p.id);
                            setTimeout(() => setCopied(null), 1800);
                          } catch {
                            /* clipboard unavailable */
                          }
                        }}
                      >
                        <Quote className="size-4" aria-hidden /> {copied === p.id ? "Citation copied" : "Copy citation"}
                      </button>
                    </div>
                  </div>
                </article>
              </Tilt>
            </motion.li>
          );
        })}
      </ol>
      {shown.length === 0 && <p className="text-muted">No publications match this filter.</p>}
    </div>
  );
}

export function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        active ? "border-text bg-text text-bg" : "border-line text-muted hover:border-line-strong hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
