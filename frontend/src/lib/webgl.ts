/** True when the browser can create a WebGL context (it can be disabled, blocked or unavailable in some environments). */
export function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
