"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, ExternalLink, FileText, Quote, BookOpen,
  Tag, Calendar, Layers, CheckCircle2, ArrowUpRight,
  Copy, Check,
} from "lucide-react";
import Link from "next/link";
import { bibtex, ieeeCitation, venueYear } from "@/lib/citation";
import type { Project, Publication } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GitHubIcon } from "./icons";
import { ProjectCover } from "./projects";
import { STATUS_LABEL } from "@/lib/utils";

/* ─────────────────────────── shared backdrop ─────────────────────────── */

function Backdrop({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      key="backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      aria-hidden
    />
  );
}

/* ─────────────────────────── drawer shell ────────────────────────────── */

function DrawerShell({
  onClose,
  children,
  label,
}: {
  onClose: () => void;
  children: React.ReactNode;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Trap focus + Esc
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [onClose]);

  return (
    <motion.aside
      ref={ref}
      key="drawer"
      role="dialog"
      aria-modal
      aria-label={label}
      tabIndex={-1}
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 36, mass: 0.9 }}
      className={cn(
        "fixed right-0 top-0 z-50 flex h-full w-full flex-col overflow-hidden",
        "bg-surface shadow-[var(--shadow-xl)] outline-none",
        "sm:max-w-xl md:max-w-2xl",
        "border-l border-line",
      )}
    >
      {children}
    </motion.aside>
  );
}

