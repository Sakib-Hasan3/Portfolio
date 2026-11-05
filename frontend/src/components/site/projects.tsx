"use client";

import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import type { Project } from "@/lib/types";
import { Photo } from "./photo";
import { cn } from "@/lib/utils";
import { GitHubIcon } from "./icons";
import { Tilt } from "./tilt";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Typographic cover used when a project has no thumbnail yet — reads as intentional, not a missing image. */
export function ProjectCover({ project, className, max = 6 }: { project: Project; className?: string; max?: number }) {
  if (project.thumbnail_url) {
    return (
      <Photo src={project.thumbnail_url} alt={`${project.title} preview`} width={800} height={450} sizes="(min-width: 1024px) 560px, (min-width: 640px) 50vw, 100vw" className={cn("size-full object-cover", className)} />
    );
  }
  // The stack itself, typeset large: an honest stand-in until a screenshot is uploaded.
  const stack = project.technologies.slice(0, max);
  return (
    <div className={cn("relative size-full min-h-44 overflow-hidden bg-surface-2", className)} aria-hidden>
      <svg className="absolute inset-0 size-full text-line" preserveAspectRatio="none">
        <defs>
          <pattern id={`g-${project.id}`} width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#g-${project.id})`} />
      </svg>
      <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-6">
        <p className="font-display text-[clamp(1.25rem,2.4vw,1.75rem)] font-medium leading-[1.15] tracking-tight text-muted/70">
          {stack.map((t, i) => (
            <span key={t}>
              {i > 0 && <span className="text-accent/60"> + </span>}
              {t}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

function Meta({ project }: { project: Project }) {
  return (
    <p className="text-sm text-faint">
      {project.period_label || project.year || ""}
      {(project.period_label || project.year) && project.category ? " — " : ""}
      {project.category}
    </p>
  );
}

export function ProjectCard({
  project,
  size = "md",
  onSelect,
  index = 0,
}: {
  project: Project;
  size?: "lg" | "md";
  onSelect?: (p: Project) => void;
  index?: number;
}) {
  const lg = size === "lg";
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotateX: 6 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: EASE, delay: index * 0.08 }}
      style={{ transformPerspective: 1000 }}
    >
    <Tilt className="rounded-2xl" max={lg ? 3 : 5}>
    <article
      className={cn(
        "group relative flex h-full overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-line-strong",
        lg ? "flex-col md:flex-row" : "flex-col",
        onSelect ? "cursor-pointer" : "",
      )}
      onClick={onSelect ? (e) => { e.preventDefault(); onSelect(project); } : undefined}
    >
      <div className={cn("relative overflow-hidden border-line", lg ? "aspect-[16/10] md:aspect-auto md:w-1/2 md:border-r" : "aspect-[16/9] border-b", !lg && "")}>
        <ProjectCover project={project} max={lg ? 6 : 4} className="transition-transform duration-500 group-hover:scale-[1.02]" />
      </div>
      <div className={cn("flex flex-1 flex-col p-6", lg && "md:p-8")}>
        <Meta project={project} />
        <h3 className={cn("mt-2", lg ? "text-2xl md:text-3xl" : "text-xl")}>
          <Link
            href={`/projects/${project.slug}`}
            className={cn(!onSelect && "after:absolute after:inset-0 after:content-['']" )}
            onClick={onSelect ? (e) => { e.stopPropagation(); e.preventDefault(); onSelect(project); } : undefined}
          >
            {project.title}
          </Link>
        </h3>
        <p className="mt-3 text-muted">{project.short_description}</p>
        {lg && project.highlights.length > 0 && (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted marker:text-faint">
            {project.highlights.slice(0, 3).map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        )}
        <ul className={cn("mt-5 flex flex-wrap gap-1.5", !project.thumbnail_url && "sr-only")} aria-label="Technologies">
          {project.technologies.slice(0, lg ? 8 : 5).map((t) => (
            <li key={t} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted">{t}</li>
          ))}
          {project.technologies.length > (lg ? 8 : 5) && (
            <li className="px-1 py-0.5 text-xs text-faint">+{project.technologies.length - (lg ? 8 : 5)}</li>
          )}
        </ul>
        <div className="relative z-10 mt-auto flex items-center gap-4 pt-6 text-sm">
          <span className="inline-flex items-center gap-1 text-text">
            {onSelect ? "View details" : "Read case study"} <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
          </span>
          {project.github_url ? (
            <a href={project.github_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-muted hover:text-text">
              <GitHubIcon className="size-4" /> Code
            </a>
          ) : null}
          {project.publication ? (
            <span className="inline-flex items-center gap-1.5 text-muted">
              <BookOpen className="size-4" aria-hidden /> Paper
            </span>
          ) : null}
        </div>
      </div>
    </article>
    </Tilt>
    </motion.div>
  );
}

export function FeaturedProjects({
  projects,
  onSelect,
}: {
  projects: Project[];
  onSelect?: (p: Project) => void;
}) {
  const featured = projects.filter((p) => p.is_featured);
  const list = featured.length ? featured : projects.slice(0, 4);
  const [lead, ...rest] = list;
  if (!lead) return null;
  return (
    <div className="space-y-6">
      <ProjectCard project={lead} size="lg" onSelect={onSelect} index={0} />
      {rest.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {rest.map((p, i) => {
            const lastOdd = rest.length % 2 === 1 && i === rest.length - 1;
            return (
              <div key={p.id} className={lastOdd ? "md:col-span-2" : undefined}>
                <ProjectCard project={p} size={lastOdd ? "lg" : "md"} onSelect={onSelect} index={i + 1} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
