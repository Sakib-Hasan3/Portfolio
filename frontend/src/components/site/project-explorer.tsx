"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { Project } from "@/lib/types";
import { ProjectCard } from "./projects";
import { FilterChip } from "./research";

export function ProjectExplorer({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const category = params.get("category");
  const tech = params.get("tech");

  const categories = useMemo(() => [...new Set(projects.map((p) => p.category))].sort(), [projects]);
  const techs = useMemo(() => {
    const counts = new Map<string, number>();
    projects.forEach((p) => p.technologies.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 14).map(([t]) => t);
  }, [projects]);

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };

  const needle = q.trim().toLowerCase();
  const shown = projects.filter(
    (p) =>
      (!category || p.category === category) &&
      (!tech || p.technologies.includes(tech)) &&
      (!needle ||
        p.title.toLowerCase().includes(needle) ||
        p.short_description.toLowerCase().includes(needle) ||
        p.technologies.some((t) => t.toLowerCase().includes(needle))),
  );

  return (
    <div>
      <div className="flex flex-col gap-5">
        <label className="relative block max-w-md">
          <span className="sr-only">Search projects</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            type="search"
            defaultValue={q}
            onChange={(e) => set("q", e.target.value || null)}
            placeholder="Search by name or technology"
            className="field !pl-9"
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          <FilterChip active={!category} onClick={() => set("category", null)}>All categories</FilterChip>
          {categories.map((c) => (
            <FilterChip key={c} active={category === c} onClick={() => set("category", category === c ? null : c)}>{c}</FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by technology">
          <span className="mr-1 text-sm text-faint">Technology</span>
          {techs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set("tech", tech === t ? null : t)}
              aria-pressed={tech === t}
              className={`rounded-md px-2 py-0.5 text-xs transition-colors ${tech === t ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted hover:text-text"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-8 text-sm text-faint" aria-live="polite">
        {shown.length} of {projects.length} projects
        {(q || category || tech) && (
          <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="ml-3 inline-flex items-center gap-1 text-muted hover:text-text">
            <X className="size-3.5" aria-hidden /> Clear filters
          </button>
        )}
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {shown.map((p) => <ProjectCard key={p.id} project={p} />)}
      </div>
      {shown.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-line p-10 text-center text-muted">
          No projects match these filters. Clear them to see everything.
        </p>
      )}
    </div>
  );
}