/* ─────────────────────────── copy button ─────────────────────────────── */

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch { /* ignore */ }
      }}
      className="btn btn-ghost !py-1.5 text-sm"
    >
      {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

/* ─────────────────────────── PROJECT DRAWER ─────────────────────────── */

export function ProjectDrawer({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const facts = [
    { label: "Year", value: project.period_label || (project.year ? String(project.year) : null), icon: Calendar },
    { label: "Area", value: project.category, icon: Layers },
    { label: "Status", value: STATUS_LABEL[project.status] ?? project.status, icon: CheckCircle2 },
  ].filter((f) => f.value);

  return (
    <AnimatePresence>
      <Backdrop onClose={onClose} />
      <DrawerShell onClose={onClose} label={`${project.title} — project details`}>
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line p-6 pb-5">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-faint">Project</p>
            <h2 className="mt-1 text-2xl leading-tight md:text-3xl">{project.title}</h2>
            <p className="mt-2 text-sm text-muted">{project.short_description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="shrink-0 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Cover image */}
          <div className="aspect-[16/7] overflow-hidden border-b border-line">
            <ProjectCover project={project} className="size-full object-cover" />
          </div>

          <div className="space-y-8 p-6">
            {/* Quick facts */}
            {facts.length > 0 && (
              <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
                {facts.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-surface p-4">
                    <dt className="flex items-center gap-1.5 text-xs text-faint">
                      <Icon className="size-3" aria-hidden /> {label}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              {project.github_url && (
                <a href={project.github_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                  <GitHubIcon className="size-4" /> View source
                </a>
              )}
              {project.demo_url && (
                <a href={project.demo_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                  <ExternalLink className="size-4" aria-hidden /> Live demo
                </a>
              )}
              {project.extra_links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                  <ExternalLink className="size-4" aria-hidden /> {l.label}
                </a>
              ))}
              <Link href={`/projects/${project.slug}`} className="btn btn-quiet ml-auto">
                Full case study <ArrowUpRight className="size-4" />
              </Link>
            </div>

            {/* Description */}
            {project.description && (
              <section>
                <h3 className="text-lg font-semibold">Overview</h3>
                <p className="mt-3 max-w-prose text-muted">{project.description}</p>
              </section>
            )}

            {/* Highlights */}
            {project.highlights.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold">What I built</h3>
                <ul className="mt-3 space-y-2">
                  {project.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-muted">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                      {h}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Technologies */}
            {project.technologies.length > 0 && (
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  <Tag className="size-4 text-faint" aria-hidden /> Technologies
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {project.technologies.map((t) => (
                    <li key={t} className="chip">{t}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* Gallery */}
            {project.images.length > 0 && (
              <section>
                <h3 className="mb-3 text-lg font-semibold">Screenshots</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {project.images.map((img) => (
                    <figure key={img.id} className="overflow-hidden rounded-xl border border-line">
                      <a href={img.url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={img.url}
                          alt={img.caption || `${project.title} screenshot`}
                          loading="lazy"
                          className="w-full transition-transform duration-500 hover:scale-105"
                        />
                      </a>
                      {img.caption && (
                        <figcaption className="px-3 py-2 text-xs text-muted">{img.caption}</figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              </section>
            )}

            {/* Related paper */}
            {project.publication && (
              <section className="rounded-xl border border-line bg-surface-2 p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-muted">
                  <BookOpen className="size-4" aria-hidden /> Related publication
                </h3>
                <Link
                  href={`/research/${project.publication.slug}`}
                  className="mt-2 block text-lg leading-snug hover:text-accent"
                >
                  {project.publication.title}
                </Link>
                <p className="mt-1 text-sm text-muted">
                  {venueYear(project.publication.venue, project.publication.year)}
                </p>
                {project.publication.doi && (
                  <a
                    href={`https://doi.org/${project.publication.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block break-all text-sm text-accent hover:underline"
                  >
                    doi:{project.publication.doi}
                  </a>
                )}
              </section>
            )}
          </div>
        </div>
      </DrawerShell>
    </AnimatePresence>
  );
}

/* ─────────────────────────── RESEARCH DRAWER ───────────────────────── */

export function ResearchDrawer({
  paper,
  onClose,
  authorFallback,
}: {
  paper: Publication;
  onClose: () => void;
  authorFallback?: string;
}) {
  const [tab, setTab] = useState<"ieee" | "bibtex">("ieee");

  return (
    <AnimatePresence>
      <Backdrop onClose={onClose} />
      <DrawerShell onClose={onClose} label={`${paper.title} — research paper details`}>
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line p-6 pb-5">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-faint">
              {paper.publication_type} · {paper.year}
            </p>
            <h2 className="mt-1 text-xl leading-snug md:text-2xl">{paper.title}</h2>
            {paper.authors && (
              <p className="mt-2 text-sm text-muted">{paper.authors}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="shrink-0 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-8 p-6">
            {/* Venue + actions */}
            <div className="rounded-xl border border-line bg-surface-2 p-5">
              <p className="text-sm font-semibold">{venueYear(paper.venue, paper.year)}</p>
              {paper.author_position && (
                <p className="mt-1 text-sm text-muted">{paper.author_position}</p>
              )}
              {paper.doi_url && (
                <a href={paper.doi_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block break-all text-sm text-accent hover:underline">
                  doi:{paper.doi}
                </a>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                {paper.pdf_url && (
                  <a href={paper.pdf_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                    <FileText className="size-4" aria-hidden /> Open PDF
                  </a>
                )}
                {paper.external_url && (
                  <a href={paper.external_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                    <ExternalLink className="size-4" aria-hidden /> Publisher page
                  </a>
                )}
                <Link href={`/research/${paper.slug}`} className="btn btn-quiet ml-auto">
                  Full details <ArrowUpRight className="size-4" />
                </Link>
              </div>
            </div>

            {/* Abstract */}
            {paper.abstract && (
              <section>
                <h3 className="text-lg font-semibold">Abstract</h3>
                <p className="mt-3 max-w-prose text-muted leading-relaxed">{paper.abstract}</p>
              </section>
            )}

            {/* Highlights */}
            {paper.highlights.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold">Key contributions</h3>
                <ul className="mt-3 space-y-2">
                  {paper.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-muted">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                      {h}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Tags */}
            {paper.tags.length > 0 && (
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  <Tag className="size-4 text-faint" aria-hidden /> Topics
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {paper.tags.map((t) => (
                    <li key={t} className="chip">{t}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* Citation */}
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <Quote className="size-4 text-faint" aria-hidden /> Cite this paper
              </h3>
              <div className="rounded-xl border border-line overflow-hidden">
                <div className="flex border-b border-line">
                  {(["ieee", "bibtex"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className={cn(
                        "px-4 py-2 text-sm font-medium transition-colors",
                        tab === t ? "bg-surface-2 text-text" : "text-muted hover:text-text",
                      )}
                    >
                      {t === "ieee" ? "IEEE" : "BibTeX"}
                    </button>
                  ))}
                  <div className="ml-auto flex items-center pr-2">
                    <CopyButton
                      text={tab === "ieee" ? ieeeCitation(paper, authorFallback) : bibtex(paper, authorFallback)}
                      label="Copy"
                    />
                  </div>
                </div>
                <pre className="overflow-x-auto bg-surface p-4 text-xs text-muted leading-relaxed whitespace-pre-wrap break-all">
                  {tab === "ieee"
                    ? ieeeCitation(paper, authorFallback)
                    : bibtex(paper, authorFallback)}
                </pre>
              </div>
            </section>
          </div>
        </div>
      </DrawerShell>
    </AnimatePresence>
  );
}
