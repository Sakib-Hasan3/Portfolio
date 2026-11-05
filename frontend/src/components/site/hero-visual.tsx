"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { SkillCategory } from "@/lib/types";
import { useIdleReady } from "@/lib/use-idle";
import { hasWebGL } from "@/lib/webgl";
import { EmbeddingField } from "./embedding-field";

// three.js is loaded only in the browser and only for the hero, so it stays out of every other page's bundle.
const SkillGalaxy = dynamic(() => import("./skill-galaxy"), {
  ssr: false,
  loading: () => <div className="h-[260px] w-full sm:h-[420px] lg:h-[520px]" aria-hidden />,
});

/** 3-D scene when WebGL is available; the 2-D version otherwise. */
export function HeroVisual({ categories }: { categories: SkillCategory[] }) {
  const [mode, setMode] = useState<"pending" | "3d" | "2d">("pending");
  const ready = useIdleReady();
  useEffect(() => {
    if (ready) setMode(hasWebGL() ? "3d" : "2d");
  }, [ready]);
  if (mode === "pending") return <div className="h-[260px] w-full sm:h-[420px] lg:h-[520px]" aria-hidden />;
  return mode === "3d" ? <SkillGalaxy categories={categories} /> : <EmbeddingField categories={categories} />;
}
