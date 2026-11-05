import { getNote, getPortfolioSafe } from "@/lib/api/server";
import { OG_SIZE, ogCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Note preview";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [data, note] = await Promise.all([getPortfolioSafe(), getNote(slug).catch(() => null)]);
  return ogCard({
    eyebrow: "Note",
    title: note?.title ?? "Note",
    subtitle: note?.summary,
    chips: note?.tags ?? [],
    footer: data?.profile?.full_name,
  });
}
