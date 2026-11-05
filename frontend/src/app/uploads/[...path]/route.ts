import type { NextRequest } from "next/server";
import { proxy } from "@/lib/api/proxy";

// Serves media stored by the API's local storage backend. With Cloudinary, URLs are absolute and this is unused.
export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const res = await proxy(req, `/uploads/${path.map(encodeURIComponent).join("/")}`);
  if (res.ok) res.headers.set("cache-control", "public, max-age=31536000, immutable");
  // framing/CSP policy for media is set in next.config.ts (same-origin embedding allowed)
  res.headers.delete("x-frame-options");
  res.headers.delete("content-security-policy");
  return res;
}
