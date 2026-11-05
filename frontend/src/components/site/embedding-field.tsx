"use client";

import { useEffect, useRef, useState } from "react";
import type { SkillCategory } from "@/lib/types";

/**
 * The hero's one motion moment: every skill from the CMS is a point in a 2-D
 * "embedding space". Points start scattered and settle into one cluster per
 * skill category, the way a trained model groups related concepts.
 * Hover (or focus the list below) to read a point. Honors prefers-reduced-motion.
 */

type Pt = { x: number; y: number; sx: number; sy: number; tx: number; ty: number; c: number; name: string; phase: number };

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function gauss(r: () => number) {
  return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
}

export function EmbeddingField({ categories }: { categories: SkillCategory[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ name: string; cat: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || categories.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const r = rand(7);
    let W = 0;
    let H = 0;
    let pts: Pt[] = [];
    let centers: { x: number; y: number }[] = [];
    let colors = { accent: "#8ea2ff", data: "#57cdb8", muted: "#8b92a3", line: "#272b35", text: "#e6e8ee" };
    const mouse = { x: -1e4, y: -1e4 };
    const start = performance.now();
    const SETTLE = 2400;
    let raf = 0;
    let visible = true;

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      colors = {
        accent: cs.getPropertyValue("--accent").trim() || colors.accent,
        data: cs.getPropertyValue("--data").trim() || colors.data,
        muted: cs.getPropertyValue("--muted").trim() || colors.muted,
        line: cs.getPropertyValue("--line-strong").trim() || colors.line,
        text: cs.getPropertyValue("--text").trim() || colors.text,
      };
    };

    const layout = () => {
      const rect = wrap.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // cluster centres on a loose ellipse, jittered so it doesn't look like a clock face
      const k = categories.length;
      const rr = rand(11);
      centers = categories.map((_, i) => {
        const a = (i / k) * Math.PI * 2 - Math.PI / 2 + (rr() - 0.5) * 0.5;
        const rx = W * (0.33 + rr() * 0.05);
        const ry = H * (0.31 + rr() * 0.06);
        return { x: W / 2 + Math.cos(a) * rx, y: H / 2 + Math.sin(a) * ry };
      });
      const spread = Math.min(W, H) * 0.055;
      const old = pts;
      pts = [];
      categories.forEach((cat, ci) => {
        cat.skills.forEach((s, si) => {
          const prev = old.find((p) => p.name === s.name && p.c === ci);
          const tx = centers[ci].x + gauss(r) * spread;
          const ty = centers[ci].y + gauss(r) * spread;
          pts.push({
            sx: prev?.sx ?? W / 2 + gauss(r) * W * 0.28,
            sy: prev?.sy ?? H / 2 + gauss(r) * H * 0.28,
            x: prev?.x ?? 0,
            y: prev?.y ?? 0,
            tx,
            ty,
            c: ci,
            name: s.name,
            phase: si * 1.7 + ci,
          });
        });
      });
    };

    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const frame = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - start) / SETTLE);
      const e = ease(t);
      ctx.clearRect(0, 0, W, H);

      for (const p of pts) {
        const drift = reduce ? 0 : 1.6;
        p.x = p.sx + (p.tx - p.sx) * e + Math.sin(now / 2400 + p.phase) * drift * e;
        p.y = p.sy + (p.ty - p.sy) * e + Math.cos(now / 2900 + p.phase) * drift * e;
      }

      // soft halo per cluster so the grouping reads at a glance
      categories.forEach((_, ci) => {
        const members = pts.filter((p) => p.c === ci);
        if (!members.length) return;
        const cx = members.reduce((s, m) => s + m.x, 0) / members.length;
        const cy = members.reduce((s, m) => s + m.y, 0) / members.length;
        const rad = Math.max(28, Math.max(...members.map((m) => Math.hypot(m.x - cx, m.y - cy))) + 22);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, ci % 3 === 1 ? colors.data : colors.accent);
        g.addColorStop(1, "transparent");
        ctx.globalAlpha = 0.07 * e;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
      });

      // two nearest neighbours inside each cluster
      ctx.lineWidth = 1;
      ctx.strokeStyle = colors.line;
      ctx.globalAlpha = 0.2 + 0.5 * e;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const near = pts
          .map((b, j) => ({ j, d: j === i || b.c !== a.c ? Infinity : (b.x - a.x) ** 2 + (b.y - a.y) ** 2 }))
          .sort((x, y) => x.d - y.d)
          .slice(0, 2)
          .filter((n) => n.d < Infinity);
        for (const n of near) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(pts[n.j].x, pts[n.j].y);
          ctx.stroke();
        }
      }

      // points
      let nearest: Pt | null = null;
      let nearestD = 18 * 18;
      for (const p of pts) {
        const d = (p.x - mouse.x) ** 2 + (p.y - mouse.y) ** 2;
        if (d < nearestD) {
          nearestD = d;
          nearest = p;
        }
      }
      for (const p of pts) {
        const isHover = nearest === p;
        const hoverCluster = nearest && nearest.c === p.c;
        ctx.globalAlpha = isHover ? 1 : hoverCluster ? 0.95 : 0.4 + 0.45 * e;
        ctx.fillStyle = p.c % 3 === 1 ? colors.data : colors.accent;
        ctx.beginPath();
        ctx.arc(p.x, p.y, isHover ? 5.5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // cluster labels fade in once the space has settled
      const labelAlpha = Math.max(0, (t - 0.65) / 0.35);
      if (labelAlpha > 0) {
        ctx.font = "500 12px 'IBM Plex Sans', system-ui, sans-serif";
        ctx.textAlign = "center";
        const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
        categories.forEach((cat, ci) => {
          const members = pts.filter((p) => p.c === ci);
          if (!members.length) return;
          const minY = Math.min(...members.map((m) => m.y));
          const maxY = Math.max(...members.map((m) => m.y));
          const cx = members.reduce((s, m) => s + m.x, 0) / members.length;
          const label = cat.name.length > 24 ? cat.name.replace(/ & .*/, "") : cat.name;
          const w = ctx.measureText(label).width;
          const x = Math.min(W - w / 2 - 4, Math.max(w / 2 + 4, cx));
          const box = (y: number) => ({ x0: x - w / 2 - 4, x1: x + w / 2 + 4, y0: y - 12, y1: y + 4 });
          const hits = (b: ReturnType<typeof box>) => placed.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
          let y = Math.max(14, minY - 14);
          if (hits(box(y))) y = Math.min(H - 4, maxY + 22);
          placed.push(box(y));
          ctx.globalAlpha = labelAlpha * (nearest && nearest.c !== ci ? 0.35 : 0.9);
          ctx.fillStyle = colors.muted;
          ctx.fillText(label, x, y);
        });
      }
      ctx.globalAlpha = 1;

      if (nearest) {
        setHover((h) =>
          h?.name === nearest!.name ? h : { name: nearest!.name, cat: categories[nearest!.c].name, x: nearest!.x, y: nearest!.y },
        );
      } else {
        setHover((h) => (h ? null : h));
      }

      if (visible && (!reduce || t < 1)) raf = requestAnimationFrame(frame);
    };

    readColors();
    layout();
    raf = requestAnimationFrame(frame);

    const ro = new ResizeObserver(() => {
      layout();
      if (reduce) requestAnimationFrame(frame);
    });
    ro.observe(wrap);
    const mo = new MutationObserver(() => {
      readColors();
      if (reduce) requestAnimationFrame(frame);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const io = new IntersectionObserver(([entry]) => {
      const was = visible;
      visible = entry.isIntersecting;
      if (visible && !was && !reduce) raf = requestAnimationFrame(frame);
    });
    io.observe(wrap);

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      if (reduce) requestAnimationFrame(frame);
    };
    const onLeave = () => {
      mouse.x = -1e4;
      mouse.y = -1e4;
      if (reduce) requestAnimationFrame(frame);
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [categories]);

  const total = categories.reduce((n, c) => n + c.skills.length, 0);

  return (
    <figure className="relative">
      <div ref={wrapRef} className="relative h-[300px] w-full sm:h-[380px] lg:h-[460px]">
        <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair" aria-hidden="true" />
        {hover && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-[var(--shadow)]"
            style={{ left: hover.x, top: hover.y }}
          >
            <span className="font-medium text-text">{hover.name}</span>
            <span className="block text-faint">{hover.cat}</span>
          </div>
        )}
      </div>
      <figcaption className="mt-3 text-sm text-faint">
        {total} skills from this portfolio, clustered by area. Point at one to read it.
      </figcaption>
      <ul className="sr-only">
        {categories.map((c) => (
          <li key={c.id}>
            {c.name}: {c.skills.map((s) => s.name).join(", ")}
          </li>
        ))}
      </ul>
    </figure>
  );
}
