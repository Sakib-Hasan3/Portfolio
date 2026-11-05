"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Perspective entrance: content swings up out of the page plane as it scrolls into view.
 * Renders flat for reduced-motion users (and on the server, so there is no hydration mismatch).
 */
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const prefersReduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || prefersReduced) return <div className={className}>{children}</div>;
  return (
    <div className={className} style={{ perspective: 1400 }}>
      <motion.div
        initial={{ opacity: 0, y: 48, rotateX: 10, scale: 0.985 }}
        whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
        viewport={{ once: true, margin: "0px 0px -12% 0px" }}
        transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: "50% 100%" }}
      >
        {children}
      </motion.div>
    </div>
  );
}
