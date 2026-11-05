"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * The project's main image, presented like a screen leaning back on a desk;
 * it straightens up as you scroll it into view.
 */
export function ProjectStage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  // The server can't know the preference; match its render first, then apply it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const reduce = mounted && prefersReduced;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [40, 0]);

  return (
    <div ref={ref} className="mt-12 [perspective:1600px]">
      <motion.div
        style={reduce ? undefined : { rotateX, scale, y, transformOrigin: "50% 100%" }}
        className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_40px_80px_-40px_rgba(0,0,0,0.6)]"
      >
        <img src={src} alt={alt} className="aspect-[16/8] w-full object-cover" />
      </motion.div>
    </div>
  );
}
