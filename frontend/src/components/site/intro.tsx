"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/** Short first-visit intro: spinning 3D cube, name reveal, then the curtain lifts. Skipped for reduced motion and repeat visits. */
export function Intro({ name }: { name: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || sessionStorage.getItem("intro-seen")) return;
    } catch {
      return;
    }
    setShow(true);
  }, []);
  useEffect(() => {
    if (!show) return;
    try {
      sessionStorage.setItem("intro-seen", "1");
    } catch {}
    const t = setTimeout(() => setShow(false), 2000);
    return () => clearTimeout(t);
  }, [show]);

  const faces = ["rotateY(0deg)", "rotateY(90deg)", "rotateY(180deg)", "rotateY(-90deg)", "rotateX(90deg)", "rotateX(-90deg)"];
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          aria-hidden
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-10 bg-bg"
          exit={{ clipPath: "inset(0 0 100% 0)", transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } }}
          initial={{ clipPath: "inset(0 0 0% 0)" }}
        >
          <div style={{ perspective: 600 }}>
            <motion.div
              className="relative size-20"
              style={{ transformStyle: "preserve-3d" }}
              initial={{ rotateX: -20, rotateY: 0, scale: 0.4 }}
              animate={{ rotateX: 340, rotateY: 540, scale: 1 }}
              transition={{ duration: 1.9, ease: [0.22, 1, 0.36, 1] }}
            >
              {faces.map((f) => (
                <span
                  key={f}
                  className="absolute inset-0 rounded-md border border-accent/70 bg-accent/10 shadow-[0_0_24px_var(--accent)]"
                  style={{ transform: `${f} translateZ(2.5rem)` }}
                />
              ))}
            </motion.div>
          </div>
          <motion.p
            className="grad-text font-display text-3xl font-semibold tracking-tight md:text-5xl"
            initial={{ opacity: 0, y: 20, letterSpacing: "0.3em" }}
            animate={{ opacity: 1, y: 0, letterSpacing: "-0.02em" }}
            transition={{ duration: 1.1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {name}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
