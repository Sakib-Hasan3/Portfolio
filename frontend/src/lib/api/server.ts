import "server-only";
import { unstable_cache } from "next/cache";
import type { Portfolio, Project, Publication } from "@/lib/types";

/** Base URL the Next.js server uses to reach FastAPI (internal network address in Docker). */
export const API_INTERNAL_URL = (process.env.API_INTERNAL_URL || "http://localhost:8000").replace(/\/$/, "");
const FALLBACK_REVALIDATE = Number(process.env.CONTENT_REVALIDATE_SECONDS || 3600);

export class NotFoundError extends Error {}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_INTERNAL_URL}/api/v1${path}`, {
    headers: { accept: "application/json" },
    cache: "no-store", // caching is handled by unstable_cache below, keyed by tags
  });
  if (res.status === 404) throw new NotFoundError(path);
  if (!res.ok) throw new Error(`API ${path} responded ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Every public read is cached and tagged. When content changes in the admin
 * dashboard, FastAPI calls /api/revalidate which invalidates these tags, so the
 * next request renders fresh data — no redeploy needed.
 */
export const getPortfolio = unstable_cache(() => getJSON<Portfolio>("/public/portfolio"), ["portfolio-bundle"], {
  tags: ["portfolio"],
  revalidate: FALLBACK_REVALIDATE,
});

export const getProject = (slug: string) =>
  unstable_cache(() => getJSON<Project>(`/public/projects/${encodeURIComponent(slug)}`), ["project", slug], {
    tags: ["portfolio", "projects"],
    revalidate: FALLBACK_REVALIDATE,
  })();

export const getPublication = (slug: string) =>
  unstable_cache(() => getJSON<Publication>(`/public/publications/${encodeURIComponent(slug)}`), ["publication", slug], {
    tags: ["portfolio", "publications"],
    revalidate: FALLBACK_REVALIDATE,
  })();

export const getPublications = unstable_cache(() => getJSON<Publication[]>("/public/publications"), ["publications"], {
  tags: ["portfolio", "publications"],
  revalidate: FALLBACK_REVALIDATE,
});

export const getSitemapData = unstable_cache(
  () =>
    getJSON<{ projects: { slug: string; updated_at: string }[]; publications?: { slug: string; updated_at: string }[] }>(
      "/public/sitemap",
    ),
  ["sitemap"],
  { tags: ["portfolio", "projects", "publications"], revalidate: FALLBACK_REVALIDATE },
);

export async function getPortfolioSafe(): Promise<Portfolio | null> {
  try {
    return await getPortfolio();
  } catch (err) {
    console.error("[portfolio] failed to load content", err);
    return null;
  }
}

export function siteUrl(settingsUrl?: string | null): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || settingsUrl || "http://localhost:3000").replace(/\/$/, "");
}

/** Media from the local storage backend is relative (/uploads/...); make it absolute for OG tags. */
export function absoluteMedia(url: string | null | undefined, base: string): string | undefined {
  if (!url) return undefined;
  return url.startsWith("http") ? url : `${base}${url}`;
}
