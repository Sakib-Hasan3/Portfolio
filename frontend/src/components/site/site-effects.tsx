"use client";

import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";

/** Static film grain behind the page. (The pointer-following colour glow was removed on purpose.) */
export function CursorGlow() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="site-grain" />
    </div>
  );
}

/** Thin gradient bar showing reading progress. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const x = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 });
  return (
    <motion.div
      aria-hidden
      style={{ scaleX: x }}
      className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-gradient-to-r from-[hsl(238_85%_68%)] via-[hsl(170_70%_55%)] to-[hsl(42_90%_60%)]"
    />
  );
}

/**
 * Custom cursor: a small dot plus a trailing ring that grows over links and buttons.
 * Buttons ( .btn ) also lean toward the pointer. Mouse only; hidden on touch and for reduced motion.
 */
export function MagneticCursor() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const r = ring.current;
    const d = dot.current;
    if (!r || !d || reduce || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    document.documentElement.classList.add("has-cursor");
    const target = { x: -100, y: -100 };
    const pos = { x: -100, y: -100 };
    let raf = 0;
    let hot = false;
    let mag: HTMLElement | null = null;
    const draw = () => {
      pos.x += (target.x - pos.x) * 0.2;
      pos.y += (target.y - pos.y) * 0.2;
      r.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%) scale(${hot ? 1.9 : 1})`;
      raf = requestAnimationFrame(draw);
    };
    const reset = () => {
      if (mag) { mag.style.transform = ""; mag = null; }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      target.x = e.clientX;
      target.y = e.clientY;
      d.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      const el = (e.target as HTMLElement | null)?.closest?.("a, button, [role=button], .btn") as HTMLElement | null;
      hot = !!el;
      r.dataset.hot = hot ? "1" : "0";
      const m = el?.classList.contains("btn") ? el : null;
      if (m !== mag) reset();
      if (m) {
        mag = m;
        const b = m.getBoundingClientRect();
        const dx = (e.clientX - (b.left + b.width / 2)) * 0.25;
        const dy = (e.clientY - (b.top + b.height / 2)) * 0.35;
        m.style.transform = `translate(${dx}px, ${dy}px)`;
      }
    };
    raf = requestAnimationFrame(draw);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", reset);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", reset);
      reset();
      document.documentElement.classList.remove("has-cursor");
    };
  }, [reduce]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[90]">
      <div ref={ring} className="cursor-ring" />
      <div ref={dot} className="cursor-dot" />
    </div>
  );
}
