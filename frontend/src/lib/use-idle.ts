"use client";

import { useEffect, useState } from "react";

/**
 * True once the browser has finished the initial load and is idle (or after `max` ms).
 * Used to start heavy, decorative work (WebGL) only after the text content has painted and become interactive.
 */
export function useIdleReady(max = 1800): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let done = false;
    const go = () => {
      if (!done) {
        done = true;
        setReady(true);
      }
    };
    const idle = () => {
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o: { timeout: number }) => number }).requestIdleCallback;
      if (ric) ric(go, { timeout: max });
      else setTimeout(go, 400);
    };
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
    const t = setTimeout(go, max + 1200);
    return () => {
      done = true;
      clearTimeout(t);
      window.removeEventListener("load", idle);
    };
  }, [max]);
  return ready;
}
