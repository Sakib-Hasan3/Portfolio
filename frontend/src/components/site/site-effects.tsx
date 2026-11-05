"use client";

import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";

/** Hue (degrees) for a pointer position: indigo on the left, through teal, to amber on the right; shifts warmer toward the bottom. */
export function hueAt(nx: number, ny: number): number {
  const x = Math.min(1, Math.max(0, nx));
  const base = x < 0.5 ? 238 - (238 - 170) * (x / 0.5) : 170 - (170 - 42) * ((x - 0.5) / 0.5);
  return base - ny * 18;
}

/**
 * Soft coloured light that trails the pointer behind the whole page (two layers, different lag, for depth).
 * Colour changes with where the pointer is. Touch devices and "reduce motion" get a still, gentle glow.
 */
export function CursorGlow() {
  const near = useRef<HTMLDivElement>(null);
  const far = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const a = near.current;
    const b = far.current;
    if (!a || !b) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const setHue = (h: number) => {
      a.style.setProperty("--h", String(Math.round(h)));
      b.style.setProperty("--h", String(Math.round(h + 38)));
      document.documentElement.style.setProperty("--glow-h", String(Math.round(h)));
    };
    const place = (el: HTMLElement, x: number, y: number, size: number) => {
      el.style.transform = `translate3d(${x - size / 2}px, ${y - size / 2}px, 0)`;
    };
    const start = { x: window.innerWidth * 0.7, y: window.innerHeight * 0.25 };
    setHue(hueAt(start.x / window.innerWidth, start.y / window.innerHeight));
    place(a, start.x, start.y, 640);
    place(b, start.x, start.y, 1100);
    if (reduce || !fine) return;

    const target = { ...start };
    const p1 = { ...start };
    const p2 = { ...start };
    let raf = 0;
    const tick = () => {
      p1.x += (target.x - p1.x) * 0.14;
      p1.y += (target.y - p1.y) * 0.14;
      p2.x += (target.x - p2.x) * 0.045;
      p2.y += (target.y - p2.y) * 0.045;
      place(a, p1.x, p1.y, 640);
      place(b, p2.x, p2.y, 1100);
      raf = Math.abs(target.x - p2.x) + Math.abs(target.y - p2.y) > 0.6 ? requestAnimationFrame(tick) : 0;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      target.x = e.clientX;
      target.y = e.clientY;
      setHue(hueAt(e.clientX / window.innerWidth, e.clientY / window.innerHeight));
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduce]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div ref={far} className="cursor-blob cursor-blob-far" />
      <div ref={near} className="cursor-blob cursor-blob-near" />
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
