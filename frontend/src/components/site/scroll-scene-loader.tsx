"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useIdleReady } from "@/lib/use-idle";
import { hasWebGL } from "@/lib/webgl";

const ScrollScene = dynamic(() => import("./scroll-scene"), { ssr: false, loading: () => null });

/** Mounts the site-wide 3D backdrop after the page is idle, and only where WebGL works. */
export function ScrollSceneLoader() {
  const ready = useIdleReady();
  const [gl, setGl] = useState(false);
  useEffect(() => setGl(hasWebGL()), []);
  return ready && gl ? <ScrollScene /> : null;
}
