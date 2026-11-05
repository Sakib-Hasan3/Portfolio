"use client";

import { MotionConfig, motion } from "framer-motion";

/**
 * Each navigation lifts the new page in from slightly behind the screen.
 * MotionConfig drops the movement (keeping only the fade) for people who ask for reduced motion.
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="[perspective:1600px]">
        <motion.div
          initial={{ opacity: 0, y: 18, rotateX: 4, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: "50% 0%" }}
        >
          {children}
        </motion.div>
      </div>
    </MotionConfig>
  );
}
