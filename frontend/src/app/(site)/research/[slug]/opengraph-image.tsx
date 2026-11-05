import { getPortfolioSafe, getPublication } from "@/lib/api/server";
import { OG_SIZE, ogCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Publication preview";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [data, pub] = await Promise.all([getPortfolioSafe(), getPublication(slug).catch(() => null)]);
  return ogCard({
    eyebrow: pub ? `${pub.publication_type} · ${pub.year}` : "Publication",
    title: pub?.title ?? "Publication",
    subtitle: pub?.venue,
    chips: pub?.tags ?? [],
    footer: data?.profile?.full_name,
  });
}
