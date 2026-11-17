"use client";

import { useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Project } from "@/lib/types";
import { ProjectCard } from "./projects";

/**
 * 3D cover-flow: the active project faces you, neighbours rotate away into depth.
 * Arrow buttons, keyboard arrows, swipe/drag and click-on-neighbour all move it.
 */
export function ProjectCarousel({ projects, onSelect }: { projects: Project[]; onSelect?: (p: Project) => void }) {
  const [active, setActive] = useState(0);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const n = projects.length;
  const go = useCallback((d: number) => setActive((a) => Math.min(n - 1, Math.max(0, a + d))), [n]);

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured projects"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      onPointerDown={(e) => { drag.current = { x: e.clientX, moved: false }; }}
      onPointerMove={(e) => {
        if (drag.current && Math.abs(e.clientX - drag.current.x) > 8) drag.current.moved = true;
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (d && Math.abs(e.clientX - d.x) > 50) go(e.clientX < d.x ? 1 : -1);
      }}
      onClickCapture={(e) => {
        // a swipe must not open a card
        if (drag.current?.moved) { e.preventDefault(); e.stopPropagation(); }
      }}
      className="select-none outline-none [touch-action:pan-y]"
    >
      <div className="relative mx-auto h-[640px] overflow-x-clip sm:h-[600px]" style={{ perspective: 1600 }}>
        {projects.map((p, i) => {
          const off = i - active;
          const abs = Math.abs(off);
          return (
            <div
              key={p.id}
              aria-hidden={off !== 0}
              inert={off !== 0}
              onClick={off !== 0 ? () => setActive(i) : undefined}
              className="absolute left-1/2 top-0 w-[min(100%,460px)] transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                transform: `translateX(calc(-50% + ${off * 62}%)) translateZ(${-abs * 160}px) rotateY(${off * -38}deg) scale(${off === 0 ? 1 : 0.92})`,
                opacity: abs > 2 ? 0 : 1 - abs * 0.3,
                filter: off === 0 ? "none" : `blur(${abs * 1.2}px) brightness(0.85)`,
                zIndex: 10 - abs,
                pointerEvents: abs > 2 ? "none" : "auto",
                cursor: off !== 0 ? "pointer" : undefined,
              }}
            >
              <ProjectCard project={p} size="md" onSelect={onSelect} />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-center gap-4">
        <button type="button" onClick={() => go(-1)} disabled={active === 0} aria-label="Previous project" className="btn btn-ghost !px-3 disabled:opacity-30">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div className="flex gap-2" role="tablist" aria-label="Choose project">
          {projects.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={p.title}
              onClick={() => setActive(i)}
              className={`h-2 rounded-full transition-all ${i === active ? "w-8 bg-accent shadow-[0_0_12px_var(--accent)]" : "w-2 bg-line-strong"}`}
            />
          ))}
        </div>
        <button type="button" onClick={() => go(1)} disabled={active === n - 1} aria-label="Next project" className="btn btn-ghost !px-3 disabled:opacity-30">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
