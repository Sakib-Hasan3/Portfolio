import type { Metadata } from "next";
import type { Portfolio } from "@/lib/types";
import { absoluteMedia, siteUrl } from "@/lib/api/server";

export function baseMetadata(data: Portfolio | null, overrides: { title?: string; description?: string; path?: string; image?: string | null } = {}): Metadata {
  const s = data?.settings;
  const base = siteUrl(s?.site_url);
  const title = overrides.title || s?.site_title || data?.profile?.full_name || "Portfolio";
  const description = overrides.description || s?.site_description || data?.profile?.hero_description || "";
  const image = absoluteMedia(overrides.image || s?.og_image_url, base);
  const url = `${base}${overrides.path ?? "/"}`;
  return {
    metadataBase: new URL(base),
    title,
    description,
    keywords: s?.keywords,
    authors: data?.profile ? [{ name: data.profile.full_name, url: base }] : undefined,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: s?.site_title || data?.profile?.full_name,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: { card: "summary_large_image", title, description, ...(image ? { images: [image] } : {}) },
    robots: { index: true, follow: true },
  };
}

export function personJsonLd(data: Portfolio) {
  const p = data.profile;
  if (!p) return null;
  const base = siteUrl(data.settings?.site_url);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${base}/#person`,
        name: p.full_name,
        jobTitle: p.title,
        description: p.hero_description,
        url: base,
        image: absoluteMedia(p.avatar_url, base),
        email: p.email ? `mailto:${p.email}` : undefined,
        address: p.location ? { "@type": "PostalAddress", addressLocality: p.location } : undefined,
        knowsAbout: data.skills.flatMap((c) => c.skills.map((s) => s.name)).slice(0, 40),
        alumniOf: data.education.map((e) => ({ "@type": "CollegeOrUniversity", name: e.institution })),
        sameAs: data.social_links.filter((l) => l.url.startsWith("http")).map((l) => l.url),
      },
      ...data.publications.map((pub) => ({
        "@type": "ScholarlyArticle",
        headline: pub.title,
        datePublished: String(pub.year),
        author: { "@id": `${base}/#person` },
        publisher: { "@type": "Organization", name: pub.venue },
        sameAs: pub.doi_url ?? undefined,
        abstract: pub.abstract ?? undefined,
      })),
    ],
  };
}

/** Safe JSON for <script type="application/ld+json"> — escapes "<" so content can't close the tag. */
export function jsonLdString(obj: unknown) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}
