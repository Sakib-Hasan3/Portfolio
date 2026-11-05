import type { Metadata } from "next";
import { Hero } from "@/components/site/hero";
import { HomeClient } from "@/components/site/home-client";
import { ContentUnavailable } from "@/components/site/states";
import { getPortfolioSafe } from "@/lib/api/server";
import { baseMetadata, jsonLdString, personJsonLd } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPortfolioSafe();
  return baseMetadata(data, { image: data?.settings?.og_image_url || undefined });
}

export default async function HomePage() {
  const data = await getPortfolioSafe();
  if (!data || !data.profile) return <ContentUnavailable />;
  const ld = personJsonLd(data);

  return (
    <>
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(ld) }} />}
      <Hero data={data} />
      <HomeClient data={data} />
    </>
  );
}
