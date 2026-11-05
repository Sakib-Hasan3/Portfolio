"use client";

import { MotionConfig, motion, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import type { Publication } from "@/lib/types";

/**
 * The paper as a physical object: a short stack of pages in 3-D that turns
 * toward the pointer. The top sheet is typeset from the CMS record.
 */
export function PaperStack({ pub, author }: { pub: Publication; author?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const onMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${-16 + x * 18}deg`);
    el.style.setProperty("--rx", `${8 - y * 12}deg`);
  };
  const reset = () => {
    ref.current?.style.setProperty("--ry", "-16deg");
    ref.current?.style.setProperty("--rx", "8deg");
  };

  const lines = (pub.abstract || pub.highlights.join(" ")).split(" ");

  return (
    <MotionConfig reducedMotion="user">
    <div className="flex justify-center py-6 [perspective:1400px]" onPointerMove={onMove} onPointerLeave={reset}>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, rotateY: -50, rotateX: 22, y: 30 }}
        animate={{ opacity: 1, rotateY: 0, rotateX: 0, y: 0 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        className="relative aspect-[1/1.32] w-[min(19rem,72vw)] [transform-style:preserve-3d]"
        style={{ ["--ry" as string]: "-16deg", ["--rx" as string]: "8deg" }}
        aria-hidden
      >
        <div className="absolute inset-0 transition-transform duration-500 ease-out [transform-style:preserve-3d] [transform:rotateY(var(--ry))_rotateX(var(--rx))]">
          {/* pages underneath */}
          {[3, 2, 1].map((i) => (
            <div
              key={i}
              className="absolute inset-0 rounded-[6px] border border-black/10 bg-[#e9ebf0] shadow-sm"
              style={{ transform: `translateZ(${-i * 14}px) translate(${i * 3}px, ${i * 4}px)`, filter: `brightness(${1 - i * 0.06})` }}
            />
          ))}
          {/* cover sheet */}
          <div
            className="absolute inset-0 overflow-hidden rounded-[6px] border border-black/10 bg-[#fbfbfc] p-[8%] text-[#1d2130] shadow-[0_30px_60px_-25px_rgba(0,0,0,0.55)]"
            style={{ transform: "translateZ(0)" }}
          >
            <p className="text-[0.55rem] text-[#5b6273]">{pub.venue}</p>
            <p className="mt-3 font-display text-[0.95rem] font-semibold leading-tight">{pub.title}</p>
            <p className="mt-2 text-[0.55rem] text-[#5b6273]">
              {pub.authors || author}
              {pub.author_position ? ` (${pub.author_position.toLowerCase()})` : ""}
            </p>
            <div className="mt-4 h-px bg-[#dde1e8]" />
            <p className="mt-3 text-[0.5rem] font-semibold">Abstract</p>
            <p className="mt-1 text-justify text-[0.45rem] leading-[1.55] text-[#3b4150]">{lines.slice(0, 70).join(" ")}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[0, 1].map((c) => (
                <div key={c} className="space-y-[5px]">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div key={i} className="h-[3px] rounded-full bg-[#e3e6ec]" style={{ width: `${70 + ((i * 37 + c * 13) % 30)}%` }} />
                  ))}
                </div>
              ))}
            </div>
            {pub.doi && <p className="absolute inset-x-[8%] bottom-[5%] truncate text-[0.45rem] text-[#8a91a1]">doi:{pub.doi}</p>}
          </div>
        </div>
      </motion.div>
    </div>
    </MotionConfig>
  );
}
