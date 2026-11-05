import type { MetadataRoute } from "next";
import { getSitemapData, siteUrl } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/projects`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/notes`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/research`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
  ];
  try {
    const { projects, publications = [], notes = [] } = await getSitemapData();
    for (const n of notes) {
      pages.push({ url: `${base}/notes/${n.slug}`, lastModified: new Date(n.updated_at), changeFrequency: "monthly", priority: 0.6 });
    }
    for (const p of publications) {
      pages.push({ url: `${base}/research/${p.slug}`, lastModified: new Date(p.updated_at), changeFrequency: "yearly", priority: 0.7 });
    }
    for (const p of projects) {
      pages.push({ url: `${base}/projects/${p.slug}`, lastModified: new Date(p.updated_at), changeFrequency: "monthly", priority: 0.6 });
    }
  } catch {
    /* API down: still serve the static entries */
  }
  return pages;
}
